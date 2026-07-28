# Task brief — Compare "Ask Rebi to choose" must stay the compare agent

## Problem (from docs/edits-1.txt)
"With the comparison chart open, I clicked Ask Rebi to choose, it opened the chatbot. It asked which
was most important to me and I answered 'Low running costs' and it opened a page with a search filter
applied to [hatchback][automatic][up to $25,000], ignoring the cars I had tagged with 'compare'. Rebi
just did an ordinary search, abandoning his job as the 'Compare agent'… what he should have done was
choose a single listing from the selection of 'compare' vehicles and open that listing."

The role-switching ability is WANTED — the bug is that Rebi switched to search **unbidden** while still
primed as the compare agent, instead of acting on the compared cars.

## Root cause (already traced — confirm, then fix)
In `src/components/widgets/ChatWidget.astro`, `send()` (~line 1283) runs, for ANY non-question message
from ANY context: `if (!looksLikeQuestion(text)) { await applyInventorySearch(text); }`. That calls
`/api/search` (enum-locked extractor), applies a generic inventory filter, and **transitions
`activeContext` to `kind:'search'`** (~line 1240) — so in `kind:'compare'` context, "low running costs"
becomes a hatchback/auto/<$25k search and the compare role is lost.

## The fix (priorities, in order)
1. **In `activeContext.kind === 'compare'`, do NOT run the generic `applyInventorySearch`.** That single
   change stops Rebi abandoning the compare role for an unrelated inventory search. (Leave the behaviour
   for all OTHER contexts — search/listing/launcher — exactly as-is.)
2. **Act as the compare agent instead.** When the user gives a decision criterion in compare context,
   Rebi should choose ONE of the COMPARED cars (the `refs` — real car ids) based on that criterion, using
   the cars' REAL data, and open that listing (navigate to `/listings/<slug>`). Reuse the existing,
   deterministic comparison scoring in `src/lib/compare-verdict.ts` (`LENSES` + `buildVerdict` /
   `SCORE_DIMS` — value/newer/lowkm/space/economy) to rank the compared cars; map the user's phrase to a
   lens (e.g. "running costs / economical / cheap to run / fuel" → economy or value; "space / family" →
   space; "newer" → newer; "low km" → lowkm; "cheapest / budget / value" → value). Pick the winning
   compared car and open it. Announce it in the chat first ("For low running costs, the {car} is your best
   pick of these three — opening it now.").
3. **Determinism:** rank/recommend ONLY from the compared cars' real specs (no fabrication). If the
   criterion maps to NO known lens, do NOT run a generic search and do NOT guess — fall back to a normal
   GROUNDED chat reply about the compared cars (the server already grounds on them) and, if useful, ask a
   clarifying question. Never invent a car or a spec.
4. **Stay in the compare role until explicitly released.** The user can still leave compare (e.g. an
   explicit new search like "show me all SUVs under 40k" — a clear fresh-search intent — may switch
   context), but a decision-criterion answer must NOT.

## Implementation notes (use your judgment; trace before you choose)
- The compared cars' data: `activeContext.refs` are ids. Trace how the server grounds compare context
  (`src/chatbot/grounding/context.ts` `resolveFocus`) and how the compare page loads cars
  (`src/pages/compare.astro` + `LISTING_FIELDS`). Decide the cleanest place to rank + get each car's
  `slug` for navigation — client-side (you have refs; you may need to fetch the cars' slugs/specs) or a
  small server assist. Prefer the simplest robust approach that doesn't fork the filter/chat cores.
- Whatever you add must reuse `applyFilterUrl`/existing helpers for any URL work and must not touch the
  chatbot streaming core, the grounding firewall, or `compare-verdict.ts` (reuse it read-only).

## Hard rules
- Do NOT regress ANY existing behaviour: homepage search-from-chat, listing-context chat, plain launcher
  chat, escalation, streaming, the search choreography. ONLY the compare-context decision path changes.
- Config-as-data, determinism, light-theme. No Math.random / module-top-level new Date(). `npx astro
  check` green (before/after; zero new errors). Do NOT commit.

## Verify (drive it on the dev server, http://localhost:4321)
- Open `/compare?ids=<2-3 real ids>`, click "Ask Rebi to decide", answer "low running costs" → Rebi should
  recommend/open ONE of those compared cars (its listing), NOT run a generic hatchback/auto/<$25k search.
- Regression: on `/`, a filter-y chat message ("hatchback under 25k") still drives the inventory grid as
  before. A listing-page chat still works.
- (You may not have a browser screenshot — verify via the network calls / resulting navigation / grid
  state and reasoning; the orchestrator does the visual check.)

## Report format
Concise: the exact gate change (file:line); how a compared car is chosen (which lens mapping + scoring);
how the listing is opened; how the compare role is preserved vs released; the regression checks you ran;
astro check before/after; anything not done.
