# Rebirth Auto — UX/UI Design Contest · SHARED BRIEF (all 3 agents work from this)

3 independent design agents, each assigned ONE theme, running simultaneously. **No agent sees
another's work.** Each produces a complete entry. **Alex judges the winner.**

## The product
**Rebirth Auto** — a commercial car-dealership listings platform for **regional Australian**
dealerships. It is **AI-native**: an embedded chatbot (**Rebi**), AI-assisted search & filtering,
AI-generated vehicle summaries, and smart lead capture. **Treat the AI features as core to the
product, not extras** — they must be visually prominent throughout every page.

## Stack awareness (do NOT redesign the stack — just design within it)
Astro + Tailwind v4 + Cloudflare Worker · Sanity CMS · OpenRouter for AI. All dealer values live in
config — so **design as a themeable system** (tokens: colours, type, spacing — one nav, one footer,
reusable cards/components you compose across pages).

## What each agent delivers (in your own isolated folder — see per-agent brief)
1. **`DIRECTION.md`** — design direction doc: theme, rationale, colour palette (hex), typography, and
   *how the visual language reflects the AI-native product*.
2. **Desktop-only static mockups** (`.astro` pages) for ALL of the pages listed below.
3. **`STRUCTURE.md`** — how the new pages slot into the existing site, plus anything you add beyond
   the audit list.

## Required mockup pages (build ALL of these, cohesive under your theme)
**Core surfaces (reimagined, AI-prominent):**
- `index.astro` — home / hero
- `listings.astro` — listings index **with filter panel** (New / Demo / Used facets)
- `vehicle.astro` — single vehicle detail page — **MUST include a clearly-designed slot for Edmunds
  review attribution** (an "Expert review" block, credited "Review by Edmunds", logo/link placeholder)
- `rebi.astro` — the **Rebi AI chat interface** (a full, prominent conversational UI — this is the
  product's signature; make it excellent)

**Bundaberg Motor Group parity pages (pages BMG has that Rebirth Auto does NOT — dummy content):**
- `finance.astro` — finance options + a **repayment calculator UI** (price/deposit/term/rate → example repayment, static)
- `offers.astro` — offers / specials hub (per-brand deals)
- `electric.astro` — Electric Vehicles (EV) hub (education + EV inventory teaser)
- `sell.astro` — Sell your car (outright-sale intake; distinct from trade-in)
- `parts.astro` — genuine parts enquiry
- `fleet.astro` — fleet & business solutions
- `about.astro` — about the dealership
- `contact.astro` — contact / find-a-dealer (locations, hours, departments — dummy)
- `careers.astro` — careers / roles
- `test-drive.astro` — book a test drive
- `brand.astro` — a per-brand landing page (brand hub: logo, models, offers link)

(Rebirth Auto ALREADY has: inventory/home, vehicle detail, compare, trade-in valuation, book-a-service,
dealer capture, accounts, Rebi chat, Experience Mode — you are re-envisioning the core + adding the
parity pages. Do NOT rebuild compare/trade-in/capture unless you want to; they are not required.)

Prioritise polish on the **core 4** (home, listings, vehicle, Rebi chat) + finance + EV; the lighter
pages (about, careers, parts, fleet, contact) may be simpler but must stay on-brand and complete.

## Hard constraints (every agent)
- **Desktop only (~1440px).** NO mobile responsiveness. **Static mockups only — NO functionality/JS**
  (CSS animation for look is fine).
- **Do NOT remove or alter anything already built.** Your work is 100% additive and isolated under
  `src/pages/concepts/<your-theme>/`. Never touch shipped pages/components/config or another agent's folder.
- **AI features must be visually prominent throughout** — Rebi entry points, AI search, AI summaries,
  smart lead capture surfaced on every relevant page.
- **Vehicle detail must accommodate Edmunds review attribution** (see above).
- **Must feel credible to a regional Australian dealership** — established, trustworthy, local. Not a
  Silicon-Valley startup, not a generic car yard. AU spelling, AU pricing ($), AU vehicle mix.
- These are **isolated concept mockups**, so your assigned theme governs the palette — a **dark theme
  is permitted here** (e.g. Dark Precision) even though the shipped product is light-first. The
  light-theme standard applies only to shipped surfaces, which you are not touching.

## Build mechanics
- Create a reusable theme shell in your folder (nav + footer + tokens + vehicle card + filter panel)
  and compose every page from it, so all your pages are cohesive and you can cover the full set.
- Each `.astro` page: `import '../../../styles/global.css';` (note: files directly under
  `src/pages/concepts/<theme>/` are THREE levels up from `src/styles/`) for Tailwind utilities; add
  page-scoped `<style>` and `export const prerender = false;`. Google Fonts via `<link>` allowed. NO npm deps.
- Dummy content only; clearly a demo. Do NOT present fictional identity as a real business; never state
  a real phone/address as fact (use obvious placeholders).
- Verify: `npx astro check` clean for your files + curl each of your routes for HTTP 200
  (`http://localhost:4321/concepts/<your-theme>/<page>`; dev server runs on :4321). Do NOT commit.

## Reference
`docs/briefs/bundaberg-parity.md` holds the raw BMG audit (their real URL structure + franchise brands).
