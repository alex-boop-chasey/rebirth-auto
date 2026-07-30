# Near-Future Yard — structure & how it slots in

> All routes live under `/concepts/near-future-yard/` and are 100% additive and
> isolated (mirrors the `labs/` isolation pattern). No shipped page, component,
> config, or another theme's folder is touched. Every `.astro` page imports
> `../../../styles/global.css` and sets `export const prerender = false;`.

## Folder layout
```
src/pages/concepts/near-future-yard/
├── _shell/                 # underscore = excluded from routing
│   ├── theme.css           # design tokens + component classes, namespaced .nfy
│   ├── data.ts             # dummy vehicles, brands, formatters, inline icon set
│   ├── Layout.astro        # <html> shell: fonts + Nav + Footer + Rebi dock + slot
│   ├── Nav.astro           # sticky glass nav, "Ask Rebi" entry
│   ├── Footer.astro        # dark footer w/ Rebi CTA
│   ├── RebiDock.astro      # ambient floating assistant (every page)
│   ├── VehicleCard.astro   # reusable card w/ inline AI summary line
│   └── FilterPanel.astro   # inventory facets + "Rebi filter" natural-language box
├── index.astro             # home / hero + AI search + curated stock
├── listings.astro          # inventory w/ filter panel + AI-interpreted search
├── vehicle.astro           # detail + AI summary + Edmunds expert-review slot
├── rebi.astro              # full Rebi chat interface (3-pane)
├── finance.astro           # options + repayment calculator UI
├── offers.astro            # per-brand offers/specials hub
├── electric.astro          # EV/hybrid hub (education + range checker + stock)
├── sell.astro              # outright-sale intake + instant AI valuation
├── parts.astro             # genuine-parts enquiry w/ AI fitment check
├── fleet.astro             # fleet & business + AI TCO snapshot
├── about.astro             # dealership story + "how Rebi fits" + team
├── contact.astro           # find-a-dealer: map, departments, enquiry
├── careers.astro           # roles + register-interest
├── test-drive.astro        # booking flow (steps, time grid, car summary)
├── brand.astro             # per-brand landing hub (Subaru exemplar)
├── DIRECTION.md            # design direction
└── STRUCTURE.md            # this file
```

## Route map (all HTTP 200, dev :4321)
`/concepts/near-future-yard/` + `listings` `vehicle` `rebi` `finance` `offers`
`electric` `sell` `parts` `fleet` `about` `contact` `careers` `test-drive`
`brand`.

## How each maps to the real site
- **Core 4 (reimagined):** `index`, `listings`, `vehicle`, `rebi` re-envision
  surfaces Rebirth Auto already has — home/inventory, detail page, and the Rebi
  chat — with AI promoted from a corner bubble to the spine of the UI.
- **Parity pages (new):** `finance`, `offers`, `electric`, `sell`, `parts`,
  `fleet`, `about`, `contact`, `careers`, `test-drive`, `brand` fill the gaps the
  Bundaberg audit flagged. Wired to nav + footer so the set navigates as one site.
- **Not rebuilt (already shipped):** compare, trade-in valuation, dealer capture,
  accounts/auth, service booking, Experience Mode. `vehicle.astro` links to a
  `/compare` placeholder and `sell.astro` sits alongside (not on top of) the
  existing trade-in flow — sell is *outright sale*, trade-in stays its own thing.

## New facets introduced (beyond the audit)
- **New / Demo / Used as first-class filters** — segmented control in the filter
  panel and a toolbar segment on listings, matching BMG's `vehicleType` facet
  that our generic inventory lacks.
- **Natural-language "Rebi filter"** inside the filter panel — describe stock in
  words as an alternative to clicking facets. Design intent for the AI-assisted
  search the product already promises.
- **Inline repayment estimate** on the vehicle buy-rail and vehicle cards, linking
  through to the full finance calculator — connecting inventory to finance.
- **Ambient Rebi dock** on every page (except the full chat page) with a
  context-specific opening prompt per page — the visual expression of
  "AI is core, not an extra."

## Integration notes for a real build
- Tokens in `_shell/theme.css` are the themeable seam — they'd map onto the
  dealer config (colours, type) rather than being hardcoded per component.
- `VehicleCard`, `FilterPanel`, `Nav`, `Footer` are already prop-driven shells;
  in production they'd read `LISTING_FIELDS` projections and `dealer.ts` config.
- The Edmunds block on `vehicle.astro` is a clearly-marked attribution slot
  ("Review by Edmunds", score tiles, external link, disclaimer) ready to receive
  syndicated expert-review data.
- **Private-data boundary respected in the design:** every AI surface is framed as
  grounded on *public* listing data + expert reviews only; nothing surfaces or
  implies private dealer notes or shopper finances.
