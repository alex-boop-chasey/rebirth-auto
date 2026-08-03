/**
 * useReducedMotion — React hook mirroring the `prefers-reduced-motion` media
 * query. Extracted VERBATIM from ShowroomTour's `usePrefersReducedMotion` so the
 * AI islands honour the exact same reduced-motion contract as Experience Mode.
 *
 * SSR-safe: initial state is `false` (no `window` touch during render); the media
 * query is only read/subscribed inside a mount `useEffect` and unsubscribed on
 * cleanup, so mount→unmount→mount is symmetric.
 */
import { useEffect, useState } from 'react';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}
