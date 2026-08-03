# Experience Mode — Candidate B: "The After-Hours Walk"

_Contest proposal · Agent 2 · prototype at `/labs/experience-alt` (unlinked)_

## The point of view

Candidate A treats "AI as the interface" as **question-led curation**: Rebi asks three
up-front questions and hands back a frozen, ranked shortlist. That's the *salesperson-with-a-clipboard*
model — better than a checkbox grid, but it still front-loads a mini-form and it still speaks before
it has seen the shopper react to a single real car.

Candidate B takes a different reading of the VISION line — _"a knowledgeable friend at the dealership,
present when you want it, unobtrusive when you don't."_ A friend showing you around a lot after hours
doesn't interview you. They **walk you to a car, tell you its story, and read your face** — then walk
you to the next one based on what just lit you up. No forms, no questions, no vocabulary required. You
express intent the most natural way there is: by **reacting to real cars**. Rebi quietly builds a
picture of your taste from those reactions and steers the walk in real time.

This is the **implicit-preference / guided-tour** model, not the explicit-quiz model. The screen is a
cinematic canvas Rebi drives one car at a time; the shopper is a passenger who nudges the wheel.

## The three beats

- **Onboarding** — a calm, full-screen invitation: _"Come for a walk around the lot. It's after hours
  and quiet."_ One primary opt-in ("Take the walk with Rebi") and an always-present escape hatch to the
  classic listings. It promises a stroll, not a questionnaire.
- **Standby** — Rebi present but unobtrusive: a single **dimmed, breathing orb** and a quiet line —
  _"I'm right here whenever you're ready. No rush."_ — over the real count of cars on the lot tonight.
  This is VISION's "unobtrusive when you don't" made literal: nothing happens until the shopper says go.
- **"Boom"** — Rebi takes the **whole screen** and drives. The current car fills the canvas full-bleed
  with a slow cinematic Ken-Burns push; Rebi speaks one **spec-true** story line over it ("A 4WD diesel
  ute. And ready for the rough stuff."); and the shopper steers with three reactions — **Love this /
  Not for me / Tell me more**. Each reaction glides the car away and the next one — re-picked live from
  the updated taste — glides in. A **"Getting a feel for…" rail** surfaces what Rebi is learning
  (utes · 4WD · near-new), and a progress ring lets Rebi **stroll hands-free** if the shopper just
  watches. The payoff — **"Here's what caught your eye"** — collects the loved cars, reads back the
  shopper's taste in one human line, and **deep-links each pick to its real listing**.

## Why it's genuinely different from Candidate A

| | Candidate A — "The Concierge" | Candidate B — "The After-Hours Walk" |
|---|---|---|
| **Interaction model** | Explicit: answer 3 questions, *then* see results | Implicit: react to real cars; intent is inferred from reactions |
| **Rebi's loop** | One-shot — scores the whole lot **once**, freezes a ranked list | Feedback loop — a **live taste vector** re-ranks the unseen queue after **every** reaction |
| **Canvas** | A staggered reveal of **three cards** side by side | **One car at a time**, full-bleed and cinematic, Ken-Burns motion |
| **Shopper's job** | Choose from glyphed answer tiles up front | Just say yes/no to what's in front of them |
| **Payoff** | Ranked shortlist with "why it fits" chips | Loved-cars set + a "your taste" read, **deep-linked to listings** |
| **Implementation** | Framework-free vanilla state machine (`.astro`) | **React 19 island** (`useReducer` taste engine + rAF auto-advance) |

It is not A-with-free-text and it is not "ask N questions then rank." It's a continuous, Rebi-led,
reaction-steered tour.

## What's real vs faked

- **Real:** the vehicles (fetched SSR from Sanity via the shared `LISTING_FIELDS` projection, mapped
  to a slim client payload with full-bleed image URLs + `formatPrice`); the dealer name
  (`dealerConfig.identity`), currency/locale (via `formatPrice`), and the taste engine's thresholds —
  price bands, low-km ceiling, family-seat count — all read from `dealerConfig` (reusing the chatbot's
  grounding tunables so the taste engine speaks the same "budget/family/low-kms" language as the rest
  of the site). The **preference model is real deterministic code** (`taste.ts`): reactions tally over
  legible feature tokens, and `pickNext` re-ranks the unseen queue every step. Every narration line and
  every "tell me more" fact is derived **strictly from a car's real specs** — a car missing a spec
  simply earns no claim about it (AGENTS.md determinism). Deep links go to the real `/listings/[slug]`.
- **Faked / scripted (deliberately, per the brief's cheap-prototype allowance):** Rebi's "voice" is
  templated, **not** a live LLM — `narrationFor` assembles a sentence from present specs. No OpenRouter,
  no `~/ai` call. The taste-read and the "getting a feel for" chips are deterministic labels for the
  top positive tokens. Auto-advance timing is cosmetic.

The productionised version swaps the templated voice for `generateStream` via `~/ai` (so Rebi narrates
each car in real prose and can improvise a follow-up when the shopper lingers), while keeping the
deterministic taste vector + spec-only claim floor exactly as-is as the anti-hallucination guard.

## Honest limitations

- **Cold start.** With an all-zero taste the first car is just the lot's lead vehicle; the walk only
  gets "smart" after a few reactions. A one-tap "what usually matters to you?" warm-start would help.
- **Thin/clustered demo stock** makes the re-ranking's effect subtle when many cars share specs (e.g.
  several utes in a row) — the steering is most visible across a varied lot.
- **Coarse tokens.** Taste is bucketed (body/fuel/drive/price-band/seats/era/km), so it can't yet learn
  fine grains like "loves *this* colour" — deliberate, to keep the "why Rebi showed you this" story
  auditable, but it caps nuance.
- **No persistence.** The walk resets on reload — no server-side memory of a returning shopper (the
  existing `journey` seam is the obvious home for that).
- **Neutral auto-advance is a judgement call:** an idle pass doesn't move taste, so a shopper who just
  watches never signals dislike — intentional (watching ≠ rejecting) but it means passive viewing
  teaches Rebi nothing.

## Files

- `src/pages/labs/experience-alt.astro` — SSR page: real-inventory fetch, slim payload mapping,
  config-derived taste bands, the React island mount, and the (page-scoped, reduced-motion-gated)
  cinematic keyframes.
- `src/components/experience-alt/ShowroomTour.tsx` — the React 19 client island: the four phases
  (onboarding → standby → tour → shortlist), the `useReducer` tour state, the rAF auto-advance, the orb,
  the learning rail, and the payoff.
- `src/components/experience-alt/taste.ts` — the pure, testable engine: tokenisation, the live
  preference vector (`applyReaction`/`scoreVehicle`/`pickNext`), spec-only narration, and the taste read.

**Verification:** `npx astro check` → 0 errors in these files; `GET /labs/experience-alt` → 200;
browser smoke confirmed all three beats play, a "Love this" reaction advanced the walk **and** updated
the live "Getting a feel for: utes · 4WD · near-new" rail, and no console errors on hydration.
