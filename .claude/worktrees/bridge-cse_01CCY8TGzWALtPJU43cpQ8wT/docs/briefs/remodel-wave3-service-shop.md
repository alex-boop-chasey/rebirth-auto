# Remodel Wave 3 — Service & Parts + Shop (parts, fleet, electric, brand)

READ `docs/briefs/REMODEL-BRIEF.md` first. Base = inline-contextual; nav/footer/design-layer (Wave 0),
grid at `/listings` (Wave 1), Buy & Own pages (Wave 2) all done. Build these as REAL routes ported from
their mockups, using the real `SiteNav`/`SiteFooter` + `.entry` classes + REAL data/config. Follow the
patterns Wave 2 set (see `src/pages/sell.astro` + `src/pages/api/sell-enquiry.ts` + `src/stubs/sell-enquiry.ts`
and the `dealerConfig.sell` block). `astro check` 0 errors.

## Design sources (read)
`src/pages/concepts2/inline-contextual/{parts,fleet,electric,brand}.astro` + `_shell/Layout.astro` +
`IA.md`. Real data helpers: `src/lib/listing.ts` (`LISTING_FIELDS`), `src/sanity/lib/client`, and how
`src/pages/listings/[slug].astro` queries Sanity.

## Pages to build
1. **`/parts` (`parts.astro`)** — parts enquiry FORM (prefill from `?vehicle=<slug>` → resolve the real
   listing like test-drive did). Backend: stub `src/pages/api/parts-enquiry.ts` + `src/stubs/parts-enquiry.ts`
   per /auto §4 (flag `STUB_PARTS` / cred `PARTS_API_KEY`, deterministic `PARTS-<hash>`, `checkRateLimit`
   distinct `parts:` prefix fail-open, optional fail-open Turnstile, `// TODO_KEYS:` + a `TODO_KEYS.md`
   row). `dealerConfig.parts` config block (enabled, rateLimit, copy). Cross-link `.entry` to `/service`.
2. **`/fleet` (`fleet.astro`)** — fleet/business enquiry FORM → stub `src/pages/api/fleet-enquiry.ts` +
   `src/stubs/fleet-enquiry.ts` (flag `STUB_FLEET` / cred `FLEET_CRM_API_KEY`, deterministic `FLEET-<hash>`,
   `fleet:` limiter, TODO_KEYS row). `dealerConfig.fleet` config block. Cross-link `.entry` to `/contact`
   (business) — that page 404s until Wave 4; link anyway.
3. **`/electric` (`electric.astro`)** — EV hub: educational content (config-driven copy in
   `dealerConfig.electric`) + a strip of **REAL electric/hybrid stock** (query Sanity for
   `fuelType in ["electric","hybrid"]` via `LISTING_FIELDS`, reuse `ListingCard`). The primary CTA hands
   back to the facet: `/listings?fuelType=electric,hybrid`. **Never invent range/cost figures** — only
   show per-vehicle data that exists; generic copy otherwise (determinism).
4. **`/brand/[slug]` (dynamic `brand/[slug].astro`) + `/brand` index (`brand/index.astro`)** — the brand
   hub. The make list comes from **REAL inventory makes only** (distinct `make` from active listings —
   determinism, never a hardcoded brand list). `/brand` lists the real makes (link each to
   `/brand/<slug>`). `/brand/[slug]` runs its OWN make-filtered Sanity query (via `LISTING_FIELDS`) and
   shows that brand's real stock + a "browse all" `.entry` back to `/listings`. Use `getStaticPaths`
   OR `prerender=false` + resolve the slug at request time — your call, but slugs derive from real makes.
   - Do NOT add a `make` param to the core filter contract (`listings-query.ts`) — keep the brand query
     self-contained on the brand pages. Update the nav's "Shop by brand" href (`src/config/nav.ts`) from
     `/#inventory`/`/listings` to `/brand`.

## Constraints (bind)
- **Real data / determinism** — makes from real inventory; EV stock real; no fabricated ranges, costs,
  parts prices, brand lists, or dealer facts. Dealer-specific values from `dealerConfig`; graceful
  placeholder if unset.
- **Config-as-data** — new config only in `src/config/dealer.ts` (parts, fleet, electric blocks +
  interface). **All AI through `src/ai/`**; `data-rebi-open` for Rebi entries; `dealerNotes` never public.
- Stub pattern for parts + fleet endpoints; external integrations stay stubbed. Light-theme; focus rings.
- Do NOT touch grid/filter/SearchDock/ChatWidget/compare seams or Wave-0/1/2 files beyond the additive
  `dealer.ts` config + the one `nav.ts` "Shop by brand" href + TODO_KEYS rows.

## Verify (DRIVE it)
`astro dev --background`: `/parts`, `/fleet`, `/electric`, `/brand`, and `/brand/<a-real-make>` all
return 200 in the inline-contextual style with real nav/footer; `/electric` shows REAL electric/hybrid
listings and its CTA → `/listings?fuelType=electric,hybrid`; `/brand` lists real makes; `/brand/<make>`
shows that make's real stock; drive one submit each of parts + fleet → stub success ref; `?vehicle=`
prefills parts. Report `astro check` (0 errors), what you drove, the new config keys, and TODO_KEYS
rows. Do NOT commit.
