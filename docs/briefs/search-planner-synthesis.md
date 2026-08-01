# Search query planner — orchestrator synthesis (Phase 1, for owner sign-off)

Contest record: `search-planner-candidate-1.md` (C1), `search-planner-candidate-2.md` (C2),
`search-planner-critique.md` (critic). This doc names the winner, states exactly what is imported from
the loser, fixes the flaws **both** shared, and gives the final schema + prompt + policy + tests. It is
Phase-1 design only — no production code ships until you approve.

---

## 1. Synthesis verdict

**Winner (base): Candidate 2** — its schema skeleton and its taxonomy *discipline*. Two reasons, both
on the axes the brief weights hardest:

1. **One-shot emit reliability.** C2's `seats: z.array(z.number().int())` cannot fail Zod on an
   off-list value (e.g. a model reasoning to `[6]`), where C1's literal-union `seats` is the single most
   likely first-shot validation failure in either schema. On a Haiku-class model between keystroke and
   results, a schema that never hard-fails on a plausible value wins.
2. **Family-body restraint.** C2 applies *only the almost-always-true part* of a soft signal — `family →
   seats [5]`, **no forced body type** — while C1 forces `bodyType:[hatchback,suv]` on "family", which
   excludes sedans and wagons (both common family cars) and narrows recall on the exact flagship demo
   query. C2's "apply the part that's never wrong, never the part that's a guess" is the sharper rule.

**Imported from Candidate 1 (the loser) — three things, explicitly:**

1. **The clarification gate.** C1's rule is mechanical where C2's is not: flag **only** when a soft
   signal *narrows* **price or seats** the shopper didn't state (C1 §4 r1), with an explicit **price >
   seats** tie-break (r2). I adopt this verbatim over C2's "high mis-rank cost" wording, which the brief
   itself flagged as a vibe.
2. **The "never invent a price number" rule.** Lifestyle wording ("cheap", "second car") **never** sets
   `priceMax`; it flags budget. This fixes a real bug in C2 (see §1 disagreement below), not a nit.
3. **Enum-typed inference key + enum clarification topic.** C1's `field` enum and `topic` enum are
   machine-safe and renderable; I graft them onto C2's per-phrase inference shape and its quoted
   `signal`.

**Where I disagree with the critic.** The critic called it "low-confidence, near-even". I agree on the
schema skeleton but rate **one C2 flaw as disqualifying for its own clarification policy, not a nit:**
C2 *flags* budget on "second car" (§7 ex.1) yet *silently applies* `priceMax: 25000` on "cheap little
runabout" (§7 ex.9). Applying a hard $25k ceiling to "cheap" is exactly the "infuriating when wrong"
case the gate exists to prevent — a shopper after a cheap $32k SUV is silently excluded. So the final
design takes **C1's price handling wholesale** and overrides C2's ex.9: *"cheap/affordable" with no
figure → flag budget, leave `priceMax` null.* This is a substantive call worth your eye — it means
budget-flavoured words without a number produce a one-question budget flag rather than a fabricated
ceiling. The plan still runs (results show immediately); the flag is optional to answer.

**What BOTH candidates missed (my last-set-of-eyes additions):**

- **F1 — the config `concepts` entry fights the family fix.** Both prompts interpolate
  `chat.search.concepts` verbatim, whose family entry (`dealer.ts` ~L848) still says *"suv/wagon, seats
  7/8 when several children."* Changing `familySeats` to `[5]` without rewriting that concept feeds the
  model **two contradictory family instructions**. The family-trap fix is a **two-line config change**,
  not one (§6).
- **F2 — redundant field pairs that pass Zod while self-contradicting.** C1's `needsClarification`↔
  `clarification` and C2's `kind`↔`noPlanReason` can each emit an inconsistent-but-valid object that
  never triggers the repair. The final schema **collapses both axes to single derived fields** (a single
  `kind` enum; `clarification` nullable with no companion boolean) — neither candidate did this.
- **F3 — `interpretation` is an unguarded free-text surface** on the search path, outside the
  `verify.ts` firewall. Neither prompt forbids it asserting stock. The final `.describe()` + a prompt
  rule hard-forbid counts/"we have…" claims (§2, §3).
- **F4 — inference key ↔ chip-helper mismatch.** Inference keys (`seats`, `priceMin`, `odoMax`, …) don't
  line up 1:1 with `activeChips`/`DIMENSION_LABELS` dimension names (`seatCount`, `price`, `odometer`).
  A small deterministic adapter is needed in Phase 2 (§8) — constraining `fields[]` to the `FilterField`
  enum makes that adapter total.
- **F5 — keyword-with-filters is new behaviour.** The regex extractor deliberately *never* layers a
  keyword on top of structured filters (`vehicle-filter-extract.ts:258`). The LLM planner does (e.g.
  "red hilux" → `colour:[red] + keyword:"hilux"`), which is *better* (precise, not a residual-noun
  heuristic) — but Phase 2 must confirm `/api/search` ANDs keyword with filters rather than dropping it
  (§8 risk).

---

## 2. Final Zod v4 schema

Every field carries a `.describe()` (the model's only per-field instruction). Flat, all-keys-required,
`[]`/`null` for "unset", `nullable` not `optional`, one level of nesting — the shape the candidates'
proofs agree emits reliably one-shot.

```ts
import { z } from 'zod';

// Contract enums — mirror parseFilters allowed sets. The executor re-validates and
// silently drops any code not in the dealer's live set, so emitting the full set is safe.
const BodyType = z.enum(['sedan', 'hatchback', 'suv', 'ute', 'wagon', 'van', 'coupe', 'convertible']);
const Colour = z.enum(['white', 'black', 'silver', 'grey', 'blue', 'red', 'green', 'gold', 'brown', 'orange', 'yellow', 'purple']);
const Transmission = z.enum(['auto', 'manual']);
const FuelType = z.enum(['petrol', 'diesel', 'hybrid', 'electric', 'lpg']);
const DriveType = z.enum(['2wd', 'awd', '4wd']);
const Condition = z.enum(['new', 'used', 'demo']);

// Machine-safe key set for disclosure (imported from C1). Matches FilterState keys 1:1.
const FilterField = z.enum([
  'bodyType', 'colour', 'transmission', 'fuelType', 'driveType',
  'condition', 'seats', 'priceMin', 'priceMax', 'yearMin', 'yearMax', 'odoMax',
]);

const Filters = z
  .object({
    bodyType: z.array(BodyType).describe('Body styles to include (OR of the values). Empty [] = no body-type constraint. Only add a body type the shopper names or clearly implies; do NOT narrow body type on a weak lifestyle hint (a "family" car can be a hatch, wagon, sedan or SUV).'),
    colour: z.array(Colour).describe('Colour families the shopper explicitly named. Empty [] unless a colour is stated. Never infer a colour from lifestyle wording.'),
    transmission: z.array(Transmission).describe('"auto" or "manual". Empty [] unless stated or strongly implied ("easy to drive" → auto).'),
    fuelType: z.array(FuelType).describe('Fuel codes. Empty [] unless the shopper NAMES a fuel. Never emit a fuel for "economical"/"cheap to run" — a small petrol is economical, so forcing hybrid/electric wrongly excludes stock.'),
    driveType: z.array(DriveType).describe('"2wd" | "awd" | "4wd". Empty [] unless off-road/towing/adventure intent or an explicit drivetrain (towing → 4wd, optionally awd).'),
    condition: z.array(Condition).describe('"new" | "used" | "demo". "secondhand"/"pre-owned"/"used" → ["used"]; "brand new" → ["new"]; "demo"/"ex-demo" → ["demo"]. If the shopper contradicts themselves ("new secondhand"), leave [] and raise a clarification.'),
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
```

**Two schema improvements over both candidates (fix F2):** a single `kind` enum (no `noPlanReason`
companion), and a bare nullable `clarification` (no `needsClarification` boolean). Neither redundant,
self-contradicting pair can now be emitted. `seats` is open-int (C2, emit-safe) but the `.describe()`
carries the valid set + nearest-available rule (C1's intent, without the hard-fail).

---

## 3. Final system prompt (≈ 560 tokens fixed + ~120 for concepts; under the 800 budget)

`{{softConcepts}}` expands from `dealerConfig.chat.search.concepts` (one line per `{phrase, maps}`).
`{{familySeats}}`, `{{lowKmThreshold}}`, `{{dealerName}}` interpolate from config. **The family concept
must be rewritten in config (§6) so the interpolated text and the fix agree** — this prompt states the
large-family escalation once and does not restate the bare-family mapping (that lives in the concept).

```text
You are the search planner for {{dealerName}}, a used-car dealership. A shopper typed one line into the
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
   - "economical"/"cheap to run" is NOT a fuel — never force hybrid/electric.
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
redirect). NEVER assert stock or a result count.
```

---

## 4. Clarification policy (numbered, mechanical)

The planner **flags**; Rebi asks. Rules, in order:

1. **Trigger — all three required.** Flag iff **(a)** a *soft* signal (not an explicit word) drove a
   **narrowing** constraint on **price or seats** the shopper didn't state, **(b)** the trigger phrase
   has a well-known two-way reading that flips that constraint, and **(c)** one phrase-length question
   resolves it. Explicit figures never trigger. Broadening / body-style / colour inferences never
   trigger (cheap to be wrong, reversible by a chip).
2. **At most one; price beats seats.** If several qualify, keep the highest-impact: **price > seats**.
   Anything not about price or seats is resolved by best-guess + disclosure, never a question.
3. **Plan still runs.** `filters` is always populated with the best guess even when flagged. Sole
   exception: a direct contradiction leaves the contested dimension `[]`. Search never blocks on an
   answer.
4. **Contradiction sub-rule.** Conflicting explicit signals on one dimension ("new" + "secondhand") →
   that dimension `[]`, `topic` = that dimension (`condition`), one question.
5. **Fields Rebi needs — exactly two.** `clarification.topic` (enum `budget|seats|condition` → the UI
   pre-wires quick-reply chips and de-dupes by axis within a session) and `clarification.question` (the
   verbatim spoken sentence — the planner owns phrasing, so the conversation layer needs no second
   model call). "Needs clarification" is derived as `clarification !== null`; there is no boolean field
   to fall out of sync.
6. **No fabricated budgets.** "cheap"/"affordable"/"budget" with no figure → flag budget, `priceMax`
   stays null. (Overrides C2's silent-band behaviour — see §1 disagreement.) *Deliberate tradeoff:*
   budget-flavoured words without a number produce a one-question flag rather than a guessed ceiling;
   results still render immediately. A future config `budgetBands` could offer opt-in typed quick-replies
   without the model inventing a number.

---

## 5. Inference transparency

`inferences: [{ signal, assumed, fields }]` carries everything the UI + Rebi need in the **single**
response — no second model call:

- **`signal`** quotes the shopper's own words → the chip reads *"for our family"* (a UX asset from C2).
- **`assumed`** is a pre-written speakable line → Rebi voices it verbatim; the chip tooltip shows it.
- **`fields`** is an **enum array of FilterState keys** (from C1) → tapping "not right" clears exactly
  those filters and re-runs the search through **`applyFilterUrl`** (never a hand-built URL — filter-URL
  hard constraint). See F4 (§8) for the key→chip-dimension adapter Phase 2 adds.

Explicit filters are deliberately absent from `inferences` (no chip clutter for words the shopper
typed). `interpretation` is the one-line summary above the chips, and is grounding-guarded (§2/§3).

---

## 6. Family-trap fix (config change — TWO lines, fixes F1)

1. **`dealerConfig.chat.grounding.lookup.familySeats`: `[7, 8]` → `[5]`.** A household's family car —
   *especially a second car* — is overwhelmingly a 5-seat hatch/wagon/SUV, not a people-mover. `[5]` is
   a first-class `SEAT_OPTIONS` value and round-trips `parseFilters` unchanged. **Shared with the regex
   fallback** (`extractFilters` reads the same key), so both paths agree — a virtue, not drift; kept in
   one place on purpose (addresses the critic's config-hygiene note without duplicating the value).
2. **`dealerConfig.chat.search.concepts` family entry (`dealer.ts` ~L848): rewrite** from *"bodyType suv
   or wagon, and seats 7 or 8 when they mention several children"* → *"seats {{familySeats}} (room for
   the family); do NOT force a body type; use 7–8 seats only on explicit large-family cues (several kids
   / third row / people-mover / stated 7+)."* Without this, the interpolated concept contradicts the
   `familySeats` fix inside the same prompt (F1).

Escalation to `[7,8]` is driven by explicit large-family cues in the prompt's universal rules — those
seat counts are universal `SEAT_OPTIONS`, not a dealer preference, so naming them is tenant-safe.

---

## 7. Test suite (15 cases)

Full JSON for the canonical + four failure modes; compact rows for the rest. The harness
(`scripts/eval/search-planner-eval.ts`, §9) carries exact JSON for all 15 and validates each against the
§2 schema. Assumes `familySeats=[5]`, `lowKmThreshold=60000`.

### Case 1 — canonical: `"a secondhand vehicle as a second car for our family"`

```json
{
  "kind": "search",
  "filters": {
    "bodyType": [], "colour": [], "transmission": [], "fuelType": [], "driveType": [],
    "condition": ["used"], "seats": [5],
    "priceMin": null, "priceMax": null, "yearMin": null, "yearMax": null, "odoMax": null
  },
  "keyword": null,
  "inferences": [
    { "signal": "for our family", "assumed": "room for the family — a 5-seat car", "fields": ["seats"] }
  ],
  "clarification": {
    "topic": "budget",
    "question": "Is the second car more about keeping costs down, or just an extra runabout? Give me a budget and I'll tighten it up."
  },
  "interpretation": "Used, 5-seat family car; I asked a budget question about the second car."
}
```
*Fixes the original bug on every axis: "secondhand" → `condition:["used"]` (synonym gap closed); "family"
→ `seats:[5]` not `[7,8]` (family trap), no forced body (recall preserved); "second car" → budget
**flagged**, never fabricated.*

### Case 2 — `"Family SUV with 7 seats under $40,000"`

```json
{
  "kind": "search",
  "filters": { "bodyType": ["suv"], "colour": [], "transmission": [], "fuelType": [], "driveType": [], "condition": [], "seats": [7], "priceMin": null, "priceMax": 40000, "yearMin": null, "yearMax": null, "odoMax": null },
  "keyword": null, "inferences": [], "clarification": null,
  "interpretation": "7-seat SUVs under $40,000."
}
```
*All explicit — "7 seats" stated so `[7]`, SUV + price direct; no inference, no flag. "Family" redundant.*

### Case 6 — failure: `"do you have a MG4"` (unverifiable make/model)

```json
{
  "kind": "search",
  "filters": { "bodyType": [], "colour": [], "transmission": [], "fuelType": [], "driveType": [], "condition": [], "seats": [], "priceMin": null, "priceMax": null, "yearMin": null, "yearMax": null, "odoMax": null },
  "keyword": "mg4", "inferences": [], "clarification": null,
  "interpretation": "Searching our stock for an MG4."
}
```
*Not a failure — still `kind:"search"`; the planner can't know the catalogue, so it emits the keyword and
lets the executor return zero-or-more. Never asserts stock.*

### Case 7 — failure: `"new secondhand car"` (contradiction)

```json
{
  "kind": "search",
  "filters": { "bodyType": [], "colour": [], "transmission": [], "fuelType": [], "driveType": [], "condition": [], "seats": [], "priceMin": null, "priceMax": null, "yearMin": null, "yearMax": null, "odoMax": null },
  "keyword": null, "inferences": [],
  "clarification": { "topic": "condition", "question": "Did you mean a brand-new car or a used one? I can show either." },
  "interpretation": "Cars — new or used; just need to confirm which."
}
```
*Conflicting explicit condition → drop `condition` (search runs across all), flag the one question.*

### Case 8 — failure: `"what are your opening hours"` (zero vehicle content)

```json
{
  "kind": "not_vehicle",
  "filters": { "bodyType": [], "colour": [], "transmission": [], "fuelType": [], "driveType": [], "condition": [], "seats": [], "priceMin": null, "priceMax": null, "yearMin": null, "yearMax": null, "odoMax": null },
  "keyword": null, "inferences": [], "clarification": null,
  "interpretation": "That's one for the team, not a car search — I'll pass it to Rebi."
}
```

### Case 9 — failure: `"asdfghjkl qwerty"` (gibberish)

```json
{
  "kind": "gibberish",
  "filters": { "bodyType": [], "colour": [], "transmission": [], "fuelType": [], "driveType": [], "condition": [], "seats": [], "priceMin": null, "priceMax": null, "yearMin": null, "yearMax": null, "odoMax": null },
  "keyword": null, "inferences": [], "clarification": null,
  "interpretation": "That didn't look like a car search — mind trying again?"
}
```

### Cases 3–5, 10–15 (compact — full JSON in the harness)

| # | Query | Key expected output | Rationale |
|---|---|---|---|
| 3 | `Reliable diesel ute for towing, low kms` | `bodyType:[ute] fuel:[diesel] drive:[4wd] odoMax:60000`; infer `driveType` (towing), `odoMax` (low kms); no flag | Explicit diesel/ute; towing→4wd disclosed; low-kms→threshold (mapping, not invented); "reliable" is noise |
| 4 | `First car for my daughter, automatic, under $15k` | `transmission:[auto] priceMax:15000`; infer `bodyType:[hatchback]` (first car); no flag | Auto + budget explicit; first-car→small hatch disclosed; budget stated so no flag |
| 5 | `red hilux` | `colour:[red] keyword:"hilux"`; no infer, no flag | Colour explicit; make/model in keyword (keyword + filter together — F5) |
| 10 | `white automatic hybrid under 30k, low kms` | `colour:[white] trans:[auto] fuel:[hybrid] priceMax:30000 odoMax:60000`; infer `odoMax`; no flag | Five explicit dims; only low-kms is an inference |
| 11 | `tow the boat, big diesel, plenty of room` | `bodyType:[ute,suv] fuel:[diesel] drive:[4wd,awd]`; infer body+drive (towing); no flag | Diesel explicit; towing→ute/4wd disclosed; "big/room" too vague for a seat count |
| 12 | `cheap little runabout for the city` | `bodyType:[hatchback] priceMax:null`; infer `bodyType`; **flag budget** | **Override of C2:** "cheap" with no figure → flag budget, never fabricate $25k (policy r6) |
| 13 | `something economical for the commute` | `bodyType:[hatchback] fuelType:[]`; infer `bodyType`; no flag | "economical" is running-cost not a fuel — bias small hatch, never force hybrid/electric |
| 14 | `show me everything you've got` | all filters empty, `keyword:null`, `kind:search`, no flag | Valid empty search → executor returns full inventory; not a no-plan |
| 15 | `manual 4x4 diesel under 200k kms, prefer white or silver` | `trans:[manual] drive:[4wd] fuel:[diesel] colour:[white,silver] odoMax:200000`; no infer, no flag | All explicit incl. multi-colour OR and an explicit odo figure |

---

## 8. Phase-2 wiring plan, files, and risks (no code until approval)

**Files Phase 2 will touch:**
- **New** `src/ai/search/query-planner.ts` (or `src/lib/search/`) — the `SearchPlan` schema (§2), the
  prompt builder that interpolates config, and `planSearch(query): Promise<SearchPlan | null>` calling
  `generateObject` on the `structured` tier. **All-AI-through-`src/ai/`** honoured.
- **`src/pages/api/search.ts`** (~L135) — the pre-pass: try `planSearch(query)` with a timeout; on a
  usable `kind:"search"` plan, project `plan.filters` onto `FilterState` and run the executor; on
  `not_vehicle`/`gibberish`/null/timeout/exhausted-retry, **fall back to `extractFilters(query)`** (the
  existing regex path) exactly as today. Surface `inferences`/`clarification`/`interpretation` to the
  SmartSearch island + Rebi.
- **`src/config/dealer.ts`** — the two family-trap lines (§6) + a `chat.search.planner` block for the
  timeout and an `enabled` kill-switch (config-as-data; regex-only when off).
- **`docs/DECISIONS.md`** — a new decision recording the taxonomy, the apply-and-disclose model, and the
  clarification gate.
- **Test:** promote `scripts/eval/search-planner-eval.ts` (§9) to a kept test.

**Risks / open wiring questions (flag before build):**
- **R1 (F5):** confirm `/api/search` ANDs `keyword` with structured filters (don't drop keyword when
  filters present, and don't let a keyword add a spurious clause — the LLM keyword is precise, so the
  old residual-noun guard shouldn't apply).
- **R2 (F4):** build the `FilterField → activeChips` dimension adapter (`seats→seatCount`,
  `priceMin/priceMax→price`, `odoMax→odometer`, `yearMin/yearMax→year`).
- **R3 (F3):** decide whether `interpretation` also gets a lightweight server-side stock-claim check, or
  the prompt rule + `.describe()` guard suffices. (Recommend: prompt guard now; revisit if a demo shows
  drift.)
- **R4 latency/cost:** `structured` tier is Haiku primary (paid) + free gemma fallback. A per-search LLM
  call adds latency + spend; the config timeout + `enabled` kill-switch bound both, and the regex path is
  always the floor.
- **R5 policy tradeoff (r6):** budget-flavoured words now flag rather than guess — more budget questions.
  Acceptable? Owner call.

---

## 9. Test-harness status (proof)

A standalone eval harness (`scripts/eval/search-planner-eval.ts`, NOT wired into any production path)
defines the §2 schema and all 15 expected outputs, and:
- **Offline (runs here):** `safeParse`s every expected output against the schema → proves the schema
  compiles under Zod v4 and all 15 examples are self-consistent with it. *(Result reported in the
  presentation message.)*
- **Live (blocked):** runs each query through `generateObject` on the real `structured` tier and reports
  the one-shot validation pass rate — **requires `OPENROUTER_API_KEY`, which is absent from `.env` and
  `.dev.vars` in this environment.** The harness is wired to run the moment a key is present; the live
  pass rate is an owner-gated follow-up, not a silent skip.

---

## 10. Rejected alternatives (preserved for DECISIONS.md)

1. **Per-signal confidence floats (0–1).** Rejected — a Haiku-class model can't calibrate them; chips
   need words (`assumed`), not numbers. (Both candidates rejected this too.)
2. **Weighted "soft hints" fed to a ranker.** Rejected — the executor is a deterministic boolean GROQ
   filter, not a scorer; weights have nowhere to land without a re-ranking layer the grounding rule
   forbids.
3. **Literal-union `seats` (C1).** Rejected as the base — most likely one-shot Zod failure; kept its
   *intent* (valid-set guidance) in the `.describe()` instead.
4. **Keeping `needsClarification`/`noPlanReason` companion flags.** Rejected — redundant pairs that pass
   Zod while self-contradicting (F2); collapsed to single derived fields.
5. **Silently applying a config budget band for "cheap" (C2 ex.9).** Rejected — fabricates a ceiling that
   excludes good stock; the exact "infuriating when wrong" failure; flag instead.
6. **A separate `softFilters` object the executor treats as optional.** Rejected — splits the projection
   and invites divergence; one `filters` object + `inferences[]` disclosure keeps a single source the
   executor already understands.
7. **Structured `clarification.options[]` (typed quick-replies).** Rejected for now — adds emit burden;
   the enum `topic` already lets the UI render quick-replies from config, keeping number-choice out of
   the model.
```
