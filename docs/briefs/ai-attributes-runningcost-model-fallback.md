# Brief — runningCost gets a model-judgment fallback (rule-first, model when no measured data)

You are a sub-agent on the `feat/ai-attributes` branch. Scope: extend the enrichment module so
`runningCost` is filled by AI judgment WHEN the deterministic rule can't decide, plus update the test
and the backfill script to exercise it. Owner has approved this change. ONE conventional commit.

## Why
Today `runningCost` is pure-rule: EV/hybrid → low; else numeric `fuelEconomy` bands; else **WARN +
blank**. Most petrol/diesel listings have no numeric `fuelEconomy`, so running cost is blank on nearly
every car. Owner's call: when there's no measured fuel-economy figure, let the model judge
cheap/medium/expensive from the PUBLIC specs (make/model/engine/body/year) — a measured number still
wins where it exists, and the model must ABSTAIN (leave blank) when it genuinely can't tell. Never
invent.

## Binding constraints (restated — they bite here)
- **Decision 6 boundary:** enrichment input is PUBLIC ONLY. Do NOT touch `buildEnrichmentInput` — it
  already excludes `dealerNotes`/cost/floor. The model prompt is grounded ONLY in the existing
  `EnrichmentInput`. Do not add any private field.
- **All AI through `~/ai`:** reuse the existing `generateObject` on the `structured` tier via the
  dynamic `import('~/ai')` already in the module. NO new provider calls, NO second model round-trip —
  fold runningCost into the SAME structured call that already judges `usageFit`.
- **Determinism / never fabricate:** the model may return "unsure" → running cost stays UNSET + WARN.
  A measured rule result ALWAYS wins over the model. The model result is only consulted when the rule
  returned undefined.
- **Free models for now:** no model/tier changes. Keep `maxTokens` tight.

## Exact changes — `src/lib/generate-description/enrich-attributes.ts`
1. **Extend the structured schema** (`UsageFitJudgment` → rename to `EnrichmentJudgment`): add
   `runningCost: z.enum(['low','medium','high']).nullable()` with a `.describe(...)` — "How cheap this
   vehicle is to run (fuel + typical servicing) judged from make/model/engine/body/year. low = economical
   (small/efficient/EV-like), medium = average, high = thirsty (large/performance/heavy). Return null if
   you genuinely cannot tell from the data — do not guess." Keep `usageFit` as-is.
2. **Judge type + default judge:** change `UsageFitJudge` to return
   `{ usageFit: UsageFit[]; runningCost: RunningCost | null }` (rename to `EnrichmentJudge`). The default
   judge returns both from the one `generateObject` call. Update `JUDGE_SYSTEM` to mention it also rates
   running cost from the public data, abstaining (null) when unsure.
3. **`deriveAttributes` flow:**
   - Compute the rule `runningCost` first (unchanged `deriveRunningCost`), but do NOT emit its WARN yet
     if it's undefined — you may fill it from the model. (Restructure so the "no measured data" WARN is
     only logged if BOTH rule and model leave it unset.)
   - When `opts.judge !== false`, after getting the judgment: if the rule gave a value → keep it,
     `sources.runningCost = 'rule'`. If the rule was undefined and the model returned a valid enum value
     (not null) → use it, `sources.runningCost = 'model'`. If both undefined → unset + the WARN.
   - Validate the model's runningCost against `RUNNING_COSTS`; ignore anything off-enum (treat as null).
   - Keep the existing `usageFit` merge behaviour exactly. Never throw — on judge failure, running cost
     falls back to the rule result (blank if none), same as usageFit keeps its leans.
4. Keep `judge: false` fully offline: with the model skipped, running cost is rule-only (blank when no
   data) — existing offline tests must still pass unchanged.

## Test — `enrich-attributes.test.ts`
- Keep all existing assertions green (rule EV→low, economy bands, missing→unset+warn under `judge:false`).
- Add: with an INJECTED judge returning `{ usageFit: [], runningCost: 'high' }` for a petrol car with no
  `fuelEconomy` → `runningCost==='high'`, `sources.runningCost==='model'`, and NO runningCost warning.
- Add: injected judge returning `runningCost: null` for the same car → runningCost UNSET + warning present
  (model abstained, we did not invent).
- Add: a car WITH numeric `fuelEconomy` where the injected judge returns a DIFFERENT runningCost → the
  RULE value wins, `sources.runningCost==='rule'` (measured beats model).
- Confirm the Decision-6 boundary test still fails loudly if a private key is added to
  `buildEnrichmentInput` output, then reverted (report you did this).

## Backfill — `scripts/enrich-attributes.ts`
Currently runs rules-only (`judge:false`), so it can't fill the new model-judged running cost. Change it
to run the model path when a key is present:
- If `process.env.OPENROUTER_API_KEY` is set, `configureAI({ openrouterApiKey, referer, appTitle,
  attemptTimeoutMs })` (mirror the endpoint's config; reuse `APP_URL`/`APP_TITLE` or sensible literals
  ONLY if not exported — prefer importing existing constants) and call `deriveAttributes(input, { id })`
  WITHOUT `judge:false` so the model runs. If NO key → keep `judge:false` (rules-only) and log a NOTE that
  running cost will stay blank without a key. The dry-run must still complete without a key.
- The diff table already prints per-field source (`rule`/`model`) and WARNs — keep that; it now shows
  which running-cost values came from the model.
- `--commit` stays OWNER-GATED: do NOT run it. Run the DRY-RUN only and paste the table + counts.
- Note: on the current free models this makes ~1 model call per listing and may be slow / degrade on
  timeouts — that's expected; degradation must leave fields blank, never fabricate.

## Verify (DoD)
- `npx astro check` → 0 errors.
- Run the test file (`npx tsx src/lib/generate-description/enrich-attributes.test.ts`) — paste results,
  all green.
- Run the backfill DRY-RUN (`npx tsx scripts/enrich-attributes.ts`) — paste the summary counts + a few
  sample rows showing `runningCost` now populated with source `model` where there's no fuel economy. (If
  free models time out during the dry-run, say so and paste what completed — do not fake it.)

## Report back
Files changed, the exact schema/prompt additions, how the rule-wins-over-model precedence is enforced,
the test results, and the dry-run outcome (including any timeouts). Commit `feat(ai): model-judged
runningCost fallback when no measured fuel economy`.
