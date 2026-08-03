/**
 * useFilterUrl — a thin, STORE-FREE React wrapper over the existing URL-driven
 * filter machinery. The URL is the single source of truth (DECISION 5): this hook
 * introduces NO React/in-memory filter store and NO popstate subscription (the
 * shared `filter-url` module already re-swaps the grid on back/forward, and owns
 * the module-level in-flight `seq`). It only colocates read helpers so islands
 * don't reach into `location.search` / the grid DOM ad hoc.
 *
 * Every read (`location.search`, the grid count node) happens at CALL time inside
 * a stable `useCallback` — never at module load or during render — so the hook is
 * SSR-safe. Writes go through the existing `applyFilterUrl(hrefFor(state))`.
 */
import { useCallback } from 'react';
import {
  parseFilters,
  hrefFor,
  hasActiveFilters as hasActiveFiltersLib,
  serializeFilters,
  type FilterState,
} from '~/lib/listings-query';
import { applyFilterUrl } from '~/lib/client/filter-url';

export interface FilterUrlApi {
  /** Current filter state parsed from `location.search` at call time. */
  readState: () => FilterState;
  /** The zero/default filter state. */
  emptyState: () => FilterState;
  /** True when any filter is active (defaults to the current URL state). */
  hasActiveFilters: (s?: FilterState) => boolean;
  /** Push the state's URL and fetch-swap the grid (via the shared driver). */
  apply: (s: FilterState, opts?: { push?: boolean }) => Promise<void>;
  /** Escape hatch — the raw shared driver. */
  applyRaw: typeof applyFilterUrl;
  /** True match total from the freshly-swapped grid; missing/"no match" → 0. */
  readGridTotal: () => number;
  /** Canonical query string for a state (for the `reb:search` ref, etc). */
  serialize: (s: FilterState) => string;
}

export function useFilterUrl(): FilterUrlApi {
  const readState = useCallback(
    (): FilterState => parseFilters(new URLSearchParams(window.location.search)),
    [],
  );

  const emptyState = useCallback((): FilterState => parseFilters(new URLSearchParams()), []);

  const hasActiveFilters = useCallback(
    (s?: FilterState): boolean =>
      hasActiveFiltersLib(s ?? parseFilters(new URLSearchParams(window.location.search))),
    [],
  );

  const apply = useCallback(
    (s: FilterState, opts?: { push?: boolean }): Promise<void> => applyFilterUrl(hrefFor(s), opts),
    [],
  );

  const applyRaw = applyFilterUrl;

  // Ported verbatim from SearchDock.astro's `readGridTotal`: read the total from
  // #inventory-results [data-results-count]; "No vehicles match" or a missing node → 0.
  const readGridTotal = useCallback((): number => {
    const node = document.querySelector('#inventory-results [data-results-count]');
    if (!node) return 0;
    const txt = node.textContent ?? '';
    if (/No vehicles match/i.test(txt)) return 0;
    const m = txt.match(/of ([\d,]+)/);
    return m ? parseInt(m[1].replace(/,/g, ''), 10) : 0;
  }, []);

  const serialize = useCallback((s: FilterState): string => serializeFilters(s), []);

  return { readState, emptyState, hasActiveFilters, apply, applyRaw, readGridTotal, serialize };
}
