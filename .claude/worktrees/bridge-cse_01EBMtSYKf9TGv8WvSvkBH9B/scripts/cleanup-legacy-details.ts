/**
 * scripts/cleanup-legacy-details.ts
 *
 * DEMO-ONLY TOOLING — one-shot, idempotent cleanup that removes the LEGACY
 * `details[]` rows whose data was already promoted to first-class typed fields
 * by `migrate-details-to-fields.ts` (+ `migrate-details-to-specs.ts`). Those
 * loose rows were deliberately LEFT in place as a safety net during migration;
 * this is the separate, later, owner-approved step that clears them so the
 * "Extra details" section on existing listings matches brand-new listings
 * (empty of promoted rows). The typed fields already hold all that data, so
 * removing these rows loses no information.
 *
 * SURGICAL removal — NEVER unsets the whole `details` array. For each listing we
 * remove ONLY the individual array members whose `label` (trimmed,
 * case-insensitive) is one of the 21 promoted STANDARD labels (plus the spelling
 * variants that mirror `STANDARD_DETAIL_LABELS` in src/lib/listing.ts). Each
 * such member is unset by its own `_key`, e.g.
 *   unset(['details[_key=="<key>"]'])
 * Any details member with a NON-standard label (a genuine one-off like
 * "Sunroof" or "Tow bar") is PRESERVED untouched.
 *
 * Idempotency: only standard-label rows are targeted; a doc with none left is a
 * no-op, so re-running is safe.
 *
 * Drafts + published: the client uses the `raw` perspective so BOTH `drafts.<id>`
 * and published copies are returned and each `_id` is patched independently by
 * its explicit id (never a broad query-match).
 *
 * Usage:
 *   tsx scripts/cleanup-legacy-details.ts            # dry-run (default) — prints plan, no writes
 *   tsx scripts/cleanup-legacy-details.ts --commit   # actually unset the legacy rows
 *
 * Requires a write-enabled SANITY_TOKEN in .env.
 */
import 'dotenv/config';
import { createClient } from '@sanity/client';

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

// The 21 promoted labels (from the ticket) plus the spelling variants already
// tolerated by `STANDARD_DETAIL_LABELS` in src/lib/listing.ts. Kept in sync with
// that set on purpose — any label here is data that now lives in a typed field.
// Compared trimmed + lower-cased.
const STANDARD_DETAIL_LABELS = new Set(
  [
    'make', 'model', 'badge', 'series', 'model year', 'year', 'colour', 'color',
    'odometer', 'body', 'engine', 'fuel type', 'fuel', 'transmission',
    'drive type', 'drive', 'doors', 'seats', 'trim', 'vin',
    'registration plate', 'registration expiry', 'build date', 'compliance date',
    'stock number',
  ].map((l) => l.toLowerCase()),
);

const norm = (label?: string) => (label ?? '').trim().toLowerCase();

interface DetailRow {
  _key: string;
  label?: string;
}

interface ListingRow {
  _id: string;
  title: string;
  details?: DetailRow[];
}

const QUERY = `*[_type == "listing" && category == "automotive"]{
  _id, title,
  details[]{ _key, label }
}`;

interface PreservedRow {
  id: string;
  title: string;
  label: string;
}

async function cleanup() {
  const listings = await client.fetch<ListingRow[]>(QUERY);
  const draftCount = listings.filter((l) => l._id.startsWith('drafts.')).length;
  console.log(
    `${commit ? 'COMMIT' : 'DRY-RUN'} — scanning ${listings.length} listing doc(s) ` +
      `(${listings.length - draftCount} published, ${draftCount} draft).\n`,
  );
  if (!commit) console.log('(dry-run: no data will be written — pass --commit to write)\n');

  let changedListings = 0;
  let removedRows = 0;
  const preserved: PreservedRow[] = [];
  let untrackedKeyless = 0; // standard-label rows lacking a _key (cannot target safely)

  for (const listing of listings) {
    const details = listing.details ?? [];

    // Rows to REMOVE: standard-label members, targeted by their own _key.
    const toRemove: DetailRow[] = [];

    for (const d of details) {
      const isStandard = STANDARD_DETAIL_LABELS.has(norm(d.label));
      if (!isStandard) {
        // Genuine one-off — PRESERVE. Record for the owner-review list.
        preserved.push({ id: listing._id, title: listing.title, label: (d.label ?? '(no label)').trim() || '(empty label)' });
        continue;
      }
      if (!d._key) {
        // A standard-label row with no _key cannot be surgically unset without
        // risking the wrong member — flag it, never guess.
        untrackedKeyless += 1;
        console.log(`  WARN: [${listing._id}] "${listing.title}": standard-label row "${d.label}" has no _key — SKIPPED (needs manual review).`);
        continue;
      }
      toRemove.push(d);
    }

    if (toRemove.length === 0) continue;

    changedListings += 1;
    removedRows += toRemove.length;

    console.log(`• ${listing.title}  (${listing._id})  — removing ${toRemove.length} row(s):`);
    for (const d of toRemove) console.log(`    - ${d.label}  [_key=${d._key}]`);

    if (commit) {
      // Unset each targeted member by its explicit _key on this exact _id only —
      // never the whole `details` array, never a broad query-match.
      const unsetPaths = toRemove.map((d) => `details[_key=="${d._key}"]`);
      await client.patch(listing._id).unset(unsetPaths).commit();
    }
  }

  // --- Summary ---------------------------------------------------------------
  console.log(`\n── ${commit ? 'Removed' : 'Would remove'} summary ──`);
  console.log(`  Docs scanned:                 ${listings.length}`);
  console.log(`  Docs affected:                ${changedListings}`);
  console.log(`  Standard-label rows ${commit ? 'removed:  ' : 'to remove:'} ${removedRows}`);
  if (untrackedKeyless) console.log(`  Standard-label rows w/o _key (skipped): ${untrackedKeyless}`);

  console.log(`\n── PRESERVED non-standard rows (${preserved.length}) — one-offs kept untouched ──`);
  if (preserved.length === 0) {
    console.log('  (none — every details[] row across all docs was a promoted standard label)');
  } else {
    for (const p of preserved) console.log(`  KEEP: "${p.label}"  — ${p.title}  (${p.id})`);
  }

  console.log(
    `\n${commit ? 'Committed' : 'Would remove'} ${removedRows} legacy row(s) across ${changedListings} listing(s). ` +
      `Non-standard one-off rows are never modified.`,
  );
  if (!commit) console.log('DRY-RUN — re-run with --commit to write these changes.');
}

cleanup().catch((err) => {
  console.error(err);
  process.exit(1);
});
