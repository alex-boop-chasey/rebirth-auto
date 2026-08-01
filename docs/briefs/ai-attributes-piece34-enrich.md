# Brief — Pieces 3 & 4: aiAttributes enrichment module + endpoint wiring + Studio button

You are a sub-agent on the `feat/ai-attributes` branch. Scope: build the enrichment module, wire it
into the `describe` action of `/api/generate-description`, and make the Studio "Generate description"
button also patch `aiAttributes` onto the draft. ONE conventional commit at the end.

Do NOT touch the search files, the schema (already committed), or the backfill script — other pieces
own those. The leak-fix piece has already edited this same endpoint (`looksLikeReasoning` validation
on the describe/tone/tighten paths); **preserve that logic** — you are adding enrichment alongside it,
not reverting it.

## The three fields (fixed enums — already in the Sanity schema)
- `runningCost`: single — `low | medium | high`
- `usageFit`: array — `city | family | highway | towing | tradie | first-car`
- `sizeClass`: single — `compact | medium | large`

## HARD CONSTRAINT — Decision 6 data boundary (the reason this piece exists)
`aiAttributes` feeds shopper-facing search/ranking, so enrichment input is **PUBLIC PROJECTION ONLY**.
It must NEVER receive `dealerNotes`, cost, floor price, or any private condition flag. The endpoint's
existing `facts`/`draft` objects DO contain `dealerNotes` — you must build a **separate, fresh input
object** from public fields only. The two AI calls (description vs enrichment) must never share an
object that holds a private field. A test asserts this and must fail loudly if a private key ever
appears in the enrichment input.

Other binding rules: **all AI through `~/ai`** (use `generateObject` on the `structured` tier — never a
direct provider call); **determinism** (rules are pure; ambiguous → `console.warn('[enrich] WARN …',
id, field)` and leave the field UNSET — never guess/fabricate); config-as-data.

## Piece 3 — `src/lib/generate-description/enrich-attributes.ts` (new module)

### `buildEnrichmentInput(publicListing)` → public-only input object
Accepts the listing's PUBLIC fields and returns a plain object containing ONLY:
`vehicleSpecs{bodyType, fuelType, driveType, seatCount, fuelEconomy, year, odometer, condition}`,
`make`, `model`, `doors`, public `details[]` (label/value pairs), asking `price`, `title`.
**Mark the Decision 6 boundary with a comment.** This function must be the single choke point — it
never reads `dealerNotes`/cost/floor. Type its parameter so a private field is not even in scope.

### `deriveAttributes(input)` → `{ aiAttributes, sources, warnings }`
Apply the rule/model split. `sources` records per-field whether the value came from `'rule'` or
`'model'` (for the backfill diff table). `warnings` is a string[] of WARN reasons.

- **`runningCost` — pure rule.** fuelType `electric`/`hybrid` → `low`; else by `fuelEconomy` L/100km:
  `<6` → `low`, `6–9` (inclusive of 6, up to 9) → `medium`, `>9` → `high`. If neither fuelType-EV nor
  a numeric fuelEconomy is present → **WARN + leave unset** (do not guess).
- **`sizeClass` — pure rule.** Deterministic map from `bodyType` (+ `seatCount`):
  hatch/micro → `compact`; sedan/wagon/small-SUV with seats ≤ 5 → `medium`;
  large-SUV/ute/van/people-mover OR seats ≥ 7 → `large`. Unmapped bodyType → **WARN + unset**. Use the
  actual bodyType codes this repo uses (check `scripts/lib/vehicle-specs.ts` / `vehicleSpecs` schema
  for the real vocabulary — do not invent codes).
- **`usageFit` — rule leans + model judgment.** Deterministic leans first: ute/van + 4wd/awd →
  `towing` + `tradie`; seats ≥ 7 or a family-SUV → `family`; compact + `runningCost=low` → `city` +
  `first-car`. Then, for genuine judgment calls (e.g. `highway`, borderline `family`), call
  `generateObject` on the **`structured`** tier with a Zod v4 schema whose `usageFit` is
  `z.array(z.enum([...the six codes]))` with `.describe(...)`; ground the prompt ONLY in the public
  input. **Validate model output against the enum** (drop any off-enum value). Merge model results
  with the rule leans (union, deduped). On model failure/timeout → keep the rule leans only. If there
  is no confident signal at all → leave unset + WARN. Keep the model call optional and side-effect free
  on failure (never throw out of `deriveAttributes` — degrade).

Return `aiAttributes` with only the fields that were confidently derived (omit unset fields entirely,
so a partial result is representable).

### Test — `enrich-attributes.test.ts` (or the repo's test convention; check package.json scripts)
- Asserts `buildEnrichmentInput`'s output contains NONE of: `dealerNotes`, `cost`, `floor`, and any
  private price key — **fails loudly** if one is added later. Feed it an input that DOES carry a
  `dealerNotes`/cost to prove they're stripped.
- Asserts the pure rules: an EV → `runningCost=low`; `fuelEconomy: 5` → `low`, `7` → `medium`, `11` →
  `high`; missing both → unset + a warning present. A couple of `sizeClass` mappings + an unmapped
  bodyType → unset + warning.
- Rules must be exercised WITHOUT a live model (the model path is only `usageFit` judgment; the test
  should not require `OPENROUTER_API_KEY` — structure `deriveAttributes` so the rule assertions run
  offline, e.g. the model call short-circuits when no key/config or is separately injectable).

## Piece 3 (cont.) — endpoint wiring in `src/pages/api/generate-description.ts`
Only the **`describe`** action gains enrichment (not tone/tighten/sellingPoints). After the description
is produced and passes the existing `looksLikeReasoning` validation:
- Build the enrichment input via `buildEnrichmentInput(...)` from the **draft's PUBLIC fields** (NOT
  the `facts` object — `facts` carries `dealerNotes`). Assemble it separately and explicitly.
- Call `deriveAttributes(...)`; wrap in try/catch. On success, include `aiAttributes` in the response.
  On enrichment failure, still return the description, plus `enrichError: true` (never 500, never block
  the description). Response for describe becomes `{ description, aiAttributes?, enrichError? }`.
- Keep tone/tighten/sellingPoints responses exactly as they are.

## Piece 4 — Studio button in `src/sanity/components/GenerateDescriptionInput.tsx`
On a successful `describe` run, in addition to `onChange(set(description))`, patch `aiAttributes` onto
the current draft document. This is a DOCUMENT-level patch (a different field than the PT input's own
`description`), so use the Studio-native patch path — `useDocumentOperation(publishedId, type)` `.patch`
(or `useClient` against the draft id) — targeting the DRAFT. Follow current Studio API; check installed
`sanity` version if unsure.
- **Partial success must be visible:** if `description` came back but `aiAttributes` is absent or
  `enrichError` is set, still set the description and `toast.push({ status: 'warning', … })` telling the
  dealer the AI attributes were left unset (they can fill them manually) — do NOT fail silently and do
  NOT block the description.
- If `aiAttributes` is present, patch it and include it in the success toast (or a second info toast).
- Other actions (tighten/tone/sellingPoints) unchanged.

## Verify (don't assume — DoD)
- `npx astro check` → 0 errors.
- Run the enrich-attributes test; confirm the Decision-6 boundary assertion FAILS when you temporarily
  add a private key to the input (then revert), proving it's a real guard. Report that you did this.
- Confirm the rule table with the offline unit assertions (EV/economy/sizeClass) — paste the results.
- Endpoint: describe the response shape change and that tone/tighten/sellingPoints are untouched.
- Studio: since Studio rendering can't be driven headlessly, at minimum typecheck the patch call and
  explain which Studio API you used and why it targets the draft; note partial-failure toast wiring.

## Report back
Files changed/created, the rule thresholds implemented, the exact bodyType→sizeClass map (with the
real codes you found), how the model call is gated, the boundary-test proof, and astro check result.
Commit with a `feat(ai):` conventional message.
