# Dark Precision — structure & how it slots in

> All routes are **additive, unlinked concept mockups** under
> `/concepts/dark-precision/`. Nothing here is wired into the shipped nav, config, or data
> layer. Zero shipped files touched. This mirrors the existing `labs/` isolation pattern.

## Route map

`index.astro` serves at the **folder root** `/concepts/dark-precision` (Astro maps
`index.astro` to the directory, not `/index`). All other pages are `…/<name>`.

| Route | File | Maps to which real surface |
|---|---|---|
| `/concepts/dark-precision` | `index.astro` | Reimagined **home / hero** |
| `/concepts/dark-precision/listings` | `listings.astro` | Reimagined **inventory** + filter panel (New/Demo/Used facets) |
| `/concepts/dark-precision/vehicle` | `vehicle.astro` | Reimagined **vehicle detail** (incl. **Edmunds** expert-review slot) |
| `/concepts/dark-precision/rebi` | `rebi.astro` | Reimagined **Rebi chat** — full 3-column console |
| `/concepts/dark-precision/finance` | `finance.astro` | **NEW** — options + repayment calculator |
| `/concepts/dark-precision/offers` | `offers.astro` | **NEW** — per-brand offers hub |
| `/concepts/dark-precision/electric` | `electric.astro` | **NEW** — EV hub (education + range check + stock) |
| `/concepts/dark-precision/sell` | `sell.astro` | **NEW** — outright-sale intake (distinct from trade-in) |
| `/concepts/dark-precision/parts` | `parts.astro` | **NEW** — genuine parts enquiry |
| `/concepts/dark-precision/fleet` | `fleet.astro` | **NEW** — fleet & business + TCO model |
| `/concepts/dark-precision/about` | `about.astro` | **NEW** — dealership story / team |
| `/concepts/dark-precision/contact` | `contact.astro` | **NEW** — find-a-dealer, departments |
| `/concepts/dark-precision/careers` | `careers.astro` | **NEW** — roles + apply |
| `/concepts/dark-precision/test-drive` | `test-drive.astro` | **NEW** — booking form |
| `/concepts/dark-precision/brand` | `brand.astro` | **NEW** — per-brand landing (Isuzu shown) |

## Shared shell (`_components/`, `_`-prefixed so Astro never routes it)

- `theme.css` — all design tokens + component classes, every rule scoped under `.dp`.
- `Layout.astro` — `<html>` document, Google-Fonts link, imports `theme.css`, renders
  `Nav` + `<slot/>` + `Footer` + `RebiDock`. Props: `title`, `current`, `dockHint`,
  `showDock`.
- `Nav.astro` / `Footer.astro` — one nav, one footer, driven by a link array.
- `RebiDock.astro` — the persistent floating Rebi console (hidden on the full Rebi page).
- `VehicleCard.astro` — reusable listing tile with spec grid + Rebi one-liner.

Each **page** follows the brief's mechanics exactly: `import '../../../styles/global.css';`
(Tailwind utilities, three levels up), `export const prerender = false;`, then composes the
Layout + components. Page-specific layout is inline; the reusable vocabulary lives in
`theme.css`.

## How it would slot into the real site

- **Vehicle-type as first-class facets** — the New/Demo/Used segmented control (`.dp-seg`) on
  listings answers the parity gap where the shipped site has only generic inventory. It maps
  cleanly onto the existing URL-driven filter model (`applyFilterUrl`) — the segment is just
  another filter param, no new state mechanism.
- **Parity pages** (finance, offers, electric, sell, parts, fleet, about, contact, careers,
  test-drive, brand) are the pages BMG has that Rebirth Auto lacks. Each is a real content
  surface that would read from Sanity + `dealerConfig` in production; here they use obvious
  placeholder content.
- **Rebi everywhere** — the dock and the `.dp-ai` / `.dp-insight` blocks are designed to drop
  onto any surface, matching the product's AI-native intent. In production the summaries and
  match scores would come through `src/ai/` tiers, grounded only on the **public projection**
  (`LISTING_FIELDS`), never `dealerNotes` — every AI surface in these mockups is deliberately
  framed as "grounded in verified spec / public data only."

## Additions beyond the audit list

- **Rebi natural-language search bar** on home + listings (over a plain text box) — makes AI
  the primary search affordance.
- **Instrument-cluster vehicle intelligence** on the vehicle page — value-vs-market /
  condition / running-cost / resale gauges rendered as an AI readout.
- **EV range-check + 5-year EV-vs-diesel cost model** on the electric hub.
- **Fleet TCO snapshot** on the fleet page.
- **Smart-lead "warm handoff"** pattern on home and the Rebi console (shortlist + budget +
  finance context travel with the enquiry).
- **Persistent Rebi dock** on every page.

## Constraint compliance

Desktop-only (fixed `width=1440` viewport, no responsive rules) · no JS (CSS-only animation:
scan line, pulse, spin, blink caret) · additive & isolated (only new files under this
folder) · AI prominent on every page · Edmunds attribution slot present on the vehicle page ·
AU spelling, `$`, AU vehicle mix · all content obvious placeholder, no real phone/address
presented as fact.
