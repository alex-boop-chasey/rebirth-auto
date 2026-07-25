# Build ticket — AI search: LLM-driven refine + anti-hallucination backstop (free-model, Haiku-ready)

**Status:** approved by owner via a 3-agent contest + synthesis. Owner chose to **stay on free models
for now** (the Haiku reply-brain upgrade is deferred to a one-line tier flip for the demo). So this
builds the pragmatic architecture (contest Agent 1, with Agent 3's fixes applied): make the AI the
interpreter so the grid moves, and add a structural backstop so the free model can't ship an invented
car/price. Everything is model-agnostic — flipping the reply tier to Haiku later makes it dramatically
better with no rebuild.

## The failure this fixes (owner's real test)
Conversational refines ("cheap and low fuel", "a good first car for a city driver on the P Plate, easy
to park and low fuel") (1) **didn't move the grid** — the in-chat refine used the deterministic
keyword matcher (`vehicle-filter-extract.ts`), and those soft words are all stopwords/unknown — and
(2) **Rebi hallucinated** cars/prices ("Honda Jazz ~$25k", not in the Subaru/Chery/LDV/Isuzu/Ford lot)
**even though the grounding block already listed the real stock** — a free-model failure to obey its
grounding. Root cause confirmed by the critique: grounding already exists; the free model ignored it,
and stale grounding (grid didn't move) made it worse.

## Hard constraints
- **Chat streaming/escalation core: additive only.** No tool-calling loop, no new AI tier wired in
  now, no rewrite of `streamChatResponse`'s marker logic. The only core touch is a post-hoc reply
  scrub + buffering inventory-bearing streamed turns (mirror the existing escalation-buffer pattern) —
  same footprint the compare/listing work used.
- **URL is the single source of truth** (drive the ONE filter URL via `applyFilterUrl`/`parseFilters`
  /`hrefFor`; no parallel store). Homepage-fenced (`#inventory-results` present).
- All AI via `src/ai/`; `dealerNotes` excluded (public projections only); config-as-data; fail-open.

## 1. Fix the grid — LLM interpreter in the refine (not the keyword matcher)
In `ChatWidget.astro`'s §C refine block, replace the client-side deterministic `extractFilters` with a
call to the **existing `/api/search`** (deterministic pre-pass accelerator → enum-locked `structured`
`generateObject` → `SearchResponse.filters`), then drive the grid via `applyFilterUrl(hrefFor(filters))`
exactly as `SearchDock` does. Keep the `looksLikeQuestion` gate and the `gridPresent()` homepage-fence.
Ordering matters: the grid URL must update **before** the grounded `/api/chat` turn's `basePayload`
reads `location.search`, so the reply grounds on the refined set (critique §2.5).
- **Concept map for soft phrases** (config-as-data): add `chat.search.concepts` in `dealer.ts` and
  interpolate it + few-shots into `src/lib/ai-search/prompt.ts` so the enum-locked extractor maps
  "first car / P-plate → small hatchback + auto + budget", "economical / cheap to run → hybrid (or
  low-price petrol hatch)", "easy to park / city car → hatchback", "camping / touring → 4wd/awd +
  suv/ute", "family → 7-8 seats". P-plate is NOT a filter dimension — the prompt must flag it, not
  invent one. Output stays enum-locked (a concept can only ever emit valid codes).
- **Carry-forward on refine:** add a `SYSTEM_PROMPT` line — "if current filters are shown, carry them
  forward unless the request modifies/removes one; return the COMPLETE resulting set" — so REPLACE
  semantics work (handles "actually not diesel"). `/api/search` already receives `current` filters.

## 2. Anti-hallucination backstop — the grounding firewall (load-bearing on free models)
New pure module `src/chatbot/grounding/verify.ts` (portable, unit-testable, no Sanity/Astro import).
`buildGroundedSystemPrompt` returns `{ prompt, facts }`; `facts` is an allow-list built from the exact
PUBLIC grounded rows already fetched (no new query, no `dealerNotes`):
- `allowedPrices: Set<number>` — the exact prices in the grounded rows (focus/matches/overview).
- `stockedMakes: Set<string>` — brand tokens parsed from the grounded/active listing **titles** (there
  is NO structured `make` field — makes live in `title`, e.g. "2021 Subaru Outback"; parse best-effort)
  plus a small static `CAR_MAKES` lexicon (config) to recognise *real* brand words.
`scrubReply(reply, facts, mode)`:
- **Price firewall (primary, reliable):** any `$`-figure in the reply not in `allowedPrices` → violation.
- **Make firewall (best-effort secondary):** any token that IS a known car brand (`CAR_MAKES`) but is
  NOT a stocked brand → violation. (Catches the "Honda Jazz" case; a wrong brand at a coincidentally-
  grounded price is caught by the make check, a right brand at a wrong price by the price check — the
  owner's exact failure is caught by both.)
- On violation (default `mode:'block'`): discard the reply, substitute a grounded fallback that names
  ONLY real matches (or points to /listings + the team). Config-tunable `block`|`redact`.
Wire into `core.ts`: run `scrubReply` on the JSON reply path (before `persistExchange`) and on the
streamed reply — **buffer inventory-bearing streamed turns** (the grounding step already knows if it
produced inventory rows) so a bad token never reaches the browser; pure-chat turns keep live streaming
(scrub at `done` + a `replace:true` flag the client uses to overwrite the bubble). This mirrors the
existing escalation-buffer pattern; escalation/`[[ESCALATE]]`/Turnstile/D1/handoff stay byte-identical.
Honest scope: this catches invented brands + prices, NOT wrong specs on a real car — the real fix for
that is the model (Haiku), deferred. It's a backstop, not a guarantee.

## 3. Economy honesty (the owner's literal "low fuel" ask)
There is **no fuel-economy field** anywhere (schema + all projections confirm). Add persona/grounding
guidance so Rebi offers to filter to hybrids/electrics or lower-priced economical models but says it
doesn't have exact per-car fuel-economy figures — never invents an L/100km number. (The price firewall
won't catch an invented economy figure, so this must be handled by instruction.)

## 4. Haiku-ready (the deferred real-intelligence upgrade)
Leave the chatbot reply on the free `chat-cheap` tier. Do NOT wire a tool loop. Add a one-paragraph
note (in this doc + `tiers.ts` comment) that flipping the reply capability to a Haiku-backed tier is a
one-line change that makes the whole thing markedly better — the demo upgrade, per the standing memory
note. The architecture built here (LLM refine, grounding, firewall, concept map) works with either.

## Files
- **Add:** `src/chatbot/grounding/verify.ts` (`scrubReply`, `GroundingFacts`, static `CAR_MAKES`,
  grounded-fallback builder).
- **Change:** `src/chatbot/grounding/index.ts` (return `{prompt, facts}`; collect prices/makes from the
  rows already fetched), `src/chatbot/grounding/{context,lookup,overview}.ts` (surface the structured
  rows/prices they already fetch for the allow-list — no new dealerNotes exposure), `src/chatbot/core.ts`
  (scrub on JSON + streamed reply; buffer inventory turns), `src/components/widgets/ChatWidget.astro`
  (§C refine → `/api/search` LLM instead of client `extractFilters`; one `replace`-flag line in
  `handleEvent`), `src/lib/ai-search/prompt.ts` (concept guidance + carry-forward + soft few-shots),
  `src/config/dealer.ts` (`chat.search.concepts`, `chat.grounding.antiHallucination:{enabled,mode}`,
  `CAR_MAKES` lexicon).

## Verify (build agent, before reporting)
1. `npx astro check` → 0 errors.
2. `astro dev --background`, then reproduce the owner's transcript + more:
   - "cheap and low fuel", "a good first car for a city driver on the P Plate, easy to park and low
     fuel" → **the grid moves** to a sensible filtered set (small/economical), and Rebi's reply
     names ONLY real on-screen cars — no Honda Jazz/i30/Picanto, no invented prices.
   - A **zero-match** query (e.g. hatchback if the lot has none) → Rebi says "nothing matches", offers
     to broaden — never invents.
   - "how economical is the X?" → Rebi offers economical options but doesn't invent an L/100km figure.
   - A question ("is the diesel reliable?") → grounded answer, grid unchanged.
   - Directly attempt to force a fake price/brand → the firewall blocks it (substitutes grounded text).
   - **Regression:** plain non-search chat, an escalation turn, Turnstile first-message — unchanged.
   - `dealerNotes` in no reply; classic FilterDrawer + no-JS still work.
   Then `astro dev stop`. No scratch files. Do NOT commit.

## Deferred (logged in todo.md → Experience-Mode runway)
The full by-construction **tool-calling agent** (contest Agent 2) on a paid model — the strongest
hallucination guarantee — and the Haiku reply-brain flip (a config change for the demo).
