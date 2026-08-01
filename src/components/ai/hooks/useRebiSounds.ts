/**
 * useRebiSounds — React wrapper around the framework-free `createToneEngine()`
 * (src/components/widgets/rebi-sounds.ts). This is the adjudicated shape both AI
 * islands (SmartSearch + the corner chat) standardize on: mute lives in React so
 * the speaker button is JSX-rendered — no `getElementById`, no `speakerRef`, no
 * DOM wiring. The tone engine stays a pure closure with no persistent audio
 * context until the first user gesture calls `unlock()`.
 *
 * SSR/remount safety:
 *   - `muted` initialises to the deterministic default (`defaultMuted ?? false`),
 *     never touching `localStorage` during render, so the first client render
 *     matches the server render (no hydration mismatch on the speaker button's
 *     `aria-pressed`/`className`). A mount effect then reads the persisted value
 *     (guarded + try/catch for private mode) and reconciles if it differs.
 *   - The engine is held in a ref, created in a mount effect and nulled on
 *     cleanup, so StrictMode double-invoke and a future `<ClientRouter>` remount
 *     are both harmless. `soundSend`/`soundRebi`/`toggleMute` are stable
 *     `useCallback`s that read the latest `muted`/`enabled` via refs, so a stale
 *     closure never plays while muted.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createToneEngine, type ToneEngine } from '~/components/widgets/rebi-sounds';

export interface UseRebiSoundsOptions {
  /** localStorage key for the persisted mute flag, e.g. 'rebi:search:muted'. */
  muteKey: string;
  /** Master switch; default true. When false, tones never play. */
  enabled?: boolean;
  /** Initial mute state when nothing is persisted yet. Default false. */
  defaultMuted?: boolean;
}

export interface UseRebiSounds {
  soundSend: () => void;
  soundRebi: () => void;
  muted: boolean;
  toggleMute: () => void;
}

/**
 * Read the persisted mute flag — SSR-safe, private-mode-safe. Returns `null` when
 * nothing is stored (or storage is unavailable) so callers keep their default.
 * MUST only be called from an effect/handler, never during render.
 */
function readStoredMuted(muteKey: string): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(muteKey);
    if (stored !== null) return stored === '1';
  } catch {
    /* private mode / no storage — treat as no stored value */
  }
  return null;
}

export function useRebiSounds(opts: UseRebiSoundsOptions): UseRebiSounds {
  const { muteKey, enabled, defaultMuted = false } = opts;

  // Deterministic initial render (no localStorage during render) so the first
  // client render matches SSR — the persisted value is applied in a mount effect.
  const [muted, setMuted] = useState<boolean>(defaultMuted ?? false);

  // Latest-value refs so the stable callbacks never read a stale closure.
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const muteKeyRef = useRef(muteKey);
  muteKeyRef.current = muteKey;

  // The tone engine is a pure closure (no audio context until `unlock()`), held in
  // a ref. Created in a mount effect and nulled on cleanup for remount symmetry;
  // `engine()` also lazily recreates it defensively if ever called before mount.
  const engineRef = useRef<ToneEngine | null>(null);
  const engine = useCallback((): ToneEngine => {
    if (!engineRef.current) engineRef.current = createToneEngine();
    return engineRef.current;
  }, []);

  useEffect(() => {
    if (!engineRef.current) engineRef.current = createToneEngine();
    return () => {
      engineRef.current = null;
    };
  }, []);

  // After hydration, reconcile with the persisted mute flag. Runs only on the
  // client (post-render), so it can never cause a hydration mismatch. `mutedRef`
  // is kept in sync so the stable callbacks read the reconciled value immediately.
  useEffect(() => {
    const stored = readStoredMuted(muteKeyRef.current);
    if (stored !== null && stored !== mutedRef.current) {
      mutedRef.current = stored;
      setMuted(stored);
    }
  }, []);

  const soundSend = useCallback(() => {
    if (mutedRef.current || enabledRef.current === false) return;
    engine().soundSend();
  }, [engine]);

  const soundRebi = useCallback(() => {
    if (mutedRef.current || enabledRef.current === false) return;
    engine().soundRebi();
  }, [engine]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    try {
      localStorage.setItem(muteKeyRef.current, next ? '1' : '0');
    } catch {
      /* private mode / no storage — persistence is best-effort */
    }
    // Unmuting: this click IS the user gesture — unlock audio and preview the
    // chime. Mirrors the vanilla `createRebiSounds` behaviour exactly.
    if (!next) {
      const e = engine();
      e.unlock();
      e.soundRebi();
    }
  }, [engine]);

  return { soundSend, soundRebi, muted, toggleMute };
}
