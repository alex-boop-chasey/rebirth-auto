/**
 * scripts/seed.ts
 *
 * DEMO-ONLY TOOLING — not shipped in the publishable `astro-listings` package.
 * Populates the Sanity dataset with sample listings so the listing component
 * can be built against real data.
 *
 * Usage (dry-run by default — writes require the explicit --commit flag):
 *   npm run seed                   # DRY RUN — print what would be created, no writes
 *   npm run seed -- --commit       # create the sample listings (additive)
 *   npm run seed:clean -- --commit # delete existing listings by explicit _id, then re-seed
 *
 * Requires a write-enabled SANITY_TOKEN in .env.
 */
import 'dotenv/config';
import { createClient } from '@sanity/client';
import { randomUUID } from 'node:crypto';
import { specsFromDetails } from './lib/vehicle-specs';

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

const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false });

// --- Helpers -----------------------------------------------------------------

/** Unique key for Sanity array items (`_key`). */
const key = () => randomUUID().replace(/-/g, '').slice(0, 12);

/** A single Portable Text paragraph block. */
const block = (text: string) => ({
  _type: 'block',
  _key: key(),
  style: 'normal',
  markDefs: [],
  children: [{ _type: 'span', _key: key(), text, marks: [] }],
});

type ValueType = 'text' | 'number' | 'boolean' | 'date';
interface Detail {
  label: string;
  valueType: ValueType;
  value?: string;
  valueNumber?: number;
  unit?: string;
  valueBoolean?: boolean;
  valueDate?: string;
}

/** A single key/value detail array member. */
const detail = (d: Detail) => ({ _type: 'detail', _key: key(), ...d });

// --- Seed data ---------------------------------------------------------------
// Images are intentionally left empty here. Add them manually in Studio, or
// write a follow-up script that uploads assets via `client.assets.upload()`
// and references the returned asset IDs in the `images` array.

const listings = [
  // --- Automotive ------------------------------------------------------------
  {
    _type: 'listing',
    title: '2019 Toyota Hilux SR5 Dual Cab',
    slug: { _type: 'slug', current: '2019-toyota-hilux-sr5-dual-cab' },
    description: [
      block(
        'Well-maintained SR5 dual cab 4x4 with full service history. Tow bar, ' +
          'canopy and tinted windows. Ready for work or weekends away.',
      ),
    ],
    price: 48990,
    currency: 'AUD',
    status: 'active',
    category: 'automotive',
    images: [],
    details: [
      detail({ label: 'Odometer', valueType: 'number', valueNumber: 142000, unit: 'km', value: '142,000 km' }),
      detail({ label: 'Year', valueType: 'number', valueNumber: 2019, value: '2019' }),
      detail({ label: 'Transmission', valueType: 'text', value: 'Automatic' }),
      detail({ label: 'Fuel Type', valueType: 'text', value: 'Diesel' }),
      detail({ label: 'Registered', valueType: 'boolean', valueBoolean: true, value: 'Yes' }),
    ],
    listingDate: '2026-07-12T00:00:00Z',
  },
  {
    _type: 'listing',
    title: '2021 Mazda CX-5 Touring',
    slug: { _type: 'slug', current: '2021-mazda-cx-5-touring' },
    description: [
      block(
        'One-owner CX-5 Touring in immaculate condition. Leather interior, ' +
          'reverse camera and low kilometres. Balance of factory warranty.',
      ),
    ],
    price: 36500,
    currency: 'AUD',
    status: 'pending',
    category: 'automotive',
    images: [],
    details: [
      detail({ label: 'Odometer', valueType: 'number', valueNumber: 58000, unit: 'km', value: '58,000 km' }),
      detail({ label: 'Year', valueType: 'number', valueNumber: 2021, value: '2021' }),
      detail({ label: 'Transmission', valueType: 'text', value: 'Automatic' }),
      detail({ label: 'Fuel Type', valueType: 'text', value: 'Petrol' }),
      detail({ label: 'Registered', valueType: 'boolean', valueBoolean: true, value: 'Yes' }),
    ],
    listingDate: '2026-07-05T00:00:00Z',
  },
  {
    _type: 'listing',
    title: '2016 Ford Ranger XLT',
    slug: { _type: 'slug', current: '2016-ford-ranger-xlt' },
    description: [
      block(
        'High-kilometre but honest XLT that has been reliably used as a work ute. ' +
          'Sold unregistered — priced to sell for a quick sale.',
      ),
    ],
    price: 32000,
    currency: 'AUD',
    status: 'sold',
    category: 'automotive',
    images: [],
    details: [
      detail({ label: 'Odometer', valueType: 'number', valueNumber: 189000, unit: 'km', value: '189,000 km' }),
      detail({ label: 'Year', valueType: 'number', valueNumber: 2016, value: '2016' }),
      detail({ label: 'Transmission', valueType: 'text', value: 'Manual' }),
      detail({ label: 'Fuel Type', valueType: 'text', value: 'Diesel' }),
      detail({ label: 'Registered', valueType: 'boolean', valueBoolean: false, value: 'No' }),
    ],
    listingDate: '2026-06-20T00:00:00Z',
  },
];

// --- Operations --------------------------------------------------------------

/**
 * Delete every existing `listing` document so the seed is repeatable.
 * Deletions target explicit _ids (never a broad query-match): the ids are
 * fetched first, then deleted individually. In dry-run mode nothing is written —
 * the ids that WOULD be deleted are printed instead.
 */
export async function clean(commit: boolean) {
  const ids: string[] = await client.fetch('*[_type == "listing"]._id');
  if (!commit) {
    console.log(`[DRY RUN] would delete ${ids.length} existing listing document(s) by explicit _id:`);
    ids.forEach((id) => console.log(`  ✗ delete ${id}`));
    return;
  }
  for (const id of ids) await client.delete(id);
  console.log(`Deleted ${ids.length} existing listing document(s) by explicit _id.`);
}

/** Create the sample listings (or, in dry-run mode, print what would be created). */
export async function seed(commit: boolean) {
  for (const doc of listings) {
    // Every seed listing is automotive — populate the typed spec fields from the
    // same `details[]` the migration reads, so freshly-seeded listings match
    // migrated ones.
    const toCreate = { ...doc, vehicleSpecs: specsFromDetails(doc.details) };
    if (!commit) {
      console.log(`[DRY RUN] would create "${doc.title}"`);
      continue;
    }
    const created = await client.create(toCreate);
    console.log(`Created "${doc.title}" (${created._id})`);
  }
  if (!commit) {
    console.log(`\n[DRY RUN] no documents written. Re-run with --commit to write.`);
    return listings.length;
  }
  const count = await client.fetch<number>('count(*[_type == "listing"])');
  console.log(`\nDone. Dataset now contains ${count} listing document(s).`);
  return count;
}

// Run when executed directly (via `tsx scripts/seed.ts`).
// Dry-run by default; writes require the explicit --commit flag.
const commit = process.argv.includes('--commit');
const shouldClean = process.argv.includes('--clean');
(async () => {
  console.log(
    commit
      ? '*** LIVE SEED (--commit) — writing to Sanity ***\n'
      : '*** DRY RUN (default) — no writes. Re-run with --commit to write. ***\n',
  );
  if (shouldClean) await clean(commit);
  await seed(commit);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
