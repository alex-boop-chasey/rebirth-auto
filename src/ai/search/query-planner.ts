/**
 * LLM search-query planner — the PRIMARY interpreter on `/api/search`.
 * ---------------------------------------------------------------------------
 * Turns one shopper search line into a structured `SearchPlan` (the owner-signed
 * design in `docs/briefs/search-planner-synthesis.md`). It sits as Stage 0 ahead
 * of the deterministic regex pre-pass; on ANY failure/timeout `planSearch`
 * returns `null` so the caller falls back to the existing regex + Stage-2 chain,
 * byte-identical to pre-planner behaviour.
 *
 * Discipline:
 *  - ALL AI through `~/ai` (`generateObject` on the `structured` tier). Never
 *    OpenRouter directly, never `src/ai/providers/*`.
 *  - CONFIG AS DATA: the dealer name, family seats, low-km threshold, soft
 *    concepts, timeout and kill-switch all come from `dealerConfig` — nothing is
 *    hardcoded here.
 *  - GROUNDING: the planner emits a query plan only — never inventory, never a
 *    fabricated price/number. `interpretation` never asserts stock or a count.
 *
 * The §2 `SearchPlan` schema below is transcribed VERBATIM from the proof harness
 * `scripts/eval/search-planner-eval.ts` (15/15 offline conformance) — the source
 * of truth. Keep the two in lockstep.
 */
import { z } from 'zod';
import { configureAI, generateObject } from '~/ai';
import { APP_URL, APP_TITLE, REQUEST_TIMEOUT_MS } from '~/chatbot/config';
import { getChatEnv } from '~/chatbot/get-env';
import { dealerConfig } from '~/config/dealer';
import { parseFilters, activeChips, type FilterState } from '~/lib/listings-query';
import type { SearchResponse } from '~/lib/ai-search/schema';

// ---------------------------------------------------------------------------
// §2 — Final Zod v4 `SearchPlan` schema (verbatim from the proof harness).
// ---------------------------------------------------------------------------

// Contract enums — mirror parseFilters allowed sets. The executor re-validates and
// silently drops any code not in the dealer's live set, so emitting the full set is safe.
const BodyType = z.enum(['sedan', 'hatchback', 'suv', 'ute', 'wagon', 'van', 'coupe', 'convertible']);
const Colour = z.enum(['white', 'black', 'silver', 'grey', 'blue', 'red', 'green', 'gold', 'brown', 'orange', 'yellow', 'purple']);
const Transmission = z.enum(['auto', 'manual']);
const FuelType = z.enum(['petrol', 'diesel', 'hybrid', 'electric', 'lpg']);
const DriveType = z.enum(['2wd', 'awd', '4wd']);
const Condition = z.enum(['new', 'used', 'demo']);
// AI-derived soft dimensions (mirror the Sanity `aiAttributes` object). The executor
// re-validates and drops any code not in the live set, so emitting the full set is safe.
const RunningCost = z.enum(['low', 'medium', 'high']);
const UsageFit = z.enum(['city', 'family', 'highway', 'towing', 'tradie', 'first-car']);
const SizeClass = z.enum(['compact', 'medium', 'large']);

// Machine-safe key set for disclosure (imported from C1). Matches FilterState keys 1:1.
const FilterField = z.enum([
  'bodyType', 'colour', 'transmission', 'fuelType', 'driveType',
  'condition', 'runningCost', 'usageFit', 'sizeClass',
  'seats', 'priceMin', 'priceMax', 'yearMin', 'yearMax', 'odoMax',
]);

const Filters = z
  .object({
    bodyType: z.array(BodyType).describe('Body styles to include (OR of the values). Empty [] = no body-type constraint. Only add a body type the shopper names or clearly implies; do NOT narrow body type on a weak lifestyle hint (a "family" car can be a hatch, wagon, sedan or SUV).'),
    colour: z.array(Colour).describe('Colour families the shopper explicitly named. Empty [] unless a colour is stated. Never infer a colour from lifestyle wording.'),
    transmission: z.array(Transmission).describe('"auto" or "manual". Empty [] unless stated or strongly implied ("easy to drive" → auto).'),
    fuelType: z.array(FuelType).describe('Fuel codes. Empty [] unless the shopper NAMES a fuel. Never emit a fuel for "economical"/"cheap to run" — a small petrol is economical, so forcing hybrid/electric wrongly excludes stock.'),
    driveType: z.array(DriveType).describe('"2wd" | "awd" | "4wd". Empty [] unless off-road/towing/adventure intent or an explicit drivetrain (towing → 4wd, optionally awd).'),
    condition: z.array(Condition).describe('"new" | "used" | "demo". "secondhand"/"pre-owned"/"used" → ["used"]; "brand new" → ["new"]; "demo"/"ex-demo" → ["demo"]. If the shopper contradicts themselves ("new secondhand"), leave [] and raise a clarification.'),
    runningCost: z.array(RunningCost).describe('AI-derived cost-to-run band. Empty [] unless the shopper implies running cost. "economical"/"cheap to run"/"good on fuel"/"fuel efficient" → ["low"]. This is the RIGHT home for "economical" — do NOT force a fuelType for it.'),
    usageFit: z.array(UsageFit).describe('AI-derived best-fit use cases (OR of the values). Empty [] unless a use case is implied. "city"/"runabout"/"commute" → include "city"; "first car"/"learner"/"P-plate" → include "first-car"; towing/caravan/boat → include "towing"; "tradie"/"work truck" → include "tradie"; highway/touring/long trips → include "highway"; a family car → include "family".'),
    sizeClass: z.array(SizeClass).describe('AI-derived overall size class. Empty [] unless size is implied. "small"/"compact"/"city car" → ["compact"]; "large"/"big" → ["large"].'),
    seats: z.array(z.number().int()).describe('Seat counts to include. Allowed values: 2, 4, 5, 7, 8 — if the shopper asks an unavailable count, pick the nearest available or leave []. Empty [] = no seat constraint. A plain "family" car is a 5-seater; use [7,8] ONLY on explicit large-family cues (several kids / third row / people-mover / a stated 7+).'),
    priceMin: z.number().int().nullable().describe('Minimum price in AUD, or null. Only from an explicit figure ("over $20k"). Never invented from lifestyle wording.'),
    priceMax: z.number().int().nullable().describe('Maximum price in AUD, or null. Only from an explicit figure ("under $30k", "around 25000"). If a soft signal implies "cheap"/budget but names NO figure, keep null and raise a budget clarification — never fabricate a ceiling.'),
    yearMin: z.number().int().nullable().describe('Earliest build year, or null. An explicit year wins; "late-model"/"newer" MAY set a recent yearMin only if confident.'),
    yearMax: z.number().int().nullable().describe('Latest build year, or null. Set only when the shopper caps the year.'),
    odoMax: z.number().int().nullable().describe('Maximum odometer in km, or null. An explicit figure ("under 50,000 km") wins; a bare "low kms"/"low mileage" with no number → the configured low-km threshold.'),
  })
  .describe('The deterministic FilterState projection handed to the executor. Every key is always present; use [] or null for "no constraint". Combines explicit filters AND applied soft inferences. Never add keys.');

const Inference = z
  .object({
    signal: z.string().describe('The exact words from the query that triggered this assumption, e.g. "for our family". Quoted back to the shopper on the chip.'),
    assumed: z.string().describe('Plain, speakable statement of what you assumed, e.g. "room for the family — a 5-seat car". No jargon; read aloud by Rebi and shown as a removable chip.'),
    fields: z.array(FilterField).describe('Which Filters keys this inference set, e.g. ["seats"]. Must be keys you actually populated. Lets the UI clear exactly those filters if the shopper taps the chip off.'),
  })
  .describe('One soft inference that was APPLIED to filters and is disclosed. One entry per phrase (not per field). List ONLY inferred filters, never explicit ones the shopper stated.');

const Clarification = z
  .object({
    topic: z.enum(['budget', 'seats', 'condition']).describe('The single dimension Rebi should confirm. Enables pre-wired quick-reply chips. Only these axes ever warrant a question.'),
    question: z.string().describe('One short, friendly question Rebi speaks verbatim to confirm the pivotal assumption. Answerable in a phrase.'),
  })
  .describe('The at-most-one clarification, or null. The filters plan MUST still be a usable search if the shopper ignores it.');

export const SearchPlan = z
  .object({
    kind: z.enum(['search', 'not_vehicle', 'gibberish']).describe('"search" = a vehicle query (even vague or a model we may not stock) → fill filters. "not_vehicle" = coherent but not about finding a car (hours, finance, trade-in, directions) → empty filters, route to chat. "gibberish" = no discernible meaning → empty filters. Single field: no separate reason flag.'),
    filters: Filters,
    keyword: z.string().nullable().describe('A make/model/nameplate you cannot express as a filter, lowercase, e.g. "hilux", "mg4". You CANNOT know whether it is in stock — emit it anyway; the executor matches real inventory and returns nothing if absent. null when no model is named.'),
    inferences: z.array(Inference).describe('Every soft assumption applied to filters, for UI disclosure. [] when every filter came from explicit words, or when kind is not "search".'),
    clarification: Clarification.nullable().describe('One clarification or null. There is NO separate boolean — "needs clarification" is derived in code as (clarification !== null). null whenever the plan is confident or kind is not "search".'),
    interpretation: z.string().describe('One plain sentence describing the SEARCH (the filters) — e.g. "Used 5-seat family car; asked about budget." MUST NOT assert stock, counts, or specific cars (never "we have…", never a number of results). For not_vehicle/gibberish, a friendly redirect.'),
  })
  .describe('The complete search plan for one shopper query. Only the `filters` sub-object becomes URL params (via applyFilterUrl); the wrapper fields are consumed by the caller and never reach parseFilters. This object never contains or implies specific cars.');

export type SearchPlan = z.infer<typeof SearchPlan>;

// ---------------------------------------------------------------------------
// §3 — System prompt builder. Interpolates config placeholders. The
// `{{softConcepts}}` block renders `chat.search.concepts` (one line per entry);
// `{{familySeats}}`, `{{lowKmThreshold}}`, `{{dealerName}}` come from config too.
// Any `{{familySeats}}` token embedded inside a concept's `maps` string is also
// expanded (global replace after assembly), so the family concept can carry the
// live seat count without duplicating the value.
// ---------------------------------------------------------------------------

/** The §3 template — verbatim; placeholders expanded by `buildSystemPrompt`. */
const SYSTEM_PROMPT_TEMPLATE = `You are the search planner for {{dealerName}}, a used-car dealership. A shopper typed one line into the
search bar. Turn it into a structured search plan for our inventory filter, matching the JSON schema.

You NEVER invent, list, promise, or count cars, prices, stock, or numbers. You emit filters + an
optional keyword only; real results come from a separate search over real inventory. Return ONLY the
JSON object.

KIND
- "search": the text is about finding a vehicle → fill filters.
- "not_vehicle": coherent but not a car search (opening hours, finance, trade-in, directions) → empty
  filters, no clarification.
- "gibberish": no discernible meaning → empty filters, no clarification.

THREE KINDS OF SIGNAL
1. EXPLICIT — the shopper named it: "diesel", "under $30k", "7 seats", "auto", "secondhand" (= used),
   "brand new" (= new). Map straight to filters. Do NOT list these in inferences.
2. SOFT — lifestyle wording implying a constraint they did not spell out. Apply ONLY the part that is
   almost always true, and add one inferences entry (signal = their words; assumed = a plain speakable
   line; fields = the keys you set). Dealer mappings:
{{softConcepts}}
   Universal soft rules:
   - Large-family cues (several kids / third row / people-mover / stated 7+) → seats [7,8]. A plain
     "family" is already covered above (a 5-seater; do NOT force a body type).
   - "low kms"/"low mileage" with no figure → odoMax {{lowKmThreshold}}.
   - "economical"/"cheap to run"/"good on fuel" → runningCost ["low"]; it is NOT a fuel — never
     force hybrid/electric (a small petrol is cheap to run).
3. NEVER INVENT A NUMBER. Set priceMin/priceMax/yearMin/yearMax/odoMax ONLY from an explicit figure or a
   configured mapping (low-kms). If a soft signal implies a budget ("cheap", "second car") but names no
   figure, leave price null and raise ONE budget clarification instead.

KEYWORD
A make/model you cannot express as a filter → keyword, lowercased ("hilux", "mg4"). You cannot know if
we stock it — emit it anyway; never guess whether it exists.

CLARIFICATION (at most one; always still return a usable plan)
Set clarification ONLY when ALL hold:
(a) a SOFT signal implies a narrowing constraint on PRICE or SEATS the shopper did not state, AND
(b) two common readings would flip it ("second car" = cheaper vs just another car), AND
(c) one short question settles it.
Pick the single highest-impact one: PRICE over SEATS. Still fill filters with your best guess so search
runs. A direct contradiction ("new secondhand") → leave that dimension [] and clarify it. Otherwise
clarification = null.

interpretation: one short plain sentence describing the plan (or, for not_vehicle/gibberish, a friendly
redirect). NEVER assert stock or a result count.`;

/** Render the config soft concepts as one `- "phrase" → maps` line each. */
function renderSoftConcepts(): string {
  return dealerConfig.chat.search.concepts.map((c) => `- "${c.phrase}" → ${c.maps}`).join('\n');
}

/**
 * Build the §3 system prompt from live config. Expands `{{softConcepts}}` first,
 * then does a GLOBAL replace of the scalar tokens so any token embedded inside a
 * concept string (e.g. the family concept's `{{familySeats}}`) also resolves.
 */
export function buildSystemPrompt(): string {
  const lookup = dealerConfig.chat.grounding.lookup;
  const familySeats = lookup.familySeats.join(', ');
  const lowKmThreshold = String(lookup.lowKmThreshold);
  const dealerName = dealerConfig.identity.name;

  return SYSTEM_PROMPT_TEMPLATE.replace('{{softConcepts}}', renderSoftConcepts())
    .split('{{dealerName}}').join(dealerName)
    .split('{{familySeats}}').join(familySeats)
    .split('{{lowKmThreshold}}').join(lowKmThreshold);
}

// ---------------------------------------------------------------------------
// SearchPlan → SearchResponse mapping (consumed by /api/search Stage 0).
// ---------------------------------------------------------------------------

/**
 * Project a plan's `filters` onto a canonical `FilterState` by writing the values
 * into `URLSearchParams` and running the page's OWN `parseFilters` — so the result
 * is by construction identical to a hard SSR load of the equivalent URL (and any
 * code the dealer doesn't stock is silently dropped by parseFilters).
 */
function planFiltersToState(f: SearchPlan['filters']): FilterState {
  const sp = new URLSearchParams();
  const setMulti = (key: string, arr: readonly (string | number)[]) => {
    if (arr.length) sp.set(key, arr.join(','));
  };
  setMulti('bodyType', f.bodyType);
  setMulti('colour', f.colour);
  setMulti('transmission', f.transmission);
  setMulti('fuelType', f.fuelType);
  setMulti('driveType', f.driveType);
  setMulti('condition', f.condition);
  setMulti('runningCost', f.runningCost);
  setMulti('usageFit', f.usageFit);
  setMulti('sizeClass', f.sizeClass);
  setMulti('seats', f.seats);
  if (f.priceMin != null) sp.set('priceMin', String(f.priceMin));
  if (f.priceMax != null) sp.set('priceMax', String(f.priceMax));
  if (f.yearMin != null) sp.set('yearMin', String(f.yearMin));
  if (f.yearMax != null) sp.set('yearMax', String(f.yearMax));
  if (f.odoMax != null) sp.set('odoMax', String(f.odoMax));
  return parseFilters(sp);
}

/**
 * Map a `kind:"search"` plan onto the island's `SearchResponse`. Confidence is
 * `'high'` when the plan yields at least one active filter or a keyword, else
 * `'low'` (the island applies filters only when confidence !== 'low'). The
 * disclosed inferences ride along additively for a future chip UI; `keyword` is
 * surfaced too (see R1 — not yet applied to the grid).
 */
export function planToSearchResponse(plan: SearchPlan): SearchResponse {
  const filters = planFiltersToState(plan.filters);
  const chips = activeChips(filters);
  const keyword = plan.keyword ?? null;
  const hasSignal = chips.length > 0 || keyword != null;
  const inferenceReasons = plan.inferences.map((i) => i.assumed).filter((s) => s.length > 0);
  const matchReasons = (inferenceReasons.length ? inferenceReasons : chips.map((c) => c.value)).slice(0, 5);
  return {
    interpretation: plan.interpretation,
    confidence: hasSignal ? 'high' : 'low',
    clarifyingQuestion: plan.clarification?.question ?? null,
    filters,
    matchReasons,
    inferences: plan.inferences,
    keyword,
  };
}

// ---------------------------------------------------------------------------
// planSearch — the primary interpreter. Returns null on ANY failure/timeout.
// ---------------------------------------------------------------------------

/**
 * Run the LLM query planner for one shopper query. Returns a validated
 * `SearchPlan`, or `null` on ANY failure (missing key, timeout, thrown error,
 * parse/validation exhaustion) so the caller falls back cleanly to the regex
 * pre-pass + Stage-2 chain.
 *
 * `currentFilters` is accepted for parity with the endpoint's signature but the
 * planner is used for FRESH searches only (refines keep the existing carry-forward
 * path), so it does not carry filters forward.
 */
export async function planSearch(
  query: string,
  _currentFilters?: FilterState,
): Promise<SearchPlan | null> {
  const env = getChatEnv();
  if (!env.OPENROUTER_API_KEY) return null;

  // Match /api/search's configureAI call BYTE-FOR-BYTE so the shared isolate is
  // idempotent-compatible (configureAI throws if re-called with a *different*
  // config within one isolate).
  try {
    configureAI({
      openrouterApiKey: env.OPENROUTER_API_KEY,
      referer: APP_URL,
      appTitle: APP_TITLE,
      attemptTimeoutMs: REQUEST_TIMEOUT_MS,
      streamAttemptTimeoutMs: REQUEST_TIMEOUT_MS,
    });
  } catch (err) {
    console.error('[search-planner] configureAI mismatch, using existing isolate config', err);
  }

  const timeoutMs = dealerConfig.chat.search.planner.timeoutMs;
  const system = buildSystemPrompt();

  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('planner timeout')), timeoutMs),
    );
    const call = generateObject({
      capability: 'structured',
      schema: SearchPlan,
      schemaName: 'SearchPlan',
      maxTokens: 1024, // small payload — bound cost/latency (per-request override)
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: query },
      ],
    });
    const { content } = await Promise.race([call, timeout]);
    const parsed = SearchPlan.safeParse(content);
    return parsed.success ? parsed.data : null;
  } catch (err) {
    console.error('[search-planner] planSearch failed (falling back to regex)', err);
    return null;
  }
}
