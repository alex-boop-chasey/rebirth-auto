/**
 * aiAttributes enrichment — derive shopper-facing soft attributes for a listing.
 * =============================================================================
 * Produces the three `aiAttributes` fields (`runningCost`, `usageFit`,
 * `sizeClass`) that power soft-query search/ranking. Two-part shape:
 *
 *   1. `buildEnrichmentInput(publicListing)` — the SINGLE choke point that
 *      assembles the enrichment input from PUBLIC fields ONLY.
 *   2. `deriveAttributes(input)` — a rule/model split that turns that input into
 *      `{ aiAttributes, sources, warnings }`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HARD CONSTRAINT — Decision 6 data boundary (the reason this module exists)
 * ─────────────────────────────────────────────────────────────────────────────
 * `aiAttributes` feeds shopper-facing search/ranking, so its input MUST be the
 * PUBLIC PROJECTION ONLY. It must NEVER receive `dealerNotes`, cost/floor price,
 * or any private condition flag. `buildEnrichmentInput` is the enforced choke
 * point: it reads a fixed whitelist of public keys and returns a fresh object,
 * so a private field on the source listing can never survive into the enrichment
 * input — even if a caller passes the whole draft. A test asserts this and fails
 * loudly if a private key ever appears in the output.
 *
 * Determinism: the rules are pure. Anything that cannot be confidently derived
 * is left UNSET and logged as a WARN — never guessed or defaulted. All AI routes
 * through `~/ai` (`generateObject` on the `structured` tier) via ONE structured
 * call per listing that refines `usageFit` and, ONLY when the rule found no
 * measured fuel economy, supplies a `runningCost` fallback. A measured rule
 * `runningCost` always wins; the model abstaining (null) leaves the field unset.
 * The judgment degrades to the rule results on any failure. The `~/ai` barrel is
 * DYNAMICALLY imported inside the judge so the pure-rule path (and its offline
 * tests) never loads the AI client.
 */
import { z } from 'zod';

// --- Vocabularies (mirror the Sanity `aiAttributes` schema exactly) ----------
export const RUNNING_COSTS = ['low', 'medium', 'high'] as const;
export const USAGE_FITS = ['city', 'family', 'highway', 'towing', 'tradie', 'first-car'] as const;
export const SIZE_CLASSES = ['compact', 'medium', 'large'] as const;

export type RunningCost = (typeof RUNNING_COSTS)[number];
export type UsageFit = (typeof USAGE_FITS)[number];
export type SizeClass = (typeof SIZE_CLASSES)[number];

/** The derived attributes. Every field is optional — an unset field is omitted
 *  entirely, so a partial result is representable (Decision: never guess). */
export interface AiAttributes {
  runningCost?: RunningCost;
  usageFit?: UsageFit[];
  sizeClass?: SizeClass;
}

// --- Public input shapes -----------------------------------------------------
// These types deliberately DO NOT include `dealerNotes`, cost, or floor price,
// so a private field is not even in scope at the `buildEnrichmentInput` seam.

/** A public `details[]` extra reduced to a label/value pair. */
export interface PublicDetail {
  label?: string;
  value?: string;
}

/** The public subset of `vehicleSpecs` used for enrichment. */
export interface PublicVehicleSpecs {
  bodyType?: string;
  fuelType?: string;
  driveType?: string;
  seatCount?: number;
  fuelEconomy?: number;
  year?: number;
  odometer?: number;
  condition?: string;
}

/**
 * The PUBLIC listing fields `buildEnrichmentInput` accepts. Private fields are
 * intentionally absent from this type. `vehicleSpecs` is widened with
 * `Record<string, unknown>` only so a raw draft's specs object can be passed —
 * the builder still reads a fixed public whitelist, so nothing else leaks.
 */
export interface PublicListingInput {
  title?: string;
  make?: string;
  model?: string;
  doors?: number;
  /** Asking price — public. NOT cost/floor (those are private and never here). */
  price?: number;
  vehicleSpecs?: (PublicVehicleSpecs & Record<string, unknown>) | null;
  details?: PublicDetail[] | null;
}

/** The clean, public-only object handed to `deriveAttributes`. */
export interface EnrichmentInput {
  title?: string;
  make?: string;
  model?: string;
  doors?: number;
  price?: number;
  vehicleSpecs: PublicVehicleSpecs;
  details: PublicDetail[];
}

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

/** Drop `undefined` values so the object literally carries only real keys. */
function prune<T extends object>(obj: T): T {
  const rec = obj as Record<string, unknown>;
  for (const k of Object.keys(rec)) if (rec[k] === undefined) delete rec[k];
  return obj;
}

/**
 * Decision 6 CHOKE POINT — assemble the enrichment input from PUBLIC fields only.
 *
 * Reads a fixed whitelist and returns a fresh object. `dealerNotes`, cost, and
 * floor price are never read, so they can never appear in the output — even if
 * the caller passes a draft that carries them. Do not add a private field here.
 */
export function buildEnrichmentInput(listing: PublicListingInput): EnrichmentInput {
  const s = listing.vehicleSpecs ?? {};
  const vehicleSpecs = prune<PublicVehicleSpecs>({
    bodyType: str(s.bodyType),
    fuelType: str(s.fuelType),
    driveType: str(s.driveType),
    seatCount: num(s.seatCount),
    fuelEconomy: num(s.fuelEconomy),
    year: num(s.year),
    odometer: num(s.odometer),
    condition: str(s.condition),
  });

  const details: PublicDetail[] = (listing.details ?? [])
    .map((d) => prune<PublicDetail>({ label: str(d?.label), value: str(d?.value) }))
    .filter((d): d is PublicDetail => typeof d.label === 'string');

  return prune<EnrichmentInput>({
    title: str(listing.title),
    make: str(listing.make),
    model: str(listing.model),
    doors: num(listing.doors),
    price: num(listing.price),
    vehicleSpecs,
    details,
  }) as EnrichmentInput;
}

// --- Rule tables -------------------------------------------------------------
// sizeClass by bodyType, using the REAL codes from the Sanity `vehicleSpecs`
// vocabulary (sedan | hatchback | suv | ute | wagon | van | coupe | convertible).
// A seatCount >= 7 promotes to `large` regardless of body (people-mover signal);
// SUV is `medium` at its base and only reaches `large` via the seat override,
// which mirrors "small-SUV ≤5 → medium, large-SUV/7-seat → large" with the codes
// this repo actually has (there is no small/large-SUV code — seats disambiguate).
const SIZE_BY_BODYTYPE: Readonly<Record<string, SizeClass>> = {
  hatchback: 'compact',
  coupe: 'compact',
  convertible: 'compact',
  sedan: 'medium',
  wagon: 'medium',
  suv: 'medium',
  ute: 'large',
  van: 'large',
};

// --- Derivation result -------------------------------------------------------
export type AttributeField = 'runningCost' | 'usageFit' | 'sizeClass';
export type Provenance = 'rule' | 'model';

export interface DeriveResult {
  aiAttributes: AiAttributes;
  /** Per-field provenance, for the backfill diff table. Only set fields appear. */
  sources: Partial<Record<AttributeField, Provenance>>;
  /** WARN reasons for fields left unset. */
  warnings: string[];
}

/** The one structured judgment the model returns per listing: the `usageFit`
 *  refinement AND a `runningCost` fallback (null = abstain). Both come from the
 *  SAME `generateObject` call — never a second round-trip. */
export interface EnrichmentJudgment {
  usageFit: UsageFit[];
  /** Model's running-cost call, consulted ONLY when the rule had no measured
   *  data. `null` = the model genuinely couldn't tell → we leave it unset. */
  runningCost: RunningCost | null;
}

/** Injectable model judge — the endpoint uses the default; tests pass `false` to
 *  run the pure rules fully offline, or a function to inject a fixed judgment. */
export type EnrichmentJudge = (
  input: EnrichmentInput,
  ruleLeans: UsageFit[],
) => Promise<EnrichmentJudgment>;

export interface DeriveOptions {
  /** Listing id, for WARN log correlation. */
  id?: string;
  /** `false` → skip the model entirely (offline/rule-only). A function → use it.
   *  Omitted → the default `generateObject` judge (degrades on any failure). */
  judge?: EnrichmentJudge | false;
}

// --- Pure rules --------------------------------------------------------------

/**
 * runningCost — pure rule. EV/hybrid → low; else by combined L/100km. Returns
 * undefined when there is no measured signal. It does NOT warn: a measured rule
 * value always wins, but when the rule can't decide the model may fill it in, so
 * the "no measured data" WARN is deferred to `deriveAttributes` and only logged
 * if BOTH the rule and the model leave it unset.
 */
function deriveRunningCost(input: EnrichmentInput): RunningCost | undefined {
  const fuel = input.vehicleSpecs.fuelType;
  if (fuel === 'electric' || fuel === 'hybrid') return 'low';

  const eco = input.vehicleSpecs.fuelEconomy;
  if (typeof eco === 'number' && Number.isFinite(eco)) {
    if (eco < 6) return 'low';
    if (eco <= 9) return 'medium';
    return 'high';
  }

  return undefined;
}

/** sizeClass — pure rule. Deterministic bodyType map, seats >= 7 promotes large. */
function deriveSizeClass(
  input: EnrichmentInput,
  warn: (field: AttributeField, reason: string) => void,
): SizeClass | undefined {
  const { bodyType, seatCount } = input.vehicleSpecs;
  if (typeof seatCount === 'number' && seatCount >= 7) return 'large';

  if (!bodyType) {
    warn('sizeClass', 'no bodyType and seatCount < 7');
    return undefined;
  }
  const mapped = SIZE_BY_BODYTYPE[bodyType];
  if (!mapped) {
    warn('sizeClass', `unmapped bodyType "${bodyType}"`);
    return undefined;
  }
  return mapped;
}

/** usageFit — deterministic rule leans (the confident part). */
function usageFitLeans(
  input: EnrichmentInput,
  sizeClass: SizeClass | undefined,
  runningCost: RunningCost | undefined,
): UsageFit[] {
  const leans = new Set<UsageFit>();
  const { bodyType, driveType, seatCount } = input.vehicleSpecs;

  // A ute/van with 4wd/awd is a genuine work/tow rig.
  if ((bodyType === 'ute' || bodyType === 'van') && (driveType === '4wd' || driveType === 'awd')) {
    leans.add('towing');
    leans.add('tradie');
  }
  // 7+ seats or an SUV reads as a family vehicle.
  if ((typeof seatCount === 'number' && seatCount >= 7) || bodyType === 'suv') {
    leans.add('family');
  }
  // A cheap-to-run compact is the classic city / first car.
  if (sizeClass === 'compact' && runningCost === 'low') {
    leans.add('city');
    leans.add('first-car');
  }
  return [...leans];
}

// --- Model judgment (usageFit refinement + runningCost fallback) -------------

const EnrichmentJudgment = z.object({
  usageFit: z
    .array(z.enum(['city', 'family', 'highway', 'towing', 'tradie', 'first-car']))
    .describe(
      'The best-fit use cases for this vehicle, chosen ONLY from the six codes. ' +
        'Include a code only when the public data supports it — e.g. "highway" for ' +
        'a comfortable long-distance tourer, "family" for a roomy 5-seater. Return ' +
        '[] if nothing is clearly supported. Never invent facts beyond the input.',
    ),
  runningCost: z
    .enum(['low', 'medium', 'high'])
    .nullable()
    .describe(
      'How cheap this vehicle is to run (fuel + typical servicing) judged from ' +
        'make/model/engine/body/year. low = economical (small/efficient/EV-like), ' +
        'medium = average, high = thirsty (large/performance/heavy). Return null if ' +
        'you genuinely cannot tell from the data — do not guess.',
    ),
});

const JUDGE_SYSTEM = `You classify a used vehicle for a car-search filter from PUBLIC data only.
You are given ONLY public vehicle data as JSON (specs, make/model, doors, asking price, extra details)
plus the rule-based leans already applied. Return a JSON object matching the schema with two fields:

"usageFit" — an array drawn ONLY from these six codes: city, family, highway, towing, tradie, first-car.
- Ground every choice strictly in the provided data. Never invent condition, history, or features.
- Add codes the rules may have missed (e.g. "highway" for a comfortable long-distance vehicle, a
  borderline "family" call). You may re-list the leans; they will be merged and de-duplicated.
- If the data does not clearly support a use case, do not include it. Return [] when unsure.

"runningCost" — one of "low", "medium", "high", or null. Rate how cheap the vehicle is to run (fuel
plus typical servicing) from the make/model/engine/body/year: low = economical (small/efficient/EV-like),
medium = average, high = thirsty (large/performance/heavy). Return null if you genuinely cannot tell
from the data — never guess.

Return ONLY the JSON object.`;

/** Default judge — ONE `generateObject` call on the `structured` tier that returns
 *  BOTH the usageFit refinement and the runningCost fallback. Grounds ONLY in the
 *  public enrichment input. Assumes the caller has already `configureAI(...)`d. */
async function defaultEnrichmentJudge(
  input: EnrichmentInput,
  ruleLeans: UsageFit[],
): Promise<EnrichmentJudgment> {
  // Dynamic import: the rule-only path never loads the AI client (mirrors the
  // search-planner eval). Routes through the public AI surface (`~/ai/client`,
  // which the `~/ai` barrel re-exports these functions from) — never a deeper
  // `providers/` path. Importing the client module directly (not the full barrel)
  // keeps the enrichment path free of the barrel's Sanity-loading side deps, so
  // this same shared module runs under both the Worker and Node scripts (tsx).
  const { generateObject } = await import('~/ai/client');
  const { content } = await generateObject({
    capability: 'structured',
    schema: EnrichmentJudgment,
    schemaName: 'EnrichmentJudgment',
    maxTokens: 256, // tiny payload — bound cost/latency
    messages: [
      { role: 'system', content: JUDGE_SYSTEM },
      { role: 'user', content: JSON.stringify({ ...input, ruleLeans }) },
    ],
  });
  return { usageFit: content.usageFit, runningCost: content.runningCost };
}

// --- Public API --------------------------------------------------------------

/**
 * Derive `aiAttributes` from the PUBLIC enrichment input. Pure rules for
 * `sizeClass` and the confident `usageFit` leans; an optional model judgment
 * refines `usageFit` AND, only when the rule found no measured fuel-economy
 * signal, fills `runningCost` as a fallback. A measured rule `runningCost` ALWAYS
 * wins over the model; the model is consulted for it ONLY when the rule returned
 * undefined, and if the model abstains (null) the field stays UNSET + WARN — we
 * never invent. Never throws — degrades to the rule result on any model failure.
 * Unset fields are omitted; each unset field logs a WARN.
 */
export async function deriveAttributes(
  input: EnrichmentInput,
  opts: DeriveOptions = {},
): Promise<DeriveResult> {
  const warnings: string[] = [];
  const warn = (field: AttributeField, reason: string) => {
    console.warn('[enrich] WARN', opts.id ?? '(no id)', field, reason);
    warnings.push(`${field}: ${reason}`);
  };

  // Rule runningCost first, but DO NOT warn yet — the model may fill it when the
  // rule had no measured data. A measured rule value wins and is never overridden.
  const ruleRunningCost = deriveRunningCost(input);
  const sizeClass = deriveSizeClass(input, warn);

  const leans = usageFitLeans(input, sizeClass, ruleRunningCost);
  let usageFit = [...leans];
  let usageSource: Provenance | undefined = leans.length ? 'rule' : undefined;

  // runningCost resolution: start from the rule; the model may only fill a gap.
  let runningCost: RunningCost | undefined = ruleRunningCost;
  let runningCostSource: Provenance | undefined = ruleRunningCost ? 'rule' : undefined;

  // Optional model judgment — ONE call refines `usageFit` and, when the rule left
  // runningCost unset, provides a fallback. Side-effect free on failure: any
  // throw/timeout keeps the rule results. `judge === false` skips it (offline).
  if (opts.judge !== false) {
    const judge = typeof opts.judge === 'function' ? opts.judge : defaultEnrichmentJudge;
    try {
      const judgment = await judge(input, leans);

      // usageFit merge — unchanged behaviour (union with rule leans, off-enum dropped).
      const rawFit = judgment?.usageFit;
      const validFit = (Array.isArray(rawFit) ? rawFit : []).filter((f): f is UsageFit =>
        (USAGE_FITS as readonly string[]).includes(f),
      );
      if (validFit.length) {
        const merged = new Set<UsageFit>([...leans, ...validFit]);
        if (merged.size > leans.length || leans.length === 0) usageSource = 'model';
        usageFit = [...merged];
      }

      // runningCost fallback — ONLY when the rule had no measured value. The rule
      // value (when present) is left untouched: measured always beats the model.
      if (ruleRunningCost === undefined) {
        const rawCost = judgment?.runningCost;
        // Validate against the enum; null/abstain or anything off-enum → leave unset.
        if (rawCost != null && (RUNNING_COSTS as readonly string[]).includes(rawCost)) {
          runningCost = rawCost;
          runningCostSource = 'model';
        }
      }
    } catch (err) {
      console.warn('[enrich] model judgment failed — keeping rule results', opts.id ?? '(no id)', err);
    }
  }

  if (!usageFit.length) warn('usageFit', 'no confident usage signal from rules or model');
  // Only warn once BOTH the rule and the model have left runningCost unset.
  if (!runningCost) warn('runningCost', 'no measured fuelEconomy and no model judgment');

  const aiAttributes: AiAttributes = {};
  const sources: DeriveResult['sources'] = {};
  if (runningCost) {
    aiAttributes.runningCost = runningCost;
    sources.runningCost = runningCostSource ?? 'rule';
  }
  if (sizeClass) {
    aiAttributes.sizeClass = sizeClass;
    sources.sizeClass = 'rule';
  }
  if (usageFit.length) {
    aiAttributes.usageFit = usageFit;
    sources.usageFit = usageSource ?? 'rule';
  }

  return { aiAttributes, sources, warnings };
}
