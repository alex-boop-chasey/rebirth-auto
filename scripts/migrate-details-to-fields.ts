/**
 * scripts/migrate-details-to-fields.ts
 *
 * DEMO-ONLY TOOLING — one-shot, idempotent migration that backfills the newly
 * promoted first-class listing fields (make/model/badge/series, colour, engine,
 * doors, trim, registration + stock fields, and the derived base-colour enum
 * `vehicleSpecs.colour`) FROM the existing loose `details[]` rows. The
 * `details[]` array is LEFT COMPLETELY UNTOUCHED — legacy cleanup is a separate,
 * later, owner-approved step.
 *
 * Sibling of `migrate-details-to-specs.ts` (which backfills the typed
 * `vehicleSpecs.*` filter dimensions); this one covers the identity/registration
 * fields plus the display+filter colour split. Same conventions throughout.
 *
 * Idempotency: a target is written ONLY when its current value on the doc is
 * null/undefined, so re-running is a no-op once populated.
 *
 * Determinism: the base-colour enum (`vehicleSpecs.colour`) is derived from the
 * manufacturer paint name via `matchBaseColour`. A paint name with no recognised
 * base-colour word is SKIPPED with a WARN (never guessed, never 'other') — the
 * owner sets those by hand.
 *
 * Drafts + published: the client uses the `raw` perspective so BOTH `drafts.<id>`
 * and published copies are returned and each `_id` is patched explicitly by id
 * (never a broad match); a doc that exists as both is filled independently.
 *
 * Usage:
 *   tsx scripts/migrate-details-to-fields.ts            # dry-run (default) — prints diff, no writes
 *   tsx scripts/migrate-details-to-fields.ts --commit   # actually write the patches
 *
 * Requires a write-enabled SANITY_TOKEN in .env.
 */
import 'dotenv/config';
import { createClient } from '@sanity/client';
import { matchBaseColour } from './lib/vehicle-specs';

const projectId = process.env.PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.PUBLIC_SANITY_DATASET;
const apiVersion = process.env.PUBLIC_SANITY_API_VERSION ?? '2024-01-01';
const token = process.env.SANITY_TOKEN;

if (!projectId || !dataset || !token) {
  throw new Error(
    'Missing required env vars. Ensure PUBLIC_SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET, ' +
      'and a write-enabled SANITY_TOKEN are set in .env.',
  );
}

// `perspective: 'raw'` returns BOTH drafts.<id> and published docs as distinct
// rows, so each is patched independently by its explicit _id.
const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false, perspective: 'raw' });

const commit = process.argv.includes('--commit');

interface DetailRow {
  label?: string;
  value?: string;
  valueNumber?: number;
  valueDate?: string;
}

interface ListingRow {
  _id: string;
  title: string;
  // Current values of every target field, for the only-write-empty guard.
  make?: string;
  model?: string;
  badge?: string;
  series?: string;
  colour?: string;
  engine?: string;
  doors?: number;
  trim?: string;
  vin?: string;
  registrationPlate?: string;
  registrationExpiry?: string;
  buildDate?: string;
  complianceDate?: string;
  stockNumber?: string;
  /** Current derived base-colour enum (vehicleSpecs.colour), aliased for the guard. */
  colourBase?: string;
  details?: DetailRow[];
}

const QUERY = `*[_type == "listing" && category == "automotive"]{
  _id, title,
  make, model, badge, series, colour, engine, doors, trim,
  vin, registrationPlate, registrationExpiry, buildDate, complianceDate, stockNumber,
  "colourBase": vehicleSpecs.colour,
  details[]{ label, value, valueNumber, valueDate }
}`;

// --- Value extractors from a details row -------------------------------------
/** Verbatim trimmed display string, or null when absent/empty. */
function asString(d?: DetailRow): string | null {
  const v = d?.value?.trim();
  return v ? v : null;
}
/** ISO date string (valueDate, falling back to value), or null. */
function asDate(d?: DetailRow): string | null {
  const v = (d?.valueDate ?? d?.value)?.trim();
  return v ? v : null;
}
/** Integer from valueNumber, falling back to parsing digits out of value; null if none. */
function asInt(d?: DetailRow): number | null {
  if (typeof d?.valueNumber === 'number' && Number.isFinite(d.valueNumber)) return Math.round(d.valueNumber);
  if (typeof d?.value === 'string') {
    const cleaned = d.value.replace(/[^0-9.-]/g, '');
    if (cleaned) {
      const n = Number(cleaned);
      if (Number.isFinite(n)) return Math.round(n);
    }
  }
  return null;
}

interface Proposed {
  /** Patch path (top-level field key, or `vehicleSpecs.colour`). */
  path: string;
  raw: string;
  typed: string | number;
}

const perFieldCounts = new Map<string, number>();

async function migrate() {
  const listings = await client.fetch<ListingRow[]>(QUERY);
  const draftCount = listings.filter((l) => l._id.startsWith('drafts.')).length;
  console.log(
    `${commit ? 'COMMIT' : 'DRY-RUN'} — scanning ${listings.length} listing doc(s) ` +
      `(${listings.length - draftCount} published, ${draftCount} draft).\n`,
  );
  if (!commit) console.log('(dry-run: no data will be written — pass --commit to write)\n');

  let changedListings = 0;
  let changedFields = 0;
  const warnings: string[] = [];

  for (const listing of listings) {
    // Case-insensitive label → first matching row.
    const byLabel = new Map<string, DetailRow>();
    for (const d of listing.details ?? []) {
      const key = (d.label ?? '').trim().toLowerCase();
      if (key && !byLabel.has(key)) byLabel.set(key, d);
    }
    const row = (label: string) => byLabel.get(label.toLowerCase());

    const proposed: Proposed[] = [];

    // isEmpty guard on the CURRENT doc value — only fill when empty (idempotent).
    const empty = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

    // Verbatim string mappings: details label → top-level field.
    const stringMap: Array<{ path: keyof ListingRow; label: string }> = [
      { path: 'make', label: 'Make' },
      { path: 'model', label: 'Model' },
      { path: 'badge', label: 'Badge' },
      { path: 'series', label: 'Series' },
      { path: 'colour', label: 'Colour' }, // top-level PAINT NAME (display), verbatim
      { path: 'engine', label: 'Engine' },
      { path: 'trim', label: 'Trim' }, // do NOT normalise casing — verbatim
      { path: 'vin', label: 'VIN' },
      { path: 'registrationPlate', label: 'Registration Plate' },
      { path: 'stockNumber', label: 'Stock Number' }, // string — preserves leading zeros
    ];
    for (const { path, label } of stringMap) {
      const v = asString(row(label));
      if (v != null && empty(listing[path])) proposed.push({ path, raw: v, typed: v });
    }

    // Integer: Doors (valueNumber, fallback parse value).
    {
      const n = asInt(row('Doors'));
      if (n != null && empty(listing.doors)) proposed.push({ path: 'doors', raw: String(n), typed: n });
    }

    // ISO date mappings.
    const dateMap: Array<{ path: keyof ListingRow; label: string }> = [
      { path: 'registrationExpiry', label: 'Registration Expiry' },
      { path: 'buildDate', label: 'Build Date' },
      { path: 'complianceDate', label: 'Compliance Date' },
    ];
    for (const { path, label } of dateMap) {
      const v = asDate(row(label));
      if (v != null && empty(listing[path])) proposed.push({ path, raw: v, typed: v });
    }

    // Derived base-colour enum: Colour paint name → vehicleSpecs.colour.
    // WARN (never guess) when the paint name has no recognisable base-colour word.
    {
      const paint = asString(row('Colour'));
      if (paint != null && empty(listing.colourBase)) {
        const code = matchBaseColour(paint);
        if (code == null) {
          warnings.push(
            `[${listing._id}] "${listing.title}": Colour "${paint}" has no recognisable base-colour word — vehicleSpecs.colour left UNSET (needs manual fill).`,
          );
        } else {
          proposed.push({ path: 'vehicleSpecs.colour', raw: paint, typed: code });
        }
      }
    }

    if (proposed.length === 0) continue;

    changedListings += 1;
    changedFields += proposed.length;

    console.log(`• ${listing.title}  (${listing._id})`);
    for (const p of proposed) {
      perFieldCounts.set(p.path, (perFieldCounts.get(p.path) ?? 0) + 1);
      console.log(`    ${p.path}: ${JSON.stringify(p.typed)}${p.raw !== String(p.typed) ? `  (from "${p.raw}")` : ''}`);
    }

    if (commit) {
      const patch: Record<string, string | number> = {};
      for (const p of proposed) patch[p.path] = p.typed;
      // Patch this exact _id only — never a broad query-match.
      await client.patch(listing._id).set(patch).commit();
    }
  }

  // --- Summary ---------------------------------------------------------------
  console.log(`\n── Per-field ${commit ? 'written' : 'would-set'} counts ──`);
  const order = [
    'make', 'model', 'badge', 'series', 'colour', 'vehicleSpecs.colour', 'engine',
    'doors', 'trim', 'vin', 'registrationPlate', 'registrationExpiry', 'buildDate',
    'complianceDate', 'stockNumber',
  ];
  for (const field of order) {
    const c = perFieldCounts.get(field) ?? 0;
    console.log(`  ${field.padEnd(22)} ${c}`);
  }

  if (warnings.length) {
    console.log(`\n── WARN (${warnings.length}) — paint names with no base-colour match (manual fill needed) ──`);
    for (const w of warnings) console.log(`  WARN: ${w}`);
  } else {
    console.log('\nNo WARN lines — every non-empty Colour mapped to a base colour.');
  }

  console.log(
    `\n${commit ? 'Committed' : 'Would update'} ${changedFields} field(s) across ${changedListings} listing(s). ` +
      `details[] is never modified.`,
  );
  if (!commit) console.log('DRY-RUN — re-run with --commit to write these changes.');
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
