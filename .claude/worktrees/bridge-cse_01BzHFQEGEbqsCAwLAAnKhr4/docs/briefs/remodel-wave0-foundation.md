# Remodel Wave 0 — Foundation (design layer + Smart Hubs nav + full-directory footer)

READ `docs/briefs/REMODEL-BRIEF.md` FIRST — it is the definitive spec. Base design = **inline-contextual**;
the **top nav = smart-hubs mega-menu**; preserve every AI mechanic; config-as-data; light-theme.

This wave builds the shared shell only (no page reskin). Because every real page already imports
`SiteNav`/`SiteFooter`, upgrading those two components rolls the new top nav + footer out site-wide.

## Read (design sources)
- `src/pages/concepts2/inline-contextual/_shell/Layout.astro` — the `.entry`/`.entry-rail`/`.entry-origin`
  affordance + page helpers (`.hero-wrap`, `.grid-auto`, `.facet`, `.slider`, `.field`, `.divider`) to port.
- `src/pages/concepts2/inline-contextual/_shell/Footer.astro` + `IA.md` — the full-directory footer
  (Shop / Buy & own / Service & parts / Dealership).
- `src/pages/concepts2/smart-hubs/_shell/Nav.astro` + `_shell/data.ts` (the `hubs` model) — **the top nav
  to build** (this is the one thing from smart-hubs).
- Current real components you are REBUILDING: `src/components/site/SiteNav.astro`, `SiteFooter.astro`
  (both already `dealerConfig`-driven — keep that pattern). Real chat seam: the ChatWidget opens on a
  `[data-rebi-open]` click (preserve).

## Build
1. **Design layer** — add the inline-contextual `.entry*` affordance + the page helpers (above),
   **un-namespaced + token-driven**, to the shared stylesheet (`src/styles/theme.css` or `global.css` —
   your call; must be available to every page). These are the signature of the whole IA; later waves use
   them heavily.
2. **`src/config/nav.ts`** — the nav model as **config-as-data** (no dealer literals; read dealer bits
   from `~/config/dealer`). The Smart Hubs 3-hub model: `browse`, `buy-own`, `service-parts`, each
   `{ key, label, tagline, href, items:[{label,href,icon,blurb}] }`; plus the footer directory columns
   (Shop / Buy & own / Service & parts / Dealership) per inline-contextual's IA.
3. **`SiteNav.astro`** — rebuild as the **Smart Hubs mega-menu**: brand → 3 hub triggers (each opens a
   mega-menu panel of its items w/ blurbs) → right side **"Ask Rebi"** (`<button data-rebi-open
   data-rebi-kind="nav">`, opens the real ChatWidget — NOT a link) + **"Browse inventory"** CTA. Port the
   mockup's mega-menu look, integrated with the NFY tokens.
4. **`SiteFooter.astro`** — rebuild as inline-contextual's full-directory footer (every page grouped into
   the 4 columns), config-driven, + brand blurb + a Rebi CTA.

## REAL hrefs (link to what works now; new routes 404 until their wave — link anyway)
- **Browse hub → the EXISTING home grid via filter URLs (work today):** All inventory → `/#inventory` ·
  New & Demo → `/?condition=new,demo#inventory` · Used → `/?condition=used#inventory` · Electric →
  `/?fuelType=electric,hybrid#inventory` · Shop by brand → `/#inventory`. The primary "Browse inventory"
  CTA → `/#inventory`. (Confirm the home page SSR-filters these params via `parseFilters` — it does.)
  *(Wave 1 will repoint these to `/listings` when the grid moves there.)*
- **Buy & Own →** Trade-in `/trade-in` (EXISTS) · Finance `/finance` · Offers `/offers` · Sell `/sell` ·
  Test drive `/test-drive`.  **Service & Parts →** Service `/service` (EXISTS) · Parts `/parts` · Fleet `/fleet`.
- `/finance /offers /sell /test-drive /parts /fleet` are built in later waves — they 404 for now; DO NOT
  build them here.

## Productionise the nav (the mockup is demo-only — this is the real value-add)
- **Mobile menu** (the mockup hides all hubs below 900px with NO hamburger): add a hamburger →
  accordion of the 3 hubs + items + Ask Rebi + CTA.
- Click/tap to open a hub panel (not hover-only), `aria-expanded`, Escape closes, outside-click closes,
  focus into panel; keep desktop hover as enhancement; visible focus rings.

## Constraints (bind)
- Config-as-data; all nav/footer content from `src/config/nav.ts` + `dealerConfig`.
- Do NOT touch any inventory/filter/`stage-engine`/ChatWidget/compare seam — only these shell files +
  the shared CSS. Preserve `data-rebi-open`. Light-theme. `astro check` 0 errors.

## Verify (DRIVE it, don't just typecheck)
`astro dev --background`, then on the real home page: nav renders in the NFY/inline-contextual style;
each hub opens its mega-menu via click AND hover; Escape/outside-click close; the mobile menu works at
narrow width; the Browse-hub filter links load the filtered grid; "Browse inventory" loads the grid;
"Ask Rebi" opens the chat widget; the footer directory renders. Report `astro check` + what you drove.
Do NOT commit — I review and commit.
