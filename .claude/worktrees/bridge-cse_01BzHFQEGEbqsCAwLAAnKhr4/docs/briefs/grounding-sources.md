# Task brief — Supplementary Rebi grounding sources (manufacturer + reviews), STUBBED, OFF BY DEFAULT

Give Rebi two new OPTIONAL knowledge sources — manufacturer new-model info and automotive
review sentiment — as additive, fail-open, CONTEXT-ONLY grounding blocks. Follow
`docs/briefs/_stub-convention.md` (READ FIRST). **These must not touch the default chat path.**

## The overriding safety rule
The live chatbot pipeline is the crown jewel and already works. Your feature must be
**disabled by default** (`enabled: false`) so that with default config the composed system
prompt and the anti-hallucination firewall are BYTE-IDENTICAL to today. Only when a dealer
flips the flag do the new blocks appear. Model your work EXACTLY on the existing continuity
`journey` grounding, which is additive and fail-open:
- Read `src/chatbot/grounding/journey.ts` and `src/chatbot/grounding/index.ts` (see how
  `resolveJourney` is folded in its own try/catch, and how it's CONTEXT-ONLY, price-stripped,
  and explicitly framed as "NOT a source of prices, specs, or availability").
- Your blocks follow the same contract: own try/catch in `buildGroundedSystemPrompt`, return
  `null` on disabled/miss/any error, PRICE-STRIPPED (reuse the same stripping approach), and
  explicitly framed as EXTERNAL REFERENCE — never our inventory, never stock/availability,
  never last-word over live matches. The firewall's allow-list must not be widened by these
  blocks (strip prices; do not introduce numbered vehicle rows).

## Stack / rules
- `npx astro check` stays green (before/after; zero new errors).
- **Config as data:** add `grounding.manufacturer` and `grounding.reviews` sub-blocks (each `{ enabled: false, maxItems }`) inside the existing `chat.grounding` config in BOTH dealer config objects (`src/config/dealer.ts` ~line 104 and ~line 408). `enabled: false` in BOTH.
- Env-gated stub data (no real fetch): `useStub = !env.MANUFACTURER_API_KEY || truthy(env.STUB_MANUFACTURER)` and similarly `STUB_REVIEWS`. But since the FEATURE is off by default, the stub only ever runs when the dealer opts in.

## Build
### 1. Stubs
- `src/stubs/manufacturer.ts` — `export interface ModelInfo { make; model; year?; overview: string; keyFeatures: string[]; }` and `export async function getModelInfo(make: string, model: string): Promise<ModelInfo | null>` returning realistic structured info for a few well-known makes/models (Ford Ranger, Toyota Corolla, Mitsubishi Triton, etc.), `null` for unknown. Deterministic, no prices. `// TODO_KEYS: Manufacturer grounding — MANUFACTURER_API_KEY / partner feed — per-brand`.
- `src/stubs/reviews.ts` — `export interface ReviewSummary { make; model; rating: number; pros: string[]; cons: string[]; source: string; }` and `getReviewSummary(make, model)` returning structured, clearly-attributed demo review data (source label like "demo review data"), `null` unknown. No prices. `// TODO_KEYS: Review grounding — review source licence (Wheels/etc.) — per-source`.

### 2. Grounding modules (mirror journey.ts)
- `src/chatbot/grounding/manufacturer.ts` — `resolveManufacturer(userMessage, cfg, useStub): Promise<string | null>`: if disabled → null; detect a known make/model in the message using the EXISTING make/model detection utilities already in the grounding layer (look at `verify.ts` `findKnownMakes`/`CAR_MAKES` and how `lookup.ts` matches — reuse, don't reinvent); fetch stub info; render a delimited `=== MANUFACTURER REFERENCE (external, not our inventory/stock/pricing) === … === END ===` block, price-stripped. Fail-open null on any error.
- `src/chatbot/grounding/reviews.ts` — same shape for review sentiment, `=== INDEPENDENT REVIEW REFERENCE (external, not our inventory) === …`.

### 3. Fold into `src/chatbot/grounding/index.ts`
- Add two more INDEPENDENT try/catch blocks exactly like the existing `journey` fold (lines ~63-70), each gated on its config flag, each appended to the prompt via the existing `buildSystemPrompt` context. Extend `buildSystemPrompt` (`src/chatbot/system-prompt.ts`) to accept optional `manufacturer` / `reviews` context strings and place them AFTER live inventory/focus but clearly as external reference — mirror how `journey` is threaded through `buildSystemPrompt`. When both flags are off, the produced prompt string must be identical to today (verify: the new params default to null/undefined and add nothing).

## Scope guardrails — do NOT
- Do NOT enable by default. Do NOT let these blocks carry prices or numbered vehicle rows (firewall safety). Do NOT change the firewall (`verify.ts`) logic. Do NOT alter the live inventory/focus/journey blocks. Do NOT make real HTTP calls. Do NOT edit get-env.ts. No Math.random / module-top-level new Date(). Do NOT commit.

## Acceptance criteria (report each)
1. Stubs created (interfaces + sample outputs).
2. Grounding modules mirror journey (fail-open null; price-stripped; external-reference framing — quote the block headers).
3. Fold into index.ts + buildSystemPrompt; **prove the default-off prompt is identical to today** (explain why the new params contribute nothing when flags are off).
4. Config sub-blocks in BOTH objects, enabled:false in both.
5. Firewall safety: explain why these blocks can't widen the price/make allow-list.
6. astro check before N / after M (M ≤ N).

## Report format
Concise: files, block header strings, the default-off-identical proof, firewall-safety reasoning, astro check before/after, anything not done.
