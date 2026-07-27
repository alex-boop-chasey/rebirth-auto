# Task brief — Fuel economy / L-100km field

Add a per-vehicle fuel-economy figure to the data model and surface it so Rebi can ANSWER
economy questions (instead of declining) and the comparison tool can weigh it — **without
ever inventing a figure for a vehicle that doesn't have one** (hard determinism rule).

## Stack / rules you must follow
- Astro 7 SSR, Sanity CMS, TypeScript. `npx astro check` must stay green (report before/after error counts; introduce ZERO new errors).
- **Determinism (non-negotiable):** economy is stated ONLY when the vehicle actually has the field populated. If absent, Rebi says it's not listed for that specific vehicle and offers to have the team confirm — it must NEVER estimate/invent an L/100km number. Inventing one is a hard error, same as inventing a price.
- **Config as data:** no dealer literals in code.
- Do NOT commit, do NOT run data scripts or `--commit`, do NOT run migrations. Leave changes in the working tree.

## What to build

### 1. Sanity schema — add the field
`src/sanity/schemaTypes/listing.ts`, inside the `vehicleSpecs` object (near `odometer`/`condition`, ~line 204-230):
- Add `defineField({ name: 'fuelEconomy', title: 'Fuel economy (L/100km, combined)', type: 'number', description: 'Combined-cycle fuel consumption in L/100km. Leave blank if unknown — never guess.', validation: (Rule) => Rule.min(0).max(60).precision(1) })`.
- Match the surrounding field style. It is nullable/optional.

### 2. Projection + type + display — `src/lib/listing.ts`
- Add `fuelEconomy?: number;` to the `VehicleSpecs` type (near `odometer?: number`, ~line 36).
- Add `fuelEconomy` to the `vehicleSpecs{ … }` GROQ projection in `LISTING_FIELDS` (~line 82).
- Add a display row so it renders on listing pages when present (near the odometer/fuel rows, ~line 238-240): a `numberRow('spec-fuel-economy', 'Fuel economy', vs.fuelEconomy, 'L/100km')` following the existing `rowOrFallback`/`numberRow` pattern. When absent it should simply not render (match how other optional spec rows behave).

### 3. Grounding — make economy answerable
The whole point: when a vehicle in the grounded prompt HAS an economy figure, Rebi must be able to state it. Trace how vehicle specs reach the grounding blocks (`src/chatbot/grounding/lookup.ts`, `overview.ts`, `context.ts` — they render specs derived from the same listing fields). Ensure the per-vehicle spec rendering used in grounding INCLUDES the fuel-economy figure when present (e.g. "7.2 L/100km"). If grounding renders specs via a shared helper from `listing.ts`, extending #2 may be enough — verify and, if a grounding renderer lists specs explicitly, add economy there too. Do not add economy to any price/firewall list — it is not a price.

### 4. Flip the four "no such field" guards
These currently tell the model the field does NOT exist. Update each to the new reality — economy IS available per-vehicle when present; state it from the data; if a specific vehicle lacks it, say it's not listed for that vehicle and offer team confirmation; NEVER invent one:
- `src/chatbot/system-prompt.ts:204-208` — rewrite the "Fuel economy: we do NOT hold…" bullet. New guidance: "When a vehicle's listing includes a fuel-economy (L/100km) figure, you may state it. If a specific vehicle has no economy figure listed, say it isn't listed for that vehicle and offer to have our team confirm real-world running costs — never invent or estimate a number."
- `src/lib/ai-search/prompt.ts:73` — the line "There is NO fuel-economy / L/100km field." → note that a fuel-economy field now exists on listings but is NOT a search filter dimension; keep the existing rule that vague "economical/cheap to run" phrasing maps to practical intent (small body + modest budget), NOT to a fabricated figure. **Do NOT add an economy filter to the search schema this round** — scope guard.
- `src/config/dealer.ts:468` — the "Never invent a fuel-economy (L/100km) figure — there is no such field." clause in the `economical/cheap to run` mapping → keep the practical-intent mapping, but change the parenthetical to "a fuel-economy figure may exist per vehicle; never invent one when it doesn't."
- `src/lib/compare-verdict.ts:37-44` — see #5.

### 5. Comparison — add economy as a scored dimension (data-safe)
`src/lib/compare-verdict.ts`: the comment at :37 says there's deliberately no economy dimension because the field didn't exist. Now it does. Add an economy `ScoreDim` — `{ key: 'economy', field: 'fuelEconomy'/*or the correct DimField*/, dir: -1, short: 'fuel economy' }` (lower L/100km is better). CRITICAL: the scoring must gracefully SKIP this dimension for any pair where one or more vehicles lack the figure — never treat "missing" as 0 or infinity. Inspect how `SCORE_DIMS` consumes `field` and how missing numeric specs are already handled; mirror that. If adding a `DimKey`/`DimField`/`Lens` entry is needed for type completeness, add it consistently. Update the stale comment.

## Scope guardrails — do NOT
- Do NOT add a fuel-economy FILTER to the AI search bar / FilterDrawer / listings-query this round (explicitly out of scope; can be a follow-on).
- Do NOT backfill/seed economy values for existing listings (no invented data; the field ships empty and dealers populate it).
- Do NOT touch pricing, the firewall (`verify.ts`), or unrelated grounding logic.
- Do NOT alter display helpers beyond adding the one economy row.

## Acceptance criteria (report on each)
1. `fuelEconomy` field added to `vehicleSpecs` schema; style matches.
2. Type + `LISTING_FIELDS` projection + one listing-page display row added; row hidden when absent.
3. Grounding renders economy when a vehicle has it (name the file/function that carries it into the prompt, and confirm the path).
4. All four guards flipped to "state when present, never invent when absent"; quote each new line.
5. Compare has an economy dimension that SKIPS pairs missing the figure (explain exactly how missing data is handled — prove it can't fabricate a comparison).
6. `npx astro check`: errors before N, after M, M ≤ N.

## Report format
Concise: file:line for each change, the exact new guard wordings, how grounding carries economy, how compare skips missing data, astro check before/after.
