# Smart Hubs remodel — Phase 1 plan (for owner sign-off)

**Ask:** completely remodel the shipped site to the **Smart Hubs** IA/navigation
(`/concepts2/smart-hubs`), including its top menu, while (a) keeping the docs' hard constraints and
(b) keeping every AI tool's mechanics identical. (Both URLs in the request were `smart-hubs`, so Smart
Hubs is the source for both the design and the top menu — flag if you meant a different menu.)

This is Phase 1 only — investigation + plan. **No code ships until you approve.** Under /auto the
two-phase gate binds: a whole-site remodel cannot self-approve.

---

## 1. What the remodel actually is — three streams converging

| Stream | State today | This remodel |
|---|---|---|
| **NFY visual skin** | ✅ Done (Wave 0–2 on `redesign/near-future-yard`): tokens in `global.css`/`theme.css`, shared `SiteNav`/`SiteFooter`, all core pages reskinned. | Reused as the skin. Not re-done. |
| **Smart Hubs IA** | A dummy mockup (`/concepts2/smart-hubs`): 3-hub nav, HubBar, breadcrumb, department consolidation, contextual chips, `/rebi` navigator. No real wiring. | **The new work** — port the IA onto the real site + build ~15 real pages. |
| **AI mechanics** | Shipped + working; the query planner + free-model tiers just landed on **`main`**. | **Preserved, not rebuilt** — and `main`'s AI work must be brought into the remodel branch. |

**So the job is:** lay the Smart Hubs IA over the NFY-skinned site, wire its pages to real
inventory/AI/forms, and preserve 100% of the AI + interactive behaviour.

## 2. The branch problem (needs a decision — Wave A)

`redesign/near-future-yard` has the NFY reskin **but is missing what just merged to `main`**:
`src/ai/search/query-planner.ts`, the `chat.search.planner` config + kill-switch, the free-model
`tiers.ts` (it still has the paid-Haiku "demo flip"), and the run-6 search work. `main` conversely
lacks the entire NFY reskin.

**Recommended:** **merge `main` → `redesign/near-future-yard`** first (Wave A), reconciling the overlap
(`api/search.ts`, `tiers.ts`, `dealer.ts`, `lib/ai-search/*`), so the remodel is built on one branch
that has both the skin and the current AI. Then the whole remodel merges back to `main` when proven.
Expected conflicts are localised and manageable; I'll resolve them as the first wave and verify with
`astro check` + driving search/chat.
*Alternative (not recommended): cherry-pick just the planner — more fiddly, leaves the branches
diverged longer.*

## 3. IA mapping — every current route → Smart Hubs

| Current route | Smart Hubs home | Notes |
|---|---|---|
| `/` (home = AI search **+ inventory grid + filters**) | **Home = front door** (AI search + brand/EV chips + 3 hub cards + featured + Rebi band). Grid/filters MOVE to `/browse`. | Highest-risk change (§5). SEO: home stops being the inventory index — needs canonical/redirect handling. |
| inventory grid + `New/Demo/Used` | **`/browse` hub** — condition **tabs** (not pages) + facets + brand/EV chips | tabs map to the `condition` URL param via the existing filter contract |
| `/listings/[slug]` (vehicle) | **Vehicle detail** (supporting) — add contextual finance-from-price, test-drive, trade-in, Rebi | keep compare/journey/Rebi seams |
| `/trade-in` | **Buy & Own** hub child | exists; reskin-in-place + HubBar/breadcrumb + sell cross-link |
| `/service` | **Service & Parts** hub child | exists; reskin-in-place + HubBar + parts cross-link |
| `/compare`, `/compare-tools` | reached from Browse results + vehicle + Rebi | keep the whole compare contract |
| `/account`, auth | unchanged (AuthLayout); linked from footer/utility | not part of the hub nav |
| `/capture` (dealer PWA) | unchanged; own shell | out of shopper IA |
| **NEW** (don't exist as real routes) | `/browse` hub, `/buy-own` + `/service-parts` hub landings, `/finance`, `/offers`, `/electric` (EV hub), `/sell`, `/parts`, `/fleet`, `/about`, `/contact`, `/careers`, `/test-drive`, `/brand/[slug]`, `/rebi` | §5 — build + wire |

Footer holds the long tail (About, Careers, Contact) + a mirror of every hub's links. Brands and EV
are **chips under the AI search bar**, never top-nav items.

## 4. The top menu + shared components (production hardening)

The Smart Hubs nav is **demo-only** and must be productionised, then adopted site-wide (replacing the
current flat `SiteNav`):
- **Mega-menu nav** — 3 hub triggers + "Ask Rebi" + "Browse inventory" CTA. Needs **JS toggle,
  `aria-expanded`, keyboard nav (arrows/Escape/focus-trap), and a real mobile menu** (the demo hides
  all hubs below 900px — unacceptable for a shipped site).
- **HubBar** (sibling drill-in strip), **breadcrumb**, **hub-page layout**, footer 4-column, RebiDock
  (reuse the existing ChatWidget launcher rather than a second orb).
- **Config-as-data:** the hub taxonomy (the 3 hubs, their items, labels, links, footer columns) moves
  from the mockup's hardcoded `data.ts` into **`dealerConfig`** (or a central `src/config/nav.ts`
  reading `dealerConfig`), so it's tenant-overridable and honours the config-as-data rule. Current
  `SiteNav`/`SiteFooter` are already config-driven — extend that model to hubs.

## 5. New real pages + wiring (with stubs where a backend is missing)

| Page | Real data / wiring | Backend |
|---|---|---|
| `/browse` hub | move the real grid + filters + SearchDock; condition tabs → `condition` param | existing (preserve contract) |
| `/electric` EV hub | educational content (config) + **filtered real stock** (`fuelType=electric,hybrid` via existing filter) | existing |
| `/brand/[slug]` | dynamic route; brand list derived from **real inventory makes**; brand-filtered stock | existing (determinism: only real makes) |
| `/finance` (+ calculator) | client-side repayment calc; rates from `dealerConfig` (no fabricated lender data) | client + config |
| `/offers` | config-driven deals **or** a Sanity `offer` type — **owner decision**; no fabricated prices | config/CMS |
| `/test-drive` | booking form | reuse/extend `/api/book-service` pattern |
| `/sell`, `/parts`, `/fleet`, `/contact`, `/careers` | enquiry forms | **NEW stub endpoints** per /auto §4 (`src/stubs/*`, flag-gated, `TODO_KEYS` row) — no real email/PII |
| `/about`, `/contact` | dealer facts (phone/hours/address/ABN) | **from `dealerConfig`/`businessInfo` only** — these are the owner-blocked real facts; until supplied, clearly-placeholder-gated, never shipped as real (determinism rule) |
| `/buy-own`, `/service-parts` | hub landings (cards from the config hub model) | static/config |
| `/rebi` | full-page navigator reusing the **real** chat mechanics + navigator affordances (clickable cards, action chips, "take me to" jumps) | existing chat API + `src/chatbot/**` |

The mockup's "(demo)" phone/email/ABN/deals must **never** ship as if real — they come from config or
stay visibly placeholder (Decision-level determinism).

## 6. Preserve-contract (non-negotiable — from REBUILD-PLAN + run 6)

Every one of these must survive (SSR still renders if broken — **verify by driving the flow**):
- **Grid/filter/SearchDock** contract when moved to `/browse`: `#inventory-results` (identical in the
  page **and** `partials/inventory.astro`), `[data-results-count]` **wording**, `#inventory-heading`,
  `#filters-trigger`/`[data-filter-count]`, all filter input `name`s = URL params, `applyFilterUrl` as
  the ONLY filter-URL path, the `seq`/popstate guards.
- **Rebi** `#reb-*` IDs + `data-rebi-open`/`-kind`/`-ref(s)`/`-title` seam + the `reb:search` event +
  shared `stage-engine.ts` classnames (shared by SearchDock **and** ChatWidget).
- **Compare** `c3-*` + `data-compare-*` + `localStorage` keys + journey beacons.
- **All AI through `src/ai/`**; endpoint request/response shapes unchanged; `dealerNotes` never public;
  the run-6 query planner + free-model tiers preserved; **light-theme** (NFY is light — satisfied).
- Do **not** alter `src/pages/concepts/**` or `src/pages/concepts2/**` (the mockups stay as reference).

## 7. Proposed execution phasing (Phase 2 — after approval)

Waves, ≤3 agents each, disjoint file ownership, `astro check` + drive-the-flow + commit per surface:
- **Wave A — Converge branches.** Merge `main`→`redesign/near-future-yard`; reconcile AI overlap;
  verify search/chat. (Solo; foundation.)
- **Wave B — Config hub model + productionised Smart Hubs nav/HubBar/breadcrumb/footer**, adopted
  site-wide. (Foundation for every page.)
- **Wave C — Home front-door + `/browse` hub** (move grid/filters/SearchDock; condition tabs).
  HIGHEST RISK — preserve-contract §6.
- **Wave D — Buy & Own** (finance, offers, sell, test-drive; trade-in in place) + **Service & Parts**
  (service in place, parts, fleet).
- **Wave E — Footer pages** (about/contact/careers) + `/brand/[slug]` + `/electric` EV hub.
- **Wave F — `/rebi` navigator** + contextual Rebi action chips on hub/vehicle pages.

## 8. Contest designation (per /auto §6): **NONE.**
The design is already chosen — Smart Hubs won the IA contest and you selected it. No open-ended
"which design" question remains, and the execution, while large, is directed (the preserve-contract +
the mockup pin the target). A design or coding contest would add ceremony without a real fork.

## 9. Owner decisions needed before Phase 2
1. **Branch strategy** — merge `main`→`redesign/near-future-yard` and build the remodel there (rec)?
2. **Home vs Browse split** — OK to move the inventory grid off `/` to `/browse` (with an SEO
   canonical/redirect plan)? This is the biggest structural change.
3. **Config-as-data extent** — put the hub taxonomy in `dealerConfig`/`src/config/nav.ts` (rec)?
4. **Offers source** — config-driven vs a new Sanity `offer` type?
5. **New enquiry forms** — build all of sell/parts/fleet/contact/careers now (stubbed backends), or a
   subset?
6. **Business facts** (phone/hours/address/ABN for about/contact) — still owner-blocked; pages ship
   placeholder-gated until you supply them. Confirm.
7. **Scope confirmation** — full remodel incl. all ~15 new pages, or reskin/restructure the existing
   surfaces first and add parity pages in a later pass?
