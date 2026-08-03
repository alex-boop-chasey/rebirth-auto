/**
 * ShowroomTour.tsx — Experience Mode, Candidate B: "The After-Hours Walk".
 * ---------------------------------------------------------------------------
 * A React 19 client island (deliberately NOT framework-free — that is Candidate
 * A's implementation; this diverges in tech too). Rebi doesn't hand you a form or
 * a quiz. It walks you through the lot after hours, one car at a time, full-bleed
 * and cinematic, and it READS YOUR REACTIONS: every "love it / not for me / tell
 * me more" nudges a live taste vector, and Rebi re-picks which car to walk you to
 * next. Implicit preference learning by reaction — a feedback loop, not a one-shot
 * ranked list.
 *
 * The three beats:
 *   onboarding → the calm opt-in invite ("come for a walk").
 *   standby    → Rebi present but unobtrusive; a breathing orb, dimmed, waiting.
 *   "boom"     → Rebi takes the whole screen and drives the walk; cars glide in,
 *                Rebi narrates from real specs, the shopper steers by reacting.
 * A fourth "shortlist" state is the payoff: the cars you loved + Rebi's read on
 * your taste, each deep-linked to its real listing (closing Candidate A's "picks
 * don't deep-link" gap).
 *
 * Honesty: no LLM. Rebi's narration is templated STRICTLY from each car's real
 * specs (see taste.ts). The taste vector + re-ranking are real deterministic code.
 * The cars, images and prices are real inventory passed from the SSR page.
 */
import { useCallback, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import {
  type TourVehicle,
  type TasteBands,
  type Prefs,
  type Reaction,
  applyReaction,
  pickNext,
  vehicleHeadline,
  narrationFor,
  moreFactsFor,
  tasteRead,
} from './taste';

type Phase = 'onboarding' | 'standby' | 'tour' | 'shortlist';

interface Props {
  vehicles: TourVehicle[];
  bands: TasteBands;
  dealerName: string;
}

interface TourState {
  prefs: Prefs;
  seen: string[];
  current: TourVehicle | null;
  loved: TourVehicle[];
  step: number;
}

type TourAction =
  | { type: 'start'; first: TourVehicle | null }
  | { type: 'react'; reaction: Reaction; bands: TasteBands; vehicles: TourVehicle[] }
  | { type: 'skip'; vehicles: TourVehicle[]; bands: TasteBands };

function reducer(state: TourState, action: TourAction): TourState {
  switch (action.type) {
    case 'start':
      return { prefs: {}, seen: [], current: action.first, loved: [], step: 0 };
    case 'react': {
      if (!state.current) return state;
      const prefs = applyReaction(state.prefs, state.current, action.reaction, action.bands);
      const seen = [...state.seen, state.current.id];
      const loved = action.reaction === 'love' ? [...state.loved, state.current] : state.loved;
      const next = pickNext(action.vehicles, new Set(seen), prefs, action.bands);
      return { prefs, seen, current: next, loved, step: state.step + 1 };
    }
    case 'skip': {
      // Ambient auto-advance: Rebi strolls on. Neutral — taste is unchanged so an
      // idle pass never punishes a car the shopper simply didn't react to.
      if (!state.current) return state;
      const seen = [...state.seen, state.current.id];
      const next = pickNext(action.vehicles, new Set(seen), state.prefs, action.bands);
      return { ...state, seen, current: next, step: state.step + 1 };
    }
    default:
      return state;
  }
}

const AUTO_MS = 9000;

function usePrefersReducedMotion(): boolean {
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

export default function ShowroomTour({ vehicles, bands, dealerName }: Props) {
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState<Phase>('onboarding');
  const [state, dispatch] = useReducer(reducer, {
    prefs: {},
    seen: [],
    current: null,
    loved: [],
    step: 0,
  });
  const [showMore, setShowMore] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [progress, setProgress] = useState(0);

  const total = vehicles.length;

  // Enter the walk: seed the first car (all-zero prefs → original order → the lot's
  // lead car), after a short "standby" breath so the beat is legible.
  const beginStandby = useCallback(() => setPhase('standby'), []);
  const beginTour = useCallback(() => {
    const first = pickNext(vehicles, new Set(), {}, bands);
    dispatch({ type: 'start', first });
    setPhase('tour');
  }, [vehicles, bands]);

  const react = useCallback(
    (reaction: Reaction) => {
      setShowMore(false);
      setProgress(0);
      dispatch({ type: 'react', reaction, bands, vehicles });
    },
    [bands, vehicles],
  );

  // When the walk runs out of cars, roll into the payoff.
  useEffect(() => {
    if (phase === 'tour' && state.step > 0 && state.current === null) setPhase('shortlist');
  }, [phase, state.step, state.current]);

  // Ambient auto-advance: a calm progress ring; on complete Rebi strolls on
  // (neutral skip). Paused by reduced-motion, by the pause control, and while
  // "tell me more" is open (so reading is never interrupted).
  const active = phase === 'tour' && !!state.current;
  const paused = !autoPlay || reduced || showMore;
  useEffect(() => {
    if (!active || paused) {
      setProgress(0);
      return;
    }
    const startedAt = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - startedAt) / AUTO_MS);
      setProgress(p);
      if (p >= 1) {
        dispatch({ type: 'skip', vehicles, bands });
        setProgress(0);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, paused, state.current?.id, vehicles, bands]);

  const cur = state.current;
  const narration = useMemo(() => (cur ? narrationFor(cur, bands) : ''), [cur, bands]);
  const facts = useMemo(() => (cur ? moreFactsFor(cur) : []), [cur]);
  const read = useMemo(() => tasteRead(state.prefs), [state.prefs]);

  // The live "what Rebi's learning" rail — top positive taste tokens as chips.
  const learning = useMemo(() => topLeanings(state.prefs), [state.prefs]);

  if (total === 0) {
    return (
      <Shell>
        <div className="text-center">
          <p className="text-lg font-medium text-slate-900">The lot's empty just now.</p>
          <p className="mt-2 text-slate-500">
            No vehicles are in stock to walk through yet.{' '}
            <a className="underline underline-offset-4" href="/">Back to {dealerName}</a>.
          </p>
        </div>
      </Shell>
    );
  }

  // ---------- Onboarding ----------
  if (phase === 'onboarding') {
    return (
      <Shell>
        <div className="mx-auto max-w-xl text-center">
          <Orb size={92} breathing={!reduced} />
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            {dealerName} · Experience Mode
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Come for a walk around the lot.
          </h1>
          <p className="mx-auto mt-5 max-w-md text-lg text-slate-600">
            It's after hours and quiet. I'll show you the cars one at a time — you
            just tell me what you think, and I'll follow your lead.
          </p>
          <div className="mt-9 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={beginStandby}
              className="rounded-full bg-slate-900 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-700"
            >
              Take the walk with Rebi
            </button>
            <a href="/" className="text-sm text-slate-500 underline-offset-4 hover:text-slate-800 hover:underline">
              No thanks — just show me the classic listings
            </a>
          </div>
        </div>
      </Shell>
    );
  }

  // ---------- Standby ----------
  if (phase === 'standby') {
    return (
      <Shell>
        <div className="mx-auto max-w-md text-center">
          <Orb size={80} breathing={!reduced} dim />
          <p className="mt-8 text-lg text-slate-500" aria-live="polite">
            I'm right here whenever you're ready. No rush — take your time.
          </p>
          <div className="mt-8">
            <button
              type="button"
              onClick={beginTour}
              className="rounded-full bg-slate-900 px-7 py-3 text-sm font-semibold text-white shadow transition hover:bg-slate-700"
            >
              Start the walk
            </button>
          </div>
          <p className="mt-4 text-xs text-slate-400">{total} cars on the lot tonight</p>
        </div>
      </Shell>
    );
  }

  // ---------- Shortlist (payoff) ----------
  if (phase === 'shortlist') {
    return (
      <Shell wide>
        <div className="mx-auto w-full max-w-3xl">
          <div className="text-center">
            <Orb size={64} breathing={!reduced} />
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">
              {state.loved.length > 0 ? 'Here’s what caught your eye.' : 'That’s the lot for tonight.'}
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-lg text-slate-600">{read}</p>
          </div>

          {state.loved.length > 0 ? (
            <ul className="mt-10 grid gap-5 sm:grid-cols-2">
              {state.loved.map((v) => (
                <li key={v.id}>
                  <a
                    href={v.slug ? `/listings/${v.slug}` : '/'}
                    className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                  >
                    <div className="aspect-[16/10] overflow-hidden bg-slate-100">
                      {v.image ? (
                        <img
                          src={v.image}
                          alt={vehicleHeadline(v)}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-slate-400">No photo</div>
                      )}
                    </div>
                    <div className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-semibold text-slate-900">{vehicleHeadline(v)}</p>
                        <p className="text-sm text-slate-500">{v.priceLabel}</p>
                      </div>
                      <span className="text-sm font-medium text-slate-400 transition group-hover:text-slate-900">
                        View →
                      </span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-10 text-center text-slate-500">
              You didn't fall for one this time — that's fine. Want to walk it again?
            </p>
          )}

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={beginTour}
              className="rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Walk the lot again
            </button>
            <a
              href="/"
              className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Browse the full inventory
            </a>
          </div>
        </div>
      </Shell>
    );
  }

  // ---------- Tour ("boom") ----------
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-900 text-white">
      {/* Cinematic full-bleed media — keyed by id so each car re-triggers its enter */}
      {cur && (
        <div key={cur.id} className={reduced ? 'absolute inset-0' : 'absolute inset-0 car-enter'}>
          {cur.image ? (
            <img
              src={cur.image}
              alt={vehicleHeadline(cur)}
              className={
                'h-full w-full object-cover ' + (reduced ? '' : 'kb-zoom')
              }
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-slate-800 text-slate-500">
              No photo for this one
            </div>
          )}
          {/* Legibility scrim — dark at the bottom where the copy sits */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/25 to-slate-950/40" />
        </div>
      )}

      {/* Top bar: Rebi presence + progress + controls */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 md:p-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Orb size={40} breathing={!reduced} onDark />
            {/* auto-advance progress ring */}
            <svg className="pointer-events-none absolute -inset-1" viewBox="0 0 48 48" aria-hidden>
              <circle
                cx="24" cy="24" r="22" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"
                strokeDasharray={2 * Math.PI * 22}
                strokeDashoffset={(1 - progress) * 2 * Math.PI * 22}
                transform="rotate(-90 24 24)"
                style={{ transition: 'stroke-dashoffset 80ms linear' }}
              />
            </svg>
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Rebi</p>
            <p className="text-xs text-white/60">
              Car {Math.min(state.step + 1, total)} of {total}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!reduced && (
            <button
              type="button"
              onClick={() => setAutoPlay((a) => !a)}
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-white/20"
              aria-pressed={!autoPlay}
            >
              {autoPlay ? 'Pause auto-walk' : 'Resume auto-walk'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setPhase('shortlist')}
            className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-white/20"
          >
            Finish walk
          </button>
        </div>
      </div>

      {/* Live "what Rebi's learning" rail */}
      {learning.length > 0 && (
        <div className="absolute right-4 top-20 z-10 hidden max-w-[190px] flex-col items-end gap-1.5 md:flex">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
            Getting a feel for
          </p>
          {learning.map((l) => (
            <span
              key={l}
              className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white backdrop-blur"
            >
              {l}
            </span>
          ))}
        </div>
      )}

      {/* Bottom: Rebi's spec-true narration + the react controls */}
      {cur && (
        <div className="absolute inset-x-0 bottom-0 z-10 p-5 md:p-8">
          <div className="mx-auto max-w-2xl">
            <p className="text-sm font-medium text-white/60">{cur.priceLabel}</p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">
              {vehicleHeadline(cur)}
            </h2>
            <p className="mt-2 max-w-xl text-lg text-white/85" aria-live="polite">
              {narration}
            </p>

            {showMore && facts.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2 more-enter">
                {facts.map((f) => (
                  <li key={f} className="rounded-full bg-white/12 px-3 py-1 text-sm text-white/90 backdrop-blur">
                    {f}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => react('love')}
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-slate-100"
              >
                ♥ Love this
              </button>
              <button
                type="button"
                onClick={() => react('pass')}
                className="rounded-full bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                Not for me
              </button>
              <button
                type="button"
                onClick={() => (showMore ? react('more') : setShowMore(true))}
                className="rounded-full bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                {showMore ? 'Next →' : 'Tell me more'}
              </button>
              {cur.slug && (
                <a
                  href={`/listings/${cur.slug}`}
                  className="ml-auto text-sm font-medium text-white/70 underline-offset-4 hover:text-white hover:underline"
                >
                  See full listing →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- small presentational helpers -------------------------------------------

function Shell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-5 py-16">
      <div className={wide ? 'w-full' : 'w-full max-w-2xl'}>{children}</div>
    </div>
  );
}

function Orb({
  size,
  breathing,
  dim,
  onDark,
}: {
  size: number;
  breathing: boolean;
  dim?: boolean;
  onDark?: boolean;
}) {
  return (
    <span
      className={
        'relative inline-flex items-center justify-center rounded-full ' +
        (breathing ? 'orb-breathe ' : '') +
        (onDark ? 'bg-white/90' : 'bg-slate-900')
      }
      style={{ width: size, height: size, opacity: dim ? 0.55 : 1 }}
      aria-hidden
    >
      <span
        className={
          'block rounded-full ' + (onDark ? 'bg-slate-900' : 'bg-white')
        }
        style={{ width: size * 0.34, height: size * 0.34 }}
      />
    </span>
  );
}

// Top positive taste tokens → short human chips for the "learning" rail.
const LEANING_LABEL: Record<string, string> = {
  'body:suv': 'SUVs', 'body:ute': 'utes', 'body:hatchback': 'hatches',
  'body:sedan': 'sedans', 'body:wagon': 'wagons', 'body:van': 'vans',
  'body:coupe': 'coupes', 'body:convertible': 'convertibles',
  'fuel:diesel': 'diesel', 'fuel:hybrid': 'hybrid', 'fuel:electric': 'electric',
  'fuel:petrol': 'petrol', 'drive:4wd': '4WD', 'drive:awd': 'AWD',
  'seats:family': 'family seats', 'km:low': 'low kms', 'era:near-new': 'near-new',
  'trans:auto': 'autos', 'trans:manual': 'manuals',
};

function topLeanings(prefs: Prefs): string[] {
  return Object.entries(prefs)
    .filter(([tok, w]) => w > 0 && LEANING_LABEL[tok])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([tok]) => LEANING_LABEL[tok]);
}
