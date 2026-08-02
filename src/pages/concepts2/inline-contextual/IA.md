# Inline-Contextual IA — Rebirth Auto (Contest 2)

**Philosophy in one line:** the top nav does almost nothing. Wayfinding lives *inline*,
exactly where a page becomes relevant — on a car's price, on a fuel facet, on a brand chip —
backed by a full-directory footer and Rebi as an active navigator.

## Why this slims the sprawl

Bundaberg's model puts every page in a menu or sub-menu. That forces a taxonomy decision on a
visitor who just wants a car. The sprawl of similar pages (finance, offers, sell, trade-in,
brands, EV) is really a sprawl of *menu entries* — the content itself is fine. So we delete the
menu, not the content:

- **Near-zero top nav** — only `Logo · Ask Rebi · Browse`. Nothing to scan, nothing to mis-file.
- **Inline contextual entry points** carry the load. You reach Finance from a car's *price*, the
  EV hub from the *fuel facet*, a Brand hub from a *brand chip*, Sell from *trade-in*, Parts from
  the *vehicle you own* — each door appears at the moment it means something. One consistent
  affordance (`.entry`: a left-accented card with an arrow) teaches "this takes me somewhere".
- **Overlaps are folded, not siloed.** Finance ↔ Offers cross-link on both surfaces; Sell ↔
  Trade-in sit as two doors in one room; EV ↔ the fuel facet are literally one tap apart; Brand ↔
  listings facets share the same chips. No redundant hub pages.
- **The footer is the whole map.** Because nothing hides in a mega-menu, the footer carries the
  complete directory — the reliable "show me everything" surface for the long tail.
- **Rebi is a real navigator.** It renders clickable listing cards in-thread and answers
  "where do I…/take me to…" by *going there*, with action-button chips ("Work out repayments",
  "See all 7-seaters", "Book a test drive", "Talk to Service").

The result: the same information, reached in fewer, more meaningful clicks — the site feels slim
because the structure is felt, not read.

## The four wayfinding surfaces

1. **Top nav (near-zero):** Logo → home · **Ask Rebi** (opens the navigator) · **Browse** → listings.
2. **Footer (full directory):** every page, grouped Shop / Buy & own / Service & parts / Dealership.
3. **Inline contextual `.entry` buttons:** nested on the related page, at the point of relevance.
4. **Rebi:** clickable cards + in-response action chips; "take me to…" navigation.

## Placement map — every page, how it's reached

| Page | Top nav | Footer | Inline contextual entry (from → where) | Rebi |
|------|:------:|:------:|-----------------------------------------|:----:|
| **Home** (`/`) | Logo | Brand | — (the origin hub) | — |
| **Listings** (`/listings`) | **Browse** | Shop | Home AI-search bar; home facet chips; every "All stock" link | "See all 7-seaters" card + chips |
| Vehicle detail (`/vehicle`) | — | — | Listing cards (home, listings, EV hub, brand, Rebi) | Clickable listing cards in-thread |
| **Finance** (`/finance`) | — | Buy & own | **Vehicle price** ("Work out repayments", prefilled); listing-card chip; test-drive rail; offers cross-link | "Work out repayments" / "pre-qualify" |
| **Offers** (`/offers`) | — | Shop | Home offers strip; **Finance** side-rail (finance↔offers fold); brand hub | "Find me a deal that fits" |
| **Electric hub** (`/electric`) | — | Shop | **Fuel facet** (listings sidebar + home fuel strip); EV fuel badge on a vehicle | "Is an EV right for my drive?" |
| **Sell** (`/sell`) | — | Buy & own | **Trade-in** page (sell↔trade fold); vehicle buy-rail | valuation intake |
| **Trade-in** (`/trade-in`) | — | Buy & own | **Vehicle** buy-rail ("Add your trade-in"); Sell page; Finance ("trade as deposit") | valuation intake |
| **Parts** (`/parts`) | — | Service & parts | **Vehicle page** ("parts for this model", prefilled); Service page | "Check a part for my vehicle" |
| **Fleet** (`/fleet`) | — | Service & parts | About + Contact (business); brand hubs | fleet enquiry |
| **About** (`/about`) | — | Dealership | Footer; Contact | "tell me about you" |
| **Contact** (`/contact`) | — | Dealership | Footer; About; Fleet; department cards route onward | "who do I talk to about X" |
| **Careers** (`/careers`) | — | Dealership | **About** ("Join the team") | "what's it like working here" |
| **Test drive** (`/test-drive`) | — | Buy & own | **Vehicle page** ("Book a test drive", prefilled); listing-card chip | "book me a test drive in the <car>" |
| **Brand hub** (`/brand`) | — | Shop | **Brand chips** (home, listings sidebar, vehicle "More <make>") | per-brand landing |
| Service (`/service`) | — | Service & parts | Vehicle ("book its first service"); Parts; Contact Service dept | "service my <car>" |
| Account (`/account`) | — | Dealership (utility) | Footer | "show my saved cars" |
| Rebi full view (`/rebi`) | **Ask Rebi** | Brand (chat CTA) | RebiChat dock "Full view" | is Rebi |

*New / Demo / Used are **filter facets** on `/listings`, never separate pages.*

## Fold decisions (overlap → interlink, not duplicate)

- **Finance ↔ Offers** — reciprocal entries on both; the calculator and the deals are two views of
  the same "what can I afford" question.
- **Sell ↔ Trade-in** — kept distinct (cash vs offset) but each carries a one-tap door to the
  other plus a plain-language "which is right for me".
- **EV ↔ fuel facet** — the hub is reached *through* the filter, so education and stock never split.
- **Brand ↔ listings** — brand chips are the only "brands" UI; a hub adds story + offers + a
  filtered stock teaser, then hands back to the facet.
- **Test-drive ↔ vehicle**, **Parts/Service ↔ vehicle** — task chains that start on the car and
  prefill from it.

## Demo notes

- Built on the shipped NFY tokens/primitives (`global.css` → `theme.css`): `.btn`, `.card`,
  `.chip`, `.orb`, `.ai-summary`, `.aisearch`, `.site-nav`, `.site-footer`. The only concept-local
  additions are the `.entry` inline-affordance and small page helpers (in `_shell/Layout.astro`).
- The `data-rebi-open` seam is preserved — every "Ask Rebi" trigger opens the navigator dock.
- Static/CSS mock; forms and the composer are inert. `export const prerender = false` on all routes.
- Isolated under `src/pages/concepts2/inline-contextual/` — no shipped code touched.

## Routes

`/` · `/listings` · `/vehicle` · `/finance` · `/offers` · `/electric` · `/sell` · `/trade-in` ·
`/parts` · `/fleet` · `/about` · `/contact` · `/careers` · `/test-drive` · `/brand` · `/service` ·
`/account` · `/rebi` — all under `/concepts2/inline-contextual/`.
