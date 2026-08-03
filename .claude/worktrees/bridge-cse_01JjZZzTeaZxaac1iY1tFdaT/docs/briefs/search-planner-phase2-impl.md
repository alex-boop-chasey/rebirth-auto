# Phase 2 brief — implement the approved LLM search query planner

Owner-approved (Phase 1 sign-off): the design in `docs/briefs/search-planner-synthesis.md`. Build it.
This wires a NEW LLM query planner as the **primary** interpreter on the search path, with the existing
regex `extractFilters()` demoted to the **fallback** on planner failure/timeout/disabled/no-key.

Read first (context): `docs/briefs/search-planner-synthesis.md` (the whole thing — §2 schema, §3 prompt,
§4 policy, §6 config change, §8 wiring/risks are your spec), then the real files below.

## Binding constraints (restate — these bite here)
- **All AI through `src/ai/`** via `generateObject` on the `structured` tier. Never call OpenRouter
  directly. Never import `src/ai/providers/*`.
- **Config as data:** no dealer literals outside `src/config/dealer.ts`. Family seats, low-km threshold,
  concept phrases, planner timeout + kill-switch all live in config and interpolate into the prompt.
- **Determinism / grounding:** the planner emits a query plan only — never inventory, never a fabricated
  price/number. The `interpretation` string must never assert stock or a result count.
- **Filter state only via `applyFilterUrl`** — you are not changing that; the island already owns it.
- **Zero regression when the planner is off or unavailable:** with no `OPENROUTER_API_KEY` (the state in
  this environment) or `planner.enabled=false`, `/api/search` must behave EXACTLY as it does today.
- **`npx astro check` must stay green.**

## Files to read before writing
- `src/pages/api/search.ts` — the endpoint. Note the current flow: flag → validate → rate-limit →
  Stage 1 regex pre-pass (`extractFilters`) → Stage 2 existing LLM (`ExtractionSchema`/`SYSTEM_PROMPT`).
- `src/lib/ai-search/schema.ts` — `SearchResponse` type, `normalizeCurrentFilters`, `activeFilterSummary`,
  `toSearchResponse`, `fallbackResponse`. **`ExtractionSchema` is ALSO used by
  `src/ai/tools/inventory-tools.ts` — do NOT remove or change it.** You may ADD an optional field to
  `SearchResponse` (additive only).
- `src/lib/listings-query.ts` — `FilterState` (the 12 filter keys + sort/page), `parseFilters`,
  `activeChips`, and **how a keyword / title match is represented** (investigate for R1 below).
- `src/components/search/SmartSearch.tsx` — the island consumes `data.filters`, `data.confidence`
  (applies filters only when `!== 'low'`), `data.interpretation`, `data.clarifyingQuestion`. **You are
  NOT changing the island in this task** — your response mapping must satisfy what it already reads.
- `src/ai/structured.ts` + how `src/pages/api/search.ts` calls `configureAI`/`generateObject` — mirror
  that call style (same `configureAI` config, so the shared isolate doesn't throw).
- `src/config/dealer.ts` L767-773 (`chat.grounding.lookup`: `familySeats`, `lowKmThreshold`) and
  L820-855 (`chat.search`: `concepts`).

## Task 1 — new module `src/ai/search/query-planner.ts`
- Transcribe the **final `SearchPlan` Zod v4 schema from synthesis §2 verbatim** (every `.describe()`).
  You may reuse the exact schema already validated in `scripts/eval/search-planner-eval.ts` (it is the
  source of truth — 15/15 conformance). Export `SearchPlan` + the inferred type.
- A prompt builder that renders the synthesis §3 template, interpolating from config:
  `{{dealerName}}`, `{{familySeats}}` and `{{lowKmThreshold}}` (from `chat.grounding.lookup` — shared
  with the regex fallback so both paths agree), and `{{softConcepts}}` (rendered from
  `chat.search.concepts`, one line per `{phrase, maps}`).
- `planSearch(query, currentFilters?): Promise<SearchPlan | null>` — calls `generateObject({ capability:
  'structured', schema: SearchPlan, ... })`. Wrap in a **timeout** (`chat.search.planner.timeoutMs`);
  return `null` on ANY failure (timeout, parse/validation exhaustion, thrown error) so the caller falls
  back cleanly. Do the `configureAI` call exactly as `search.ts` does today.

## Task 2 — config (`src/config/dealer.ts`)
1. `chat.grounding.lookup.familySeats`: `[7, 8]` → `[5]` (approved family-trap fix). This is shared with
   the regex fallback — intended.
2. **`chat.search.concepts` — reconcile with the approved policy (fixes the prompt-internal
   contradiction the critique flagged):**
   - **family** entry (currently *"bodyType suv or wagon, and seats 7 or 8 when they mention several
     children"*) → *"seats {{familySeats}} — room for the family; do NOT force a body type (a family car
     can be a hatch, wagon, sedan or SUV); use 7–8 seats ONLY on explicit large-family cues (several kids
     / third row / people-mover / a stated 7+)."* (Note: this string is interpolated raw into the
     prompt; keep the `{{familySeats}}` token literal so the builder expands it, OR write `5` and add a
     code comment — pick the approach that matches how you render `{{softConcepts}}`. Simplest: render
     the token in the builder.)
   - **first car** entry (L833) and **economical** entry (L837) and **city/runabout** entry (L841):
     REMOVE the invented-price language (*"a modest priceMax (around 25000) if no budget is given"*).
     The approved policy is **flag budget, never fabricate a ceiling** — these concepts must no longer
     instruct the model to invent `priceMax`. Keep the non-price mappings (hatchback / auto / no-fuel).
     Where budget is implied but unstated, the planner's clarification gate handles it.
3. Add a **`chat.search.planner`** block: `{ enabled: boolean (default true), timeoutMs: number }`. Pick a
   sensible `timeoutMs` (the planner sits between submit and results — propose ~6000–8000ms and leave a
   comment on the tradeoff). Extend the `search` type definition accordingly. This is the config-as-data
   kill-switch (planner off → regex-only, today's behaviour).

## Task 3 — wire `src/pages/api/search.ts` (ADDITIVE, planner-primary, zero-regression fallback)
Insert the planner as **Stage 0**, BEFORE the existing regex pre-pass, gated so today's path is the
untouched fallback:

```
if (cfg.planner.enabled && env.OPENROUTER_API_KEY && !refine) {
  const plan = await planSearch(query, current);        // null on any failure/timeout
  if (plan && plan.kind === 'search') {
     -> map SearchPlan -> SearchResponse (below), captureSearch(filters), return 200
  } else if (plan && plan.kind !== 'search') {           // not_vehicle | gibberish
     -> return a low-confidence SearchResponse whose interpretation is plan.interpretation
        (confidence:'low' so the island does NOT apply filters and shows the redirect;
         this is the no-plan escape that routes the shopper to normal chat)
  }
  // plan === null -> FALL THROUGH to the existing Stage 1 regex pre-pass + Stage 2, unchanged
}
```
Everything after this block (regex pre-pass, existing ExtractionSchema Stage 2, fallbackResponse) stays
**exactly as-is** — it is now the fallback chain. `refine` requests keep using the existing path (the
planner does not do filter carry-forward/removal). When `planner.enabled` is false or there's no key,
the block is skipped entirely → byte-identical to today.

**SearchPlan → SearchResponse mapping:**
- `filters` ← `plan.filters` (already the 12 FilterState keys; let `normalizeCurrentFilters`/the
  executor supply sort/page defaults as the existing path does).
- `interpretation` ← `plan.interpretation`.
- `clarifyingQuestion` ← `plan.clarification?.question ?? null`.
- `confidence` ← `'high'` for a `kind:'search'` plan that has at least one active filter or a keyword;
  else `'low'`.
- `matchReasons` ← the applied inferences' `assumed` strings (fall back to `activeChips` values), max 5.
- **NEW:** add an optional `inferences?: {signal,assumed,fields}[]` field to `SearchResponse` in
  `ai-search/schema.ts` and populate it from `plan.inferences`, so the data reaches the client for a
  future chip UI. (Do NOT build the chip UI in this task — additive field only.)

**R1 — keyword (investigate + handle, do not silently drop):** determine from `listings-query.ts` /
`applyFilterUrl` whether a make/model keyword can be applied as a URL/title param on the grid. If there
is a clean mechanism, wire `plan.keyword` into the response so it applies (and confirm it ANDs with
structured filters). If wiring keyword cleanly is a larger change than this task, keep the current
behaviour (the existing pre-pass already ignores `keyword`), still return `plan.keyword` in the response
for the island, and **flag it in your report as a known gap** — do not expand scope silently.

## Verify (do all — you cannot exercise the live LLM: no OPENROUTER_API_KEY here)
1. `npx astro check` → 0 errors.
2. `npx tsx scripts/eval/search-planner-eval.ts` → still 15/15 offline (schema unchanged).
3. **Prove zero regression on the fallback path:** start the dev server (`astro dev --background`) and
   with NO key set, POST a few queries to `/api/search` (curl): a concrete one (`"red suv under 40k"`),
   a soft one (`"family car"`), and the canonical (`"a secondhand vehicle as a second car for our
   family"`). Confirm each returns HTTP 200 with a sensible `SearchResponse` via the existing regex/
   Stage-2 fallback (planner is skipped with no key) — i.e. search still works exactly as before.
   Capture the responses in your report.
4. Confirm `planner.enabled=false` also yields today's behaviour (skips the block).

## Out of scope (do NOT do)
- The SmartSearch inference-CHIP UI (render/remove chips) — follow-up; you only add the response field.
- `DECISIONS.md` — the orchestrator writes that.
- Removing/altering `ExtractionSchema` or `SYSTEM_PROMPT` (still used by inventory-tools + fallback).
- Any push. Commit nothing — the orchestrator reviews and commits.

## Report back
The files changed, the exact `chat.search.planner` defaults you chose (+ why), the R1 keyword decision
(wired or flagged-gap), the astro-check + harness + curl-fallback results verbatim, and anything that
diverged from this brief with the reason.
