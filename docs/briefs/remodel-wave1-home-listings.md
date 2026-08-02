# Remodel Wave 1 — Home front-door + /listings (grid move) + vehicle detail

READ `docs/briefs/REMODEL-BRIEF.md` first. Base = inline-contextual; top nav already done (Wave 0);
**preserve every AI/filter/compare mechanic**; config-as-data; light-theme. HIGHEST-RISK wave — the
grid/filter/SearchDock contract MOVES and must survive intact (SSR renders even when broken — verify by
DRIVING it).

## Design sources (read)
- `src/pages/concepts2/inline-contextual/index.astro` — the front-door home design (AI search, facet
  chips, offers strip, featured, Rebi band).
- `src/pages/concepts2/inline-contextual/listings.astro` — the listings/grid design.
- `src/pages/concepts2/inline-contextual/vehicle.astro` — the vehicle detail design (inline `.entry`
  jumps: finance-from-price, test-drive, trade-in, parts).
- CURRENT real pages you are restructuring: `src/pages/index.astro` (has the grid+filters+SearchDock
  today) and `src/pages/listings/[slug].astro` (vehicle detail).

## PRESERVE-CONTRACT (non-negotiable — from REBUILD-PLAN + run 6; verify by driving)
- Grid swap: `#inventory-results` markup **identical** in the listings page AND
  `src/pages/partials/inventory.astro`; the `[data-results-count]` **wording** ("Showing X–Y of N
  vehicles" / "No vehicles match your filters" — the dock regex-scrapes it); `#inventory-heading`;
  `#filters-trigger` + `[data-filter-count]`.
- Filter input `name`s = URL params (`bodyType,colour,transmission,fuelType,driveType,seats,condition,
  priceMin,priceMax,yearMin,yearMax,odoMax,sort`); `a[data-filter-chip|data-filter-clear|data-page-link]`
  stay anchors; document-delegated listeners + `window.__*Bound` guards; save-search `[data-save-search-*]`.
  Filter state ONLY via `applyFilterUrl`.
- SearchDock (`src/components/search/SearchDock.astro` = the SmartSearch island) IDs `#search-dock*` +
  `.focus-stage`; the shared `stage-engine.ts` classes; the `/api/search` + query-planner flow — ALL
  unchanged. You are relocating the component, not editing its mechanics.
- Vehicle detail: keep compare seams (`data-compare-*`), journey `sendBeacon`, `AskRebiButton`
  (`data-rebi-*`), the AI-summary, and the Edmunds expert-review slot.

## Build
1. **`/listings` (NEW real route `src/pages/listings/index.astro`)** — the full inventory experience:
   move the grid + filters + SearchDock + `partials/inventory` wiring here VERBATIM from today's
   `index.astro`, reskinned to the inline-contextual `listings.astro` look (facet chips, the `.facet`
   sidebar, `.entry` jumps like "Electric hub" from the fuel facet, "Shop by brand"). Real Sanity
   inventory via the existing query. **This page owns the preserved contract.**
2. **Home (`/` = `src/pages/index.astro`)** — becomes the inline-contextual front-door: a lightweight AI
   search input that **navigates to `/listings`** carrying the query (do NOT run the in-place grid here;
   the real SearchDock/grid lives on `/listings`), facet chips (link to `/listings?<param>`), a featured
   strip of REAL listings, an offers teaser (link `/offers`), and the Rebi band (`data-rebi-open`). No
   full grid on home.
   - The home search → `/listings`: simplest faithful wiring is a `<form>`/input that routes to
     `/listings?q=…` (or applies via the listings SearchDock on load). Keep it simple; the real
     planner/search runs on `/listings`. If you route a raw query, `/listings` should feed it to the
     same search flow. Preserve `applyFilterUrl` as the only filter-URL writer.
3. **Vehicle detail (`src/pages/listings/[slug].astro`)** — reskin to the inline-contextual look and add
   the inline `.entry` contextual jumps (finance-from-price with the car prefilled where the target
   supports it, test-drive, trade-in, parts-for-this-model) using the `.entry` classes from Wave 0.
   Targets `/finance /test-drive /trade-in /parts` (some 404 until their waves — link anyway). Preserve
   ALL existing seams listed above.

## Constraints
- Real data only (no fabricated cars/prices — determinism). All AI through `src/ai/`; `dealerNotes`
  never public. Config-as-data. Light-theme. `astro check` 0 errors.
- Do NOT edit `stage-engine.ts`, `stage.css`, `SmartSearch.tsx`/`SearchDock.astro` internals, the API
  routes, `partials/inventory.astro`'s grid markup contract, or ChatWidget.

## Verify (DRIVE it — the whole point of this wave)
`astro dev --background`, then:
- `/` renders the front-door (no full grid); the search input navigates to `/listings` with the query;
  facet chips go to `/listings?<param>` and show filtered stock; featured shows real cars.
- `/listings`: grid renders real stock; **apply a filter → grid swaps, URL updates, count wording
  matches, chips work, pagination works** (drive it, don't just load it); the SearchDock AI search runs
  and updates the grid+count; save-search works.
- Vehicle detail: renders; inline `.entry` jumps present; compare tag + "Ask Rebi" + journey beacon
  intact.
Report `astro check` + exactly what you drove (esp. the filter swap + count wording on `/listings`).
Do NOT commit — I review and commit.
