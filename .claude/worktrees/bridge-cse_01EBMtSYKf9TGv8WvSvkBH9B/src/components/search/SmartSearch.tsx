/**
 * SmartSearch — the Rebi-fronted plain-English homepage search dock, as a React
 * island. A straight PARITY port of SearchDock.astro's former inline `<script>`:
 * same control flow, same constants, same order of side-effects. Behaviour is
 * identical to the vanilla version — this is a migration, not a redesign.
 *
 * A JS-ONLY enhancement on the hero: SSR renders the dock `hidden`; hydration
 * (`client:idle`) flips it visible (mirrors the vanilla `dock.hidden = false`).
 * With no JS it stays hidden and the classic Filters drawer is the fallback.
 * On submit it POSTs /api/search, drives the ONE filter URL via the shared
 * `applyFilterUrl` (URL = single source of truth, Decision 5) exclusively through
 * the `useFilterUrl` hook, and speaks back on the cinematic Focus Stage.
 *
 * State is imperative (refs), matching the vanilla host: the ONLY React render
 * state is `mounted` (reveal) and `muted` (the sound toggle, owned by useRebiSounds).
 * The card column is mutated by the framework-free stage engine OUTSIDE React's
 * vdom — React renders it empty and never reconciles its children.
 *
 * Hard constraints honoured: no filter store (URL-only via useFilterUrl); no
 * `cloudflare:workers` / `~/ai` / `src/ai/*` imports; all copy/timings/sounds come
 * from the typed `config` prop (dealerConfig.chat.search); light-theme; no
 * `Math.random` / module-top-level `new Date()`. It does NOT dispatch `reb:search`
 * and does NOT open the corner Rebi widget (preserving today's behaviour).
 */
import { useCallback, useEffect, useRef, useState, type FormEventHandler } from 'react';
import {
  useReducedMotion,
  useRebiSounds,
  useFocusStage,
  useFilterUrl,
} from '~/components/ai/hooks';
import type { FocusStage, Descriptor } from '~/components/search/stage-engine';
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
import './stage.css';

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
  // ---- render state (the only two) ----
  const [mounted, setMounted] = useState(false);

  // ---- imperative refs (the island holds NO filter state) ----
  const columnRef = useRef<HTMLDivElement | null>(null);
  const liveRef = useRef<HTMLParagraphElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const seqRef = useRef(0); // island guard — distinct from the shared module `seq` in filter-url.ts
  const busyRef = useRef(false); // guards overlapping animations only
  const abortRef = useRef<AbortController | null>(null); // aborts the previous /api/search

  // ---- hooks ----
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced); // live value read inside imperative handlers
  reducedRef.current = reduced;

  const { soundSend, soundRebi, muted, toggleMute } = useRebiSounds({
    muteKey: 'rebi:search:muted',
    enabled: config.sounds.enabled,
    defaultMuted: config.sounds.defaultMuted,
  });

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

  // Seat Rebi's opening greeting exactly as the vanilla host does (on load + on reset).
  const seatGreeting = useCallback(
    (stage: FocusStage) => {
      if (config.greeting.showOnLoad && config.greeting.text) {
        stage.appendRebi({ kind: 'greeting', text: config.greeting.text, count: 0 });
      }
    },
    [config.greeting.showOnLoad, config.greeting.text],
  );

  // "New search": full reset to idle → base inventory, heading + stack + input.
  // Stored on a ref so useFocusStage's `onNewSearch` wrapper always calls the live one.
  const resetSearchRef = useRef<() => void>(() => {});

  const stageRef = useFocusStage(
    { columnRef, liveRef },
    {
      reducedMotion: reduced,
      newSearchLabel: config.messages.newSearchLabel,
      onNewSearch: () => resetSearchRef.current(),
      onReply: soundRebi,
      retire: true,
      onCreate: seatGreeting,
    },
  );

  // Runs the search, builds a reply descriptor from config.messages.* + the server
  // interpretation/clarifyingQuestion, then lands the reply. Ported verbatim.
  const runSearch = useCallback(
    async (query: string, typing: HTMLElement) => {
      const stage = stageRef.current;
      if (!stage) return;
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
      if (my !== seqRef.current) {
        stage.retire(typing);
        return;
      } // superseded by a newer submit / reset

      // Guarantee a minimum "thinking" beat so the fade-out + dots always read.
      const elapsed = performance.now() - started;
      if (elapsed < MIN_BEAT_MS) await delay(MIN_BEAT_MS - elapsed);
      if (my !== seqRef.current) {
        stage.retire(typing);
        return;
      } // superseded during the beat

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
        if (my !== seqRef.current) {
          stage.retire(typing);
          return;
        } // superseded during the grid swap
        // Keep the freshly-swapped results hidden (synchronously, pre-paint) so their
        // fade-in lands AFTER the message — not the instant the grid swaps.
        primeGridHidden(reducedRef.current);
        flipHeading(true);
      }

      let descriptor: Descriptor;
      if (applied) {
        const total = fu.readGridTotal();
        descriptor =
          total > 0
            ? { kind: 'results', text: config.messages.resultsRefine, count: total }
            : { kind: 'nomatch', text: config.messages.noMatch, count: 0 };
      } else {
        const unclear =
          [interpretation, clarifying].filter(Boolean).join(' ') || config.messages.unclear;
        descriptor = { kind: 'unclear', text: unclear, count: 0 };
      }

      // Step 3 — the reply message lands in the chat (replacing the dots).
      stage.landReply(typing, descriptor);

      // Step 4 — a beat later, the new (or restored) grid fades back in, so the
      // message registers before the results appear.
      if (reducedRef.current) {
        fadeGridIn(reducedRef.current);
      } else {
        setTimeout(() => {
          if (my === seqRef.current) fadeGridIn(reducedRef.current);
        }, 180);
      }
    },
    [
      stageRef,
      fu,
      config.messages.resultsRefine,
      config.messages.noMatch,
      config.messages.unclear,
    ],
  );

  // "New search": full reset to idle. Since greeting-on-load is on, re-seat it.
  const resetSearch = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage) return;
    seqRef.current++; // invalidate any in-flight search so it can't re-message
    abortRef.current?.abort();
    await fu.apply(fu.emptyState()); // base "/" → full inventory
    flipHeading(false);
    setSubheadActive(false, reducedRef.current);
    stage.clearStack();
    seatGreeting(stage);
    if (inputRef.current) inputRef.current.value = '';
    twRestartRef.current();
    inputRef.current?.focus();
  }, [stageRef, fu, seatGreeting]);
  resetSearchRef.current = resetSearch;

  const onSubmit = useCallback<FormEventHandler<HTMLFormElement>>(
    (e) => {
      e.preventDefault();
      const input = inputRef.current;
      const stage = stageRef.current;
      if (!input || !stage) return;
      const query = input.value.trim();
      if (!query) {
        input.focus();
        return;
      }
      if (busyRef.current) return; // guard overlapping animations only
      busyRef.current = true;

      // 1) your message rises into focus + the "sent" blip
      stage.addUserTurn(query);
      soundSend();

      // wipe the input (ready for the next prompt) and restart the placeholder
      input.value = '';
      twRestartRef.current();
      setSubheadActive(true, reducedRef.current);

      // 2) the current list recedes AND Rebi's typing beat begins together — the
      //    live region announces "finding" now
      fadeGridOut(reducedRef.current);
      const typing = stage.showTyping();
      if (liveRef.current) liveRef.current.textContent = config.messages.finding;

      // 3) the real search resolves → the reply lands
      runSearch(query, typing).finally(() => {
        busyRef.current = false;
        input.focus();
      });
    },
    [stageRef, soundSend, config.messages.finding, runSearch],
  );

  // "Refine manually" opens the classic drawer (its trigger stays the fallback).
  const onManualRefine = useCallback(() => {
    document.getElementById('filters-trigger')?.click();
  }, []);

  // Reveal-on-mount (mirrors the vanilla `dock.hidden = false`).
  useEffect(() => {
    setMounted(true);
  }, []);

  // Cleanup: abort any in-flight fetch on unmount. (useFocusStage / useRebiSounds /
  // useTypewriter own their own teardown.)
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const soundLabel = muted ? config.stage.unmuteLabel : config.stage.muteLabel;

  return (
    <div id="search-dock" className="search-dock" hidden={!mounted}>
      <section className="rebi-stage" aria-label={config.stage.askLabel}>
        {/* Sound toggle sits on the glass shelf, top-right. */}
        <button
          type="button"
          className={`sound-toggle${muted ? ' muted' : ''}`}
          id="search-dock-sound"
          aria-pressed={muted}
          aria-label={soundLabel}
          title={soundLabel}
          onClick={toggleMute}
        >
          <svg
            className="ic-on"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 9v6h4l5 4V5L8 9H4z"></path>
            <path d="M16.5 8.5a5 5 0 0 1 0 7"></path>
            <path d="M19 6a8 8 0 0 1 0 12"></path>
          </svg>
          <svg
            className="ic-off"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 9v6h4l5 4V5L8 9H4z"></path>
            <path d="M17 9l4 6M21 9l-4 6"></path>
          </svg>
        </button>

        {/* The 3D theatre. The card column is built entirely at runtime by the stage
            engine (outside React's vdom); it carries NO aria-live. */}
        <div className="stage-viewport">
          <div className="glass-shelf" aria-hidden="true"></div>
          <div className="shelf-label" aria-hidden="true">
            <span className="dotmark"></span>
            {config.stage.shelfLabel}
          </div>
          <div className="card-column focus-stage" id="search-dock-column" ref={columnRef}></div>
        </div>

        <form
          id="search-dock-form"
          className="entry"
          role="search"
          autoComplete="off"
          ref={formRef}
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

        {/* One polite region: the COMPLETE reply text, set once per landed card. */}
        <p id="search-dock-live" className="sd-sr-only" aria-live="polite" ref={liveRef}></p>
      </section>
    </div>
  );
}
