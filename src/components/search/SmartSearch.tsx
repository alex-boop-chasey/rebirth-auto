/**
 * SmartSearch — the Rebi-fronted plain-English `/listings` search dock, as a React
 * island. The composer (input + submit) is the entry affordance; the CONVERSATION
 * lives in an in-island Focus Stage carousel that docks below the composer — the
 * corner Rebi drawer is no longer part of the search handoff.
 *
 * A JS-ONLY enhancement on the page: SSR renders the dock `hidden`; hydration
 * (`client:idle`) flips it visible. With no JS it stays hidden and the classic
 * Filters drawer is the fallback.
 *
 * On submit it POSTs /api/search, drives the ONE filter URL via the shared
 * `applyFilterUrl` (URL = single source of truth, DECISION 5) exclusively through
 * the `useFilterUrl` hook — the grid still filters IN PLACE, unchanged. On top of
 * that real search it seats a user turn + typing dots in the receding-card Focus
 * Stage (`useFocusStage`) and, when the search resolves, lands ONE short canned
 * Rebi reply drawn ONLY from `config.messages` (never the model's free-form
 * interpretation/clarifyingQuestion — those still drive `data.filters`/the grid and
 * nothing else visible). The dock also toggles `is-active` on its root so the hero
 * page can blur/collapse via CSS `:has()`. The homepage `?q=` handoff
 * (listings/index.astro fills the input and calls `form.requestSubmit()`) flows
 * through this SAME onSubmit, so a landed `/listings?q=…` also drives the grid AND
 * the carousel.
 *
 * State is imperative (refs): the ONLY React render state is `mounted` (reveal).
 * The island holds NO filter state — the URL is the single source of truth via
 * `useFilterUrl`. NO persistence / sessionStorage / rehydration; the carousel is
 * presentation ON TOP of the real search, never a parallel filter system.
 *
 * Hard constraints honoured: no filter store; no `cloudflare:workers` / `~/ai` /
 * `src/ai/*` imports; all copy/timings come from the typed `config` prop
 * (dealerConfig.chat.search); no `Math.random` / module-top-level `new Date()`.
 */
import { useCallback, useEffect, useRef, useState, type FormEventHandler } from 'react';
import { useReducedMotion, useFilterUrl, useFocusStage } from '~/components/ai/hooks';
import type { FilterState } from '~/lib/listings-query';
import type { Descriptor } from './stage-engine';
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

/** Duration (ms) of the composer FLIP morph when the dock activates/resets. */
const MORPH_MS = 460;

/** Mirrors today's `dockConfig` — the slice of `dealerConfig.chat.search` the dock uses. */
export interface SmartSearchConfig {
  placeholders: readonly string[];
  typewriter: { typeMs: number; deleteMs: number; dwellMs: number };
  messages: {
    finding: string;
    resultsFound: string;
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
  const dockRef = useRef<HTMLDivElement | null>(null); // #search-dock root — toggles `is-active`
  const formRef = useRef<HTMLFormElement | null>(null); // .entry composer — the FLIP target
  const columnRef = useRef<HTMLDivElement | null>(null); // .focus-stage card column
  const typingRef = useRef<HTMLElement | null>(null); // the current typing-dots card, if any
  const sessionIdRef = useRef<string>(''); // per-mount ledger session id (set on mount)

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

  // Toggle the dock's `is-active` state (hero collapses via CSS `:has()`) and morph
  // the composer with a FLIP so the dock transition is transform-based. Under
  // reduced motion it is an instant class toggle — no transform.
  const setActive = useCallback((on: boolean) => {
    if (reducedRef.current) {
      dockRef.current?.classList.toggle('is-active', on);
      return;
    }
    const el = formRef.current;
    if (!el || !dockRef.current) {
      dockRef.current?.classList.toggle('is-active', on);
      return;
    }
    // FLIP: measure First, mutate layout (is-active drives the hero collapse +
    // composer dock), measure Last, then invert and play back to identity.
    const first = el.getBoundingClientRect();
    dockRef.current.classList.toggle('is-active', on);
    const last = el.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const sx = last.width ? first.width / last.width : 1;
    el.style.transformOrigin = 'left top';
    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx})`;
    void el.offsetWidth; // commit the inverted state before animating
    requestAnimationFrame(() => {
      el.style.transition = `transform ${MORPH_MS}ms cubic-bezier(0.22,0.61,0.30,1)`;
      el.style.transform = '';
    });
    // After the morph, strip the inline transition/origin so nothing lingers.
    setTimeout(() => {
      el.style.transition = '';
      el.style.transformOrigin = '';
    }, MORPH_MS + 40);
  }, []);

  // "New search" — reset the cinematic surface only (visual, never the URL/filters):
  // clear the card stack, deactivate the dock, restore the heading + grid, refocus.
  const onNewSearch = useCallback(() => {
    stageRef.current?.clearStack();
    typingRef.current = null;
    setActive(false);
    flipHeading(false);
    fadeGridIn(reducedRef.current); // restore the grid if it was faded (safe no-op otherwise)
    inputRef.current?.focus();
  }, [setActive]);

  const stageRef = useFocusStage(
    { columnRef, liveRef },
    { reducedMotion: reduced, newSearchLabel: config.messages.newSearchLabel, onNewSearch, retire: true },
  );

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
      // First search is fresh (deterministic pre-pass eligible); once filters are
      // active a follow-up REFINES (carries the current filters forward). Captured
      // in outer scope so it also keys the reply copy after the fetch resolves.
      let refine = false;
      try {
        refine = fu.hasActiveFilters();
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, filters: fu.readState(), refine }),
          signal: controller.signal,
        });
        data = await res.json().catch(() => null);
      } catch {
        /* network error or abort — fall through to the unclear reply below */
      }
      if (my !== seqRef.current) return; // superseded by a newer submit

      // Guarantee a minimum "thinking" beat so the grid fade-out always reads.
      const elapsed = performance.now() - started;
      if (elapsed < MIN_BEAT_MS) await delay(MIN_BEAT_MS - elapsed);
      if (my !== seqRef.current) return; // superseded during the beat

      const gridPresent = !!document.getElementById('inventory-results');
      const filters: FilterState | null = data && data.filters ? (data.filters as FilterState) : null;
      const confidence: string = data?.confidence ?? 'low';

      // Apply only a confident, NON-EMPTY extraction — an empty extraction at high
      // confidence must NOT clear the visitor's existing filters (salvaged guard).
      const applied = !!filters && confidence !== 'low' && fu.hasActiveFilters(filters);

      if (applied && gridPresent && filters) {
        await fu.apply({ ...filters, page: 1 });
        if (my !== seqRef.current) return; // superseded during the grid swap
        // Keep the freshly-swapped results hidden (synchronously, pre-paint) so their
        // fade-in lands after the reply — not the instant the grid swaps.
        primeGridHidden(reducedRef.current);
        flipHeading(true);
      }

      // Build the carousel reply descriptor keyed by OUTCOME. The card text comes
      // ONLY from config.messages — never data.interpretation/clarifyingQuestion.
      const total = applied ? fu.readGridTotal() : 0;
      let descriptor: Descriptor;
      if (applied && total > 0) {
        descriptor = {
          kind: 'results',
          text: refine ? config.messages.resultsRefine : config.messages.resultsFound,
          count: total,
        };
      } else if (applied && total === 0) {
        descriptor = { kind: 'nomatch', text: config.messages.noMatch, count: 0 };
      } else {
        descriptor = { kind: 'unclear', text: config.messages.unclear, count: 0 };
      }

      // Land the reply onto the typing card (or append fresh if none). Both
      // landReply/appendRebi set the aria-live region to the reply text, so no
      // manual live announce is needed here (the "finding" one stays in onSubmit).
      if (typingRef.current) {
        stageRef.current?.landReply(typingRef.current, descriptor);
        typingRef.current = null;
      } else {
        stageRef.current?.appendRebi(descriptor);
      }

      // A beat later, the new (or restored) grid fades back in.
      if (reducedRef.current) {
        fadeGridIn(reducedRef.current);
      } else {
        setTimeout(() => {
          if (my === seqRef.current) fadeGridIn(reducedRef.current);
        }, 180);
      }

      // Fire-and-forget ledger seam: nothing reads this in this ticket (future
      // ledger consumer). Do NOT wire it to anything.
      document.dispatchEvent(
        new CustomEvent('reb:ledger', {
          detail: {
            surface: 'search',
            timestamp: Date.now(),
            sessionId: sessionIdRef.current,
            action: 'search_performed',
            payload: { query, resultCount: total, appliedFilters: fu.readState() },
          },
        }),
      );
    },
    [
      fu,
      config.messages.resultsFound,
      config.messages.resultsRefine,
      config.messages.noMatch,
      config.messages.unclear,
      stageRef,
    ],
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

      // Dock into the cinematic stage: activate the dock (hero collapses via :has,
      // composer morphs via FLIP), seat the user turn + typing dots, recede the
      // grid, and announce "finding". The real search then lands the reply.
      setActive(true);
      stageRef.current?.addUserTurn(query);
      typingRef.current = stageRef.current?.showTyping() ?? null;

      fadeGridOut(reducedRef.current);
      if (liveRef.current) liveRef.current.textContent = config.messages.finding;

      runSearch(query).finally(() => {
        busyRef.current = false;
        input.focus();
      });
    },
    [config.messages.finding, runSearch, setActive, stageRef],
  );

  // "Refine manually" opens the classic drawer (its trigger stays the fallback).
  const onManualRefine = useCallback(() => {
    document.getElementById('filters-trigger')?.click();
  }, []);

  // Reveal-on-mount (mirrors the vanilla `dock.hidden = false`) and mint the
  // per-mount ledger session id (crypto.randomUUID inside the effect is fine).
  useEffect(() => {
    setMounted(true);
    sessionIdRef.current = crypto.randomUUID();
  }, []);

  // Cleanup: abort any in-flight fetch on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return (
    <div id="search-dock" className="search-dock" hidden={!mounted} ref={dockRef}>
      {/* The Focus Stage carousel — receding user/Rebi cards seat here, above the
          composer. Its chrome is styled by stage.css under `.focus-stage`. */}
      <div className="focus-stage" ref={columnRef}></div>

      <form
        id="search-dock-form"
        className="entry"
        role="search"
        autoComplete="off"
        onSubmit={onSubmit}
        ref={formRef}
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
