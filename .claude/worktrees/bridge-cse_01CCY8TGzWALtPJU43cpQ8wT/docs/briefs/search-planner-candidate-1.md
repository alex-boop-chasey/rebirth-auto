# Search-planner design — Candidate 1

**"Apply-and-disclose, clarify only the pivot."**

## 1. Design thesis

A shopper's line carries three signal classes and each gets its **own channel in the schema**, not a
shared confidence blob. **Explicit filters** (words the shopper actually said, including synonyms like
*secondhand → used*) map straight to `filters` and are never disclosed or questioned. **Soft
inferences** (`family`, `second car`, `tow the boat`) are *applied* to `filters` as the best guess **and
simultaneously listed in an `inferences[]` array** with a plain-English `basis` — so every assumption
becomes a removable, speakable chip the shopper can undo in one tap. Silent-but-*disclosed* beats both
silent-and-hidden (infuriating when wrong, no undo) and ask-every-time (dumb, slow demo). The planner
**never asks** and **never invents a number**: a soft signal that clearly implies a *budget or seat
count* the shopper didn't state — the genuinely two-way-ambiguous case — is applied as a best guess
**and** flagged with exactly one `clarification` for the Rebi layer to confirm, while search still runs.
This is good for a live dealer demo because it **always returns real stock in one call**, it **shows its
working** ("I assumed a smaller car because you said *second car* — not right?"), and its behaviour is
mechanical enough to predict on stage rather than pray over.

The whole plan is one `generateObject` call on the `structured` tier. Real results come only from the
deterministic executor against real inventory — the model emits filters + an optional keyword and
nothing that could be rendered as a vehicle.

## 2. Zod v4 schema

```ts
import { z } from 'zod';

// Canonical code sets mirror listings-query.ts (full schema sets, not the dealer
// subset — the executor re-validates and silently drops anything unknown).
// `colour` intentionally omits the `other` sentinel (not a nameable request).

const FiltersSchema = z
  .object({
    bodyType: z
      .array(z.enum(['sedan', 'hatchback', 'suv', 'ute', 'wagon', 'van', 'coupe', 'convertible']))
      .describe('Body styles to include, OR of the values. Empty array = no body-type filter. Use the full canonical set even if unsure the dealer stocks it; the executor drops codes it does not offer.'),
    colour: z
      .array(z.enum(['white', 'black', 'silver', 'grey', 'blue', 'red', 'green', 'gold', 'brown', 'orange', 'yellow', 'purple']))
      .describe('Colour families the shopper explicitly named (e.g. "the red ones"). Empty array = no colour filter. Never infer a colour from lifestyle wording.'),
    transmission: z
      .array(z.enum(['auto', 'manual']))
      .describe('Transmission. Empty array = no filter. "automatic"/"auto" -> auto; "manual"/"stick" -> manual.'),
    fuelType: z
      .array(z.enum(['petrol', 'diesel', 'hybrid', 'electric', 'lpg']))
      .describe('Fuel type. Empty array = no filter. Only set when the shopper names a fuel OR a soft mapping specifies one (e.g. towing -> diesel). "economical"/"cheap to run" is NOT a fuel — leave empty.'),
    driveType: z
      .array(z.enum(['2wd', 'awd', '4wd']))
      .describe('Drivetrain. Empty array = no filter. off-road/4x4/tow/adventure -> 4wd (or awd).'),
    condition: z
      .array(z.enum(['new', 'used', 'demo']))
      .describe('Vehicle condition. Empty array = no filter. "secondhand"/"pre-owned"/"used" -> used; "brand new" -> new; "demo"/"ex-demo" -> demo. If the shopper contradicts themselves ("new secondhand"), leave EMPTY and raise a clarification.'),
    seats: z
      .array(z.union([z.literal(2), z.literal(4), z.literal(5), z.literal(7), z.literal(8)]))
      .describe('Exact seat counts to include. Empty array = no filter. Only these values are accepted. "7 seater" -> [7]. A plain "family" car is a 5-seater — do NOT default to 7/8.'),
    priceMin: z.number().int().nullable().describe('Minimum price in AUD, or null. Only from an explicit figure (e.g. "over 20k"). Never invented from lifestyle wording.'),
    priceMax: z.number().int().nullable().describe('Maximum price in AUD, or null. Only from an explicit figure ("under $30k", "around 25000") or a configured concept mapping. If a soft signal implies "cheap" but names no figure, keep null and raise a clarification instead.'),
    yearMin: z.number().int().nullable().describe('Earliest build year, or null. "late-model"/"newer" MAY set a recent yearMin only if you are confident; otherwise null.'),
    yearMax: z.number().int().nullable().describe('Latest build year, or null. Rarely set; only from an explicit year ceiling.'),
    odoMax: z.number().int().nullable().describe('Maximum odometer in km, or null. An explicit figure ("under 50,000 km") sets it directly; a bare "low kms"/"low mileage" with no number sets the configured low-km threshold.'),
  })
  .describe('Projection onto the deterministic FilterState contract. Every key is always present; use [] or null for "no constraint". Never add keys.');

const InferenceSchema = z
  .object({
    field: z
      .enum(['bodyType', 'colour', 'transmission', 'fuelType', 'driveType', 'condition', 'seats', 'priceMin', 'priceMax', 'yearMin', 'yearMax', 'odoMax'])
      .describe('Which filter field this assumption set. Must match a field you actually populated in `filters`.'),
    value: z.string().describe('Human-readable value you applied for that field (e.g. "hatchback, suv" or "5" or "60000"). For display only.'),
    basis: z.string().describe('Short plain-English reason, spoken to the shopper and shown on a removable chip. E.g. "a second car for the family is usually a small 5-seater". No jargon.'),
  })
  .describe('One disclosed soft assumption. List ONLY inferred filters, never explicit ones the shopper stated.');

const ClarificationSchema = z
  .object({
    topic: z
      .enum(['budget', 'seats', 'condition', 'bodyType', 'fuelType'])
      .describe('The single dimension Rebi should confirm. Lets the UI pre-wire quick-reply chips.'),
    question: z.string().describe('One short, friendly question Rebi asks to confirm the pivotal assumption. Must be answerable in a phrase.'),
  })
  .describe('Payload for the at-most-one clarification. Present iff needsClarification is true.');

export const SearchPlanSchema = z
  .object({
    intent: z
      .enum(['search', 'non_vehicle', 'gibberish'])
      .describe('"search" = a vehicle query; fill filters. "non_vehicle" = coherent but not about finding a car (hours, finance, trade-in, directions) -> route to chat, empty filters. "gibberish" = no discernible meaning -> empty filters.'),
    filters: FiltersSchema,
    keyword: z
      .string()
      .nullable()
      .describe('A make/model (or nickname) you cannot express as a filter, lowercased, e.g. "hilux", "mg4". You CANNOT know if it is in stock — emit it anyway; the executor decides. null when none.'),
    inferences: z
      .array(InferenceSchema)
      .describe('All soft assumptions you applied, for UI disclosure. Empty array when every filter came from explicit words.'),
    needsClarification: z
      .boolean()
      .describe('The UI render gate. true iff `clarification` is non-null. See the clarification rule — at most one, and filters are still filled with your best guess so search can run without an answer.'),
    clarification: ClarificationSchema.nullable().describe('The clarification payload, or null. Must be non-null exactly when needsClarification is true.'),
    interpretation: z
      .string()
      .describe('One short plain sentence shown to the shopper. For a search: what you searched for ("Used 5-seat hatch or small SUV"). For non_vehicle/gibberish: a friendly redirect.'),
  })
  .describe('The complete search plan for one shopper query. Return ONLY this object.');

export type SearchPlan = z.infer<typeof SearchPlanSchema>;
```

**Why this shape emits reliably in one shot:** every field is always present (no optionality guessing);
arrays default to `[]`, numerics to `null`, so the model fills a uniform skeleton. Enums (and literal
unions for seats) give the model a closed vocabulary, which is what makes a Haiku-class model's output
land on the first try and keeps the single retry rare. `inferences[]` is the only variable-length part
and it is a flat `{field, value, basis}` — no nested optional objects.

## 3. System prompt (< ~800 tokens)

`{{softConcepts}}` is rendered at runtime from `dealerConfig.chat.search.concepts` (one bullet per
`phrase -> maps`), so no dealer's buyer language is baked into the template. `{{familySeats}}`,
`{{lowKmThreshold}}` and `{{dealerName}}` interpolate from config.

```text
You are the search planner for {{dealerName}}, a used-car dealership. A shopper typed one line into the
search bar. Turn it into a structured search plan for our inventory filter.

You NEVER invent cars, prices, stock, or numbers. You only emit filters + an optional keyword; real
results come from our catalogue. Return ONLY the JSON object the schema defines.

INTENT
- "search": text is about finding a vehicle -> fill filters.
- "non_vehicle": coherent but not a car search (opening hours, finance, trade-in, directions) ->
  empty filters, no clarification.
- "gibberish": no discernible meaning -> empty filters, no clarification.

THREE KINDS OF SIGNAL
1. EXPLICIT — the shopper named it: "diesel", "under $30k", "7 seats", "auto", and direct synonyms
   ("secondhand"/"pre-owned" = used, "brand new" = new). Map straight to filters. Do NOT list these
   in inferences.
2. SOFT — lifestyle wording implying a constraint they did not spell out. Apply your best-guess
   filter AND add one entry to inferences with a plain-English basis. Dealer mappings:
{{softConcepts}}
   Plus universal rules:
   - "family" -> bodyType suv/wagon; seats {{familySeats}}. Only bump to 7 or 8 seats if they mention
     several kids, a people-mover, or a 7-seater. A plain family car is a 5-seater.
   - "second car" / "runabout" / "daily" -> the smaller, cheaper end: bodyType hatchback/suv.
   - "low kms"/"low mileage" with no figure -> odoMax {{lowKmThreshold}}.
3. NEVER INVENT A NUMBER. Set priceMin/priceMax/yearMin/yearMax/odoMax only from an explicit figure or
   a configured mapping (like low-kms). If a soft signal implies a budget but names no figure, leave
   price null and raise ONE clarification instead.

KEYWORD
Put a make/model you cannot express as a filter into keyword ("hilux", "mg4"), lowercased. You cannot
know whether we stock it — emit it anyway; never guess whether it exists.

CLARIFICATION (at most one; always still return a usable plan)
Set needsClarification=true and fill clarification ONLY when ALL hold:
(a) a SOFT signal implies a narrowing constraint on PRICE or SEATS the shopper did not state, AND
(b) two common readings would flip that constraint (e.g. "second car" = cheaper vs just another car),
    AND
(c) one short question settles it.
Pick the single highest-impact one (price over seats). STILL fill filters with your best guess so
search runs. If two signals contradict ("new secondhand"), drop the contradicted filter and clarify it.
Otherwise needsClarification=false and clarification=null.

interpretation: one short plain sentence describing the plan (or, for non_vehicle/gibberish, a friendly
redirect). It is shown to the shopper.
```

Estimated ~560 tokens before `{{softConcepts}}` expands (the six Bundaberg concepts add ~180), leaving
headroom under the 800 budget.

## 4. Clarification policy

Rebi — not the planner — asks. The planner only *flags*. Rules, in order:

1. **Trigger (all three required).** Flag iff **(a)** a *soft* signal (not an explicit word) drove a
   **narrowing** constraint on **price or seats**, **(b)** the trigger phrase has a well-known two-way
   reading that flips that constraint, and **(c)** a single phrase-length question resolves it. Explicit
   figures never trigger a flag; broadening/body-style inferences never trigger a flag (they are cheap
   to be wrong and removable as a chip).
2. **At most one.** If more than one candidate qualifies, keep the **highest-impact**: price over
   seats over everything else. Ambiguity that isn't about price or seats is resolved by best-guess +
   disclosure, not a question.
3. **Plan still runs.** `filters` is always populated with the best guess even when flagged — the
   contradiction case is the sole exception (the contradicted field is left empty). Search never blocks
   on an answer; if the shopper ignores Rebi, they still see stock.
4. **Contradiction sub-rule.** Directly conflicting explicit signals on one field (e.g. `new` +
   `secondhand`) → leave that field empty, `topic` = that field, and clarify which they meant.
5. **Fields Rebi needs.** Exactly two: `clarification.topic` (enum — lets the UI render quick-reply
   chips without parsing prose) and `clarification.question` (the spoken/rendered sentence).
   `needsClarification` is the boolean render-gate; the invariant `needsClarification === (clarification
   !== null)` is enforced by the prompt.

Rejected candidate principle from the brief: *"flag when a soft signal implies a constraint the user
didn't state AND getting it wrong badly mis-ranks AND one question resolves it."* Adopted almost
verbatim, but **narrowed to price/seats** and made **directional** (narrowing only) — "badly mis-ranks"
is a vibe; "narrowed price or seat count the user didn't state" is checkable.

## 5. Inference transparency

One field does all the work: `inferences: [{ field, value, basis }]`.

- **Machine-usable:** `field` is an enum matching a `FilterState` key, so the UI reuses the existing
  `DIMENSION_LABELS` / `codeLabel` helpers to render one **removable assumption chip** per entry.
  Removing a chip drops that value from the filter and re-runs the search through `applyFilterUrl`
  (never a hand-built URL) — no model call.
- **Human-readable:** `basis` is a spoken sentence. Rebi says *"I assumed a smaller car because you
  said 'second car' — want the bigger ones too?"* directly from `basis`, and the chip tooltip shows the
  same string. `interpretation` gives the one-line summary above the results.
- **No second call:** everything the UI and Rebi need is in the single response. Disclosure is what lets
  us apply inferences aggressively — the shopper always sees and can reverse them.

Explicit filters are deliberately **absent** from `inferences` (no chip clutter for words the shopper
actually typed); only assumptions appear.

## 6. Family-trap recommendation

**Change `dealerConfig.chat.grounding.lookup.familySeats` from `[7, 8]` to `[5]`.**

Reasoning: a household's *second* / everyday family car is overwhelmingly a 5-seat hatch or small SUV,
not a 7–8 seat people-mover. Mapping "family" to `[7,8]` is the exact bug that made the canonical query
return only `seats=[7,8]`. `[5]` is a first-class `SEAT_OPTIONS` value, so it round-trips through
`parseFilters` and the executor unchanged.

Escalation stays mechanical: the planner only emits `[7, 8]` when the shopper gives an **explicit
large-family cue** — "several kids", "people-mover", "7 seater". Those seat counts are universal
catalogue options (like `SEAT_OPTIONS`), not a dealer preference, so naming them in the prompt is
tenant-safe. If a dealer wants the escalation tunable, add an optional `largeFamilySeats: [7, 8]`
config key and swap the literal for a placeholder; not required for correctness.

With `familySeats = [5]`, the canonical query `"a secondhand vehicle as a second car for our family"`
produces `condition: ["used"]`, `bodyType: ["hatchback", "suv"]`, `seats: [5]` — the right result — plus
one budget clarification (Example 1 below).

## 7. Worked examples

All `filters` keys are always present. Rationale is one line each.

**1. Canonical — `"a secondhand vehicle as a second car for our family"`**

```json
{
  "intent": "search",
  "filters": {
    "bodyType": ["hatchback", "suv"],
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
    { "field": "bodyType", "value": "hatchback, suv", "basis": "a family's second car is usually a small, easy 5-seater" },
    { "field": "seats", "value": "5", "basis": "a second family car is typically a 5-seater, not a people-mover" }
  ],
  "needsClarification": true,
  "clarification": {
    "topic": "budget",
    "question": "Is this second car about keeping costs down, or just an extra car — should I focus on the cheaper end?"
  },
  "interpretation": "Used 5-seat hatch or small SUV as the family's second car."
}
```

Rationale: *secondhand* is an explicit synonym (→ `used`, no chip); *family*/*second car* infer a small
5-seater (disclosed); *second car* implies but doesn't state a budget → best guess runs with no price
ceiling **and** the one budget clarification fires. This is the exact query the regex extractor botched.

**2. Clean — `"Family SUV with 7 seats under $40,000"`**

```json
{
  "intent": "search",
  "filters": { "bodyType": ["suv"], "colour": [], "transmission": [], "fuelType": [], "driveType": [], "condition": [], "seats": [7], "priceMin": null, "priceMax": 40000, "yearMin": null, "yearMax": null, "odoMax": null },
  "keyword": null,
  "inferences": [],
  "needsClarification": false,
  "clarification": null,
  "interpretation": "7-seat SUVs under $40,000."
}
```

Rationale: body, seats, and price are all explicit — no inference, no flag. "Family" is redundant here.

**3. Messy real — `"Reliable diesel ute for towing, low kms"`**

```json
{
  "intent": "search",
  "filters": { "bodyType": ["ute"], "colour": [], "transmission": [], "fuelType": ["diesel"], "driveType": ["4wd"], "condition": [], "seats": [], "priceMin": null, "priceMax": null, "yearMin": null, "yearMax": null, "odoMax": 60000 },
  "keyword": null,
  "inferences": [
    { "field": "driveType", "value": "4wd", "basis": "towing usually wants 4WD" },
    { "field": "odoMax", "value": "60000", "basis": "‘low kms’ with no figure — using our low-km guide of 60,000 km" }
  ],
  "needsClarification": false,
  "clarification": null,
  "interpretation": "Low-km diesel 4WD utes suited to towing."
}
```

Rationale: diesel + ute explicit; towing infers 4wd (disclosed); "low kms" → configured
`{{lowKmThreshold}}` (a mapping, not an invented number); "reliable" is too vague to filter on.

**4. Clean — `"First car for my daughter, automatic, under $15k"`**

```json
{
  "intent": "search",
  "filters": { "bodyType": ["hatchback"], "colour": [], "transmission": ["auto"], "fuelType": [], "driveType": [], "condition": [], "seats": [], "priceMin": null, "priceMax": 15000, "yearMin": null, "yearMax": null, "odoMax": null },
  "keyword": null,
  "inferences": [
    { "field": "bodyType", "value": "hatchback", "basis": "a first car is usually a small, easy-to-drive hatch" }
  ],
  "needsClarification": false,
  "clarification": null,
  "interpretation": "Small automatic first cars under $15,000."
}
```

Rationale: auto + price explicit; "first car" infers a small hatch (disclosed). No budget flag — the
budget is stated.

**5. Keyword + colour — `"red hilux"`**

```json
{
  "intent": "search",
  "filters": { "bodyType": [], "colour": ["red"], "transmission": [], "fuelType": [], "driveType": [], "condition": [], "seats": [], "priceMin": null, "priceMax": null, "yearMin": null, "yearMax": null, "odoMax": null },
  "keyword": "hilux",
  "inferences": [],
  "needsClarification": false,
  "clarification": null,
  "interpretation": "Red HiLux utes."
}
```

Rationale: colour is explicit; make/model rides in `keyword`.

**6. Unverifiable make/model — `"do you have a MG4"`**

```json
{
  "intent": "search",
  "filters": { "bodyType": [], "colour": [], "transmission": [], "fuelType": [], "driveType": [], "condition": [], "seats": [], "priceMin": null, "priceMax": null, "yearMin": null, "yearMax": null, "odoMax": null },
  "keyword": "mg4",
  "inferences": [],
  "needsClarification": false,
  "clarification": null,
  "interpretation": "Checking our stock for an MG4."
}
```

Rationale: **not** a failure mode — the planner cannot know the catalogue, so it emits the keyword and
lets the executor return zero-or-more. The empty-results UI (config `messages.noMatch`) handles absence;
the model never asserts stock exists.

**7. Gibberish — `"asdfghjkl qwerty"`**

```json
{
  "intent": "gibberish",
  "filters": { "bodyType": [], "colour": [], "transmission": [], "fuelType": [], "driveType": [], "condition": [], "seats": [], "priceMin": null, "priceMax": null, "yearMin": null, "yearMax": null, "odoMax": null },
  "keyword": null,
  "inferences": [],
  "needsClarification": false,
  "clarification": null,
  "interpretation": "That didn't look like a car search — mind trying again?"
}
```

Rationale: no discernible meaning → no-plan escape. Caller shows `interpretation`, runs no search.

**8. Zero vehicle content — `"what are your opening hours"`**

```json
{
  "intent": "non_vehicle",
  "filters": { "bodyType": [], "colour": [], "transmission": [], "fuelType": [], "driveType": [], "condition": [], "seats": [], "priceMin": null, "priceMax": null, "yearMin": null, "yearMax": null, "odoMax": null },
  "keyword": null,
  "inferences": [],
  "needsClarification": false,
  "clarification": null,
  "interpretation": "That's one for Rebi, not a car search — I'll pass it along."
}
```

Rationale: coherent but not a search → caller routes to the Rebi chat layer instead of the executor.

**9. Contradiction — `"new secondhand car"`**

```json
{
  "intent": "search",
  "filters": { "bodyType": [], "colour": [], "transmission": [], "fuelType": [], "driveType": [], "condition": [], "seats": [], "priceMin": null, "priceMax": null, "yearMin": null, "yearMax": null, "odoMax": null },
  "keyword": null,
  "inferences": [],
  "needsClarification": true,
  "clarification": {
    "topic": "condition",
    "question": "Did you mean a brand-new car or a used one? I can show either."
  },
  "interpretation": "Cars — new or used; just need to confirm which."
}
```

Rationale: conflicting explicit condition signals → drop `condition` (search runs across all), flag the
one clarification on `condition`.

**10. Soft, no false fuel — `"something economical for the commute"`**

```json
{
  "intent": "search",
  "filters": { "bodyType": ["hatchback"], "colour": [], "transmission": [], "fuelType": [], "driveType": [], "condition": [], "seats": [], "priceMin": null, "priceMax": null, "yearMin": null, "yearMax": null, "odoMax": null },
  "keyword": null,
  "inferences": [
    { "field": "bodyType", "value": "hatchback", "basis": "‘economical’ points to a small, cheap-to-run car — not a specific fuel" }
  ],
  "needsClarification": false,
  "clarification": null,
  "interpretation": "Small, economical cars for the commute."
}
```

Rationale: "economical" is running-cost, not a fuel — bias small `hatchback`, **never force
`hybrid`/`electric`** (that wrongly excludes a cheap-to-run petrol). Body inference is broadening/cheap
to be wrong → disclosed, not flagged.

## 8. Rejected alternatives

1. **Tool-calling / multi-call planner (fetch counts, then refine).** Rejected — the `structured` tier
   has no tool transport and the budget is one call; a loop can't run.
2. **Silent inference with no disclosure.** Rejected — magical when right, infuriating when wrong, and
   offers no undo affordance; the `inferences[]` chip is what makes aggressive inference safe.
3. **Per-filter confidence scores (0–1).** Rejected — a Haiku-class model can't calibrate them, they're
   not mechanically actionable, and chips need words (`basis`) not numbers.
4. **Let the planner ask inline / block search until answered.** Rejected — the planner never asks
   (constraint 3) and a live demo must always return real stock; clarification is a flag alongside a
   usable plan, never a gate.
5. **Deeply nested inference objects (`{field, constraintType, appliedValue, altReadings[]}`).**
   Rejected — nested optional structure is exactly what a mid-tier model fumbles in one shot; a flat
   `{field, value, basis}` emits reliably and carries everything the UI needs.
