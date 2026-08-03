# Task brief — Rebi visual consistency + globalize his styles/sounds into their own file

## Problem (from docs/edits-1.txt)
"The chatbot background is inconsistent: when opened from the inventory page via the chatbot widget it
has the greyed, blurred page behind it, but when opened from the comparison table it had the white
background with feathered edge. Let's make all instances of Rebi the same as the main chatbot and make
all of his styles, layout, noises etc global in their own file for easy edits."

Two parts: (A) fix the inconsistency so EVERY Rebi instance shows the same greyed+blurred backdrop, and
(B) extract Rebi's styles + layout + sound engine out of the 1736-line `src/components/widgets/ChatWidget.astro`
into dedicated file(s) for easy editing.

## Part A — diagnose + fix the inconsistency
- Rebi's "dreaming" backdrop is `body.reb-dreaming > :not(#reb-chat) { filter: grayscale(1) brightness(1.08)
  contrast(0.96) blur(6px); }` (in ChatWidget's `<style is:global>`), plus a feathered spotlight glow.
- On the homepage this greys+blurs the page. On `/compare` (the new "Balance" page, `src/pages/compare.astro`
  → `.balance-page`) it does NOT — the compare page shows a white backdrop with just the feathered edge.
  Diagnose why: almost certainly the `.balance-page` (or its fixed-position glow layers / an opaque
  background / a stacking context or z-index) sits such that the body-level grayscale+blur filter doesn't
  apply to it, OR `.balance-page` paints its own opaque light background above the greyed body.
- Fix so the dreaming backdrop applies identically on `/compare` as on `/`. Drive BOTH pages on the dev
  server (http://localhost:4321): open Rebi from the homepage widget and from the compare "Ask Rebi"
  button, and confirm both show the same greyed+blurred page behind the floating chat. Screenshot both.
- Do not change Rebi's own chat UI (bubbles, input, glow) — only make the backdrop consistent.

## Part B — globalize (refactor, behaviour-identical)
- Extract Rebi's `<style is:global>` CSS block into a dedicated stylesheet, e.g. `src/styles/rebi.css`,
  imported by ChatWidget (and anywhere else needed) — the single place to edit Rebi's look/layout.
- Extract the oscillator SOUND engine (the AudioContext/tone synthesis, ~line 1658+) into a dedicated
  module, e.g. `src/components/widgets/rebi-sounds.ts`, imported by ChatWidget. Keep every tone/behaviour
  identical.
- The goal is "all of Rebi's styles, layout, noises in their own file(s) for easy edits" — ChatWidget
  becomes markup + wiring that imports the shared style + sound modules. Behaviour must be byte-identical
  to today (same classes, same tones, same triggers). This is a pure refactor + the Part-A consistency fix.

## Rules
- Light-theme only (Rebi's greyed backdrop is a filter over the light page — keep it). Config-as-data
  where any dealer value appears (sounds toggle etc. already in dealerConfig — reuse). No Math.random /
  module-top-level new Date(). `npx astro check` green (before/after; zero new errors). Do NOT commit.
- Do NOT change Rebi's server logic, grounding, or the compare-agent behaviour (a separate ticket handles that).

## Verify (drive it)
- Open Rebi from `/` and from `/compare` — identical greyed+blurred backdrop (screenshot both).
- Sounds still play (tones on submit/open), speaker toggle still works, open/close/minimise unchanged.
- astro check green.

## Report
Concise: root cause of the compare inconsistency + the fix (file:line); which files the styles/sounds
moved to; confirmation behaviour is identical; screenshots taken; astro check before/after.
