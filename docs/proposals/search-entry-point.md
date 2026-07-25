# Build ticket — Search entry point ("Rebi-fronted homepage search")

**Status:** approved by owner via a 3-agent solution contest + synthesis (A1 "hero+companion" proven,
A2 "Rebi takes the wheel" experimental, A3 critic). This is the synthesis: **A1's safe,
chatbot-untouched architecture + A2's pre-pass extraction & always-on Rebi, with every bug the critic
verified fixed and the risky bits deferred.** Owner's refine choice: **"type it to Rebi"** — on the
homepage, a filter-y message to Rebi re-drives the grid AND Rebi comments; questions answer normally.

## Goal
Rebuild plain-English conversational search as the `kind:'search'` caller of the priming seam. A
Rebi-fronted homepage search dock drives the inventory grid; **Rebi always slides in with the
results**, grounded in what's on screen; you refine by talking to Rebi. Continuity across
search→listing→compare falls out of the seam.

## HARD CONSTRAINTS (the whole point of choosing this design — do not violate)
1. **Do NOT touch the chatbot's streaming/escalation core.** No changes to `core.ts`'s
   `streamChatResponse` / `decide()` / `stripMarkers` / the `[[ESCALATE]]`/`[[RESOLVED]]` first-line
   buffering. **No action channel, no new SSE event types.** Grid-driving is **client-side** via the
   existing `applyFilterUrl`. Chatbot-side changes are limited to additive, low-risk touches
   (a `resolveFocus` `search` branch; a `buildOpening` arm; the widget's search-mode input handling) —
   the same footprint as the listing/compare entry points. (Regression here hits live handoff — verify
   a plain chat, an escalation, and a Turnstile first-message still work.)
2. **Homepage-fence the grid-driving.** The results grid `#inventory-results` exists ONLY on the
   homepage (verified: `/compare` and `/listings/[slug]` have none). Only call `applyFilterUrl` when
   that grid is present. **Off-homepage, the search context is conversational-only** — Rebi stays
   grounded but must NEVER push a filter URL to a page with no grid (the critic's sharpest defect).
3. **URL is the single source of truth (Decision 5).** Drive the ONE filter URL via
   `applyFilterUrl`/`parseFilters`/`serializeFilters`. No parallel AI-filter store.
4. **Preserve the classic `FilterDrawer`** as the JS-off / manual fallback (Lens 1). No-JS users keep
   the headline hero + drawer exactly as today; the dock is a JS-only enhancement layered on.
5. `dealerNotes` excluded (public projection); all AI via `src/ai/`; config-as-data; fail-open;
   portable `core.ts`; refs carry no free text.

## Design

### A. Restore the salvaged extraction (from `docs/ai-natural-language-search-reference.md`)
- **`src/lib/ai-search/schema.ts`** — `ExtractionSchema`, `AiFiltersSchema`, `toFilterState`,
  `toSearchResponse`, `fallbackResponse`, `normalizeCurrentFilters`. Enum sets import from
  `listings-query.ts` (they still line up; `buildListingsFilter` was extracted this session but the
  enum sets are unchanged — verify).
- **`src/lib/ai-search/prompt.ts`** — the enum-interpolated `SYSTEM_PROMPT` + few-shots.
- **`src/pages/api/search.ts`** — feature-flag → cheap body validation → per-IP rate limit → extract →
  `toSearchResponse`; graceful **HTTP-200** fallback. Accepts `{ query, filters? }` (`filters` = the
  current FilterState for refinement, via `normalizeCurrentFilters`).
  - **FIX (critic-verified A1 bug):** call `checkRateLimit(env.RATE_LIMIT_KV, ip, cfg.rateLimit,
    'search:')` — a **distinct key prefix** so search does NOT share the chat `rl:` 10/hr counter.
  - **Extraction = deterministic pre-pass → LLM fallback (from A2):** run the deterministic
    `extractFilters()` (currently in `src/chatbot/grounding/lookup.ts` — reuse it; extract to a shared
    location if cleaner) FIRST; if it yields concrete filters, use them and **skip the LLM**. Only when
    the pre-pass is empty/ambiguous, call `generateObject` on the `structured` tier. Cheaper + faster
    than always-LLM; still handles soft concepts ("family/camping/off-road") via the LLM path.

### B. The homepage search dock (`src/components/search/SearchDock.astro`, new)
- A Rebi-branded plain-English input in the hero of `src/pages/index.astro` (currently headline-only),
  with the salvaged typewriter placeholder. JS-only enhancement; leave `#filters-trigger` +
  `<FilterDrawer>` + `<InventoryResults>` intact as the fallback.
- **On submit:** loading beat → `POST /api/search { query }` (supersede-in-flight `seq`) →
  - `applied = confidence !== 'low' && activeChips(filters).length > 0` → `applyFilterUrl('/?' +
    serializeFilters(filters))` → grid updates, heading flips to **"Results"**, dock recedes.
  - **ALWAYS open Rebi** (`setActiveContext('search', [serializeFilters(state)], summary)` + open the
    panel) — even on low-confidence/empty (fixes A1's conditional-Rebi; matches the owner's "Rebi
    slides in" every time). On low-confidence, Rebi (grounded) asks the clarifying question
    conversationally rather than a dead-end.
  - Empty extraction at high confidence must NOT clear existing filters (the salvaged `applied` guard).

### C. "Type it to Rebi" — Rebi's search input drives the grid (owner's choice)
When `activeContext.kind === 'search'` **and the grid is present (homepage)**, on send:
- Run the deterministic `extractFilters(message)` **client-side** (free) to detect filter intent.
  - **Concrete new filters (a refine, e.g. "actually under $30k"):** merge onto the current
    FilterState, **`applyFilterUrl`** (drive the grid, client-side — chatbot core untouched), update
    `activeContext.refs` to the new `serializeFilters(state)`, then send a **normal grounded
    `/api/chat`** turn so Rebi comments on the tighter set ("here are the 4 under $30k…"). The grid
    move is client-side; Rebi's comment is an ordinary grounded chat turn — no action channel.
  - **No filter intent (a question, e.g. "is the diesel reliable?"):** a normal grounded `/api/chat`
    turn; Rebi answers from the on-screen results; grid unchanged.
  - Ambiguous soft refines the deterministic pre-pass misses → treated as a question; Rebi (grounded)
    can offer to filter. (An LLM intent-classifier is a later refinement; v1 is deterministic-drives.)
- **Off-homepage (no grid):** never `applyFilterUrl`; the search context is conversational grounding
  only.

### D. `resolveFocus` search branch (`src/chatbot/grounding/context.ts`)
Replace the `kind:'search'` no-op: parse the filter-string ref via `parseFilters` → `buildListingsFilter`
+ the existing public `FOCUS_PROJECTION` (no `dealerNotes`) → render a "RESULTS CURRENTLY ON SCREEN"
focus block (filter summary + **exact total** + top-N matches, live). `cachedText`, fail-open. This
grounds Rebi in exactly what the visitor is looking at (and backstops the enum-subset mismatch below —
if `parseFilters` drops a body type the dealer doesn't stock, the total reads 0 and Rebi says so
honestly).

### E. Config (`src/config/dealer.ts`)
- Add `'search'` to `chat.context.allowedKinds`.
- Add a `chat.search` block: `{ enabled, maxQueryLength, rateLimit: { windowSeconds, maxRequests },
  placeholders: readonly string[], typewriter timings }` (restored from the removed config).
- **FIX (critic — unbounded ref):** add a max-ref-length cap in `parseContext` (`src/chatbot/context.ts`)
  and enforce it, so a multi-kilobyte ref can't bloat the KV cache key / query.

### F. Critique fixes recap (all baked in above)
Distinct `search:` rate-limit prefix; homepage-fenced `applyFilterUrl`; Rebi always opens; ref-length
cap; grounding backstops the dealer-subset body-type mismatch; searches use `/api/search`'s own counter
(a refine's Rebi comment is one ordinary grounded chat turn, not an extra search-budget hit).

## Files
- **Add:** `src/lib/ai-search/schema.ts`, `src/lib/ai-search/prompt.ts`, `src/pages/api/search.ts`,
  `src/components/search/SearchDock.astro`.
- **Change:** `src/pages/index.astro` (mount the dock; keep the drawer fallback),
  `src/chatbot/grounding/context.ts` (search branch + `renderSearchFocus`),
  `src/components/widgets/ChatWidget.astro` (search-mode input handling per §C, `buildOpening` search
  arm, prime-search hook, import `applyFilterUrl`, homepage-grid guard), `src/config/dealer.ts`,
  `src/chatbot/context.ts` (ref-length cap). Possibly relocate/share `extractFilters` if the endpoint
  reuse is cleaner. **Do NOT change** `core.ts`'s streaming/escalation code.

## Verify (build agent, before reporting)
1. `npx astro check` → 0 errors.
2. `astro dev --background`, then:
   - Homepage search "family SUV, diesel, under $50k" → grid updates to matches + "Results" heading +
     Rebi opens grounded (names real on-screen cars).
   - **Refine by typing to Rebi** "actually under $30k" → grid re-drives + Rebi comments on the tighter
     set.
   - **Question to Rebi** "is the diesel reliable?" → grounded answer, grid unchanged.
   - Low-confidence/vague query → Rebi opens and asks conversationally (no dead-end).
   - **Search from a listing page** (off-homepage) → NO phantom URL change; context is
     conversational-only.
   - `/api/search` uses the `search:` counter (doesn't decrement the chat `rl:` counter).
   - `dealerNotes` in no response.
   - **Regression:** a plain (non-search) chat, an `[[ESCALATE]]` turn, and a Turnstile first-message
     still behave exactly as before (proves the chatbot core is untouched).
   - Classic `FilterDrawer` + no-JS path still work.
   Then `astro dev stop`. Leave no scratch files. Do NOT commit.

## Deferred (Experience Mode runway, already in todo.md)
The full single-surface action channel (type-into-Rebi drives *everything* via SSE, no separate dock)
and the server-persisted journey for cross-device continuity.
