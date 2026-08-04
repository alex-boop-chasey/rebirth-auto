# Rebirth Auto — Near-Future Yard Rebuild Plan (master)

**Goal:** re-skin the SHIPPED site to the Near-Future Yard (NFY) visual language while keeping the
current fonts and preserving 100% of the AI engine + interactive behaviour. Branch:
`redesign/near-future-yard`. This is a **re-skin of working pages**, not a paste of the static
mockups. The 3 contest mockups under `src/pages/concepts/` STAY as the visual reference — do not
delete or alter them.

**Inputs:** `AUDIT-filters-experience.md` + `AUDIT-ai-endpoints.md` (the behaviour/DOM contracts that
must survive — READ BOTH before touching a surface) and the NFY concept at
`src/pages/concepts/near-future-yard/` (visual target; tokens in `_shell/theme.css`).

## Locked decisions (orchestrator)
1. **Fonts — keep current.** The shipped site declares NO custom font: it uses the Tailwind/browser
   default sans (system-ui stack). So the rebuild introduces **NO Google Fonts**. Map NFY's type
   ROLES onto the current sans: display/heading/body/ui → the default `font-sans`. The NFY "mono"
   accent (eyebrows, labels, footer headers) → a **system `ui-monospace` stack** (no imported font)
   — keeps the near-future feel without adding a font. Drop Space Grotesk / JetBrains Mono / Inter.
2. **Width system — keep the site's.** Preserve `.site-container` (`--site-gutter` 16→55px,
   `--site-max: 2400px`) and `.inventory-grid` in `src/styles/global.css`. Do NOT hardcode NFY's
   `1440px` mockup width — the real site is responsive/near-full-width. Apply NFY tokens WITHIN the
   existing width system. (Reskin may keep a comfortable content max on marketing sections, but the
   inventory grid + gutters stay.)
3. **Tokens — real, themeable, un-namespaced.** Port the NFY palette/depth/radii/gradients into
   `global.css` as `:root` CSS custom properties + Tailwind v4 `@theme` mapping (so utilities and
   components share them). NOT the throwaway `.nfy`-namespaced concept CSS. Palette (from
   `_shell/theme.css`): bg `#F5F8FC`, surface `#FFFFFF`, ink `#0D1626`, ink-soft `#47566B`,
   teal `#0FB5A6`, indigo `#5566F0` (Rebi/AI), amber `#E0813B` (local/offers), aurora gradient
   `linear-gradient(115deg,#0FB5A6,#2E86E4,#5566F0)`, shadows sh-1/2/3 + glow, radii 10/16/22/30/pill.
   (Future: accent could be driven from `dealerConfig` for multi-tenant — note only, not now.)
4. **Light-theme standard is satisfied** (NFY is light-first) — no conflict with CLAUDE.md.
5. **Shared components are an improvement, additive.** The shipped site has no shared layout (each
   page inlines its `<html>`). Introduce real reusable `SiteNav` + `SiteFooter` + primitives and adopt
   them page-by-page. Config-as-data: nav/footer labels + dealer values from `dealerConfig`.

## NON-NEGOTIABLE preserve-contract (from the audits)
Reskin visuals only; keep every one of these or behaviour breaks silently (SSR still renders, so
screenshots won't catch it — **verify by driving the flow**):
- Grid swap: `#inventory-results` (identical markup in `index.astro` AND `partials/inventory.astro`),
  the `[data-results-count]` **wording** ("Showing X–Y of N vehicles" / "No vehicles match your
  filters" — SearchDock regex-scrapes it), `#inventory-heading`, `#filters-trigger` + `[data-filter-count]`.
- Filter form input `name`s = URL params (`bodyType,colour,transmission,fuelType,driveType,seats,
  condition,priceMin,priceMax,yearMin,yearMax,odoMax,sort`); `a[data-filter-chip|data-filter-clear|
  data-page-link]` stay anchors; document-delegated listeners + `window.__*Bound` guards; save-search
  `[data-save-search-*]`. Filter state ONLY via `applyFilterUrl`.
- Rebi widget guard IDs (all required): `#reb-chat,#reb-launcher,#reb-panel,#reb-close,#reb-log,
  #reb-column,#reb-live,#reb-form,#reb-input,#reb-send` + `.reb-open`/`.reb-dreaming`.
- SearchDock guard IDs `#search-dock*` + `.focus-stage` on its column.
- Shared AI seams: `data-rebi-open`/`-kind`/`-ref(s)`/`-title` attribute contract; the `reb:search`
  DOM event; the shared `stage-engine.ts` classnames (`.turn/.card/.bubble/.body/.name/.avatar/.word/
  .dots/.actions/.newsearch`) + `.focus-stage` — **shared by SearchDock AND ChatWidget** (single owner).
- Compare: `data-compare-toggle`+`data-id/-category/-title/-thumb`, `data-compare-label/-remove/-clear`,
  `aria-pressed`/`disabled`-driven styling, `localStorage['astro-listings-compare(-meta)']`; compare-tools
  `c3-*` classes + `data-dim/-weight/-score/-seg-dim/-car-id/-remove/-bar` + `--dc/--fill/--sc`.
- Experience Mode Candidate A ids `.xp-root`/`data-xp`,`#xp-canvas/#xp-orb/#xp-brand/#xp-progress/
  #xp-restart` + `.xp-*` classes (all-or-nothing). Candidate B anim classes `orb-breathe/kb-zoom/
  car-enter/more-enter`. **The run-5 orb-overlap fix lives in ExperienceCanvas.astro — keep it.**
- All AI through `src/ai/`; `dealerNotes` never public; endpoint request/response shapes unchanged;
  journey `sendBeacon` scripts preserved on listing + compare pages.
- **Do NOT alter `src/pages/concepts/`** (the contest mockups) or any API endpoint logic.

## Build waves — ≤3 agents at a time, foundation FIRST
**Wave 0 — Foundation (1 agent, solo, everything depends on it).**
Add the NFY token layer to `global.css` (`:root` custom props + Tailwind `@theme`, keep the existing
width/grid/focus-ring blocks), define the type roles on the current sans + ui-monospace, and build the
real reusable components + primitives: `SiteNav.astro`, `SiteFooter.astro`, and CSS/utility primitives
for button/card/glass/chip/eyebrow/ai-badge/orb/ai-summary/scan/section (ported from `_shell/theme.css`
but un-namespaced and driven by the tokens). Wire `dealerConfig` for nav/footer content. NO page reskin
yet. Verify: `astro check` green; a throwaway/manual check that the tokens+components render. Commit.

**Wave 1 — Core surfaces (≤3 agents, disjoint file ownership).**
- **Agent A — Home + inventory + filters:** `index.astro`, `partials/inventory.astro`,
  `components/filters/{InventoryResults,FilterDrawer,ActiveFilterChips}.astro`, `components/ListingCard.astro`,
  and the visual chrome of `components/search/SearchDock.astro` (use `.focus-stage`/stage classes but do
  NOT edit `stage.css`). HIGHEST RISK — preserve the entire grid/filter/searchdock contract above.
- **Agent B — Vehicle detail + compare:** `listings/[slug].astro` (+ **add the Edmunds "Expert review"
  attribution slot** and NFY AI-summary), `compare.astro`, `compare-tools.astro`, `components/CompareTray.astro`,
  `components/compare/{Contender,Dial}.astro`, `components/AskRebiButton.astro`. Preserve compare `c3-*`/
  `data-compare-*`/`data-rebi-*` + journey beacon.
- **Agent C — Rebi chat + shared stage:** `components/widgets/ChatWidget.astro`, `styles/rebi.css`,
  `components/search/stage.css` (SINGLE OWNER of the shared stage CSS). Reskin panel/launcher/stage to NFY
  tokens; preserve all `#reb-*` ids + `data-rebi-*` seam + stage classnames.

**Wave 2 — Secondary surfaces (≤3 agents).**
- Auth set (`login/signup/account/reset-password/check-email` + `layouts/AuthLayout.astro` +
  `components/auth/AuthCard.astro`) — keep Turnstile + action wiring.
- Forms (`service.astro`, `trade-in.astro`) + `404.astro` — keep POST field contracts.
- Capture PWA (`capture/index.astro`) — optional; keep endpoints + guard.

**Wave 3 — New parity pages (additive, ≤3 agents), OPTIONAL/secondary.**
Add the NFY parity pages as REAL routes with dummy/config content (finance+calculator, offers, electric,
sell, parts, fleet, about, contact, careers, test-drive, brand). Config-as-data; AI-prominent; reuse the
Wave-0 components. Only after the core reskin is proven.

## Per-surface verification (every wave)
`astro check` green AND **drive the behaviour** on the dev server: apply a filter (grid swaps, URL
updates, chips work), run AI search from the dock (grid + count update), open Rebi and send/stream a
message, tag 2 cars → compare → ask Rebi to pick, submit a form. Screenshot for looks; drive for
behaviour. Commit per completed surface; push the branch.

## Sequencing
Wave 0 solo → review/commit. Then Wave 1 (≤3 parallel, disjoint files) → review each + drive flows →
commit. Then Wave 2, then Wave 3. Never more than 3 agents at once (owner constraint).
