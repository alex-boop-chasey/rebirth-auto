/**
 * useTypewriter — the cycling-placeholder typewriter for the SmartSearch entry
 * field, ported VERBATIM from SearchDock.astro's inline `<script>`. It drives ONLY
 * `inputRef.current.placeholder` via timers — never the input's real value — and
 * pauses while the field is focused or holds text, resuming on blur of an empty
 * field. Under reduced motion it does not cycle (shows the first placeholder).
 *
 * All timers are torn down on unmount and the focus/blur listeners removed, so
 * mount→unmount→mount is symmetric. Config is read live via a ref so a re-render
 * with new copy/timings never re-seats the listeners. `restart()` re-seats the
 * cycle from the start — the island calls it after wiping the input on submit/reset,
 * mirroring the vanilla `startTw()` calls.
 */
import { useEffect, useRef, type RefObject } from 'react';

const DEFAULT_PLACEHOLDER = 'Describe the car you’re looking for…';

export interface TypewriterConfig {
  placeholders: readonly string[];
  typewriter: { typeMs: number; deleteMs: number; dwellMs: number };
  reducedMotion: boolean;
}

export function useTypewriter(
  inputRef: RefObject<HTMLInputElement | null>,
  config: TypewriterConfig,
): { restart: () => void } {
  const cfgRef = useRef(config);
  cfgRef.current = config;

  // Latest `startTw` closure, so the returned `restart` always calls the live one
  // (and is a no-op before mount / after unmount).
  const restartRef = useRef<() => void>(() => {});

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    let twTimer: ReturnType<typeof setTimeout> | null = null;
    let phraseIdx = 0;
    let charIdx = 0;
    let deleting = false;
    const clearTw = () => {
      if (twTimer) {
        clearTimeout(twTimer);
        twTimer = null;
      }
    };

    const twTick = () => {
      const phrases = cfgRef.current.placeholders;
      const { typeMs, deleteMs, dwellMs } = cfgRef.current.typewriter;
      if (!phrases.length || document.activeElement === input || input.value) return;
      const phrase = phrases[phraseIdx % phrases.length];
      if (!deleting) {
        charIdx++;
        input.placeholder = phrase.slice(0, charIdx);
        if (charIdx >= phrase.length) {
          deleting = true;
          twTimer = setTimeout(twTick, dwellMs);
          return;
        }
        twTimer = setTimeout(twTick, typeMs);
      } else {
        charIdx--;
        input.placeholder = phrase.slice(0, Math.max(0, charIdx));
        if (charIdx <= 0) {
          deleting = false;
          phraseIdx++;
        }
        twTimer = setTimeout(twTick, deleteMs);
      }
    };

    const startTw = () => {
      clearTw();
      charIdx = 0;
      deleting = false;
      const { reducedMotion, placeholders } = cfgRef.current;
      if (reducedMotion || !placeholders.length) {
        input.placeholder = placeholders[0] ?? DEFAULT_PLACEHOLDER;
        return;
      }
      twTimer = setTimeout(twTick, 400);
    };
    restartRef.current = startTw;

    const onFocus = () => {
      clearTw();
      if (!input.value) input.placeholder = DEFAULT_PLACEHOLDER;
    };
    const onBlur = () => {
      if (!input.value) startTw();
    };
    input.addEventListener('focus', onFocus);
    input.addEventListener('blur', onBlur);
    startTw();

    return () => {
      clearTw();
      input.removeEventListener('focus', onFocus);
      input.removeEventListener('blur', onBlur);
      restartRef.current = () => {};
    };
  }, [inputRef]);

  return { restart: () => restartRef.current() };
}
