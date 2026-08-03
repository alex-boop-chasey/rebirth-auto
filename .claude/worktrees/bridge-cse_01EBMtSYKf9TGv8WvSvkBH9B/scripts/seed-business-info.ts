/**
 * scripts/seed-business-info.ts
 *
 * DEMO-ONLY TOOLING — seeds the single `businessInfo` Sanity document (the
 * dealer-editable chatbot knowledge base) from the placeholder facts currently
 * baked into src/chatbot/knowledge.ts, as a STARTING POINT the owner then edits
 * in Studio.
 *
 * ⚠️ DRY-RUN BY DEFAULT. Without `--commit` it only PRINTS the document it would
 * upsert plus WARN lines for every field it cannot fill confidently; it makes NO
 * network call and NO write. The placeholder identifying facts (name, phone,
 * address, email) are FICTIONAL DEMO VALUES — the owner MUST review and replace
 * them with the dealer's real facts before ever running `--commit`.
 *
 * `--commit` (owner-gated; not run by tooling) upserts the one document by its
 * explicit id `businessInfo-current` via `createOrReplace`, so it targets a
 * single known id and never a broad query match.
 *
 * Usage:
 *   tsx scripts/seed-business-info.ts            # dry-run (default) — prints doc + WARNs
 *   tsx scripts/seed-business-info.ts --commit   # owner-gated upsert (needs Editor SANITY_TOKEN)
 *
 * Requires a write-enabled SANITY_TOKEN in .env for --commit only.
 */
import 'dotenv/config';
import { BUSINESS_KNOWLEDGE } from '../src/chatbot/knowledge';

/** Stable, explicit id for the single current-dealer businessInfo document. */
const DOC_ID = 'businessInfo-current';

const commit = process.argv.includes('--commit');
const warnings: string[] = [];
const warn = (m: string) => warnings.push(m);

// --- Confident parsers (leave blank + WARN when not confidently matched) ------

const K = BUSINESS_KNOWLEDGE;

/** First labelled contact line, e.g. `- Phone: (07) ...`. */
function contactLine(label: string): string | undefined {
  const m = K.match(new RegExp(`^-\\s*${label}:\\s*(.+)$`, 'im'));
  return m?.[1].trim();
}

/** Dealer display name from the "<Name> is a ... dealership" opener. */
function parseName(): string | undefined {
  const m = K.match(/^([A-Z][\w'&.-]*(?: [A-Z][\w'&.-]*)*) is a\b/m);
  return m?.[1].trim();
}

/** Bullet list under a "# <HEADING>" up to the next "#" heading. */
function bulletsUnder(headingRe: RegExp): string[] {
  const lines = K.split('\n');
  const start = lines.findIndex((l) => l.startsWith('#') && headingRe.test(l));
  if (start === -1) return [];
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('#')) break;
    const m = lines[i].trim().match(/^-\s+(.*\S)\s*$/);
    if (m) out.push(m[1].trim());
  }
  return out;
}

interface HoursRow {
  _type: 'hoursRow';
  _key: string;
  day: string;
  hours: string;
}

/**
 * Opening-hours rows, tagged with the nearest preceding department label so the
 * two department blocks (Sales vs Service/Parts) don't collapse ambiguously.
 * `_key` is derived from the row content (index + day) — deterministic, no RNG.
 */
function parseOpeningHours(): HoursRow[] {
  const lines = K.split('\n');
  const start = lines.findIndex((l) => l.startsWith('#') && /OPENING HOURS/i.test(l));
  if (start === -1) return [];
  const rows: HoursRow[] = [];
  let dept = '';
  let idx = 0;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (lines[i].startsWith('#')) break;
    const deptM = line.match(/^(.+?):\s*$/); // "Sales department:" style label
    if (deptM && !line.startsWith('-')) {
      dept = deptM[1].replace(/\s+departments?$/i, '').trim();
      continue;
    }
    const rowM = line.match(/^-\s*(.+?):\s*(.+)$/); // "- Mon to Fri: 8–5:30"
    if (rowM) {
      const dayLabel = dept ? `${dept} — ${rowM[1].trim()}` : rowM[1].trim();
      rows.push({
        _type: 'hoursRow',
        _key: `hours-${idx++}`,
        day: dayLabel,
        hours: rowM[2].trim(),
      });
    }
  }
  return rows;
}

// --- Build the draft document -------------------------------------------------

interface ServiceObj {
  offered: boolean;
  notes?: string;
}

function service(present: boolean, label: string): ServiceObj {
  if (present) {
    warn(
      `${label}: marked offered:true (described in knowledge.ts) but NOTES left blank — owner to add a short blurb.`,
    );
    return { offered: true };
  }
  return { offered: false };
}

function buildDoc() {
  const name = parseName();
  if (!name) warn('name: could not parse a dealer name from knowledge.ts — REQUIRED, owner must set.');

  const phone = contactLine('Phone');
  if (!phone) warn('phone: no "- Phone:" line found — leave blank for owner.');

  const email = contactLine('Email');
  if (!email) warn('email: no "- Email:" line found — leave blank for owner.');

  const address = contactLine('Address');
  if (!address) warn('address: no "- Address:" line found — leave blank for owner.');

  const brandsStocked = bulletsUnder(/BRANDS\s*\/\s*FRANCHISES/i);
  if (!brandsStocked.length) warn('brandsStocked: no brand bullets parsed — owner to fill.');
  else
    warn(
      'brandsStocked: copied verbatim from knowledge.ts — reconcile against real inventory ' +
        '(see scripts/reconcile-brands.ts) before trusting.',
    );

  const openingHours = parseOpeningHours();
  if (!openingHours.length) warn('openingHours: none parsed — owner to fill.');

  // Not present anywhere in knowledge.ts → never invent.
  warn('established (year): not present in knowledge.ts — LEFT BLANK, owner to provide.');
  warn('yearsInBusiness: not present in knowledge.ts — LEFT BLANK, owner to provide.');
  warn('extraFacts: not seeded — add warranty/T&Cs prose in Studio if needed.');

  const doc: Record<string, unknown> = {
    _id: DOC_ID,
    _type: 'businessInfo',
    ...(name ? { name } : {}),
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    ...(address ? { address } : {}),
    ...(brandsStocked.length ? { brandsStocked } : {}),
    ...(openingHours.length ? { openingHours } : {}),
    sales: service(true, 'sales'),
    finance: service(true, 'finance'),
    servicing: service(true, 'servicing'),
    tradeIns: service(true, 'tradeIns'),
  };
  return doc;
}

async function main(): Promise<void> {
  const doc = buildDoc();

  console.log(
    `${commit ? 'COMMIT' : 'DRY-RUN'} — businessInfo seed (id: ${DOC_ID})\n`,
  );
  console.log('Document that would be upserted (createOrReplace on explicit id):');
  console.log(JSON.stringify(doc, null, 2));
  console.log('');

  if (warnings.length) {
    console.log(`WARN (${warnings.length}) — fields NOT confidently filled (never invented):`);
    for (const w of warnings) console.log(`  - ${w}`);
    console.log('');
  }

  console.log(
    '⚠️  These identifying facts (name/phone/address/email) are FICTIONAL DEMO placeholders.',
  );
  console.log(
    '    The OWNER must review and replace them with the real dealer facts before --commit.',
  );

  if (!commit) {
    console.log('\nDry-run only — no network call, no write performed.');
    console.log('Re-run with --commit (owner-gated, needs Editor SANITY_TOKEN) to upsert.');
    return;
  }

  // --- Owner-gated write path (NOT exercised by tooling) ----------------------
  const projectId = process.env.PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.PUBLIC_SANITY_DATASET;
  const token = process.env.SANITY_TOKEN;
  if (!projectId || !dataset || !token) {
    throw new Error(
      'Missing env for --commit. Set PUBLIC_SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET, ' +
        'and a write-enabled SANITY_TOKEN in .env.',
    );
  }
  const { createClient } = await import('@sanity/client');
  const client = createClient({
    projectId,
    dataset,
    apiVersion: process.env.PUBLIC_SANITY_API_VERSION ?? '2024-01-01',
    token,
    useCdn: false,
  });
  const res = await client.createOrReplace(doc as { _id: string; _type: string });
  console.log(`\nCommitted businessInfo document ${res._id}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
