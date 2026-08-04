# Experience Mode — Candidate A: "The Concierge"

_Contest proposal · Agent 1 · prototype at `/labs/experience` (unlinked)_

## The point of view

The classic filter+grid puts the translation burden on the **shopper**: they must turn a fuzzy
human wish — _"something safe and easy for my daughter's first car, nothing too dear"_ — into a
matrix of checkboxes (bodyType, transmission, price band, seats…). That demands they already speak
the dealership's vocabulary and already know what trade-offs matter.

The homepage SearchDock softened this (type plain English → filtered grid), but it is still
**reactive**: the shopper leads, Rebi follows and filters. Candidate A's thesis is that the fullest
expression of "AI as the interface" is **proactive**: Rebi should behave like the best salesperson on
the floor — one who asks a few of the _right_ questions, then walks you to the three cars worth your
time and tells you _why_. The screen becomes a canvas Rebi drives, not a form the shopper fills.

**Genuinely better than filter+grid because:** it needs zero product vocabulary, it collapses a
20-checkbox search into three taps, and — critically — the payoff is _curation with reasoning_, not a
wall of results. That is the difference between a search box and a concierge, and it is the thing a
static brochure site can never do (which is what earns the subscription, per VISION).

## The three beats

- **Onboarding** — a calm, full-screen invitation: _"Don't shop the lot. Let it come to you."_ One
  primary opt-in ("Hand me the wheel") and an always-present escape hatch to the classic inventory.
  It sets the promise (three questions, no forms) without demanding anything yet.
- **Standby** — Rebi present but unobtrusive. A single ambient **breathing orb** (Rebi's persistent
  presence), a quiet greeting typed out — _"I'm right here whenever you want me"_ — and a soft "I'm
  ready" control. This is VISION's "present when you want it, unobtrusive when you don't" made literal.
- **"Boom"** — Rebi takes the whole screen and _drives_. Three guided questions (who's it for → what
  matters most → budget feel), each a full-canvas beat with tappable, glyphed choices and a typed Rebi
  prompt. Then the reveal: a brief "combing the lot" thinking beat, and **three real vehicles fly in
  in ranked order**, each with a price and one or two **"why this one" chips derived from its real
  specs** ("Seats 7 — room for everyone", "4WD — ready for the rough stuff").

The orb is the through-line: it presides at centre during onboarding/standby, recedes to the top to
preside over the questions, and settles above the curated reveal.

## What's real vs faked in the prototype

- **Real:** the vehicles (fetched SSR from Sanity via the shared `LISTING_FIELDS` projection, mapped
  to a slim client payload with image URLs + `formatPrice`); the dealer name (`dealerConfig.identity`)
  and currency/locale (via `formatPrice`); the full client-side state machine, transitions, orb, and
  staggered reveal; and the **matching** — a pure, deterministic scoring function (`matcher.ts`) that
  ranks real stock against the shopper's answers. The per-car reason chips are generated **only from a
  vehicle's real specs** — a car missing a spec simply earns no reason from it (CLAUDE.md determinism).
- **Faked / scripted (deliberately, per the brief's cheap-prototype allowance):** Rebi's conversational
  copy is a scripted local flow, **not** a live LLM call. The answer→preference weights live in
  `matcher.QUESTIONS` (the feature analogue of `dealer.ts` `concepts`). No OpenRouter, no `~/ai` call.

The productionised version would swap the scripted branch for `generateObject` via `~/ai` (turning the
fixed 3-question tree into an adaptive one that asks the next-most-useful question) while keeping the
deterministic matcher + honest-reasons layer exactly as-is, as the anti-hallucination floor.

## Distinctiveness (vs the likely alternatives)

Not another chat log, and not the existing reactive search-then-filter. Candidate A is **question-led
curation on a canvas**: Rebi leads, the shopper taps, and the reward is a small, reasoned shortlist —
the salesperson model, not the search-engine model.

## Honest limitations

- The 3-question tree is fixed and scripted; it can feel like a quiz rather than a conversation. A
  free-text "or just tell me" affordance is missing (a real gap the LLM version closes).
- Deterministic weights are hand-tuned; with thin/duplicated demo stock the top-3 can repeat models.
- Scoring is soft (budget penalises, never excludes), so an out-of-budget car _can_ still surface —
  intentional (always show something) but arguably surprising; needs a "just over budget" chip.
- Reveal shows 3 and links to the full lot, but doesn't yet deep-link each pick to its listing/compare
  or hand the curation to the corner Rebi widget — the obvious next integration seams.
- Framework-free (matches the SearchDock precedent) — no React island — so no reduced-motion story
  beyond CSS `prefers-reduced-motion` (which is handled) and no persisted progress across reloads.

## Files

- `src/pages/labs/experience.astro` — SSR page; real-inventory fetch + payload mapping.
- `src/components/experience/ExperienceCanvas.astro` — the canvas: markup, styles, framework-free engine.
- `src/components/experience/matcher.ts` — pure deterministic question flow + `curate()` scorer.

**Verification:** `npx astro check` → 0 errors in these files; `GET /labs/experience` → 200; matcher
unit-smoke confirms sensible, deterministic, spec-derived picks (first-car→hatch, work→diesel 4WD ute,
family→7-seat SUV).
