/**
 * scripts/reconcile-brands.ts
 *
 * DEMO-ONLY TOOLING — READ-ONLY brand reconciliation. Analysis, no writes.
 *
 * Compares the brand list Rebi *believes* the dealer stocks (parsed from the
 * "BRANDS / FRANCHISES WE STOCK" block in src/chatbot/knowledge.ts) against the
 * makes ACTUALLY present in inventory. Inventory makes are sourced from the demo
 * manifest `scripts/data/bundaberg-40.json`; if a Sanity token is present it
 * additionally reads the live automotive listings and folds those makes in,
 * FAILING OPEN to the json file when no token / no network is available.
 *
 * Output is a reconciliation DIFF only:
 *   - claimed-but-absent   — brands Rebi names but no matching make in inventory
 *   - present-but-unclaimed — makes in inventory Rebi never names
 *   - a recommended aligned brand list for the owner to consider
 *
 * There is intentionally NO `--commit` path: `knowledge.ts` is a SOURCE FILE the
 * owner edits by hand, not a Sanity document. This script only reports the diff
 * the owner acts on.
 *
 * Determinism: matching is exact on a normalised (lowercased, punctuation- and
 * franchise-suffix-trimmed) key. Anything that only *nearly* matches (e.g.
 * "Isuzu UTE" vs "Isuzu") is NEVER silently merged — it is reported as a WARN so
 * a human decides.
 *
 * Usage:
 *   tsx scripts/reconcile-brands.ts            # dry-run diff (default, read-only)
 *   tsx scripts/reconcile-brands.ts --json     # machine-readable JSON
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { BUSINESS_KNOWLEDGE } from '../src/chatbot/knowledge';

const asJson = process.argv.includes('--json');

// --- Normalisation -----------------------------------------------------------
// A brand "key" for comparison: lowercase, collapse whitespace, drop punctuation
// and known franchise-descriptor suffix words. This is deliberately conservative
// — it only strips words that are unambiguously NOT part of the make name.
const FRANCHISE_SUFFIXES = new Set(['ute', 'utes', 'trucks', 'commercial']);

function normaliseKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !FRANCHISE_SUFFIXES.has(w))
    .join(' ')
    .trim();
}

// --- Sources -----------------------------------------------------------------

/** Parse the bullet list under "BRANDS / FRANCHISES WE STOCK" in knowledge.ts. */
function parseClaimedBrands(): string[] {
  const lines = BUSINESS_KNOWLEDGE.split('\n');
  const start = lines.findIndex((l) => /BRANDS\s*\/\s*FRANCHISES/i.test(l));
  if (start === -1) return [];
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#')) break; // next section
    const m = line.match(/^-\s+(.*\S)\s*$/);
    if (m) out.push(m[1].trim());
  }
  return out;
}

interface ManifestVehicle {
  make?: string;
  label?: string;
}

/** Makes present in the committed demo manifest (always available, offline). */
function parseManifestMakes(): string[] {
  const url = new URL('./data/bundaberg-40.json', import.meta.url);
  const data = JSON.parse(readFileSync(url, 'utf8')) as {
    vehicles?: ManifestVehicle[];
  };
  const makes = (data.vehicles ?? [])
    .map((v) => v.make?.trim())
    .filter((m): m is string => Boolean(m));
  return makes;
}

/**
 * Optionally read live automotive makes from Sanity. FAILS OPEN (returns []) when
 * no token / no network — never throws, never blocks the offline path.
 */
async function readSanityMakes(): Promise<{ makes: string[]; source: string }> {
  const projectId = process.env.PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.PUBLIC_SANITY_DATASET;
  const token = process.env.SANITY_TOKEN;
  if (!projectId || !dataset || !token) {
    return { makes: [], source: 'skipped (no Sanity token — manifest only)' };
  }
  try {
    const { createClient } = await import('@sanity/client');
    const client = createClient({
      projectId,
      dataset,
      apiVersion: process.env.PUBLIC_SANITY_API_VERSION ?? '2024-01-01',
      token,
      useCdn: false,
    });
    // `make` is not a first-class field; derive it from the vehicleSpecs-agnostic
    // title's leading "<year> <make> …" is unreliable, so we read an explicit
    // `make` detail if present. Fail open on any error.
    const makes = await client.fetch<string[]>(
      `*[_type == "listing" && category == "automotive"].details[label match "Make"][0].value`,
    );
    const clean = (makes ?? []).filter((m): m is string => Boolean(m));
    return { makes: clean, source: `Sanity (${clean.length} live make value(s))` };
  } catch (err) {
    return {
      makes: [],
      source: `Sanity read failed, using manifest only (${(err as Error).message})`,
    };
  }
}

// --- Reconciliation ----------------------------------------------------------

interface NamedKey {
  display: string; // first-seen display form
  key: string;
}

/** Dedupe a raw name list by normalised key, keeping first display form. */
function dedupeByKey(names: string[]): NamedKey[] {
  const seen = new Map<string, string>();
  for (const n of names) {
    const key = normaliseKey(n);
    if (!key) continue;
    if (!seen.has(key)) seen.set(key, n.trim());
  }
  return [...seen.entries()].map(([key, display]) => ({ key, display }));
}

interface Reconciliation {
  claimed: NamedKey[];
  present: NamedKey[];
  matched: string[]; // display forms present in both
  claimedAbsent: string[]; // claimed, no exact key in inventory
  presentUnclaimed: string[]; // inventory, no exact key in claimed list
  warnings: string[]; // near-matches / ambiguity
  recommended: string[];
}

function reconcile(claimedRaw: string[], presentRaw: string[]): Reconciliation {
  const claimed = dedupeByKey(claimedRaw).sort((a, b) => a.display.localeCompare(b.display));
  const present = dedupeByKey(presentRaw).sort((a, b) => a.display.localeCompare(b.display));

  const claimedKeys = new Set(claimed.map((c) => c.key));
  const presentKeys = new Set(present.map((p) => p.key));

  const matched = claimed
    .filter((c) => presentKeys.has(c.key))
    .map((c) => c.display);
  const claimedAbsent = claimed
    .filter((c) => !presentKeys.has(c.key))
    .map((c) => c.display);
  const presentUnclaimed = present
    .filter((p) => !claimedKeys.has(p.key))
    .map((p) => p.display);

  // WARN on NEAR-matches between the two "unmatched" piles — one key being a
  // token-prefix of the other. Reported, never auto-merged (determinism rule).
  const warnings: string[] = [];
  for (const c of claimed.filter((x) => !presentKeys.has(x.key))) {
    for (const p of present.filter((x) => !claimedKeys.has(x.key))) {
      const a = c.key;
      const b = p.key;
      const near =
        a !== b &&
        (a.startsWith(b + ' ') ||
          b.startsWith(a + ' ') ||
          a.split(' ')[0] === b.split(' ')[0]);
      if (near) {
        warnings.push(
          `Near-match (NOT merged): claimed "${c.display}" ~ inventory "${p.display}". ` +
            `Confirm whether these are the same franchise before treating either as absent/unclaimed.`,
        );
      }
    }
  }

  // Recommended aligned list = every make CONFIDENTLY present in inventory
  // (these are demonstrably in stock), in display form. Claimed-absent
  // franchises (e.g. Jeep/Leapmotor) are intentionally NOT auto-added or
  // auto-dropped — that is an owner business decision, surfaced in the diff.
  const recommended = present.map((p) => p.display).sort((a, b) => a.localeCompare(b));

  return {
    claimed,
    present,
    matched,
    claimedAbsent,
    presentUnclaimed,
    warnings,
    recommended,
  };
}

// --- Output ------------------------------------------------------------------

async function main(): Promise<void> {
  const claimedRaw = parseClaimedBrands();
  const manifestMakes = parseManifestMakes();
  const sanity = await readSanityMakes();
  const presentRaw = [...manifestMakes, ...sanity.makes];

  const r = reconcile(claimedRaw, presentRaw);

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          inventorySource: sanity.source,
          claimed: r.claimed.map((c) => c.display),
          present: r.present.map((p) => p.display),
          matched: r.matched,
          claimedAbsent: r.claimedAbsent,
          presentUnclaimed: r.presentUnclaimed,
          warnings: r.warnings,
          recommended: r.recommended,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log('Brand reconciliation — READ-ONLY analysis (no writes, no --commit)\n');
  console.log(`Claimed brands source : src/chatbot/knowledge.ts (owner-edited SOURCE FILE, not a Sanity doc)`);
  console.log(`Inventory makes source: scripts/data/bundaberg-40.json + ${sanity.source}\n`);

  console.log(`Rebi claims (${r.claimed.length}): ${r.claimed.map((c) => c.display).join(', ')}`);
  console.log(`In inventory (${r.present.length}): ${r.present.map((p) => p.display).join(', ')}\n`);

  console.log(`✓ Matched (claimed AND in inventory) — ${r.matched.length}:`);
  console.log(`    ${r.matched.join(', ') || '(none)'}\n`);

  console.log(`✗ Claimed but ABSENT from inventory — ${r.claimedAbsent.length}:`);
  console.log(`    ${r.claimedAbsent.join(', ') || '(none)'}`);
  console.log('    → Franchises with no matching make in the current sample. Owner: keep');
  console.log('      (genuine franchise, just no demo/used stock) or drop from knowledge.ts.\n');

  console.log(`+ Present but UNCLAIMED by Rebi — ${r.presentUnclaimed.length}:`);
  console.log(`    ${r.presentUnclaimed.join(', ') || '(none)'}`);
  console.log('    → Makes in stock Rebi never names (often used/trade-in stock, not');
  console.log('      franchises). Owner: add to knowledge.ts if Rebi should mention them.\n');

  if (r.warnings.length) {
    console.log('WARN (ambiguous — human decides, never auto-resolved):');
    for (const w of r.warnings) console.log(`    - ${w}`);
    console.log('');
  }

  console.log('Recommended aligned brand list (makes confidently in inventory):');
  console.log(`    ${r.recommended.join(', ')}`);
  console.log(
    '    NOTE: this is a starting point. Claimed-absent franchises above may be',
  );
  console.log(
    '    legitimately represented with no current stock — do not blindly replace',
  );
  console.log('    the knowledge.ts list; reconcile it by hand from this diff.\n');

  console.log('No writes performed. Edit src/chatbot/knowledge.ts by hand to act on this diff.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
