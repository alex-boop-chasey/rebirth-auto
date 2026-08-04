# Brief — Phase 3: SmartSearch React island (replaces SearchDock's inline script)

## Goal
Port the homepage AI natural-language search dock from a vanilla `<script>` in `SearchDock.astro` into a
React island `SmartSearch.tsx` that consumes the Phase 2 hooks. **Behaviour must be identical to today.**
This is a parity migration of one homepage-only surface that has a real no-JS fallback (the FilterDrawer).

## Non-negotiable constraints (restated per CLAUDE.md)
- **Filter state is URL-only (DECISION 5).** The island holds NO filter state. Read current filters via the
  `useFilterUrl` hook's `readState()` (which uses `parseFilters(new URLSearchParams(location.search))`);
  write ONLY via `useFilterUrl().apply(...)` (which calls the shared `applyFilterUrl`). Do not add any
  React/in-memory filter store or a second write path.
- **All AI via the existing `/api/search`** — the island only `fetch`es it. NEVER import `cloudflare:workers`,
  `~/ai`, or `src/ai/*` into the `.tsx`. No endpoint changes.
- **Config-as-data:** all copy/timings/sounds come from `dealerConfig.chat.search`, passed to the island as
  a typed prop. No dealer literals in the island.
- **Light-theme** UI standard. **Determinism:** no `Math.random`, no module-top-level `new Date()`.

## Two decisions already made for you (do NOT deviate)
1. **Do NOT dispatch a `reb:search` event.** Today's SearchDock does not dispatch it, and the listener at
   `ChatWidget.astro:1284` *opens the chat panel* — dispatching on every applied search would auto-open the
   corner chat every search. Preserve today's behaviour: no dispatch.
2. **No new config flag; straight swap.** Do not add `useReactIsland` or any legacy fallback component. The
   existing `dealerConfig.chat.search.enabled` is the operational kill-switch. `SearchDock.astro` becomes a
   thin host that always renders `<SmartSearch>`. Rollback is via git.

## First: read these in full before writing anything
- `src/components/search/SearchDock.astro` (704 lines) — the source of truth. Port its `<script>` logic
  **verbatim** in behaviour: `runSearch`, `onSubmit`, `resetSearch`/new-search, the manual-refine button, the
  `seq` discard, `MIN_BEAT_MS`/`GRID_FADE_MS` beats, the grid fade choreography
  (`fadeGridOut/primeGridHidden/fadeGridIn/setSubheadActive/flipHeading`), the typewriter placeholder cycle,
  the `readGridTotal` count read-back, the confidence/`hasActiveFilters` apply gate, and the reveal
  (`dock.hidden = false`). Note the **exact `createFocusStage` method names** it calls (e.g. how it adds the
  user turn, shows typing, lands the reply, retires a superseded turn, clears the stack) and reuse those
  exact names — do not invent method names.
- `src/components/search/stage-engine.ts` — confirm the method names + the descriptor shapes the reply
  methods expect.
- `src/components/ai/hooks/` (Phase 2) — `useFocusStage`, `useRebiSounds`, `useFilterUrl`, `useReducedMotion`.
- `src/components/experience-alt/ShowroomTour.tsx` + `src/pages/labs/experience-alt.astro` — the island +
  host mount precedent (default export, typed props, `client:*`).
- `src/config/dealer.ts` `chat.search` — the config shape (`placeholders, typewriter, messages, greeting,
  sounds, stage, maxQueryLength`).

## Files to create

### `src/components/search/SmartSearch.tsx` (the island; default export, typed props)
- **Props:** a single typed `config` object mirroring today's `dockConfig`
  (`{ placeholders, typewriter, messages, greeting, sounds, stage, maxQueryLength }`). Derive the TS types
  from the config shape (import the types if `dealer.ts` exports them; otherwise define a local `interface`
  matching the fields the island uses).
- **Markup as JSX:** port the `#search-dock` subtree from SearchDock.astro (sound toggle button, stage
  viewport with `glass-shelf`/`shelf-label`/`card-column#search-dock-column`, the `form#search-dock-form`
  with input + submit, the hint + manual-refine button, the sr-only `#search-dock-live` region). **Keep the
  same ids and class names** (`search-dock`, `rebi-stage`, `card-column focus-stage`, `search-dock-column`,
  `search-dock-live`, etc.) so the global CSS and the stage engine's `#search-dock`-namespaced rules match.
- **Reveal-on-mount (first-paint parity):** the root renders with `hidden` until a mount `useEffect` flips a
  `mounted` state true — mirrors today's `dock.hidden = false`. With `client:idle` the SSR HTML is the hidden
  dock (exactly like today), revealed on hydration. Do NOT use `client:only`.
- **State = refs, not React state** (imperative-first, matches vanilla): `columnRef`, `liveRef`, `inputRef`,
  `formRef`; `seqRef` (island guard — distinct from the shared module `seq` in filter-url.ts), `busyRef`,
  `abortRef` (AbortController; abort the previous `/api/search` on a new submit / on reset). The ONLY React
  render state is `mounted` and `muted` (the latter from `useRebiSounds`).
- **Hooks:**
  - `const reduced = useReducedMotion();`
  - `const { soundSend, soundRebi, muted, toggleMute } = useRebiSounds({ muteKey: 'rebi:search:muted',
    enabled: config.sounds.enabled, defaultMuted: config.sounds.defaultMuted });` — render the
    `#search-dock-sound` button in JSX with `aria-pressed={muted}`, `onClick={toggleMute}`, and the
    muted/unmuted class toggle that drives the ic-on/ic-off SVG visibility (match today's CSS contract).
  - `const fu = useFilterUrl();` — use `fu.readState()`, `fu.hasActiveFilters()`, `fu.apply()`,
    `fu.emptyState()`, `fu.readGridTotal()`.
  - `const stageRef = useFocusStage({ columnRef, liveRef }, { reducedMotion: reduced, newSearchLabel: <the
    same label SearchDock uses>, onNewSearch: resetSearch, onReply: soundRebi, retire: true, onCreate:
    seatGreeting });` — seat the greeting in `onCreate` exactly as SearchDock seats it on load.
  - `useTypewriter(inputRef, { placeholders: config.placeholders, typewriter: config.typewriter,
    reducedMotion: reduced });`
- **Handlers** ported verbatim from SearchDock's script (same control flow, same constants, same order of
  side-effects). Input is **uncontrolled** (read `inputRef.current.value` on submit; the typewriter only
  mutates `.placeholder`). Preserve the `my !== seqRef.current` superseded-response discard at every await
  boundary, the `confidence !== 'low' && fu.hasActiveFilters(filters)` apply gate, and the count read-back
  from `fu.readGridTotal()` AFTER `await fu.apply(...)`.
- **Cleanup effect on unmount:** abort any in-flight fetch, clear any timers you create. (`useFocusStage`
  and `useRebiSounds` own their own teardown.)
- **Cross-boundary DOM touches** stay identical to today (all reads of static SSR nodes by id): the grid
  `#inventory-results`, the heading, `#hero-subhead`, and `document.getElementById('filters-trigger')?.click()`
  for the manual-refine button. These are fine — that DOM is shared infrastructure, not island state.

### `src/components/search/search-dock.css`
Move SearchDock.astro's `<style>` block here as a plain global stylesheet: both the currently-scoped
structural rules AND the existing `is:global` runtime-card rules. The selectors are already namespaced under
`.search-dock` / `.rebi-stage` / `#search-dock`, so they are safe as global. Import it from `SmartSearch.tsx`
alongside whatever stage stylesheet SearchDock relied on (e.g. `./stage.css` — check the real import).

### `src/components/search/useTypewriter.ts`
Port SearchDock's cycling-placeholder logic as `useTypewriter(inputRef, { placeholders, typewriter,
reducedMotion })` — drives `inputRef.current.placeholder` via timers; pauses on focus / non-empty input;
respects reduced motion (no cycling). Full timer cleanup on unmount. Verbatim behaviour.

### `src/components/search/search-choreography.ts`
Port SearchDock's pure, `reduced`-parameterized grid/heading helpers
(`fadeGridOut/primeGridHidden/fadeGridIn/setSubheadActive/flipHeading` and the `MIN_BEAT_MS`/`GRID_FADE_MS`/
`delay` constants) verbatim, so the island stays lean. These operate on the static SSR nodes by id.

## File to modify

### `src/components/search/SearchDock.astro` → thin host
Replace the whole file with: frontmatter that reads `dealerConfig.chat.search`, builds the typed `config`
object, and the template renders `<SmartSearch client:idle config={config} />` (import SmartSearch). Drop the
old markup, `<script>`, and `<style>` (now in the island + `search-dock.css`). **Keep the filename and the
default export shape** so `src/pages/index.astro:157` (`<SearchDock />`) is unchanged. Pass `config` as a real
object prop (not a JSON string).

## Do NOT
- Do not modify `stage-engine.ts`, `filter-url.ts`, `listings-query.ts`, the Phase 2 hooks,
  `ChatWidget.astro`, `index.astro`, or `dealer.ts`.
- Do not dispatch `reb:search`. Do not add a config flag or legacy fallback component.
- Do not change `/api/search` or any server code. Do not introduce a filter store.

## Verify (report exact results)
- `npx astro check` — green.
- `npm run build` — succeeds (catches island SSR/bundling issues on the Cloudflare adapter).
- If quick to do, start `astro dev --background` and confirm the homepage renders the dock after hydration
  and a concrete query drives exactly one `/partials/inventory` swap. (The orchestrator will drive the full
  flow; a smoke check is enough here.)

## Report back
The new files' contents (or a tight summary + key excerpts), the exact `createFocusStage` method names you
reused, confirmation `astro check` + `npm run build` are green, and confirmation the only modified existing
file is `SearchDock.astro`. Do NOT commit.
