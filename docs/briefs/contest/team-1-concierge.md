# Team 1 — "Concierge" · shared team brief (BOTH designers read this)

You are a **team of two designers** producing **ONE cohesive themed entry** for the Rebirth Auto
design contest: a **traditional** web designer and a **futuristic/experimental** web designer,
working **at the same time** on the SAME site. Your two halves must look like ONE website — same
nav, same footer, same tokens — with the experimental pages simply pushing composition further.

Everything lands in **`src/pages/concepts/team-1-concierge/`** (one folder = one entry).
Reference input: `docs/briefs/bundaberg-parity.md`. Constraints: `CLAUDE.md` (Stack + Hard rules).

## Theme — "Concierge": boutique quiet-luxury editorial
A high-end dealership brochure. Warm, calm, expensive, restrained.

**Design tokens (use these EXACT values in every page):**
- Background paper `#FAF7F2`; section alt `#F1EBE0`; ink text `#1A1714`; muted `#6B6157`.
- Single accent — brass `#A6792E`. Hairline rules `#E7E0D5`.
- Fonts via Google Fonts `<link>` (no npm): display **"Playfair Display"** 600/700 (serif headlines);
  body **"Inter"** 400/500. Type scale: hero 64px, h2 36px, h3 22px, body 17px/1.7, small 13px caps
  letter-spaced. Container **max-width 1200px**, centered, generous vertical rhythm (96px section pads).

**Shared nav (identical on every page):** left brand lockup "REBIRTH AUTO" in 13px caps letter-spaced
ink; right links in Inter 15px: New · Demo · Used · Finance · Electric · About · Contact, plus a quiet
underlined "Search inventory". Thin `#E7E0D5` bottom hairline. White/paper background.

**Shared footer (identical on every page):** top hairline; three columns — *Inventory* (New, Demo,
Used, Electric), *Departments* (Finance, Service, Parts, Fleet), *Company* (About, Contact, Careers);
below, fine print in muted 13px: "Rebirth Auto — demo showcase. Placeholder content, not a real
business." Serif brass wordmark top-left of footer.

## Page ownership (build in parallel — do NOT touch each other's files)
- **TRADITIONAL designer builds:** `inventory.astro`, `vehicle.astro`, `finance.astro` (incl. a
  repayment **calculator UI** — price/deposit/term/rate controls + an example estimated repayment,
  static), and `PLAN.md` (team design language + full proposed sitemap incorporating every new
  Bundaberg-parity page). Conventional, elegant, highly usable editorial grids.
- **EXPERIMENTAL designer builds:** `index.astro` (the editorial showpiece home) and `ev.astro`
  (an "Electric" hub — your signature bold page). Dramatic asymmetry, oversized serif, negative
  space as art, refined CSS motion — award-winning luxury editorial, still on-theme.

Both: link the nav to each other's real routes so the entry browses as one site.

## Hard rules (both)
- ISOLATION: only create files under `src/pages/concepts/team-1-concierge/`. Never modify shipped
  code; never write into another team's folder or your teammate's files.
- Desktop-only (~1440px, 1200px content). NO mobile responsiveness. NO JS/functionality — visual only
  (CSS animation OK). LIGHT-THEME. Dummy content; no real phone/address as fact.
- Each `.astro` page: `import '../../../../styles/global.css';` (four levels up) for Tailwind; add
  `export const prerender = false;`. No npm deps. Routes must return 200 at
  `http://localhost:4321/concepts/team-1-concierge/<page>` (dev server on :4321).
- Verify your own files: `npx astro check` clean + curl each route 200. Do not commit.
