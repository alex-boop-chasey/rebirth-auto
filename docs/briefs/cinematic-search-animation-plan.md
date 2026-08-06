# Cinematic AI Search — ANIMATION/UI Plan

_Branch: `feat/cinematic-search-carousel`. Covers ANIMATION/UI only — the shared-conversation
state model and Turnstile are separate tickets; where this work touches them it DEFINES THE
SEAM and stops._

## Context

On 1 Aug 2026 the homepage's "cinematic" AI search was removed (commit `b69c2c1`): the
receding-card "Focus Stage" carousel that used to grow out of the hero search bar was
disconnected, and `SmartSearch.tsx` was rewired to route the conversation into the corner
Rebi drawer instead. The owner wants the cinematic homepage experience back: on submit the
oversized hero search bar morphs down into the input of a Focus Stage carousel, the hero
BACKGROUND blurs (blur only, no greyscale), the hero COLLAPSES in height so the sharp,
in-colour listings + filter chips below rise into view and visibly update — the "the AI did
something" payoff. Rebi's spoken reply on a card is capped to ONE SHORT CANNED LINE from
config (long free-form replies blurring out before they could be read was the original
defect).

The good news from investigation: **almost none of the engine needs rebuilding.** The depth
engine, its CSS, a React lifecycle wrapper hook, and the whole grid choreography all still
exist and are battle-tested. This is largely a RE-WIRING + hero-CSS-choreography job.

## What already exists (verified against current main)

- **`src/components/search/SmartSearch.tsx`** — CONFIRMED a React island (mounted
  `client:idle` by `SearchDock.astro`). Only render state is `mounted`; everything else is
  imperative refs. Its `runSearch` already does the full grid choreography (seq-discard
  guard, abort, `MIN_BEAT`, `fadeGridOut` → `fu.apply` → `primeGridHidden` → `flipHeading` →
  `fadeGridIn`) and currently ends by dispatching `reb:search` to open the drawer.
- **`src/components/search/stage-engine.ts`** — `createFocusStage` intact and exported.
  Owns the turn stack + depth/lift/scale/blur/opacity model. `layout:'stage'` (default) is
  the cinematic receding carousel; `retire:true` (default) retires cards past depth 4 —
  exactly SearchDock's original behaviour. Still used today by ChatWidget in `thread` mode,
  so it is live code, not dead.
- **`src/components/search/stage.css`** — the `.focus-stage` card styles (frosted-white
  glass Rebi bubbles, ink user bubbles, word-by-word reveal, typing dots). Namespaced under
  `.focus-stage`; brand tokens inherited from an ancestor.
- **`src/components/ai/hooks/useFocusStage.ts`** — a React wrapper that creates the engine in
  a MOUNT-ONLY effect against a `columnRef` + `liveRef`, uses latest-opts refs so re-renders
  never wipe the card stack, and returns a stable `stageRef`. **This is the escape hatch
  Point A asks for — already built.**
- **`src/components/search/search-choreography.ts`** — `fadeGridOut`/`primeGridHidden`/
  `fadeGridIn`/`setSubheadActive`/`flipHeading`/`MIN_BEAT_MS`/`delay`, all operating on the
  static SSR nodes (`#inventory-results`, `#inventory-heading`, `#hero-subhead`).
- **`src/pages/index.astro`** hero — background image is ALREADY a separate sibling layer:
  `.home-hero-media` (`position:absolute; inset:0; z-index:-2`) + scrim `.home-hero::before`
  (`z-index:-1`) are siblings of `.home-hero-inner` (copy + search). Hero is `min-height:92vh`.
- **`#inventory-results`** (`InventoryResults.astro`, chips + grid + pagination) lives in a
  SEPARATE `.site-container` BELOW `.home-hero`, driven by `applyFilterUrl`. Structurally
  outside the hero — the hero blur/collapse can never reach it.
- **`dealerConfig.chat.search`** (dealer.ts ~1312) — `messages` (`finding`, `resultsRefine`
  with `{count}`, `noMatch`, `unclear`, `newSearchLabel`) + `stage` copy. FIXED config
  templates, not model text. The kill-switch is `chat.search.enabled`.

## A. React island integration

`SmartSearch.tsx` is the island. Re-adopt the EXISTING `useFocusStage` hook — it is purpose-
built for this:

- Add a ref'd stage column to the dock's JSX: `<div ref={columnRef} className="focus-stage" />`
  (plus reuse the existing `liveRef`). React owns that element but renders NO children into
  it — the engine mutates it imperatively, so React reconciliation never fights the engine
  over card nodes (the classic imperative-DOM-inside-React hazard is avoided by the empty JSX
  container + mount-only creation).
- Call `useFocusStage({ columnRef, liveRef }, { reducedMotion, newSearchLabel:
  config.messages.newSearchLabel, onNewSearch, retire: true })` → `stageRef`. Default
  `layout:'stage'` gives the receding carousel.
- In `runSearch`, drive `stageRef.current` (`addUserTurn(query)` on submit → `showTyping()` →
  `landReply(typing, descriptor)` when the outcome is known) INSTEAD of the drawer dispatch.
  The grid-driving path (apply/guards/choreography) is unchanged — the carousel layers on top.
- Exact integration points: JSX return (~line 242 `#search-dock`), `onSubmit` (~193, seat the
  user turn + typing card), `runSearch` (~106, land the canned descriptor), and swap the
  `reb:search` dispatch (~186) for the defined seam (F).

## B. The morph — one-element FLIP reusing the composer

The hero composer is a single `form.entry` (`#search-dock-form`) holding the input. In the
original design the carousel's input IS that same docked composer — so there is no second
input to cross-fade; the composer is REUSED. Approach: **one element, FLIP**:

- On submit: read the composer's current (oversized hero-pill) rect via
  `getBoundingClientRect()`; toggle the stage state class (composer docks under the stage
  column, hero collapses — D); read the new rect; invert with `transform: translate()+scale()`
  and play to identity on the next frame (First-Last-Invert-Play). Transform-only — width/top
  are never animated, so no reflow-driven animation.
- Keeping the SAME DOM node preserves focus + input value and avoids a duplicate-input a11y
  problem a cross-fade would create.
- Constraint respected: the hero entrance animation `hero-rise` sets `transform` on
  `.home-hero-copy > *` (which includes `.home-hero-search`). As learned during the search-bar
  work, the breakout transform must live on an inner element, not the animated wrapper — so
  the FLIP transform goes on `#search-dock`/`.entry`, never on `.home-hero-search`.
- Reduced motion: NO FLIP — instant class swap (composer jumps to docked position; stage
  appears via opacity only).

## C. Hero dream-state — BLUR ONLY, hero-scoped

CONFIRMED the hero background is already a separate SIBLING layer, so no splitting needed:

- On submit, add `.home-hero.is-searching`; it applies `filter: blur(Npx)` to
  `.home-hero-media` (the photo layer) and may nudge `::before` scrim opacity up a touch for
  legibility. NO greyscale. Transition the blur (motion-safe branch skips/instant-applies).
- The carousel lives in `.home-hero-inner` (a SIBLING of `.home-hero-media`, above it in
  stacking), so it is never inside the blur selector — it stays sharp.
- The nav (`SiteNav`, outside `.home-hero`) and `#inventory-results` (separate
  `.site-container` below) are structurally unreachable by a hero-scoped selector.
- Legibility: the `.focus-stage` cards are frosted-white glass with dark ink text — designed
  for exactly this dark/blurred-photo backdrop; the blur + slight darken only improves it.

## D. Hero height collapse + listings reveal

- On submit, `.is-searching` transitions the hero `min-height` DOWN from `92vh` to a compact
  band that frames the stage + docked composer. The listings region below is the next block
  in normal flow, so it rises into view as the hero shrinks — sharp, in colour, never blurred.
- Protect the payoff: the collapse target must leave the top of `#inventory` (heading +
  chips) above the fold on a laptop. `flipHeading(true)` ("Results") and `fadeGridIn` already
  fire on a landed search — the collapse simply brings that reveal into frame. This is the
  point of the collapse, not decoration.
- Reverse on "New search" (`onNewSearch`): remove `.is-searching` → hero re-expands, blur
  lifts.
- Reduced motion: instant height change (no transition); the grid swap still happens
  (opacity-instant via existing choreography).

## E. Short canned replies — carousel ONLY

The engine's `appendRebi(descriptor)` renders from `Descriptor { kind, text, count }`. The
carousel builds that descriptor from `config.messages` ONLY, keyed by outcome — NEVER from
`data.interpretation` or `data.clarifyingQuestion` (the model's free-form text). The model's
fuller output keeps doing exactly what it does today: it drives `data.filters` (the grid) and
nothing else is shown on a card.

Outcome → descriptor. **Final approved copy (owner):**

| Outcome | descriptor.kind | config key | line |
|---|---|---|---|
| fresh search (no prior active filters) & total > 0 | `results` | `resultsFound` | "Here are the vehicles matching your needs." |
| refining search (filters already active) & total > 0 | `results` | `resultsRefine` | "Would you like to refine your search?" |
| total === 0 (no match) | `nomatch` | `noMatch` | "Tell me a bit more, or try rephrasing." |
| not applied — low-confidence / empty / error (unclear) | `unclear` | `unclear` | "Tell me a bit more, or try rephrasing." |

The positive state splits on the SAME `refine` signal `runSearch` already computes
(`fu.hasActiveFilters()`, line 120): a first find greets with "Here are the vehicles matching
your needs."; a follow-up that narrows an already-filtered list invites "Would you like to
refine your search?". `noMatch` and `unclear` share one line. This needs a NEW `resultsFound`
config key and dropping `{count}` from the positive lines (no interpolation now) — a small
`dealer.ts` addition (SA-1). Guardrail is structural: the descriptor builder takes only
`config.messages`, so free-form model text physically cannot reach a card.

## F. The SEAM — self-contained now; fire-and-forget ledger note only

**Decided (owner):** drop the drawer auto-open. Remove `autoSend:true` and the `reb:search`
dispatch that opens the drawer on every homepage search. The carousel handles the reply
inline; the search no longer flings the user into the drawer.

- We are NOT building a "Continue with Rebi" handoff. There is NO transcript handoff, NO
  drawer seeding, and NO "Continue with Rebi" button in this ticket.
- This build is STANDALONE: the carousel shows its short canned reply and stops.
- The ONLY outward seam is a single decoupled, fire-and-forget ledger note emitted when a
  search resolves. Shape:

  ```
  { surface: 'search', timestamp, sessionId, action: 'search_performed',
    payload: { query, resultCount, appliedFilters } }
  ```

- Emit it via one decoupled call/event. Do NOT wire it to any consumer. NOTHING reads it in
  this ticket — the ledger and any read-back are a LATER ticket. Do NOT build the ledger, its
  storage, its lifetime, or any read/rehydrate here. Only emit the note in this shape.
- Rationale: this lets the future ledger plug into a seam the carousel already speaks, without
  building the ledger now.

**Scope guard — no persistence.** The carousel does NOT persist across page navigation in this
ticket. If the page reloads, the carousel starts fresh. Any return-visit behaviour is
explicitly a later ledger-stage ticket — do not build persistence, `sessionStorage`, or
rehydration here.

## G. Load-bearing constraints — how each is respected

- **URL single source of truth (Decision 5):** `runSearch` keeps `fu.apply` /
  `hasActiveFilters` / `serialize`, the seq-discard guard (`my !== seqRef.current`), the
  abort, and `MIN_BEAT_MS`. The carousel is presentation ON TOP of the real search — never a
  parallel filter system.
- **Config-as-data:** all copy (`messages.*`, `stage.*`) + timings from
  `dealerConfig.chat.search`. New timings (blur ms, collapse ms, morph ms) go into a config
  block (e.g. `chat.search.cinematic`), nothing hardcoded in the component.
- **Private data:** the carousel renders only `config.messages`, the grid `{count}`, and the
  user's own query — no listing/dealer fields, never `dealerNotes`. Grounding stays
  server-side.
- **prefers-reduced-motion:** full paths for all four effects — recede (engine already
  opacity-only), morph (instant swap), blur (instant/omit), collapse (instant height). No
  translate/scale/blur under reduced motion.
- **DECISIONS.md:** this reverses owner-directed removal `b69c2c1`. If re-adopted as a
  standing pattern, add a DECISIONS.md entry with reasoning (orchestrator follow-up, not built
  in Phase 2 code).

## H. Build breakdown — EXACTLY 3 coding sub-agents, sequential

Shared-conversation model and Turnstile are NOT in this breakdown.

1. **SA-1 — config + types (small, first).** Add cinematic timings + the new `resultsFound`
   copy key to `dealerConfig.chat.search`; extend `SmartSearchConfig` and the
   `SearchDock.astro` passthrough. Scope: `src/config/dealer.ts`,
   `src/components/search/SearchDock.astro`, the `SmartSearchConfig` interface in
   `SmartSearch.tsx`. Freeze the state-class names + stage DOM contract here so SA-2/SA-3
   share one contract.
2. **SA-2 — island wiring (the core). Depends on SA-1.** `SmartSearch.tsx` ONLY: add the
   ref'd `.focus-stage` column, adopt `useFocusStage`, build canned descriptors, drive the
   stage in `runSearch`, toggle the `.is-searching` state class + run the composer FLIP,
   REMOVE the drawer auto-open (`autoSend:true` + the `reb:search` dispatch), and emit the
   fire-and-forget ledger note (F) when a search resolves — wired to no consumer.
3. **SA-3 — hero CSS choreography. Depends on SA-2's frozen class/DOM contract.**
   `src/pages/index.astro` scoped `<style>` (+ minimal markup to host the stage column): the
   `.is-searching` blur on `.home-hero-media`, the `min-height` collapse, the composer FLIP
   target styles, and every reduced-motion branch.

Sequential (SA-1 → SA-2 → SA-3): SA-2 and SA-3 touch different files but share the class/DOM
contract, so run them in order to avoid contract drift. Orchestrator does the verification
pass (no sub-agent): `astro check` (0 errors), dev server + browser capture of
morph→blur→collapse→reveal, reduced-motion check.

## Verification

1. `npx astro check` → 0 errors after each sub-agent.
2. `astro dev --background`; load `/`; submit a query and confirm, via Claude-in-Chrome
   screenshot/GIF: composer morphs DOWN into the stage input; hero photo blurs (no greyscale);
   hero collapses; `#inventory-results` + chips rise into view sharp/in-colour and swap;
   Rebi's card shows ONE short canned line; nav untouched.
3. Toggle `prefers-reduced-motion` → instant swap, no morph/blur/height animation, grid still
   swaps.
4. Confirm a ledger note fires with the shape `{ surface:'search', timestamp, sessionId,
   action:'search_performed', payload:{ query, resultCount, appliedFilters } }` AND that the
   drawer does NOT auto-open on a homepage search.
5. One commit per sub-agent ticket; push only on explicit owner approval.
