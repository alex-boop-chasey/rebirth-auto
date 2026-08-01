# Task brief D — route the AI search into the Rebi drawer (retire the carousel)

You are a sub-agent. Read `CLAUDE.md` (Stack / Hard constraints / Field notes) first. Context spec:
`docs/briefs/rebi-drawer-redesign.md` — read **§7a-CORRECTION** (the authoritative requirement) and
§5, §6.4. This fixes a real miss: the plain-English AI search on `/listings` still renders its own
**`rebi-stage` focus-stage carousel** (the "old carousel chat box") instead of opening the Rebi
drawer. The prompt requires *every* front-facing AI interaction to open the chat.

## The current flow (verified)
- `/listings` mounts `src/components/search/SearchDock.astro` → `SmartSearch.tsx` (React island).
- `SmartSearch.onSubmit` (`SmartSearch.tsx:257`) renders the query as a user turn and answer in its
  OWN focus-stage carousel via `stage.addUserTurn` / `stage.showTyping` / `stage.landReply`
  (`runSearch`, `SmartSearch.tsx:141`), inside `<section className="rebi-stage">` (`~L317`). The stage
  comes from `useFocusStage` (`createFocusStage`).
- `runSearch` also **drives the `/listings` grid**: it calls `/api/search` (the query planner) and
  `fu.apply(filters)` (→ `applyFilterUrl`, URL = source of truth, **Decision 5**).
- The Rebi drawer (`ChatWidget.astro`) already listens for a `reb:search` CustomEvent
  (`ChatWidget.astro:1472`) that sets a `search` context and opens the drawer — but SmartSearch never
  dispatches it, and it does NOT auto-send the query.

## What to build
**Keep the grid-driving; move the conversation into the drawer.**

1. **Retire the `rebi-stage` carousel** in `SmartSearch.tsx` + `SearchDock.astro`: remove the
   `<section className="rebi-stage">` conversational surface, the `useFocusStage`/`createFocusStage`
   usage, and every `stage.*` call (`addUserTurn`, `showTyping`, `landReply`, `clearStack`,
   greeting seat, `retire`, mute/`New search` stage chrome). Remove the now-dead `import './stage.css'`
   from the island **only if nothing else in it uses those styles**, and delete the dead `.rebi-stage`
   rules from `src/components/search/stage.css` (keep the `.focus-stage.thread` rules the drawer uses,
   and keep the cinematic `.focus-stage` rules only if any caller still needs them — see step 5). The
   **search input/composer stays** (it's the entry affordance).
2. **Preserve grid-driving EXACTLY.** Keep the `/api/search` planner call + the confidence/empty-extract
   guards + `fu.apply({...filters, page:1})` + the heading/grid fade choreography that affects the grid
   (`primeGridHidden`/`fadeGridIn`/`flipHeading`). Do NOT change the query-planner, `/api/search`,
   `applyFilterUrl`, or the URL-as-source-of-truth behaviour. Only the *conversational reply
   presentation* moves out of the carousel — the grid still filters in place.
3. **Open the drawer with the query auto-sent.** After the submit drives the grid, dispatch
   `reb:search` with the raw query and an auto-send flag, e.g.
   `document.dispatchEvent(new CustomEvent('reb:search', { detail: { query, ref: <serializedFilterString>, opening: <primed line>, autoSend: true } }))`.
   - `ref` = the serialized current filter state (so the drawer grounds on the same search). Build it
     via the existing filter-url serialization helpers (`fu`/`applyFilterUrl` layer) — **never
     hand-assemble a query string** (filter-state rule).
   - Do this on **submit** AND on **mount when the URL has `?q=`** (so a homepage search that lands on
     `/listings?q=…` also drives the grid + opens the drawer with Rebi's answer). Guard against
     double-run and against empty `q`.
4. **Extend the `reb:search` handler in `ChatWidget.astro`** (`~L1472`) to honour `detail.query` +
   `detail.autoSend`: set the `search` context (as today), open the panel if hidden, then if
   `autoSend` and a non-empty `query`, run the widget's existing `send(query)` path so the query
   appears as a user turn and Rebi streams a grounded reply **with the new `cards`/`actions` tiles** in
   the thread. Reuse the existing `send`/`setActiveContext`/`openPanel` — add NO new endpoint, and keep
   the `/api/chat` request shape unchanged (`context:{kind:'search', refs:[ref]}` + the query as the
   user message). Preserve the existing non-autoSend `reb:search` behaviour (SearchDock hero handoff
   with `ref:''`).
5. **`createFocusStage` default `'stage'` mode may now be unused.** After this change the only caller
   of `createFocusStage` is the drawer (thread mode). If `useFocusStage.ts` / stage `'stage'`-mode
   code is genuinely unreferenced, you MAY leave it in place (harmless) — do not risk breaking a
   remaining caller by ripping it out. Grep to confirm before deleting anything shared.

## Hard constraints (RESTATED)
- **Decision 5 / filter state:** grid filtering stays via `applyFilterUrl`; the URL is the source of
  truth; never hand-build `/listings?…`. **All AI through `src/ai/`** — you add no provider call.
- **Determinism / privacy:** unchanged; the drawer's tiles already come from the public projection.
- Preserve every `#reb-*` id, `data-rebi-*` attribute, and the `/api/chat` request shape. Don't
  regress any drawer mechanic (§5 of the spec).
- **Light theme.** Don't fabricate data. Deterministic island (no `Math.random`, no top-level
  `new Date()`) — keep that discipline.

## Definition of done (must be actually checked, not assumed)
- `curl -s 'http://localhost:4321/listings?q=7+seater'` served markup contains **no `rebi-stage`**
  carousel section.
- Submitting the `/listings` AI search: the grid still filters (URL updates) AND a `reb:search`
  autoSend event opens the drawer with the query as a user turn (verify the dispatch + handler wiring
  in code; the live open is the owner's visual check).
- `npx astro check` is **0 errors**.
- Report: files changed, exactly what you removed (carousel) vs preserved (grid-driving/planner), the
  `reb:search` detail shape, and how you serialized `ref` without hand-assembling a URL.
