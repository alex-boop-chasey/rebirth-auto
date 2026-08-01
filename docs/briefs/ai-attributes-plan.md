# Plan — description leak fix + aiAttributes enrichment + search wiring + backfill

**Branch:** `feat/ai-attributes` (off `origin/main`). Autonomous /auto run; Phase-1 stop waived by the
owner. Build order: leak fix → schema → enrichment call → button → search → backfill. This doc is the
spec; the finished work is checked against §"Definition of done".

## Data boundary (Decision 6 — binds the whole ticket)
Private data (`dealerNotes`, cost/floor pricing, private condition flags) never reaches a shopper
surface **including as a ranking/filter input**. Enforcement is **exclusion at the source**:
- **Description generation** MAY use `dealerNotes` (dealer-facing, dealer reviews before publish).
- **aiAttributes enrichment** feeds shopper-facing search/ranking → **public projection ONLY**
  (`LISTING_FIELDS`-equivalent). The enrichment input builder must never receive `dealerNotes`, cost,
  or floor price. A test asserts this and fails loudly if a private key ever appears.

## Field decisions (locked)
`aiAttributes` is a **new top-level object field** on the listing document (path `aiAttributes.*`):
- `runningCost`: single string enum — `low | medium | high`
- `usageFit`: array of string enum — `city | family | highway | towing | tradie | first-car`
- `sizeClass`: single string enum — `compact | medium | large`
Enum vocab is FIXED (not free tags). GROQ reads `aiAttributes.runningCost` etc. `LISTING_FIELDS`
projection gains `aiAttributes{runningCost, usageFit, sizeClass}`.

**Rule-based vs model-judged derivation** (public fields only: `vehicleSpecs{bodyType, fuelType,
driveType, seatCount, fuelEconomy, year, odometer}`, `make/model`, `doors`, public `details[]`,
asking `price`, `title`):
- `runningCost` — **rule-based**: fuelType `electric`/`hybrid` → `low`; else by `fuelEconomy` L/100km
  (`<6`→low, `6–9`→medium, `>9`→high); if neither present → **WARN + unset** (do not guess).
- `sizeClass` — **rule-based**: deterministic map from `bodyType` (+`seatCount`): hatch/micro→`compact`;
  sedan/wagon/small-SUV & seats≤5→`medium`; large-SUV/ute/van/people-mover or seats≥7→`large`;
  unmapped bodyType → **WARN + unset**.
- `usageFit` — **rule-leans + model for judgment**: deterministic leans (ute/van+4wd/awd→`towing`,
  `tradie`; seats≥7 or family-SUV→`family`; compact+low-runningCost→`city`,`first-car`). Genuine
  judgment (e.g. `highway`, borderline `family`) filled by `generateObject` on the **`structured`**
  tier constrained to the enum; model output validated against the enum (off-enum dropped); on model
  failure → keep rule leans only; no confident signal → **unset (WARN)**.

Determinism: rules are pure. WARNs are `console.warn('[enrich] WARN …', id, field)`. Never fabricate.

## Piece 1 — description leak fix
Root cause (verified): `/api/generate-description` calls `generate('writing')` then
`plainTextToPortableText(content)` with **no output contract in the prompt and no post-validation**;
`writing` primary is `openai/gpt-oss-20b:free` (reasoning-capable → leaks "Paragraph 1:", word counts,
"We need…"). Fix:
- **Prompt** (`src/lib/generate-description/prompt.ts`, `buildSystemPrompt` + tighten + tone): add a
  hard **OUTPUT CONTRACT**: *"Return ONLY the finished description a buyer will read — paragraphs
  separated by blank lines. No reasoning, planning, word counts, self-checks, headings like
  'Paragraph 1', labels, or any commentary before or after."*
- **Deterministic post-validation** in the endpoint (shared helper `looksLikeReasoning(text)`): reject
  if any line (case-insensitive, trimmed) starts with `Paragraph`, `Count`, `We need`, `Word count`,
  `Let me`, `First,`, `Draft`, `Note:`, `Okay`, `Sure`, or `^\d+[.)]\s`, or the text contains
  `word count` / `~\d+ words` / `paragraph 1`. On reject → **retry once** (re-call `generate`); still
  bad → graceful `{ error } @ 200` (never publish scratchpad). Pure string checks — NOT a model call.
  Applies to the description actions (describe/tone/tighten).

## Piece 2 — Sanity schema
`src/sanity/schemaTypes/listing.ts`: add the `aiAttributes` object (group `details`), with a group
`description` telling the dealer these are AI-derived and **editable to override**, and each subfield a
string/array with `options.list` of the fixed enum. Mirror the existing `vehicleSpecs`/`fuelType`
idiom. Dealer-overridable (not hard `readOnly`).

## Piece 3 — enrichment call + module (Decision-6 boundary lives here)
New module `src/lib/generate-description/enrich-attributes.ts`:
- `buildEnrichmentInput(publicListing)` → an object of PUBLIC fields only. **Comment marks the
  Decision 6 boundary.** Never reads `dealerNotes`/cost/floor.
- `deriveAttributes(input)` → `{ aiAttributes, sources, warnings }` applying the rule/model split
  above (model via `generateObject` on `structured`). Pure rules + one optional model call.
- Test `enrich-attributes.test.ts`: fails if `buildEnrichmentInput`'s output ever contains
  `dealerNotes`/`cost`/`floor`/price-private keys.
Endpoint: the `describe` action ALSO runs enrichment (SEPARATE input assembly — the two AI calls never
share an object that holds private fields) and returns `{ description, aiAttributes, enrichError? }`.

## Piece 4 — single-button flow (Studio)
`src/sanity/components/GenerateDescriptionInput.tsx`: `run('describe')` now, on success, (i)
`onChange(set(description))` AND (ii) patches `aiAttributes` onto the current draft (Studio patch API —
`useDocumentOperation`/`useClient`). **Partial success visible:** if description ok but enrichment
failed, set the description and toast a WARNING that attributes were left unset (not silent). Other
actions (tighten/tone/sellingPoints) unchanged.

## Piece 5 — search integration
- `src/lib/listings-query.ts`: add code sets `RUNNING_COST_CODES/USAGE_FIT_CODES/SIZE_CLASS_CODES`;
  `FilterState` gains `runningCost/usageFit/sizeClass: string[]` (mirror `fuelType`, multi-select);
  `parseFilters`/`serializeFilters` via `parseMulti`/`set`; `buildListingsFilter` clauses —
  `runningCost`/`sizeClass`: `(!defined($x) || aiAttributes.x in $x)`; **`usageFit` (doc array):**
  `(!defined($usageFit) || count((aiAttributes.usageFit[])[@ in $usageFit]) > 0)`. Add
  `DIMENSION_LABELS`/`activeChips` entries so an AI-applied value shows as a removable chip.
- `src/lib/listing.ts`: `LISTING_FIELDS` += `aiAttributes{runningCost, usageFit, sizeClass}`.
- `src/ai/search/query-planner.ts`: add the three enums + `Filters` fields (runningCost/sizeClass
  nullable single, usageFit array) + `FilterField` keys + `planFiltersToState` mapping. **Keep
  `scripts/eval/search-planner-eval.ts` in lockstep** (schema transcribed verbatim there).
- `src/config/dealer.ts`: rewrite the `chat.search.concepts` entries for "economical/cheap to run",
  "city car/runabout/small", "first car", "towing/tow" to emit `runningCost`/`usageFit`/`sizeClass`
  (they currently map to bodyType/fuel workarounds); update the planner-prompt line that says
  "economical is NOT a fuel". Add `FilterDimension` union members (do NOT add to `inventory.dimensions`
  — see drawer decision).
- `src/lib/vehicle-filter-extract.ts`: add `RUNNING_COST_SYNONYMS` ("cheap to run","economical","cheap
  on fuel","fuel efficient"→low), `USAGE_FIT_SYNONYMS` ("city car","runabout","commuter"→city; "first
  car","p-plate","learner"→first-car; "tow*","caravan","trailer"→towing; "tradie","work truck"→tradie;
  "highway","touring","long trips"→highway; coordinate "family" with the existing seats special-case),
  `SIZE_CLASS_SYNONYMS` ("compact","small"→compact; "large","big"→large). Extend `hasConcreteFilters`
  and the `extractFilters` wiring so a solo new-field hit counts as concrete.
- `src/lib/ai-search/schema.ts` + `prompt.ts` (Stage-2 legacy fallback): add the three fields so the
  fallback path also emits them.
- **Filter drawer — DECISION: AI-only for now** (no visible facets). Reasoning: values exist only on
  enriched listings, showing empty facets is poor UX, and the ticket's goal is soft-query landing.
  The fields still flow planner→URL→GROQ and show as removable chips. Revisit visible facets later.
  → **No `FilterDrawer.astro` / `filter-url.ts` / `inventory.dimensions` changes.**

## Piece 6 — backfill
`scripts/enrich-attributes.ts` mirroring `scripts/migrate-details-to-specs.ts`: dotenv →
`@sanity/client` (`PUBLIC_SANITY_PROJECT_ID/DATASET/API_VERSION`, write `SANITY_TOKEN`) → **dry-run
default**, `--commit` to write. Reads `*[_type=="listing" && category=="automotive"]{_id,title,make,
model,vehicleSpecs,details[],aiAttributes}`, computes via the SHARED `enrich-attributes.ts` module
(public only), prints a per-vehicle diff table (id, title, derived values, **rule vs model source**,
WARNs), idempotent (only fills unset unless `--force`), patches by explicit `_id`
(`patch(_id).set({'aiAttributes.runningCost':…})`). **`--commit` is owner-gated — I run only the
dry-run and hand the clean output over.**

## DECISIONS.md
`/auto` may not edit `DECISIONS.md`. Draft the enrichment decision + data-scope reasoning in
`docs/briefs/ai-attributes-decision-draft.md` for the owner to apply (same precedent as Decision 8).

## Definition of done (verify, don't assume)
- Leak: prompt has the output contract; endpoint rejects+retries scratchpad; a unit check on
  `looksLikeReasoning` passes for the known bad markers and passes clean prose through.
- Schema: `aiAttributes` renders in Studio with enum dropdowns + override; `astro check` green.
- Enrichment: `buildEnrichmentInput` is public-only; boundary test fails if a private key is added.
- Button: one press sets description + patches aiAttributes; partial failure visible.
- Search: `parseFilters('runningCost=low')` round-trips; `buildListingsFilter` emits the clauses;
  planner schema + eval harness updated in lockstep; regex extractor maps "cheap to run city car" →
  runningCost=low + usageFit=city; a live `/api/search` for "a cheap to run car for city driving"
  lands runningCost/usageFit (not just condition=new).
- Backfill: dry-run prints a clean, deterministic, WARN-aware diff table over the real inventory.
- `npx astro check` 0 errors. Conventional commits, one per piece, **local only (no push)**.
