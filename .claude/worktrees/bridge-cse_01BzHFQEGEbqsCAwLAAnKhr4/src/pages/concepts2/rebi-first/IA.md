# Rebi-First — Information Architecture

**Philosophy:** Rebi (the AI) is the *primary* wayfinder. Instead of teaching shoppers a
menu, we teach them one habit: **ask**. The top nav carries almost nothing; the home is a
conversation, not a directory; and every answer Rebi gives ends in **buttons that navigate**
and **listing cards you can tap**. The footer holds the full site map as a safety net for
people who'd rather browse it themselves.

The bet: a car yard's real navigation is a *question* ("something safe for the family that
tows"), not a category. A menu forces the shopper to translate their question into our
taxonomy. Rebi removes that translation step — and drops them on the exact page (finance
pre-filled, EV stock filtered, test-drive booked) instead of a landing page they still have
to work through.

## The four surfaces

1. **Top nav — ultra-minimal (3 things).** Logo · a prominent **Ask Rebi** pill · one ghost
   **Browse inventory** CTA. No marketing links, no dropdowns. The nav's job is to make
   *asking* the obvious default and give one escape hatch to raw browsing.
2. **Floating Rebi dock.** A persistent aurora launcher (bottom-right, every page) so the
   primary navigator is always one tap away, mid-scroll, on any page. Carries the shipped
   `data-rebi-open` seam.
3. **Contextual on-page buttons.** Every page surfaces its *neighbours* as action chips
   (finance ↔ offers ↔ trade-in ↔ test-drive), so you move sideways through related tasks
   without returning to a menu. Brands are buttons under offers/fleet/brand — never a nav item.
4. **Footer — the full directory.** All 11 pages, grouped Shop / Finance & selling /
   Service & parts / Company. The complete map for anyone who distrusts the AI or knows
   exactly where they're going.

## How Rebi navigates (the core of this concept)

- **Clickable listing cards inside the thread** — Rebi renders real vehicle cards; tapping a
  card goes to the vehicle (here, the chat demo). Shown on `/` hero, `/rebi`, and every card
  grid.
- **Action buttons in every response** — quick-reply affordances that *do/go*: "Work out
  repayments" → finance (pre-filled), "See EVs" → electric, "Book a test drive" → test-drive,
  "Talk to Service" → contact, "Sell my car" → sell. These reuse the focus-stage
  `.actions/.newsearch` affordances + the `data-rebi-*` seam.
- **"Take me to…" navigation** — Rebi answers wayfinding questions ("who do I talk to about a
  warranty?", "take me to parts") by routing, not by describing. The `/rebi` left rail is a
  literal "Take me to…" list.
- **Per-page `RebiAsk` block** — every parity page ends with a mock of Rebi answering a
  page-relevant question, ending in navigating buttons. That's the Rebi entry the brief
  requires on every page.

## Placement map (every page → how you reach it)

| Page | Top nav | Footer | Contextual buttons (from where) | Rebi (action-button phrasing) |
|---|---|---|---|---|
| **Home / hub** | Logo → home | Brand → home | — | Base of every conversation |
| **Inventory** (facet, not a page) | **Browse inventory** CTA → `#inventory` | Shop › Browse inventory | Home cards; brand/EV teasers; test-drive "Browse all" | "Browse the yard", "Let Rebi shortlist" |
| **Finance + calculator** | — | Finance & selling | offers, sell/trade-in, test-drive, brand, EV, vehicle price | "Work out repayments" (pre-filled) |
| **Offers / specials** | — | Shop | finance, brand strip, home shortcut, Rebi | "Find me a deal that fits" |
| **Electric (EV) hub** | — | Shop | home shortcut, fleet ("electrify"), finance, fuel facet | "Is an EV right for my drive?", "See EVs" |
| **Sell your car** (+trade-in) | — | Finance & selling (+ `#trade`) | finance ("lower the amount"), test-drive ("value my trade"), home | "Sell my car", "Value my trade-in" |
| **Parts** | — | Service & parts | contact (Parts dept), test-drive/service | "Check a part for my vehicle" |
| **Fleet & business** | — | Service & parts | finance, electric, brand strip, contact | fleet spec + "Talk to fleet manager" |
| **About** | — | Company | careers, contact | "Are you actually local?" |
| **Contact / find-a-dealer** | — | Company | every dept card, test-drive/service, parts, sell, finance | "Who do I talk to about X" |
| **Careers** | — | Company | about, contact | "What's the role actually like?" |
| **Book a test drive** | — | Service & parts | offers, brand, EV, vehicle, sell, finance | "Book me a test drive in the <car>" |
| **Brand hub** | — | Shop › Brands | offers strip, fleet strip, EV, finance, inventory facet | "Which <brand> is best for…" |

**In the nav: just 2 destinations** (Ask Rebi, Browse inventory). Everything else is Rebi +
contextual + footer. That's the whole point — the sprawl doesn't live in the chrome.

## How the sprawl got slimmed (overlaps folded, not siloed)

- **New / Demo / Used** stay **filter facets** on inventory — never separate pages.
- **Finance ↔ Offers** — offers cards deep-link to the finance calculator; finance surfaces
  "See finance offers"; pre-approval is one CTA shared by both. No duplicate "pre-approval" page.
- **Sell ↔ Trade-in** — one page. Outright valuation intake + a *sell-vs-trade* explainer;
  the footer's "Trade-in valuation" is an anchor (`/sell#trade`), not a second page.
- **EV ↔ fuel facet** — the Electric hub *is* the fuel facet's landing: education + a stock
  teaser that hands off to the filtered inventory, not a parallel catalogue.
- **Brand ↔ listings facet** — one brand template; "view stock" deep-links to the brand-filtered
  inventory rather than rebuilding a grid per brand. Brands appear as buttons (offers, fleet,
  brand switcher), never as a nav item or an "Our Brands" mega-menu.
- **Test-drive ↔ vehicle detail ↔ contact** — the test-drive form is reachable from any
  vehicle/offer/brand context and from Rebi with the car pre-selected; "book a service" folds
  into the same booking surface; department routing lives on contact.

Result: 11 pages' worth of content, **2 nav items**, one AI that takes you to any of it.

## Files

- `_shell/Shell.astro` — minimal nav + full-directory footer + floating Rebi dock (+ demo helpers)
- `_shell/data.ts` — dummy stock/offers/roles/brands + icon set (`BASE = /concepts2/rebi-first`)
- `_shell/VehicleCard.astro` — in-grid listing card · `_shell/RebiAsk.astro` — per-page Rebi touchpoint
- `index.astro` (home/hub) · `rebi.astro` (full chat mock) · 11 parity pages: `finance` (live
  calculator), `offers`, `electric`, `sell`, `parts`, `fleet`, `about`, `contact`, `careers`,
  `test-drive`, `brand`.

All pages reuse the shipped NFY primitives from `global.css` (`btn/card/chip/orb/ai-summary/
aisearch/site-nav/site-footer`); `export const prerender = false`; light-theme; no npm deps.
