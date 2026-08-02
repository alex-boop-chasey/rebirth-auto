/**
 * SmartSearch — the Rebi-fronted plain-English `/listings` search dock, as a React
 * island. The composer (input + submit) is the entry affordance; the CONVERSATION
 * now lives in the Rebi drawer, not in a bespoke focus-stage carousel.
 *
 * A JS-ONLY enhancement on the page: SSR renders the dock `hidden`; hydration
 * (`client:idle`) flips it visible. With no JS it stays hidden and the classic
 * Filters drawer is the fallback.
 *
 * On submit it POSTs /api/search, drives the ONE filter URL via the shared
 * `applyFilterUrl` (URL = single source of truth, DECISION 5) exclusively through
 * the `useFilterUrl` hook — the grid still filters IN PLACE, unchanged. Then it
 * dispatches the decoupled `reb:search` DOM event with the raw query, the
 * serialized filter state (`ref`), and `autoSend:true`, so the Rebi drawer opens,
 * renders the query as a user turn, and streams a grounded reply with tiles/actions
 * in-thread. The homepage `?q=` handoff (listings/index.astro fills the input and
 * calls `form.requestSubmit()`) flows through this SAME onSubmit, so a landed
 * `/listings?q=…` also drives the grid AND opens the drawer.
 *
 * State is imperative (refs): the ONLY React render state is `mounted` (reveal).
 * The island holds NO filter state — the URL is the single source of truth via
 * `useFilterUrl`. `ref` for the drawer is built with the filter-url serializer
 * (`fu.serialize`), never a hand-assembled query string (filter-state rule).
 *
 * Hard constraints honoured: no filter store; no `cloudflare:workers` / `~/ai` /
 * `src/ai/*` imports; all copy/timings come from the typed `config` prop
 * (dealerConfig.chat.search); light-theme; no `Math.random` / module-top-level
 * `new Date()`. No provider call is added — the drawer runs the existing /api/chat.
 */
import { useCallback, useEffect, useRef, useState, type FormEventHandler } from 'react';
import { useReducedMotion, useFilterUrl } from '~/components/ai/hooks';
import type { FilterState } from '~/lib/listings-query';
import { useTypewriter } from './useTypewriter';
import {
  MIN_BEAT_MS,
  delay,
  fadeGridOut,
  fadeGridIn,
  primeGridHidden,
  setSubheadActive,
  flipHeading,
} from './search-choreography';
import './search-dock.css';

/** Mirrors today's `dockConfig` — the slice of `dealerConfig.chat.search` the dock uses. */
export interface SmartSearchConfig {
  placeholders: readonly string[];
  typewriter: { typeMs: number; deleteMs: number; dwellMs: number };
  messages: {
    finding: string;
    resultsRefine: string;
    noMatch: string;
    unclear: string;
    newSearchLabel: string;
  };
  greeting: { showOnLoad: boolean; text: string };
  sounds: { enabled: boolean; defaultMuted: boolean };
  stage: {
    askLabel: string;
    shelfLabel: string;
    hint: string;
    refineManualLabel: string;
    inputAriaLabel: string;
    muteLabel: string;
    unmuteLabel: string;
  };
  maxQueryLength: number;
}

interface Props {
  config: SmartSearchConfig;
}

export default function SmartSearch({ config }: Props) {
  // ---- render state (the only one) ----
  const [mounted, setMounted] = useState(false);

  // ---- imperative refs (the island holds NO filter state) ----
  const liveRef = useRef<HTMLParagraphElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const seqRef = useRef(0); // island guard — distinct from the shared module `seq` in filter-url.ts
  const busyRef = useRef(false); // guards overlapping submits/animations only
  const abortRef = useRef<AbortController | null>(null); // aborts the previous /api/search

  // ---- hooks ----
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced); // live value read inside imperative handlers
  reducedRef.current = reduced;

  const fu = useFilterUrl();

  // `restart` lives on a ref so the stable handlers below always call the live one
  // without re-subscribing the typewriter. Re-seated each render.
  const twRestartRef = useRef<() => void>(() => {});
  const tw = useTypewriter(inputRef, {
    placeholders: config.placeholders,
    typewriter: config.typewriter,
    reducedMotion: reduced,
  });
  twRestartRef.current = tw.restart;

  // Runs the planner search, drives the grid EXACTLY as before (confidence/empty
  // guards + applyFilterUrl + heading/grid fade choreography), announces the outcome
  // to the polite live region, then hands the conversation to the Rebi drawer.
  const runSearch = useCallback(
    async (query: string) => {
      const my = ++seqRef.current;
      const started = performance.now();

      // Abort any previous in-flight request before starting a new one.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      let data: any = null;
      try {
        // First search is fresh (deterministic pre-pass eligible); once filters are
        // active a follow-up REFINES (carries the current filters forward).
        const refine = fu.hasActiveFilters();
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, filters: fu.readState(), refine }),
          signal: controller.signal,
        });
        data = await res.json().catch(() => null);
      } catch {
        /* network error or abort — fall through to the unclear message below */
      }
      if (my !== seqRef.current) return; // superseded by a newer submit

      // Guarantee a minimum "thinking" beat so the grid fade-out always reads.
      const elapsed = performance.now() - started;
      if (elapsed < MIN_BEAT_MS) await delay(MIN_BEAT_MS - elapsed);
      if (my !== seqRef.current) return; // superseded during the beat

      const gridPresent = !!document.getElementById('inventory-results');
      const filters: FilterState | null = data && data.filters ? (data.filters as FilterState) : null;
      const confidence: string = data?.confidence ?? 'low';
      const interpretation: string =
        typeof data?.interpretation === 'string' ? data.interpretation : '';
      const clarifying: string | null =
        typeof data?.clarifyingQuestion === 'string' ? data.clarifyingQuestion : null;

      // Apply only a confident, NON-EMPTY extraction — an empty extraction at high
      // confidence must NOT clear the visitor's existing filters (salvaged guard).
      const applied = !!filters && confidence !== 'low' && fu.hasActiveFilters(filters);

      if (applied && gridPresent && filters) {
        await fu.apply({ ...filters, page: 1 });
        if (my !== seqRef.current) return; // superseded during the grid swap
        // Keep the freshly-swapped results hidden (synchronously, pre-paint) so their
        // fade-in lands after the announcement — not the instant the grid swaps.
        primeGridHidden(reducedRef.current);
        flipHeading(true);
      }

      // Announce the outcome to the polite live region (a11y for the grid change —
      // the conversational reply itself now lands in the Rebi drawer thread).
      if (liveRef.current) {
        if (applied) {
          const total = fu.readGridTotal();
          liveRef.current.textContent =
            total > 0 ? config.messages.resultsRefine : config.messages.noMatch;
        } else {
          liveRef.current.textContent =
            [interpretation, clarifying].filter(Boolean).join(' ') || config.messages.unclear;
        }
      }

      // A beat later, the new (or restored) grid fades back in.
      if (reducedRef.current) {
        fadeGridIn(reducedRef.current);
      } else {
        setTimeout(() => {
          if (my === seqRef.current) fadeGridIn(reducedRef.current);
        }, 180);
      }

      // Hand the conversation to the Rebi drawer: it opens, renders the query as a
      // user turn, and streams a grounded reply (with the new cards/actions tiles).
      // `ref` is the CANONICAL serialized filter state read back from the URL after
      // the apply — built via the filter-url serializer, never hand-assembled.
      const ref = fu.serialize(fu.readState());
      document.dispatchEvent(
        new CustomEvent('reb:search', { detail: { query, ref, opening: '', autoSend: true } }),
      );
    },
    [fu, config.messages.resultsRefine, config.messages.noMatch, config.messages.unclear],
  );

  const onSubmit = useCallback<FormEventHandler<HTMLFormElement>>(
    (e) => {
      e.preventDefault();
      const input = inputRef.current;
      if (!input) return;
      const query = input.value.trim();
      if (!query) {
        input.focus();
        return;
      }
      if (busyRef.current) return; // guard overlapping submits only
      busyRef.current = true;

      // Wipe the input (ready for the next prompt) and restart the placeholder.
      input.value = '';
      twRestartRef.current();
      setSubheadActive(true, reducedRef.current);

      // The current list recedes and the live region announces "finding" now; the
      // real search then drives the grid and opens the drawer.
      fadeGridOut(reducedRef.current);
      if (liveRef.current) liveRef.current.textContent = config.messages.finding;

      runSearch(query).finally(() => {
        busyRef.current = false;
        input.focus();
      });
    },
    [config.messages.finding, runSearch],
  );

  // "Refine manually" opens the classic drawer (its trigger stays the fallback).
  const onManualRefine = useCallback(() => {
    document.getElementById('filters-trigger')?.click();
  }, []);

  // Reveal-on-mount (mirrors the vanilla `dock.hidden = false`).
  useEffect(() => {
    setMounted(true);
  }, []);

  // Cleanup: abort any in-flight fetch on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return (
    <div id="search-dock" className="search-dock" hidden={!mounted}>
      <form
        id="search-dock-form"
        className="entry"
        role="search"
        autoComplete="off"
        onSubmit={onSubmit}
      >
        <span className="mag" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7"></circle>
            <path d="m20 20-3.2-3.2"></path>
          </svg>
        </span>
        <input
          id="search-dock-input"
          className="search-dock-input"
          type="text"
          name="q"
          aria-label={config.stage.inputAriaLabel}
          maxLength={config.maxQueryLength}
          ref={inputRef}
        />
        <button id="search-dock-submit" className="search-dock-submit" type="submit">
          <span>{config.stage.askLabel}</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h13"></path>
            <path d="m12 5 7 7-7 7"></path>
          </svg>
        </button>
      </form>

      <p className="hint">
        {config.stage.hint}{' '}
        <button
          type="button"
          id="search-dock-manual"
          className="search-dock-manual"
          onClick={onManualRefine}
        >
          {config.stage.refineManualLabel}
        </button>
      </p>

      {/* One polite region: announces the grid outcome (the conversational reply
          itself now lands in the Rebi drawer thread). */}
      <p id="search-dock-live" className="sd-sr-only" aria-live="polite" ref={liveRef}></p>
    </div>
  );
}
