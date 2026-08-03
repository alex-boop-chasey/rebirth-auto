/**
 * useFocusStage — React lifecycle wrapper around the framework-free
 * `createFocusStage` (src/components/search/stage-engine.ts). The engine owns the
 * cinematic card stack + depth model imperatively; this hook just seats it against
 * React refs and returns a stable imperative handle the island drives.
 *
 * Lifecycle (critical — the card stack must survive re-renders):
 *   - The stage is created in a MOUNT-ONLY effect, reading the refs post-commit;
 *     if either ref is null it no-ops.
 *   - `onNewSearch`/`onReply` are passed to the engine as WRAPPER closures that
 *     read a latest-`opts` ref, so changing those callbacks per render NEVER
 *     re-creates the stage (re-creation would wipe the card stack).
 *   - `reducedMotion` / `newSearchLabel` / `retire` are read ONCE at creation
 *     (matches the vanilla hosts, which read reduced-motion once).
 *   - Cleanup calls `clearStack()` and nulls the ref, so mount→unmount→mount is
 *     symmetric and no column children / observers leak (StrictMode-safe).
 */
import { useEffect, useRef, type RefObject, type MutableRefObject } from 'react';
import { createFocusStage, type FocusStage } from '~/components/search/stage-engine';

export interface UseFocusStageOptions {
  /** Honour prefers-reduced-motion — read once at creation. */
  reducedMotion: boolean;
  /** Label for the "New search" button — read once at creation. */
  newSearchLabel: string;
  /** Invoked when a results reply's "New search" button is clicked (latest-ref). */
  onNewSearch: () => void;
  /** Rebi chime fired when a descriptor reply lands (latest-ref). Optional. */
  onReply?: () => void;
  /** Retire receded cards — engine default (`true`) preserved when omitted. */
  retire?: boolean;
  /** Runs synchronously inside the create effect — seat a greeting card here. */
  onCreate?: (stage: FocusStage) => void;
}

export function useFocusStage(
  refs: { columnRef: RefObject<HTMLElement | null>; liveRef: RefObject<HTMLElement | null> },
  opts: UseFocusStageOptions,
): MutableRefObject<FocusStage | null> {
  const { columnRef, liveRef } = refs;

  // Latest-opts ref so the wrapper closures below always call the current
  // callbacks without the stage ever being re-created.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const stageRef = useRef<FocusStage | null>(null);

  useEffect(() => {
    const column = columnRef.current;
    const live = liveRef.current;
    if (!column || !live) return;

    const stage = createFocusStage({
      column,
      live,
      reducedMotion: optsRef.current.reducedMotion,
      newSearchLabel: optsRef.current.newSearchLabel,
      retire: optsRef.current.retire,
      onNewSearch: () => optsRef.current.onNewSearch(),
      onReply: () => optsRef.current.onReply?.(),
    });
    stageRef.current = stage;
    optsRef.current.onCreate?.(stage);

    return () => {
      stageRef.current?.clearStack();
      stageRef.current = null;
    };
    // Mount-only: the stage must NOT be re-created on prop changes (that would
    // wipe the card stack). Callbacks are read live via optsRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return stageRef;
}
