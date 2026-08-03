# Brief — Piece 5: wire aiAttributes into search (planner + regex fallback + GROQ + config)

You are a sub-agent on the `feat/ai-attributes` branch. Scope is EXACTLY the search integration for the
new `aiAttributes` fields. Do NOT touch the generate-description endpoint, the Studio component, the
enrichment module, or the backfill script — other pieces own those. One conventional commit at the end.

## Background
A new Sanity object field `aiAttributes` was just added to the listing schema (committed) with three
FIXED-enum subfields:
- `runningCost`: single string — `low | medium | high`
- `usageFit`: array of string — `city | family | highway | towing | tradie | first-car`
- `sizeClass`: single string — `compact | medium | large`

These are shopper-facing filter/ranking dimensions (URL filter codes, exactly like `vehicleSpecs`
fields). Your job: make them flow **planner → URL → GROQ**, show as removable chips, and be reachable
from both the LLM query planner AND the regex fallback extractor.

## Repo constraints that bite here (from AGENTS.md — obey exactly)
- **Filter state only via the established seam.** Shopper filter state lives in the URL and is
  read/written through `applyFilterUrl` — do not construct filter URLs independently. The existing
  filter dimensions (`fuelType`, etc.) are your template; mirror them precisely for multi-select.
- **All AI through `src/ai/`.** The planner already routes correctly; you're only extending its schema
  and mapping. Don't add provider calls.
- **Determinism.** Regex-synonym extraction is deterministic; ambiguous input falls through — never
  fabricate a value.
- **Config as data.** The `chat.search.concepts` map and any dealer-tunable vocab live in
  `src/config/dealer.ts`. No dealer literals elsewhere.
- **Keep the planner schema and its eval harness in LOCKSTEP.** `scripts/eval/search-planner-eval.ts`
  transcribes the planner schema verbatim; if you change the planner schema you MUST update the eval
  harness identically or the harness lies.

## Do this (mirror the `fuelType` multi-select idiom throughout)

### a. `src/lib/listing.ts`
`LISTING_FIELDS` GROQ projection += `aiAttributes{runningCost, usageFit, sizeClass}`. This is the shared
projection used by all pages — additive only.

### b. `src/lib/listings-query.ts`
- Add code sets: `RUNNING_COST_CODES` (`low/medium/high`), `USAGE_FIT_CODES`
  (`city/family/highway/towing/tradie/first-car`), `SIZE_CLASS_CODES` (`compact/medium/large`).
- `FilterState` gains `runningCost: string[]`, `usageFit: string[]`, `sizeClass: string[]` (multi-select
  like `fuelType`).
- `parseFilters` / `serializeFilters`: use the same `parseMulti` / set helpers `fuelType` uses.
- `buildListingsFilter` GROQ clauses:
  - `runningCost`: `(!defined($runningCost) || aiAttributes.runningCost in $runningCost)`
  - `sizeClass`:   `(!defined($sizeClass) || aiAttributes.sizeClass in $sizeClass)`
  - `usageFit` is a **document array** → `(!defined($usageFit) || count((aiAttributes.usageFit[])[@ in $usageFit]) > 0)`
- Add `DIMENSION_LABELS` + `activeChips` entries for the three so an AI-applied value renders as a
  removable chip (labels: "Running cost", "Usage", "Size" or similar — human-readable).

### c. `src/ai/search/query-planner.ts`
- Add the three enums to the plan schema: `runningCost` (nullable single), `sizeClass` (nullable
  single), `usageFit` (array). Use `.describe()` per field in the existing style.
- Add the `FilterField` keys and extend `planFiltersToState` (or the equivalent plan→FilterState
  mapping) so planner output lands on the new `FilterState` fields.
- **Update `scripts/eval/search-planner-eval.ts` identically** (schema transcribed verbatim there).
  Add at least one eval case whose expected output includes a new field (e.g. "a cheap to run car for
  city driving" → runningCost=low + usageFit includes city). Run the harness offline (Zod conformance)
  and confirm it still passes.

### d. `src/config/dealer.ts`
- Rewrite the `chat.search.concepts` entries for "economical / cheap to run", "city car / runabout /
  small", "first car", "towing / tow" so they emit `runningCost` / `usageFit` / `sizeClass` instead of
  the current bodyType/fuel workarounds.
- Update the planner-prompt line that currently says "economical is NOT a fuel" to reflect that
  economical now maps to `runningCost=low`.
- Add the three as `FilterDimension` union members where that union is defined. **Do NOT add them to
  `inventory.dimensions`** — decision is AI-only, no visible drawer facets (values exist only on
  enriched listings; empty facets are poor UX).

### e. `src/lib/vehicle-filter-extract.ts` (regex fallback)
- `RUNNING_COST_SYNONYMS`: "cheap to run", "economical", "cheap on fuel", "fuel efficient" → `low`.
- `USAGE_FIT_SYNONYMS`: "city car"/"runabout"/"commuter" → `city`; "first car"/"p-plate"/"learner" →
  `first-car`; "tow*"/"caravan"/"trailer" → `towing`; "tradie"/"work truck" → `tradie`;
  "highway"/"touring"/"long trips" → `highway`. Coordinate "family" with the existing seats
  special-case (don't double-apply; family already has a seats path — add usageFit=family alongside,
  matching how the codebase treats overlapping signals).
- `SIZE_CLASS_SYNONYMS`: "compact"/"small" → `compact`; "large"/"big" → `large`.
- Extend `hasConcreteFilters` and the `extractFilters` wiring so a solo new-field hit counts as a
  concrete filter (so "cheap to run city car" alone is a valid concrete extraction).

### f. `src/lib/ai-search/schema.ts` + `src/lib/ai-search/prompt.ts` (Stage-2 legacy fallback)
Add the three fields so the legacy fallback path also emits them (keep parity with the planner enums).

### DECISION already made — filter drawer is AI-only
No `FilterDrawer.astro`, no `filter-url.ts`, no `inventory.dimensions` changes. Fields flow
planner→URL→GROQ and show as removable chips only.

## Verify (don't assume — DoD)
- `parseFilters('runningCost=low')` round-trips through `serializeFilters`.
- `buildListingsFilter` emits the three clauses with the array-membership form for `usageFit`.
- The regex extractor maps `"cheap to run city car"` → `runningCost=low` + `usageFit` includes `city`
  (write a tiny `npx tsx` scratch check, confirm, then remove it; report the output).
- Planner schema + eval harness updated in lockstep; run the eval harness offline and report pass count.
- If a dev server is reachable, drive one live `/api/search` for "a cheap to run car for city driving"
  and confirm the response lands runningCost/usageFit (not just condition). If not reachable offline,
  say so and rely on the unit checks.
- `npx astro check` MUST be 0 errors.

## Report back
Files changed, the GROQ clauses, the synonym tables, eval-harness pass count, the regex-extract check
output, and `astro check` result. Commit with a `feat(search):` conventional message.
