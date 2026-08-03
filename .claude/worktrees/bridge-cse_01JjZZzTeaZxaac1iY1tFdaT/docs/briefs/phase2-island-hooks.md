# Brief — Phase 2: shared React island hooks (`src/components/ai/hooks/`)

## Goal
Create the reusable React foundation that AI islands will consume. This phase creates **only new files** —
four hooks + a barrel. It changes NO existing files. The hooks are not wired to any page yet (Phase 3 wires
the first consumer, SmartSearch), but they must fully typecheck.

Everything wraps existing, battle-tested vanilla modules. Two hard rules:
- **Zero changes** to `src/components/search/stage-engine.ts`, `src/lib/client/filter-url.ts`,
  `src/lib/listings-query.ts`. Only consume their existing exports.
- **The only source we lean on from Phase 1** is the new `createToneEngine()` in
  `src/components/widgets/rebi-sounds.ts` (already merged).

## Constraints that bite here (restated per AGENTS.md)
- **Filter state is URL-only (DECISION 5).** `useFilterUrl` must NOT introduce any React/in-memory filter
  store. Every read happens at call time off `location.search`; every write goes through the existing
  `applyFilterUrl`. Preserve the shared module-level `seq` in `filter-url.ts` (do not reimplement it).
- **SSR-safe:** no `window`/`document`/`localStorage` access at module load or during render. All DOM/storage
  touches happen inside `useEffect`, event handlers, or `useState` lazy initializers guarded by
  `typeof window !== 'undefined'`.
- **Remount-safe (defensive):** a future `<ClientRouter>` would remount islands. Hooks that instantiate
  imperative objects must create in a mount `useEffect` and fully clean up on unmount, so mount→unmount→mount
  is symmetric (React 19 StrictMode-safe too). No leaked timers/listeners/observers.
- **Light-theme / config-as-data / AI-through-`src/ai/`:** not touched here.

## First: read these to get exact signatures (do not guess)
- `src/components/experience-alt/ShowroomTour.tsx` — copy its `usePrefersReducedMotion` logic verbatim.
- `src/components/search/stage-engine.ts` — the **exact** `FocusStageOptions` shape and the `FocusStage`
  return type of `createFocusStage`, and how it takes the `column` + `live` elements. Import the types; do
  not redefine them.
- `src/lib/listings-query.ts` — confirm exports: `FilterState`, `parseFilters`, `hrefFor`,
  `hasActiveFilters`, `serializeFilters`.
- `src/lib/client/filter-url.ts` — `applyFilterUrl(url, opts?)` signature.
- `src/components/widgets/rebi-sounds.ts` — `createToneEngine()` / `ToneEngine`.

## Files to create

### `src/components/ai/hooks/useReducedMotion.ts`
```ts
export function useReducedMotion(): boolean
```
Extract `ShowroomTour`'s `usePrefersReducedMotion` verbatim: `useState(false)` initial (SSR-safe),
subscribe to the `(prefers-reduced-motion: reduce)` media query in a `useEffect`, unsubscribe on cleanup.

### `src/components/ai/hooks/useRebiSounds.ts`
Wraps `createToneEngine`; owns mute in React so the speaker button is JSX-rendered (no `getElementById`,
no `speakerRef` — this is the adjudicated shape both islands standardize on).
```ts
export interface UseRebiSoundsOptions {
  muteKey: string;          // e.g. 'rebi:search:muted' (search) | 'rebi:chat:muted' (chat)
  enabled?: boolean;        // master switch; default true. When false, tones never play.
  defaultMuted?: boolean;   // default false
}
export interface UseRebiSounds {
  soundSend: () => void;
  soundRebi: () => void;
  muted: boolean;
  toggleMute: () => void;
}
export function useRebiSounds(opts: UseRebiSoundsOptions): UseRebiSounds
```
- `muted` initial via lazy `useState` initializer reading `localStorage.getItem(muteKey)` guarded by
  `typeof window !== 'undefined'`, falling back to `defaultMuted ?? false`. Wrap in try/catch (private mode).
- Tone engine held in a `useRef`, created lazily on first use (or in a mount effect) — never during render.
  StrictMode double-invoke must be harmless (the engine is a pure closure with no persistent context until
  the first gesture via `unlock()`).
- `soundSend`/`soundRebi` are stable `useCallback`s that gate on `!muted && (enabled ?? true)` then call the
  engine. Read the latest `muted`/`enabled` (via refs or deps) so a stale closure never plays when muted.
- `toggleMute`: flip `muted` state, persist `'1'|'0'` to `muteKey` (try/catch); **on unmute** call
  `engine.unlock(); engine.soundRebi();` (the click is the gesture that unlocks audio + previews). Mirrors
  the vanilla behaviour exactly.

### `src/components/ai/hooks/useFocusStage.ts`
Instantiate the EXISTING `createFocusStage` against React refs; return a stable imperative handle ref.
```ts
import type { FocusStage } from '~/components/search/stage-engine';
export interface UseFocusStageOptions {
  reducedMotion: boolean;
  newSearchLabel: string;
  onNewSearch: () => void;        // may change per render — capture via a latest-ref
  onReply?: () => void;           // Rebi chime — latest-ref
  retire?: boolean;               // stage-engine default preserved when omitted
  onCreate?: (stage: FocusStage) => void; // seat greeting here (runs inside the create effect)
}
export function useFocusStage(
  refs: { columnRef: React.RefObject<HTMLElement | null>; liveRef: React.RefObject<HTMLElement | null> },
  opts: UseFocusStageOptions,
): React.MutableRefObject<FocusStage | null>
```
Lifecycle (critical):
- Create the stage in a **mount-only** `useEffect(() => {...}, [])`, reading `columnRef.current` /
  `liveRef.current` (populated post-commit). If either ref is null, no-op.
- Pass **wrapper closures** for `onNewSearch`/`onReply` into `createFocusStage` that read a `useRef` holding
  the latest `opts`, so changing callbacks NEVER re-creates the stage (re-creation would wipe the card
  stack). `reducedMotion` / `newSearchLabel` / `retire` are read once at creation (matches vanilla, which
  reads reduced-motion once).
- Store the instance in a ref, call `opts.onCreate?.(stage)` synchronously in the same effect.
- **Cleanup:** `stageRef.current?.clearStack(); stageRef.current = null;` so remount is symmetric and no
  column children / observers leak. (Match whatever teardown the engine exposes — if there is no
  `clearStack`, use the closest reset method you find; read the file.)
- Match the exact `FocusStageOptions` field names the engine expects when mapping `column`/`live`/opts —
  read the file; do not assume.

### `src/components/ai/hooks/useFilterUrl.ts`
Thin, store-free wrapper — adds colocated read helpers, never a competing store.
```ts
import { FilterState, parseFilters, hrefFor, hasActiveFilters, serializeFilters } from '~/lib/listings-query';
import { applyFilterUrl } from '~/lib/client/filter-url';
export interface FilterUrlApi {
  readState: () => FilterState;                 // parseFilters(new URLSearchParams(location.search))
  emptyState: () => FilterState;                // parseFilters(new URLSearchParams())
  hasActiveFilters: (s?: FilterState) => boolean;
  apply: (s: FilterState, opts?: { push?: boolean }) => Promise<void>; // applyFilterUrl(hrefFor(s), opts)
  applyRaw: typeof applyFilterUrl;              // escape hatch
  readGridTotal: () => number;                  // #inventory-results [data-results-count]; missing/"no match" → 0
  serialize: (s: FilterState) => string;        // serializeFilters — for the reb:search `ref`
}
export function useFilterUrl(): FilterUrlApi
```
- All functions are stable `useCallback`s; each `location.search` / DOM read happens at **call time** (URL is
  the single source of truth). No React state, no popstate subscription (the module already re-swaps the grid
  on back/forward).
- `readGridTotal`: read the number from `#inventory-results [data-results-count]` (port the exact logic from
  `SearchDock.astro`'s `readGridTotal` — read that function to match the "No vehicles match" / missing-node →
  0 behaviour precisely).

### `src/components/ai/hooks/index.ts`
Barrel re-exporting all four hooks and their public types.

## Do NOT
- Do not modify `stage-engine.ts`, `filter-url.ts`, `listings-query.ts`, `rebi-sounds.ts`, ShowroomTour, or
  any config/page. Create only the five new files.
- Do not build any `.tsx` component or wire anything to a page (Phase 3).
- Do not introduce a filter store, a global, or a second `seq`.

## Verify
- `npx astro check` is green (the new hooks typecheck even though unused).
- Grep-confirm no `window`/`document`/`localStorage` at module top level in any hook (only inside
  effects/handlers/lazy-initializers).
- Confirm you imported `FocusStage`/`FilterState` types rather than redefining them.

## Report back
The five files' contents, the exact `FocusStageOptions` field mapping you used (quote the engine's option
names), confirmation `astro check` is green, and confirmation no existing file was modified. Do NOT commit.
