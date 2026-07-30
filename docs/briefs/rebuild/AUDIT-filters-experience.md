# Reskin Audit — Filter System & Experience Mode (markup↔JS contract to PRESERVE)

> The whole filter feature rests on one invariant: **the URL is the single source of truth.**
> Every filter surface builds a URL → calls `applyFilterUrl` → the helper swaps ONE DOM node
> (`#inventory-results`). A reskin is safe ONLY if it preserves (a) the URL contract, (b) the exact
> set of DOM ids/classes/data-attributes the JS queries by, and (c) byte-identical rendering of the
> swappable region between `index.astro` and `/partials/inventory`. **The no-JS SSR path keeps
> working even when the swap breaks — so these breaks are invisible in a static screenshot.**

## Two render paths (must render `#inventory-results` IDENTICALLY)
- **Hard SSR** — `src/pages/index.astro`: `parseFilters` → `buildListingsQuery` → Sanity fetch →
  renders `<FilterDrawer>` (persistent, outside swap) + `<InventoryResults>` (swappable).
- **Partial swap** — `src/pages/partials/inventory.astro` (`partial = true`): SAME pipeline, renders
  ONLY `<InventoryResults>`. Fragment must be byte-for-byte what a hard load produces.

## CRITICAL DOM contract (renaming any of these breaks behaviour silently)
| Selector / attribute | Read by | Produced in | Role |
|---|---|---|---|
| `#inventory-results` (id on OUTER node) | `filter-url.ts` (replaceWith), SearchDock, ChatWidget | `InventoryResults.astro` + partial | **The single swap target.** Must be identical across both paths. |
| `[data-results-count]` **text** | SearchDock scrapes with regex `/of ([\d,]+)/` and `/No vehicles match/i` | `InventoryResults.astro` count `<p>` | SearchDock reads the true total by scraping the COPY STRING. Re-wording ("N results") makes it read 0. Keep wording "Showing X–Y of N vehicles" / "No vehicles match your filters". |
| `#filters-trigger` + `[data-filter-count]` | `filter-url.ts` updateBadge; SearchDock `.click()`s it | `index.astro` button; `FilterDrawer` `triggerId` | Filter badge + drawer open trigger. |
| `a[data-filter-chip]`, `a[data-filter-clear]`, `a[data-page-link]` (must stay `<a href>`) | FilterDrawer delegated document click → `applyFilterUrl` | `ActiveFilterChips.astro`, `InventoryResults.astro` | Chip-remove / clear / pagination enhancement. Badge counts `[data-filter-chip]` INSIDE `#inventory-results`. |
| input/select `name="…"` = URL param names: `bodyType,colour,transmission,fuelType,driveType,seats,condition` (checkboxes) · `priceMin,priceMax,yearMin,yearMax,odoMax,sort` | FilterDrawer `syncFormFromUrl`/`urlFromForm` (hard-codes `MULTI`/`RANGES` arrays), `parseFilters`/`serializeFilters` | `FilterDrawer.astro` fieldsets | **The `name` attributes ARE the URL params.** Do not rename. |
| `dialog[data-filter-drawer]`, `form[data-filter-form]`, `[data-drawer-close]`, `[data-default-sort]`, `[data-open]`, `data-trigger` | FilterDrawer inline script | `FilterDrawer.astro` | Drawer open/close/animate, form→URL. |
| `[data-save-search-*]` (region/panel/toggle/form/email/submit/status), `data-label`, `data-error` | `InventoryResults.astro` script (delegated on `document`, `window.__saveSearchBound`) | `InventoryResults.astro` | Save-this-search panel (lives inside the swapped node). |
| `.inventory-grid` + `--result-cols` CSS var | grid CSS | `InventoryResults.astro` `<section>` | Grid hook. |

**Delegation rule:** because `#inventory-results` is replaced wholesale on each change, ALL listeners
for things inside it are delegated on `document` and guarded by `window.__*Bound` flags. A reskin that
attaches direct listeners on render works once then dies after the first swap.

## Extra (non-obvious) consumers of the filter DOM — reskin must check these too
- `src/components/search/SearchDock.astro` (hero AI search): imports `applyFilterUrl`, drives
  `#inventory-results`, clicks `#filters-trigger`, scrolls `#inventory-heading`, **regex-scrapes
  `[data-results-count]`**, and mutates the grid node's inline `opacity`/`transform` for a fade.
- `src/components/widgets/ChatWidget.astro` (Rebi): imports `applyFilterUrl`, checks `#inventory-results`
  presence to decide "apply to grid" vs "navigate".

## Client helper — `src/lib/client/filter-url.ts`
`applyFilterUrl(url,opts?)`: `pushState` → `updateBadge` → `fetch('/partials/inventory'+search, {headers:{'X-Requested-With':'fetch'}})` → DOMParser → `getElementById('inventory-results')` → `replaceWith` → `updateBadge`; falls back to full nav on failure. Module `seq` supersedes slow applies; `popstate` re-applies (guarded by `window.__filterUrlPopstateBound`).

## Supporting libs (pure logic, reskin-safe): `listings-query.ts`, `listing.ts` (LISTING_FIELDS +
inline SVG icon system via `set:html`), `makes.ts`, `vehicle-filter-extract.ts` (`extractFilters`
bridges AI → canonical filter URL via the same `parseFilters`), `saved-search.ts` (D1, fail-open).

## Experience Mode (`/labs/experience` + `/labs/experience-alt`) — isolated, unlinked-except-home-CTA
- **Candidate A** `experience.astro` → `ExperienceCanvas.astro` (framework-free; inline script builds
  all nodes). **Required ids (all-or-nothing — a missing one renders BLANK):** `.xp-root` (+`data-xp`),
  `#xp-canvas`, `#xp-orb`, `#xp-brand`, `#xp-progress`, `#xp-restart`; runtime `.xp-*` classes must
  match the co-located `<style is:global>`. Brain: `experience/matcher.ts` (pure, deterministic).
  (NOTE: the home hero CTA at `index.astro` links here — the run-5 orb-overlap fix lives in this file.)
- **Candidate B** `experience-alt.astro` → `ShowroomTour.tsx` (React island, `client:load`). External
  CSS hooks: animation classes `orb-breathe`, `kb-zoom`, `car-enter`, `more-enter` in the page's
  `<style is:global>`. Brain: `experience-alt/taste.ts` (pure). Lower coupling; restyle freely.

## Reskin rule of thumb
Restyle `ListingCard`/chips/drawer/results freely, BUT preserve every id/`name`/data-attribute above
AND the `[data-results-count]` wording. Verify by DRIVING the flow (apply a filter, use the AI search
dock, ask Rebi to filter) — not just by screenshot.
