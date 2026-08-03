# Contest 2 — Information-Architecture / Navigation contest (shared brief)

3 independent agents, run simultaneously, **no agent sees another's work**. Each is primed with ONE
distinct navigation PHILOSOPHY (assigned separately). **Alex judges the winner.** The goal is a site
that holds **all the same information** but feels **sleek, slim, and effortless to navigate** — the
current sprawl of similar-content pages folded into intuitive wayfinding.

## What's FIXED (do not change)
- The **Near-Future Yard** visual system (tokens/primitives in `src/styles/theme.css`) and the existing
  page **layouts + tools** from the last reskin — sliders, AI blocks, listing cards, compare dials all
  stay. Only **minor** changes allowed, purely in service of navigation.
- The content is fixed by `docs/briefs/contest2/SHARED-PAGES-SPEC.md` — you decide placement, not content.
- All AI/behaviour contracts in `docs/briefs/rebuild/AUDIT-*.md` (esp. `#reb-*` widget ids, `data-rebi-*`,
  `reb:search`, the grid swap, compare `c3-*`). Reskin/navigation only — never break these.

## The IA brief (what to design)
- **Do NOT copy Bundaberg's model** (every page in the top menu or a sub-menu). Keep a **lean top nav**.
- Distribute wayfinding intelligently across four surfaces:
  1. **Top nav** — only the few highest-value destinations.
  2. **Footer menu** — the long tail / utility pages live here.
  3. **Contextual on-page buttons** — reach pages from where they're relevant, nested in a related page
     (e.g. brand options as buttons under the AI search bar / in Experience Mode, NOT an "Our Brands"
     nav item; "sell your car" surfaced on trade-in; "book a test drive" on the vehicle page; EV hub
     from the fuel facet; finance calculator from a vehicle's price).
  4. **Rebi (the AI) as a primary navigator** — see below.
- Fold overlapping content together (finance↔offers, sell↔trade-in, brand↔listings facets, EV↔fuel
  facet) so the site is slim, not siloed. Consistent, intuitive nav buttons everywhere.

## Rebi as a site navigator (REQUIRED in every entry)
Extend the Rebi chat so it navigates the user with less typing:
- **Clickable listing thumbnails / listing cards rendered inside the chat thread** (tap → go to the
  vehicle / compare / a filtered list).
- **Action buttons in Rebi's responses** that DO something or GO somewhere (e.g. "See all 7-seaters",
  "Book a test drive", "Work out repayments", "Talk to Service") — quick-reply/afford­ance chips, not
  free-text. This reuses the existing focus-stage `.actions/.newsearch` affordances + the `data-rebi-*`
  seam; keep those contracts.
- Rebi should be able to answer "where do I…/take me to…" by navigating.

## Deliverable per agent (isolated so Alex can compare)
Build under `src/pages/concepts2/<philosophy>/` (additive, isolated — like the last contest; do NOT
touch shipped pages or the other contest's `src/pages/concepts/`). Provide:
1. `IA.md` — your navigation philosophy + a **placement map**: every page → nav | footer | contextual
   button (which page) | Rebi. Explain how you slimmed the sprawl.
2. A **working navigation demo in NFY**: a nav + footer + a home/hub showing the contextual entry
   points, the 11 parity pages built with dummy content and interlinked per your map, and a **Rebi
   chat mock showing clickable listing cards + in-response action buttons** (static/CSS is fine — this
   is a UI/UX demo, no real backend needed).
Desktop-first is fine; keep it NFY; reuse the Wave-0 components/tokens where practical (you may inline
for the isolated demo). Verify: `npx astro check` 0 errors; each route returns 200.

## After judging
Alex picks the winner; the winning IA is then implemented in the REAL site (SiteNav/SiteFooter,
contextual buttons, and the Rebi chat cards/action-buttons extending `ChatWidget` + focus-stage while
preserving every `#reb-*`/`data-rebi-*`/`reb:search` contract), with the parity pages built into it.
