# Smart Hubs — Information Architecture

**Philosophy: progressive disclosure into three Smart Hubs.** The Bundaberg model puts every page
in the menu. We do the opposite: collapse the sprawl into **three hub destinations**, each absorbing
the similar-content pages as facets, tabs, and drill-in buttons. The shopper meets a lean top nav,
opens a hub, and disclosure deepens only as they commit: **hub → sibling drill-in strip → detail
page**. Rebi runs alongside as a fourth surface, navigating on request.

The whole IA rests on one idea: **similar content should share a home, not multiply into pages.**
New/Demo/Used/EV/brand aren't pages — they're facets of *Browse*. Finance/offers/sell/trade-in/
test-drive aren't a menu — they're the *Buy & Own* money-jobs, which overlap and so sit together.
Service/parts/fleet are *Service & Parts*. Everything else is footer or contextual.

## The three hubs (the backbone)

| Hub | Absorbs | How you go deeper |
|-----|---------|-------------------|
| **Browse** | inventory, New/Demo/Used (condition tabs), body/fuel/price (facets), brand (chips), EV (fuel facet → hub) | condition tabs + filter panel + brand chips + EV hub link |
| **Buy & Own** | finance + calculator, offers, trade-in, sell, test-drive | hub cards + the sibling `HubBar` on every child page |
| **Service & Parts** | service, parts, fleet | hub cards + `HubBar` |

Each top-nav hub opens a **mega-menu** (progressive disclosure on hover/focus) listing its drill-in
pages with one-line blurbs. Every child page carries a **`HubBar`** — a sibling strip of the hub's
other destinations — so you move laterally inside a hub without returning to the nav, plus a
**breadcrumb** back up to the hub. That makes the hub → page structure legible *on the page itself*.

## Four wayfinding surfaces

1. **Top nav** — three hubs + "Ask Rebi" + one primary CTA (Browse inventory). Nothing else.
2. **Footer** — the long tail / utility: About, Careers, Contact, and a mirror of every hub's
   drill-in links (Company / Shop / Buy & own / Service & parts columns).
3. **Contextual on-page buttons** — pages are reached from where they're relevant, not from a menu:
   - Brand + EV as **chips under the AI search bar** (home & Browse) — no "Our Brands" nav item.
   - **Finance from a vehicle's price** ("From ~$168/wk — calculate").
   - **Test drive on the vehicle page** and in Rebi.
   - **Sell surfaced on Trade-in** (and vice-versa) via the sell-vs-trade explainer.
   - **EV hub from the fuel facet** on Browse.
   - **Repayments/Offers from Browse results**; **Parts from Service**; **Careers/Contact from About**.
4. **Rebi (AI navigator)** — clickable listing cards + in-response action buttons; answers
   "take me to…/where do I…" by navigating (see `/rebi`).

## Placement map — every page

| Page | Primary home | Also reached from |
|------|--------------|-------------------|
| Home | — | brand mark |
| **Browse** (inventory + New/Demo/Used/facets) | **Nav → Browse hub** + primary CTA | footer; Rebi; every "browse all" button |
| **Electric (EV) hub** | Browse hub mega-menu; **fuel facet** on Browse | home & Browse chips; footer; Rebi; brand page |
| **Brand hub** | **contextual brand chips** (home, Browse, offers, fleet) | footer (Shop); Rebi; Browse facet |
| **Finance** (+ calculator) | **Buy & Own hub** | vehicle price; offers card; trade-in; Browse results; footer; Rebi |
| **Offers** | Buy & Own hub | finance; brand page; footer; Rebi |
| **Trade-in** | Buy & Own hub | vehicle rail; sell explainer; finance; footer; Rebi |
| **Sell** | Buy & Own hub | trade-in explainer; footer; Rebi |
| **Test-drive** | Buy & Own hub | **vehicle page** (primary in practice); Rebi; footer |
| **Service** | **Service & Parts hub** | parts cross-link; footer; Rebi |
| **Parts** | Service & Parts hub | service cross-link; footer; Rebi |
| **Fleet** | Service & Parts hub | service-parts hub; footer; Rebi |
| **About** | **Footer (Company)** | — |
| **Contact / find-a-dealer** | **Footer (Company)** | About; service-parts hub; Rebi ("who do I talk to") |
| **Careers** | **Footer (Company)** | About |

Supporting pages present for interlinking: **Vehicle detail** (finance/test-drive/trade-in/Rebi
contextual buttons) and the **Rebi chat** (`/rebi`).

## How the sprawl slims

- **11 candidate pages → 0 new top-nav items.** The nav holds three hubs, full stop.
- **New/Demo/Used** stop being three pages — they're **condition tabs** on one Browse hub.
- **Brands** stop being a menu — they're **chips** wherever a brand is relevant.
- **EV** is the **fuel facet given room to teach**, then it drops you back into filtered stock.
- **Finance ↔ offers** and **sell ↔ trade-in** overlaps are folded into **Buy & Own**, with explicit
  cross-links (the overlap becomes a feature, not duplicate silos).
- **About / Contact / Careers** — low-frequency, so they live in the **footer**, out of the shopper's
  main path but one click away everywhere.
- **Rebi** removes navigation entirely for anyone who'd rather ask: it returns the destination.

## Rebi as navigator (`/rebi`)

- **Clickable listing cards in-thread** → open the vehicle.
- **In-response action buttons** (afford­ance chips, not free text): *Work out repayments*, *Book a
  test drive*, *Add my trade-in*, *See all 7-seaters*, *Compare these two* — each DOES/GOES.
- **"Take me to…"** intent → Rebi replies with a one-tap **Go to EV hub** button. A left rail lists
  every destination Rebi can jump to.
- Grounding note kept visible: public listing data only, never private dealer notes.

## Reuse & isolation

Everything imports the shipped NFY system via `../../../../styles/global.css` (tokens + `.btn` /
`.card` / `.ai-summary` / `.aisearch` / `.orb` / `.chip` / `.site-nav` / `.site-footer`). Hub
mega-menu, `HubBar`, breadcrumb, jump-buttons and the Rebi dock are the only additions, all scoped
under `.sh-`. Nothing shipped and no `src/pages/concepts/**` file is touched. Every page sets
`export const prerender = false`.

## Routes

All under `/concepts2/smart-hubs/`:
`` (home) · `browse` · `buy-own` · `service-parts` · `finance` · `offers` · `electric` · `sell` ·
`parts` · `fleet` · `about` · `contact` · `careers` · `test-drive` · `brand` · `vehicle` ·
`trade-in` · `service` · `rebi`.
