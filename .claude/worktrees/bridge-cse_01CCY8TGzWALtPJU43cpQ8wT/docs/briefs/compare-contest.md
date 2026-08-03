# Contest brief — Comparison table redesign (shared context for all 3 agents)

A 3-agent SEQUENTIAL design contest (per todo.md). Each agent builds a genuinely distinct,
better comparison-experience candidate that tries to OUTDO the previous one. **No critic agent** —
all three are designers. The **owner is the judge**. The orchestrator synthesizes the winner.

## What you're redesigning
The vehicle comparison experience — where a shopper compares 2-4 cars side by side and decides.
The CURRENT shipped version lives at `/compare` (`src/pages/compare.astro`) with the verdict logic
in `src/lib/compare-verdict.ts` (scored dimensions + lenses + a "verdict board"). Read both to
understand the data and the current design you must beat.

## Hard rules for every candidate
- **Do NOT modify** `/compare`, `src/pages/compare.astro`, `src/components/CompareTray.astro`, or
  `src/lib/compare-verdict.ts`. Reuse them READ-ONLY. Your candidate is ADDITIVE, at its own route
  `src/pages/compare-lab/<N>.astro` (N = your agent number), with its own components under
  `src/components/compare-lab/`.
- **Real data, directly viewable:** the page must render populated with REAL vehicles so the owner
  can just open the URL. Reuse the same Sanity data-loading as `compare.astro` (LISTING_FIELDS) and
  the `compare-verdict.ts` scoring. If no `?ids=` are supplied, DEFAULT to the first 3 real active
  listings so the page is never empty. Include `fuelEconomy` now that it exists.
- **Design bar — world-class, on-brand.** Match the site's premium aesthetic: full-width, the
  "boxless / dream" feel, the Rebi glow, refined typography, tasteful motion. Study `index.astro`,
  `src/components/search/SearchDock.astro`, and `src/components/widgets/ChatWidget.astro` for the
  visual language. This should feel like the best car-comparison experience in the market, not a
  spreadsheet.
- **"AI as the interface" (the product's core lens):** include a natural "Ask Rebi to help me
  decide" entry point using the existing `AskRebiButton` (`data-rebi-kind="compare"`) — the chat
  wiring already exists; reuse it, don't rebuild it.
- **Freedom:** you MAY add extra features, interactions, content, and animations (highlight-the-
  winner, difference-only toggle, spec-category collapsing, sticky headers, per-dimension reveals,
  a "why this one" narrative, etc.). Bolder-but-cohesive beats conservative. But every number shown
  must come from REAL data via the existing helpers — never fabricate a spec or a price.
- Mobile-responsive (comparison on a phone is hard — solve it well). Theme-aware (light/dark).
  `npx astro check` must stay green (report before/after). No `Math.random` / module-top-level
  `new Date()`. Do NOT commit.

## Deliverable + report
Build the candidate at `/compare-lab/<N>`, verify it renders (the dev server is running on :4321 —
curl it). In your report, describe: the CONCEPT in one line, the 3-5 distinctive moves that make it
better than the current `/compare` (and, for agents 2 & 3, better than the prior candidate), any
new interactions/animations, and the astro check before/after. This report is what the owner reads
to judge — make the distinctive ideas legible.
