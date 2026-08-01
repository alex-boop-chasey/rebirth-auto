/**
 * STANDALONE Phase-1 proof harness for the search-query-planner schema.
 *
 * This file is NOT wired into any production path and imports NO schema from
 * `src/`. It transcribes the §2 `SearchPlan` Zod v4 schema from
 * `docs/briefs/search-planner-synthesis.md` verbatim, encodes all 15 §7/§9 test
 * cases as exact expected JSON, and runs two checks:
 *
 *   1. OFFLINE (always) — `safeParse` every expected output against the inline
 *      schema. Proves the schema compiles under Zod v4 and every example is
 *      self-consistent. Exits non-zero if ANY expected output fails to validate.
 *
 *   2. LIVE (guarded) — only when `OPENROUTER_API_KEY` is set: run each query
 *      through `generateObject` on the `structured` tier with the §3 prompt,
 *      `safeParse` the result, and report a one-shot validation pass rate.
 *      Absent key → prints "LIVE SKIPPED" and does NOT fail on that account.
 *
 * Run:  npx tsx scripts/eval/search-planner-eval.ts
 */

import 'dotenv/config';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// §2 — Final Zod v4 `SearchPlan` schema, transcribed VERBATIM from the brief.
// (Defined inline on purpose: this harness must not import a schema from src/.)
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
// §7 / §9 — the 15 test cases, each as exact expected JSON.
// Assumes familySeats=[5], lowKmThreshold=60000.
// ---------------------------------------------------------------------------

interface TestCase {
  id: number;
  query: string;
  expected: unknown;
}

/** Build a fully-populated Filters object; every key present, [] / null default. */
function filters(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    bodyType: [], colour: [], transmission: [], fuelType: [], driveType: [],
    condition: [], runningCost: [], usageFit: [], sizeClass: [], seats: [],
    priceMin: null, priceMax: null, yearMin: null, yearMax: null, odoMax: null,
    ...overrides,
  };
}

const CASES: TestCase[] = [
  // Case 1 — canonical (full JSON in brief)
  {
    id: 1,
    query: 'a secondhand vehicle as a second car for our family',
    expected: {
      kind: 'search',
      filters: filters({ condition: ['used'], seats: [5] }),
      keyword: null,
      inferences: [
        { signal: 'for our family', assumed: 'room for the family — a 5-seat car', fields: ['seats'] },
      ],
      clarification: {
        topic: 'budget',
        question: "Is the second car more about keeping costs down, or just an extra runabout? Give me a budget and I'll tighten it up.",
      },
      interpretation: 'Used, 5-seat family car; I asked a budget question about the second car.',
    },
  },
  // Case 2 — all explicit (full JSON in brief)
  {
    id: 2,
    query: 'Family SUV with 7 seats under $40,000',
    expected: {
      kind: 'search',
      filters: filters({ bodyType: ['suv'], seats: [7], priceMax: 40000 }),
      keyword: null,
      inferences: [],
      clarification: null,
      interpretation: '7-seat SUVs under $40,000.',
    },
  },
  // Case 3 — compact row expanded
  {
    id: 3,
    query: 'Reliable diesel ute for towing, low kms',
    expected: {
      kind: 'search',
      filters: filters({ bodyType: ['ute'], fuelType: ['diesel'], driveType: ['4wd'], odoMax: 60000 }),
      keyword: null,
      inferences: [
        { signal: 'for towing', assumed: 'set up for towing — four-wheel drive', fields: ['driveType'] },
        { signal: 'low kms', assumed: 'lower kilometres on the clock', fields: ['odoMax'] },
      ],
      clarification: null,
      interpretation: 'Diesel utes with four-wheel drive and lower kilometres, suited to towing.',
    },
  },
  // Case 4 — compact row expanded
  {
    id: 4,
    query: 'First car for my daughter, automatic, under $15k',
    expected: {
      kind: 'search',
      filters: filters({ bodyType: ['hatchback'], transmission: ['auto'], priceMax: 15000 }),
      keyword: null,
      inferences: [
        { signal: 'First car', assumed: 'a small, easy-to-drive hatchback for a first car', fields: ['bodyType'] },
      ],
      clarification: null,
      interpretation: 'Automatic hatchbacks under $15,000, ideal as a first car.',
    },
  },
  // Case 5 — compact row expanded (keyword + filter together, F5)
  {
    id: 5,
    query: 'red hilux',
    expected: {
      kind: 'search',
      filters: filters({ colour: ['red'] }),
      keyword: 'hilux',
      inferences: [],
      clarification: null,
      interpretation: 'Searching our stock for a red HiLux.',
    },
  },
  // Case 6 — unverifiable make/model (full JSON in brief)
  {
    id: 6,
    query: 'do you have a MG4',
    expected: {
      kind: 'search',
      filters: filters(),
      keyword: 'mg4',
      inferences: [],
      clarification: null,
      interpretation: 'Searching our stock for an MG4.',
    },
  },
  // Case 7 — contradiction (full JSON in brief)
  {
    id: 7,
    query: 'new secondhand car',
    expected: {
      kind: 'search',
      filters: filters(),
      keyword: null,
      inferences: [],
      clarification: { topic: 'condition', question: 'Did you mean a brand-new car or a used one? I can show either.' },
      interpretation: 'Cars — new or used; just need to confirm which.',
    },
  },
  // Case 8 — not_vehicle (full JSON in brief)
  {
    id: 8,
    query: 'what are your opening hours',
    expected: {
      kind: 'not_vehicle',
      filters: filters(),
      keyword: null,
      inferences: [],
      clarification: null,
      interpretation: "That's one for the team, not a car search — I'll pass it to Rebi.",
    },
  },
  // Case 9 — gibberish (full JSON in brief)
  {
    id: 9,
    query: 'asdfghjkl qwerty',
    expected: {
      kind: 'gibberish',
      filters: filters(),
      keyword: null,
      inferences: [],
      clarification: null,
      interpretation: "That didn't look like a car search — mind trying again?",
    },
  },
  // Case 10 — compact row expanded
  {
    id: 10,
    query: 'white automatic hybrid under 30k, low kms',
    expected: {
      kind: 'search',
      filters: filters({ colour: ['white'], transmission: ['auto'], fuelType: ['hybrid'], priceMax: 30000, odoMax: 60000 }),
      keyword: null,
      inferences: [
        { signal: 'low kms', assumed: 'lower kilometres on the clock', fields: ['odoMax'] },
      ],
      clarification: null,
      interpretation: 'White automatic hybrids under $30,000 with lower kilometres.',
    },
  },
  // Case 11 — compact row expanded (one entry per phrase, sets body + drive)
  {
    id: 11,
    query: 'tow the boat, big diesel, plenty of room',
    expected: {
      kind: 'search',
      filters: filters({ bodyType: ['ute', 'suv'], fuelType: ['diesel'], driveType: ['4wd', 'awd'] }),
      keyword: null,
      inferences: [
        { signal: 'tow the boat', assumed: 'built for towing — a ute or SUV with four-wheel or all-wheel drive', fields: ['bodyType', 'driveType'] },
      ],
      clarification: null,
      interpretation: 'Big diesel utes and SUVs with four-wheel or all-wheel drive, suited to towing a boat.',
    },
  },
  // Case 12 — compact row expanded (override of C2: flag budget, priceMax null)
  {
    id: 12,
    query: 'cheap little runabout for the city',
    expected: {
      kind: 'search',
      filters: filters({ bodyType: ['hatchback'] }),
      keyword: null,
      inferences: [
        { signal: 'little runabout for the city', assumed: 'a small city hatchback', fields: ['bodyType'] },
      ],
      clarification: {
        topic: 'budget',
        question: "What sort of budget are you working to? Give me a figure and I'll keep it affordable.",
      },
      interpretation: 'Small city hatchbacks; I asked what budget to keep it under.',
    },
  },
  // Case 13 — compact row expanded ("economical" is not a fuel)
  {
    id: 13,
    query: 'something economical for the commute',
    expected: {
      kind: 'search',
      filters: filters({ bodyType: ['hatchback'] }),
      keyword: null,
      inferences: [
        { signal: 'economical for the commute', assumed: 'a small, fuel-efficient hatchback for commuting', fields: ['bodyType'] },
      ],
      clarification: null,
      interpretation: 'Small, economical hatchbacks well suited to commuting.',
    },
  },
  // Case 14 — compact row expanded (valid empty search)
  {
    id: 14,
    query: "show me everything you've got",
    expected: {
      kind: 'search',
      filters: filters(),
      keyword: null,
      inferences: [],
      clarification: null,
      interpretation: 'Showing every vehicle in our inventory.',
    },
  },
  // Case 15 — compact row expanded (all explicit incl. multi-colour OR + explicit odo)
  {
    id: 15,
    query: 'manual 4x4 diesel under 200k kms, prefer white or silver',
    expected: {
      kind: 'search',
      filters: filters({ colour: ['white', 'silver'], transmission: ['manual'], fuelType: ['diesel'], driveType: ['4wd'], odoMax: 200000 }),
      keyword: null,
      inferences: [],
      clarification: null,
      interpretation: 'Manual four-wheel-drive diesels under 200,000 km, in white or silver.',
    },
  },
  // Case 16 — aiAttributes soft dimensions ("cheap to run" → runningCost low; city → usageFit city)
  {
    id: 16,
    query: 'a cheap to run car for city driving',
    expected: {
      kind: 'search',
      filters: filters({ runningCost: ['low'], usageFit: ['city'] }),
      keyword: null,
      inferences: [
        { signal: 'cheap to run', assumed: 'lower running costs', fields: ['runningCost'] },
        { signal: 'city driving', assumed: 'suited to city driving', fields: ['usageFit'] },
      ],
      clarification: null,
      interpretation: 'Cheap-to-run cars suited to city driving.',
    },
  },
];

// ---------------------------------------------------------------------------
// OFFLINE CHECK — safeParse every expected output against the inline schema.
// ---------------------------------------------------------------------------

function firstZodError(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return '(no issue)';
  const path = issue.path.length ? issue.path.join('.') : '(root)';
  return `${path}: ${issue.message}`;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

function runOffline(): boolean {
  console.log(`\n=== OFFLINE CHECK — SearchPlan.safeParse(expected) for all ${CASES.length} cases ===\n`);
  const idW = 3;
  const qW = 52;
  const rW = 4;
  console.log(
    `${'id'.padEnd(idW)} | ${'query'.padEnd(qW)} | ${'res'.padEnd(rW)} | first zod error`
  );
  console.log('-'.repeat(idW + qW + rW + 24));

  let allPass = true;
  for (const c of CASES) {
    const result = SearchPlan.safeParse(c.expected);
    const pass = result.success;
    if (!pass) allPass = false;
    const errText = pass ? '' : firstZodError(result.error);
    console.log(
      `${String(c.id).padEnd(idW)} | ${truncate(c.query, qW).padEnd(qW)} | ${(pass ? 'PASS' : 'FAIL').padEnd(rW)} | ${errText}`
    );
  }

  const passCount = CASES.filter((c) => SearchPlan.safeParse(c.expected).success).length;
  console.log(`\nOffline result: ${passCount}/${CASES.length} expected outputs validate.`);
  return allPass;
}

// ---------------------------------------------------------------------------
// LIVE CHECK (guarded) — only runs when OPENROUTER_API_KEY is present.
// ---------------------------------------------------------------------------

// §3 final system prompt. `{{...}}` placeholders interpolated below. The
// `{{softConcepts}}` block reflects the §6 config rewrite (family → seats [5],
// no forced body type). Live path only — proof tooling, never wired in.
const FAMILY_SEATS = '5';
const LOW_KM_THRESHOLD = '60000';
const DEALER_NAME = 'Bundaberg Motor Group';
const SOFT_CONCEPTS = [
  `- family → seats ${FAMILY_SEATS} (room for the family) and usageFit ["family"]; do NOT force a body type; use 7–8 seats only on explicit large-family cues (several kids / third row / people-mover / stated 7+).`,
  '- first car / learner / P-plate → a small, easy-to-drive automatic (bodyType hatchback, transmission auto), sizeClass ["compact"] and usageFit ["first-car"].',
  '- runabout / city / commute / small → sizeClass ["compact"] and usageFit ["city"]; "economical"/"cheap to run" → runningCost ["low"] (a running-cost band, NOT a fuel).',
  '- towing / tow / caravan / boat → usageFit ["towing"], four-wheel drive (driveType 4wd, optionally awd); a boat/heavy load may also imply a ute or large SUV.',
].join('\n');

function buildSystemPrompt(): string {
  return `You are the search planner for ${DEALER_NAME}, a used-car dealership. A shopper typed one line into the
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
${SOFT_CONCEPTS}
   Universal soft rules:
   - Large-family cues (several kids / third row / people-mover / stated 7+) → seats [7,8]. A plain
     "family" is already covered above (a 5-seater; do NOT force a body type).
   - "low kms"/"low mileage" with no figure → odoMax ${LOW_KM_THRESHOLD}.
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
}

async function runLive(apiKey: string): Promise<void> {
  console.log('\n=== LIVE CHECK — one-shot generateObject on the `structured` tier ===\n');

  // Dynamic import so the offline path never loads the AI client. Imported
  // directly from the layer's public functions (not from providers/).
  const { generateObject } = await import('../../src/ai/client');
  const { configureAI } = await import('../../src/ai/config');
  configureAI({ openrouterApiKey: apiKey, appTitle: 'search-planner-eval' });

  const system = buildSystemPrompt();
  let pass = 0;
  let attempted = 0;

  for (const c of CASES) {
    attempted += 1;
    try {
      const res = await generateObject({
        capability: 'structured',
        schema: SearchPlan,
        schemaName: 'SearchPlan',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: c.query },
        ],
      });
      // generateObject already validated against the schema on success.
      const check = SearchPlan.safeParse(res.content);
      if (check.success) {
        pass += 1;
        console.log(`case ${String(c.id).padStart(2)}  PASS  (${res.modelUsed})  "${c.query}"`);
      } else {
        console.log(`case ${String(c.id).padStart(2)}  FAIL  ${firstZodError(check.error)}  "${c.query}"`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`case ${String(c.id).padStart(2)}  ERROR ${truncate(msg, 120)}  "${c.query}"`);
    }
  }

  const rate = attempted ? ((pass / attempted) * 100).toFixed(1) : '0.0';
  console.log(`\nLive one-shot validation pass rate: ${pass}/${attempted} (${rate}%).`);
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const offlineOk = runOffline();

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (apiKey) {
    await runLive(apiKey);
  } else {
    console.log('\nLIVE SKIPPED — no OPENROUTER_API_KEY. Offline check is authoritative for Phase 1.');
  }

  if (!offlineOk) {
    console.error('\nFAIL: at least one expected output did not validate against the schema.');
    process.exit(1);
  }
  console.log('\nOK: all expected outputs validate against the §2 schema.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
