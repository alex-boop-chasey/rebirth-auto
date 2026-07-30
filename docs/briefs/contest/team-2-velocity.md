# Team 2 — "Velocity" · shared team brief (BOTH designers read this)

You are a **team of two designers** producing **ONE cohesive themed entry**: a **traditional** web
designer and a **futuristic/experimental** web designer, working **at the same time** on the SAME
site. Your two halves must look like ONE website — same nav, footer, tokens — with the experimental
pages pushing composition further.

Everything lands in **`src/pages/concepts/team-2-velocity/`** (one folder = one entry).
Reference input: `docs/briefs/bundaberg-parity.md`. Constraints: `CLAUDE.md`.

## Theme — "Velocity": high-energy modern sport
Fast, bold, confident, premium-mass-market.

**Design tokens (EXACT):**
- Background `#FFFFFF`; ink `#0B1220`; wash `#F1F5F9`; primary cobalt `#2563EB`; single vivid accent
  signal-lime `#C6F135` (used sparingly for emphasis only); slate `#64748B`.
- Fonts via Google Fonts `<link>`: display **"Archivo"** 800/900 (or "Anton") for oversized UPPERCASE
  tight headlines; body **"Inter"** 400/600. Type: hero 80px uppercase tight, h2 44px, body 16px.
  Container **max-width 1280px**. Diagonal/angled section dividers, big vehicle imagery, strong contrast.

**Shared nav (identical every page):** bold brand "REBIRTH//AUTO" (Archivo 900 ink); links Inter 15px
600: New · Demo · Used · Offers · Finance · EV · Contact; a prominent solid **cobalt** button
"Book a test drive". White bg, 2px ink or cobalt underline on hover.

**Shared footer (identical every page):** full-width **cobalt `#2563EB`** (or ink) block, white text,
big "REBIRTH//AUTO" wordmark, columns *Vehicles* (New, Demo, Used, EV), *Buy* (Finance, Offers,
Trade-in, Test drive), *Company* (About, Contact, Careers); fine print "Demo showcase — placeholder
content, not a real business."

## Page ownership (parallel — do NOT touch each other's files)
- **TRADITIONAL builds:** `inventory.astro`, `vehicle.astro`, `finance.astro` (incl. repayment
  **calculator UI** — price/deposit/term/rate + example repayment, static), `PLAN.md` (design language
  + full sitemap incorporating every Bundaberg-parity page). Bold but structured grids, punchy
  hierarchy, clear CTAs.
- **EXPERIMENTAL builds:** `index.astro` (kinetic showpiece home — diagonal energy, big type, motion)
  and `offers.astro` (a Specials/Offers hub — your signature bold page).

Both: nav links point to each other's real routes so it browses as one site.

## Hard rules (both)
- ISOLATION: only under `src/pages/concepts/team-2-velocity/`. Never modify shipped code or your
  teammate's/other teams' files.
- Desktop-only (~1440px, 1280px content). NO mobile responsiveness. NO JS/functionality — visual only
  (CSS animation OK). LIGHT-THEME (bright base; cobalt/lime are accents, footer block may be cobalt).
  Dummy content; no real phone/address as fact.
- Each `.astro`: `import '../../../../styles/global.css';` + `export const prerender = false;`. No npm
  deps. Routes 200 at `http://localhost:4321/concepts/team-2-velocity/<page>` (dev on :4321).
- Verify your files: `npx astro check` clean + curl 200. Do not commit.
