# Task brief — Centre the search-results listings within the site gutters

## Problem (from docs/edits-1.txt)
"When Rebi does a search, although we have designed the site to have 55px margins on laptop to make
it full screen, the listings are not centered and they should be." After an AI/Rebi search filters
the inventory to a handful of cars, the results grid left-aligns (empty grid tracks on the right)
rather than sitting centred within the site's gutters.

## Diagnose
- The grid is `.inventory-grid` in `src/styles/global.css` — `grid-template-columns: repeat(auto-fill,
  minmax(min(100%,18rem), 1fr))`. With `auto-fill` + few items, columns fill from the left leaving
  empty tracks → visually left-aligned. Results render via `src/components/filters/InventoryResults.astro`
  inside `.site-container` (index.astro) and are swapped on search into `#inventory-results`.
- Drive it: dev server is on http://localhost:4321. Load `/`, run a search in the AI bar (or apply a
  filter) that returns only 2–3 cars, and observe the left-alignment. Confirm the root cause.

## Fix
- Make a small, few-car result set sit **centred** within the site gutters, WITHOUT changing the full
  inventory layout (a full row must still fill edge-to-edge with the fluid column scaling intact) and
  without breaking mobile (1-col) or ultra-wide behaviour.
- Preferred approach: `justify-content: center` on `.inventory-grid` (a no-op when tracks fill the row,
  centres the track group when they don't) — but VERIFY it doesn't leave cards oddly narrow or break the
  `minmax`/`auto-fill` scaling. If centring the tracks looks wrong (cards too narrow/isolated), consider
  an alternative that keeps card size constant and only centres the group. Use your judgment; the goal
  is "a few results look intentionally centred, a full grid looks unchanged."
- Keep it light-theme, and keep the empty-state + pagination untouched.

## Rules
- `npx astro check` green (before/after; zero new errors). Config-as-data (the 55px gutter system lives
  in `global.css` `--site-gutter`/`.site-container` — reuse it, don't hardcode a new margin). No
  Math.random / module-top-level new Date(). Do NOT commit.

## Verify (drive it)
- Full inventory (`/`) still fills the row / scales as before.
- A filtered search returning 2–3 cars now centres within the gutters. Curl + note; ideally screenshot.

## Report
Concise: root cause, the exact CSS change (file:line), before/after behaviour for full vs few results,
astro check before/after.
