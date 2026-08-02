/**
 * scripts/enrich-attributes.ts
 *
 * DEMO/BACKFILL TOOLING — one-shot, idempotent backfill of the shopper-facing
 * `aiAttributes` (`runningCost`, `usageFit`, `sizeClass`) over the real inventory.
 *
 * It reuses the SHARED enrichment module
 * (`src/lib/generate-description/enrich-attributes.ts`) so the backfill and the
 * live endpoint derive attributes IDENTICALLY. `buildEnrichmentInput` is the
 * Decision-6 choke point: the GROQ query below selects PUBLIC fields ONLY (no
 * `dealerNotes`, no cost/floor, no private condition flags), and every row is fed
 * through `buildEnrichmentInput` before `deriveAttributes`, so a private field can
 * never reach the enrichment input.
 *
 * MODEL PATH — key-gated. When `OPENROUTER_API_KEY` is present in `.env` we
 * `configureAI(...)` (mirroring the endpoint's config) and call `deriveAttributes`
 * WITHOUT `judge:false`, so the SAME `structured`-tier model call that refines
 * `usageFit` also supplies the `runningCost` fallback for listings with no
 * measured fuel economy (a measured rule value always wins; the model abstaining
 * leaves the field blank). When NO key is present we fall back to `{ judge: false }`
 * (rules-only), so the dry-run still completes offline — running cost just stays
 * blank on petrol/diesel cars that lack a numeric economy figure.
 *
 * Idempotency: a field is only written when its current `aiAttributes.<field>` is
 * null/undefined, so re-running is a no-op once populated. `--force` overwrites
 * already-populated fields.
 *
 * Usage:
 *   tsx scripts/enrich-attributes.ts             # dry-run (default) — prints diff, no writes
 *   tsx scripts/enrich-attributes.ts --commit    # write the patches (OWNER-GATED)
 *   tsx scripts/enrich-attributes.ts --force     # also overwrite already-set aiAttributes fields
 *
 * Requires a write-enabled SANITY_TOKEN in .env (only needed for --commit).
 */
import 'dotenv/config';
import { createClient } from '@sanity/client';
import {
  buildEnrichmentInput,
  deriveAttributes,
  type AiAttributes,
  type AttributeField,
} from '../src/lib/generate-description/enrich-attributes';
import { configureAI } from '../src/ai/config';

// Mirror of the OpenRouter attribution + timeout values in `src/chatbot/config.ts`.
// Those constants are re-declared here as literals rather than imported because
// that module reads `import.meta.env` at load time, which is undefined under tsx
// (Node) and would crash this script. Keep these in sync with chatbot/config.ts.
const APP_URL = 'https://rebirth-listings-auto.pages.dev';
const APP_TITLE = 'Rebirth Auto';
const REQUEST_TIMEOUT_MS = 22000;

const projectId = process.env.PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.PUBLIC_SANITY_DATASET;
const apiVersion = process.env.PUBLIC_SANITY_API_VERSION ?? '2024-01-01';
const token = process.env.SANITY_TOKEN;
const openrouterApiKey = process.env.OPENROUTER_API_KEY;

if (!projectId || !dataset || !token) {
  throw new Error(
    'Missing required env vars. Ensure PUBLIC_SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET, ' +
      'and a write-enabled SANITY_TOKEN are set in .env.',
  );
}

const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false });

const commit = process.argv.includes('--commit');
const force = process.argv.includes('--force');

interface DetailRow {
  label?: string;
  value?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueDate?: string;
  valueType?: string;
}

interface ListingRow {
  _id: string;
  title?: string;
  make?: string;
  model?: string;
  vehicleSpecs?: Record<string, unknown> | null;
  details?: DetailRow[] | null;
  aiAttributes?: AiAttributes | null;
}

// PUBLIC fields ONLY — no dealerNotes, no cost/floor, no private condition flags.
const QUERY = `*[_type == "listing" && category == "automotive"]{
  _id, title, make, model, vehicleSpecs,
  "details": details[]{ label, value, valueNumber, valueBoolean, valueDate, valueType },
  aiAttributes
}`;

const FIELDS: AttributeField[] = ['runningCost', 'usageFit', 'sizeClass'];

/** Idempotency test — a field is "unset" when it is null/undefined or (for the
 *  array `usageFit`) an empty array. */
function isUnset(existing: AiAttributes | null | undefined, field: AttributeField): boolean {
  const v = existing?.[field];
  if (v === null || v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function fmt(v: unknown): string {
  if (Array.isArray(v)) return `[${v.join(', ')}]`;
  return String(v);
}

async function run() {
  // Model path is key-gated. With a key we configure the AI layer (mirroring the
  // endpoint's config) and let the SAME structured call fill the runningCost
  // fallback; without one we stay rules-only so the dry-run still runs offline.
  const useModel = Boolean(openrouterApiKey);
  if (useModel) {
    configureAI({
      openrouterApiKey: openrouterApiKey!,
      referer: APP_URL,
      appTitle: APP_TITLE,
      attemptTimeoutMs: REQUEST_TIMEOUT_MS,
    });
  } else {
    console.log(
      'NOTE: OPENROUTER_API_KEY not set — running RULES-ONLY (judge=false). ' +
        'runningCost will stay blank on petrol/diesel listings with no numeric fuelEconomy. ' +
        'Set the key in .env to let the model judge the fallback.\n',
    );
  }

  const listings = await client.fetch<ListingRow[]>(QUERY);
  console.log(
    `${commit ? 'COMMIT' : 'DRY-RUN'}${force ? ' --force' : ''} — scanning ${listings.length} automotive listing(s). ` +
      `(${useModel ? 'model path: runningCost fallback ON' : 'rules-only: judge=false'})\n`,
  );

  let scanned = 0;
  let wouldChange = 0;
  let fieldsSet = 0;
  let warnCount = 0;

  for (const listing of listings) {
    scanned += 1;

    // Public choke point, then derivation. With a key, the model runs (default
    // judge) and can fill the runningCost fallback; without one, rules-only.
    const input = buildEnrichmentInput(listing);
    const { aiAttributes, sources, warnings } = await deriveAttributes(input, {
      id: listing._id,
      ...(useModel ? {} : { judge: false as const }),
    });
    warnCount += warnings.length;

    // Keep only derived fields that are eligible to write (idempotent unless --force).
    const patch: Record<string, AiAttributes[AttributeField]> = {};
    const printed: string[] = [];
    for (const field of FIELDS) {
      const derived = aiAttributes[field];
      if (derived === undefined) continue; // module left it unset — never default it
      if (!force && !isUnset(listing.aiAttributes, field)) continue; // already populated
      patch[`aiAttributes.${field}`] = derived;
      printed.push(`    ${field}: ${fmt(derived)}  [${sources[field]}]`);
    }

    if (printed.length === 0 && warnings.length === 0) continue;

    console.log(`• ${listing.title ?? '(untitled)'}  (${listing._id})`);
    for (const line of printed) console.log(line);
    for (const w of warnings) console.log(`    WARN ${w}`);

    if (printed.length > 0) {
      wouldChange += 1;
      fieldsSet += printed.length;
      if (commit) {
        await client.patch(listing._id).set(patch).commit();
      }
    }
  }

  console.log(
    `\n${commit ? 'Committed' : 'Would set'} ${fieldsSet} field(s) across ${wouldChange} listing(s). ` +
      `Scanned ${scanned}. WARN count: ${warnCount}.`,
  );
  if (!commit) console.log('Re-run with --commit to write these changes (owner-gated).');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
