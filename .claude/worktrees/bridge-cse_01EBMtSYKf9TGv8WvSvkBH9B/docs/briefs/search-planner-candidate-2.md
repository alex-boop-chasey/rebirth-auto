# Search query planner — design (candidate 2)

## 1. Design thesis

A shopper's sentence carries three signal classes, and the whole design hangs on treating them
**differently in one flat plan**:

1. **Explicit filters** — stated attributes ("diesel", "under 30k", "secondhand", "7 seater").
   These go straight into a `filters` object that projects 1:1 onto `FilterState`. No disclosure
   needed — the shopper said them.
2. **Soft inferences** — lifestyle phrases ("family", "first car", "tow the boat") that imply
   attributes. My position: **apply the lowest-risk projection of the signal as a real filter,
   AND disclose it** in an `inferences[]` array that names both the phrase and the fields it set.
   Silent application is what makes the search feel magical; *disclosure* (tappable "I assumed…"
   chips) is the release valve that makes it safe when we're wrong. The discipline is: apply only
   the part of the inference that is almost never wrong (family → *has 5 seats*), never the part
   that is a guess (family → *must be an SUV*).
3. **Load-bearing ambiguities** — a soft signal that implies a *constraint the shopper didn't
   state*, where getting it wrong badly mis-ranks results, and where one question fixes it
   ("second car" = cheap, or just additional?). These do **not** get silently applied. They set a
   single `clarification` object; a usable plan still ships alongside so search never blocks.

The line between "infer and disclose" and "flag and ask" is mechanical (§4), not vibes. For a
live dealer demo this is the winning shape: the model *always* returns real, runnable filters, it
*shows its working* so the salesperson can point at the "I assumed used, 5 seats" chips, and it
asks at most one smart question instead of interrogating. One `generateObject` call, no tools, a
flat schema a Haiku-class model emits in one shot.

---

## 2. Zod v4 schema

Real Zod v4. Every field has `.describe()` — those strings are the model's only per-field
instructions (they render into the JSON Schema that `buildStructuredMessages` injects).

```ts
import { z } from 'zod';

// --- Contract enums (mirror parseFilters in src/lib/listings-query.ts) ----------
const BodyType = z.enum(['sedan', 'hatchback', 'suv', 'ute', 'wagon', 'van', 'coupe', 'convertible']);
const Colour = z.enum(['white', 'black', 'silver', 'grey', 'blue', 'red', 'green', 'gold', 'brown', 'orange', 'yellow', 'purple']);
const Transmission = z.enum(['auto', 'manual']);
const FuelType = z.enum(['petrol', 'diesel', 'hybrid', 'electric', 'lpg']);
const DriveType = z.enum(['2wd', 'awd', '4wd']);
const Condition = z.enum(['new', 'used', 'demo']);

// --- The FilterState projection. Every key is REQUIRED so the emitted shape is
//     deterministic; "no constraint" is [] for arrays and null for scalars. The
//     executor re-validates and silently drops anything off-contract. ----------
const Filters = z
  .object({
    bodyType: z.array(BodyType).describe('Body styles to include. Empty [] means no body-type constraint. Only add a body type when the shopper names or clearly implies one; do not narrow body type on a weak lifestyle hint.'),
    colour: z.array(Colour).describe('Colours to include, lowercase codes. Empty [] unless the shopper names a colour.'),
    transmission: z.array(Transmission).describe('"auto" or "manual". Empty [] unless stated or strongly implied (e.g. "easy to drive" → auto).'),
    fuelType: z.array(FuelType).describe('Fuel type codes. Empty [] unless the shopper NAMES a fuel. Never emit a fuel to satisfy "economical/cheap to run" — a small petrol car is economical, so forcing hybrid/electric wrongly excludes stock.'),
    driveType: z.array(DriveType).describe('"2wd" | "awd" | "4wd". Empty [] unless off-road/towing/adventure intent or an explicit drivetrain.'),
    condition: z.array(Condition).describe('"new" | "used" | "demo". "secondhand"/"used"/"pre-owned" → ["used"]. Leave [] if the shopper contradicts themselves (e.g. "new secondhand") — raise a clarification instead of guessing.'),
    seats: z.array(z.number().int()).describe('Seat counts to include; allowed values are 2, 4, 5, 7, 8. A plain "family" maps to the configured family seats. Only use [7,8] when they signal MANY kids / third row / people-mover / a stated 7+ seats.'),
    priceMin: z.number().int().nullable().describe('Minimum price in AUD, or null. Rarely set — only on "over $X" / "at least $X".'),
    priceMax: z.number().int().nullable().describe('Maximum price in AUD, or null. Set from an explicit budget ("under 30k" → 30000). Do NOT invent a budget from "second car" alone — flag it instead.'),
    yearMin: z.number().int().nullable().describe('Earliest build year, or null. "late-model"/"newer" → a recent yearMin; an explicit year wins.'),
    yearMax: z.number().int().nullable().describe('Latest build year, or null. Set only when the shopper caps the year.'),
    odoMax: z.number().int().nullable().describe('Maximum odometer in km, or null. A bare "low kms"/"low mileage" → the configured low-km threshold; an explicit figure wins.'),
  })
  .describe('The deterministic filter projection handed to the executor. Combines explicit filters and applied soft inferences.');

// --- One disclosed inference: a phrase we interpreted into filter fields --------
const Inference = z
  .object({
    signal: z.string().describe('The exact words from the query that triggered this, e.g. "for our family".'),
    assumed: z.string().describe('Plain-English, speakable statement of what you assumed, e.g. "room for the family — a 5-seat car". No jargon; this is read aloud and shown as a chip.'),
    fields: z.array(z.string()).describe('Which Filters keys this inference set, e.g. ["seats"]. Lets the UI highlight exactly the chips a shopper can tap off.'),
  })
  .describe('A soft inference that was APPLIED to filters and must be disclosed. One entry per phrase, not per field.');

// --- At most one clarification. Search still runs from `filters` if ignored. -----
const Clarification = z
  .object({
    topic: z.string().describe('Machine tag for the ambiguity, snake_case, e.g. "second_car_budget" or "new_vs_used". Lets the conversation layer de-dupe and track.'),
    question: z.string().describe('A single, friendly question Rebi can speak verbatim to resolve it. One question only. Must be answerable in a phrase.'),
  })
  .describe('Set when a load-bearing ambiguity needs one question (see rules). null when the plan is confident. NEVER more than one.');

// --- The query plan ------------------------------------------------------------
export const QueryPlan = z
  .object({
    kind: z.enum(['search', 'no_plan']).describe('"search" when the input is a vehicle search (even a vague or unstocked one). "no_plan" when it is not a search at all — greetings, questions about hours/finance, or gibberish — so the caller routes to normal chat.'),
    noPlanReason: z.enum(['not_vehicle', 'gibberish']).nullable().describe('Why kind is "no_plan": "not_vehicle" for off-topic but sensible input, "gibberish" for unintelligible input. null when kind is "search".'),
    filters: Filters.describe('Empty projection (all [] / null) when kind is "no_plan".'),
    keyword: z.string().nullable().describe('A free-text make/model/nameplate to match against listing titles, lowercase, e.g. "hilux" or "mg4". Use this for a named model you cannot verify is in stock — the executor matches real inventory, so an unstocked model simply returns nothing. null when no model is named.'),
    inferences: z.array(Inference).describe('Every soft inference applied to filters, for disclosure. [] when only explicit filters were used or kind is "no_plan".'),
    clarification: Clarification.nullable().describe('One clarification or null. The plan in `filters` MUST still be usable if the shopper ignores it.'),
    interpretation: z.string().describe('One human sentence summarising the plan, e.g. "Used, 5-seat family car; asked a budget question about the second car." Shown under the search bar and speakable by Rebi.'),
  })
  .describe('A search plan produced from one shopper query. Filters come from real inventory via the executor — this object never contains or implies specific cars.');
```

Design notes that make it one-shot-emittable by a mid model:
- **One level of nesting, tops.** `filters` is a flat record; `inferences` is a shallow array of
  3-string objects; `clarification` is a 2-string object or `null`. No deep optional trees.
- **Every filter key is required** — the model emits the full shape every time (`[]`/`null` for
  "unset"), which is far more reliable than optionals a small model forgets. The executor already
  tolerates and drops junk, so over-emitting is free.
- **`nullable`, not `optional`.** A mid model reliably emits an explicit `null`; it forgets
  optional keys. Matches how `structured.ts` `JSON.parse`s and validates the whole object.

---

## 3. System prompt (< ~800 tokens)

Placeholders are interpolated at runtime from `dealerConfig` — nothing dealer-specific is baked
in. `{{softSignalGuidance}}` expands from `dealerConfig.chat.search.concepts` (the phrase→intent
list), so a new tenant's buyer-language ships as config, not a prompt edit.

```text
You are the search planner for {{dealerName}}, a used-car dealership. Turn ONE shopper sentence
into a structured search plan matching the JSON schema. You never list, invent, or promise cars —
you only emit filters; real stock comes from a separate search over real inventory.

Read the query for three kinds of signal:

1) EXPLICIT filters — attributes the shopper states. Map straight to `filters`:
   • bodyType, colour, transmission, fuelType, driveType, condition (new/used/demo), seats.
   • "secondhand"/"pre-owned" → condition ["used"].  "auto"/"manual" → transmission.
   • "under $X"→priceMax X.  "over $X"→priceMin X.  a year cap→yearMax.  "late-model"→a recent yearMin.
   • an explicit "low kms" with no number → odoMax {{lowKmThreshold}}; a stated figure wins.
   Emit only codes in the schema enums. Unset = [] for lists, null for numbers.

2) SOFT inferences — lifestyle phrases that imply attributes. Apply ONLY the part that is almost
   always true, and record each in `inferences` (signal = the words; assumed = a plain speakable
   line; fields = the keys you set). Dealer guidance:
{{softSignalGuidance}}
   • "family" → seats {{familySeats}} (room for the family). Do NOT force a body type on "family"
     alone — a family car can be a hatch, wagon, or SUV. Use [7,8] seats only on many-kids /
     third-row / people-mover / a stated 7+ seats.
   • Keep inferences minimal. When unsure whether a phrase is a constraint, leave it out.

3) AMBIGUITY worth one question — set `clarification` (topic + one speakable question) ONLY when
   ALL hold: (a) a soft signal implies a constraint the shopper did NOT state; (b) guessing it
   would badly mis-rank results; (c) one question resolves it. Otherwise clarification = null.
   • "second car" is the classic case: cheap, or just an extra? Do NOT set priceMax — flag it.
   • Max ONE clarification. The `filters` you emit must still be a usable search on their own.
   • A direct contradiction (e.g. "new secondhand"): leave that dimension [] and clarify it.

ESCAPE — set kind "no_plan" (empty filters, no inferences, clarification null) when the input is
not a car search: greetings, opening hours, finance/trade-in questions → noPlanReason
"not_vehicle"; unintelligible input → "gibberish".

A named model you can't verify (e.g. "MG4") is still kind "search": put it in `keyword`
(lowercase) and set no other filter it doesn't state. The search returns nothing if it isn't in
stock — never claim it is.

`interpretation` = one sentence describing the plan. Respond with ONLY the JSON object.
```

Rough size: ~430 tokens of fixed text; `{{softSignalGuidance}}` expands to ~120 tokens for the
current 6 concepts. Comfortably inside the ~800 budget with headroom for a larger tenant list.

---

## 4. Clarification policy (mechanical)

`clarification` is non-null **iff ALL THREE** hold — this is the exact gate, not a vibe:

1. **Unstated constraint.** A soft signal implies a filter the shopper did not state. (An
   *explicit* value is never a clarification — "under 20k" is a fact, not a question.)
2. **High mis-rank cost.** Guessing the value would materially reorder or exclude good results.
   Budget and new-vs-used qualify; a colour lean does not.
3. **One question resolves it.** The ambiguity collapses to a single phrase-length answer.

If any one fails → `clarification` is `null` and we ship the plan as-is. Consequences of the gate:

- **"second car" → flag** (all three hold: implies a budget, budget badly mis-ranks, one question
  fixes it). We deliberately do **not** apply a `priceMax` — that's the "infuriating when wrong"
  case the gate exists to catch.
- **"family" → do NOT flag** — seats [5] is almost always right (fails test 2 for the seat part);
  it's applied and disclosed instead.
- **"first car" → do NOT flag** — the small/affordable/auto projection is safe and reversible via
  chips; a question every time reads as dumb.
- **Contradiction ("new secondhand")** is a degenerate clarification: the contested dimension is
  left `[]` (widest, still usable) and one question picks a side.

**Fields Rebi needs:** `topic` (machine tag — de-dupe, don't re-ask the same axis twice in a
session) and `question` (a complete, speakable sentence Rebi says verbatim — the planner owns the
phrasing so the conversation layer needs no second model call). The plan in `filters` is always a
runnable search, so if the shopper ignores the question, results are already on screen.

---

## 5. Inference transparency

`inferences[]` is the disclosure channel, and it is deliberately **redundant with `filters`**: the
inference already wrote its values into `filters`, and it *also* names them here. That redundancy
is the point — the executor reads only `filters` (so search Just Works with zero extra plumbing),
while the UI reads `inferences` to explain and to offer undo, and the two can't diverge because
`fields` points at the very keys that were set.

Each entry gives the UI everything it needs **without a second model call**:
- `signal` — the shopper's own words, so the chip can quote them ("*for our family*").
- `assumed` — a pre-written speakable line, so Rebi voices it as-is and a chip labels it.
- `fields` — the exact `Filters` keys touched, so tapping "not right" clears precisely those
  filters (map `fields` → chip removers already built in `activeChips`) and re-runs the search.

Render pattern: a subtle "I assumed…" strip under the bar, one chip per inference, each tappable
to remove. `interpretation` is the one-line summary above the chips. Nothing here can render as a
car — it only ever describes filters, satisfying the grounding rule.

---

## 6. The family trap — `familySeats` recommendation

**Change `dealerConfig.chat.grounding.lookup.familySeats` from `[7, 8]` to `[5]`.**

Reasoning: a bare "family" means "room for child seats and the school run", which a 5-seat hatch,
wagon, or SUV covers — and it's overwhelmingly the common case, *especially* for a **second** car.
Defaulting to `[7, 8]` excludes the entire 5-seat majority and surfaces only people-movers: the
exact documented failure. Seven-and-eight-seat demand is real but *marked* — shoppers say "7
seats", "third row", "people-mover", or "the kids and their friends". So:

- **"family" (bare) → seats `{{familySeats}}` = `[5]`**, applied as a disclosed inference, no body
  type forced.
- **Explicit/large-family signal → `[7, 8]`** via the prompt's many-kids/third-row rule — an
  *explicit* seat mapping, not the `familySeats` default.

This keeps the config a single tunable array (a people-mover-heavy dealer can set `[5, 7]`) while
the "big family" path is handled in prompt logic, not by widening the default. The canonical query
(§7, ex.1) produces seats `[5]` — the correct result — under this change.

---

## 7. Worked examples

Exact expected JSON per the §2 schema. Assumes `familySeats = [5]` (§6), `lowKmThreshold = 60000`.

### 1. `"a secondhand vehicle as a second car for our family"` — the canonical case

```json
{
  "kind": "search",
  "noPlanReason": null,
  "filters": {
    "bodyType": [],
    "colour": [],
    "transmission": [],
    "fuelType": [],
    "driveType": [],
    "condition": ["used"],
    "seats": [5],
    "priceMin": null,
    "priceMax": null,
    "yearMin": null,
    "yearMax": null,
    "odoMax": null
  },
  "keyword": null,
  "inferences": [
    { "signal": "for our family", "assumed": "room for the family — a 5-seat car", "fields": ["seats"] }
  ],
  "clarification": {
    "topic": "second_car_budget",
    "question": "Is the second car more about keeping the cost down, or just an extra runabout? Give me a budget and I'll tighten it up."
  },
  "interpretation": "Used, 5-seat family car; asked a budget question about the second car."
}
```
*Rationale:* "secondhand" → `condition ["used"]` (fixes the synonym gap); "family" → seats `[5]`
(fixes the family trap), disclosed; "second car" → budget flagged, **not** silently applied.

### 2. `"Family SUV with 7 seats under $40,000"`

```json
{
  "kind": "search",
  "noPlanReason": null,
  "filters": {
    "bodyType": ["suv"], "colour": [], "transmission": [], "fuelType": [], "driveType": [],
    "condition": [], "seats": [7, 8], "priceMin": null, "priceMax": 40000,
    "yearMin": null, "yearMax": null, "odoMax": null
  },
  "keyword": null,
  "inferences": [],
  "clarification": null,
  "interpretation": "7-seat SUVs under $40,000."
}
```
*Rationale:* all explicit — "7 seats" is stated so `[7,8]`, "SUV" and "$40,000" direct; no
inference to disclose, no ambiguity.

### 3. `"Reliable diesel ute for towing, low kms"`

```json
{
  "kind": "search",
  "noPlanReason": null,
  "filters": {
    "bodyType": ["ute"], "colour": [], "transmission": [], "fuelType": ["diesel"],
    "driveType": [], "condition": [], "seats": [], "priceMin": null, "priceMax": null,
    "yearMin": null, "yearMax": null, "odoMax": 60000
  },
  "keyword": null,
  "inferences": [
    { "signal": "low kms", "assumed": "low mileage — under 60,000 km", "fields": ["odoMax"] }
  ],
  "clarification": null,
  "interpretation": "Diesel utes under 60,000 km."
}
```
*Rationale:* diesel/ute explicit; "low kms" → `odoMax` threshold, disclosed; "reliable" is noise
(no filter); "towing" adds nothing beyond the stated ute/diesel.

### 4. `"First car for my daughter, automatic, under $15k"`

```json
{
  "kind": "search",
  "noPlanReason": null,
  "filters": {
    "bodyType": ["hatchback"], "colour": [], "transmission": ["auto"], "fuelType": [],
    "driveType": [], "condition": [], "seats": [], "priceMin": null, "priceMax": 15000,
    "yearMin": null, "yearMax": null, "odoMax": null
  },
  "keyword": null,
  "inferences": [
    { "signal": "First car for my daughter", "assumed": "a small, easy first car — a hatchback", "fields": ["bodyType"] }
  ],
  "clarification": null,
  "interpretation": "Automatic hatchbacks under $15,000 — a good first car."
}
```
*Rationale:* auto + budget explicit; "first car" → small/hatch, applied and disclosed; the
projection is safe and chip-reversible, so no question.

### 5. `"do you have a MG4"` — unverifiable make/model

```json
{
  "kind": "search",
  "noPlanReason": null,
  "filters": {
    "bodyType": [], "colour": [], "transmission": [], "fuelType": [], "driveType": [],
    "condition": [], "seats": [], "priceMin": null, "priceMax": null,
    "yearMin": null, "yearMax": null, "odoMax": null
  },
  "keyword": "mg4",
  "inferences": [],
  "clarification": null,
  "interpretation": "Searching stock for an MG4."
}
```
*Rationale:* the planner can't know the catalogue, so it emits `keyword "mg4"` and lets the
executor decide against real inventory — zero results if not stocked. Never claims it's available.

### 6. `"new secondhand car"` — contradiction

```json
{
  "kind": "search",
  "noPlanReason": null,
  "filters": {
    "bodyType": [], "colour": [], "transmission": [], "fuelType": [], "driveType": [],
    "condition": [], "seats": [], "priceMin": null, "priceMax": null,
    "yearMin": null, "yearMax": null, "odoMax": null
  },
  "keyword": null,
  "inferences": [],
  "clarification": {
    "topic": "new_vs_used",
    "question": "Did you mean a brand-new car, or a used one? I'll narrow it down either way."
  },
  "interpretation": "Showing all cars — checking whether you meant new or used."
}
```
*Rationale:* "new" vs "secondhand" conflict → leave `condition []` (widest, still runs) and ask
one question. No guess.

### 7. `"asdfghjkl qwerty"` — gibberish

```json
{
  "kind": "no_plan",
  "noPlanReason": "gibberish",
  "filters": {
    "bodyType": [], "colour": [], "transmission": [], "fuelType": [], "driveType": [],
    "condition": [], "seats": [], "priceMin": null, "priceMax": null,
    "yearMin": null, "yearMax": null, "odoMax": null
  },
  "keyword": null,
  "inferences": [],
  "clarification": null,
  "interpretation": "Couldn't read that as a car search."
}
```
*Rationale:* unintelligible → `no_plan`/`gibberish`; caller routes to normal chat, not a search.

### 8. `"what are your opening hours"` — zero vehicle content

```json
{
  "kind": "no_plan",
  "noPlanReason": "not_vehicle",
  "filters": {
    "bodyType": [], "colour": [], "transmission": [], "fuelType": [], "driveType": [],
    "condition": [], "seats": [], "priceMin": null, "priceMax": null,
    "yearMin": null, "yearMax": null, "odoMax": null
  },
  "keyword": null,
  "inferences": [],
  "clarification": null,
  "interpretation": "That's a question for the team, not a car search."
}
```
*Rationale:* sensible but off-topic → `no_plan`/`not_vehicle`; Rebi answers it conversationally.

### 9. `"cheap little runabout for the city"`

```json
{
  "kind": "search",
  "noPlanReason": null,
  "filters": {
    "bodyType": ["hatchback"], "colour": [], "transmission": [], "fuelType": [], "driveType": [],
    "condition": [], "seats": [], "priceMin": null, "priceMax": 25000,
    "yearMin": null, "yearMax": null, "odoMax": null
  },
  "keyword": null,
  "inferences": [
    { "signal": "cheap little runabout for the city", "assumed": "a small, budget city car — a hatchback under about $25,000", "fields": ["bodyType", "priceMax"] }
  ],
  "clarification": null,
  "interpretation": "Budget hatchbacks under $25,000 — easy around town."
}
```
*Rationale:* "runabout/city/little" → hatchback; "cheap" with no figure → the dealer's small-car
budget band; both disclosed. No fuelType (small petrol is already economical).

### 10. `"white automatic hybrid under 30k, low kms"` — clean multi-filter

```json
{
  "kind": "search",
  "noPlanReason": null,
  "filters": {
    "bodyType": [], "colour": ["white"], "transmission": ["auto"], "fuelType": ["hybrid"],
    "driveType": [], "condition": [], "seats": [], "priceMin": null, "priceMax": 30000,
    "yearMin": null, "yearMax": null, "odoMax": 60000
  },
  "keyword": null,
  "inferences": [
    { "signal": "low kms", "assumed": "low mileage — under 60,000 km", "fields": ["odoMax"] }
  ],
  "clarification": null,
  "interpretation": "White automatic hybrids under $30,000 with under 60,000 km."
}
```
*Rationale:* five explicit dimensions map straight through; only "low kms" is an inference.

### 11. `"tow the boat, big diesel, plenty of room"`

```json
{
  "kind": "search",
  "noPlanReason": null,
  "filters": {
    "bodyType": ["ute", "suv"], "colour": [], "transmission": [], "fuelType": ["diesel"],
    "driveType": ["4wd", "awd"], "condition": [], "seats": [], "priceMin": null, "priceMax": null,
    "yearMin": null, "yearMax": null, "odoMax": null
  },
  "keyword": null,
  "inferences": [
    { "signal": "tow the boat", "assumed": "something built for towing — a ute or 4WD SUV", "fields": ["bodyType", "driveType"] }
  ],
  "clarification": null,
  "interpretation": "Diesel utes and 4WD SUVs suited to towing."
}
```
*Rationale:* "diesel" explicit; "tow the boat" → ute/SUV + 4wd/awd (per config towing concept),
disclosed; "big/plenty of room" doesn't cleanly map to a seat count, so left out.

---

## 8. Rejected alternatives

1. **Weighted hints / soft scores instead of applied filters** — a `weight: 0.6` per signal fed
   to a ranker. Rejected: the executor is a deterministic boolean GROQ filter (`in $bodyType`),
   not a scorer; there is nowhere for weights to land without inventing a re-ranking layer the
   contract forbids.
2. **A separate `softFilters` object the executor treats as optional** — rejected: it splits the
   projection in two and invites divergence; applying inferences directly into `filters` and
   disclosing via `inferences[]` keeps one source of truth the executor already understands.
3. **Let the planner ask the clarifying question itself (return prose)** — rejected: violates the
   "planner never asks; it FLAGS" constraint and blurs the grounding line; the conversation layer
   owns dialogue.
4. **`confidence` score field per plan** — rejected as emit-burden with no consumer: the
   infer-vs-flag gate already encodes confidence structurally (flagged = low-confidence axis), and
   a mid model's self-rated float is noise.
5. **Keep `familySeats = [7, 8]` and special-case "second car"** — rejected: the default is simply
   wrong for the common family case, not just the second-car one; fixing the default to `[5]` is
   the correct, tenant-clean change, with 7/8 handled by explicit large-family signals.
