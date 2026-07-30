# Team 3 — "Clarity" · shared team brief (BOTH designers read this)

You are a **team of two designers** producing **ONE cohesive themed entry**: a **traditional** web
designer and a **futuristic/experimental** web designer, working **at the same time** on the SAME
site. Your two halves must look like ONE website — same nav, footer, tokens — with the experimental
pages pushing composition further.

Everything lands in **`src/pages/concepts/team-3-clarity/`** (one folder = one entry).
Reference input: `docs/briefs/bundaberg-parity.md`. Constraints: `CLAUDE.md`.

## Theme — "Clarity": calm, Scandinavian-clean, AI-forward
Effortless, trustworthy, tech-forward. Rebi (the AI assistant) is front-and-centre.

**Design tokens (EXACT):**
- Background `#FFFFFF`; section `#F8FAFC` (slate-50); ink `#0F172A`; muted `#64748B`; border `#E2E8F0`;
  single muted accent indigo `#6366F1`. Soft rounded cards (radius 16px), gentle shadow.
- Fonts via Google Fonts `<link>`: **"Inter"** everywhere (400/500/600) — no serif. Type: hero 56px
  medium, h2 32px, body 17px/1.7, generous whitespace. Container **max-width 1120px**. Precise modular
  grid, minimal ornament, lots of air.

**Shared nav (identical every page):** clean brand "Rebirth Auto" (Inter 600 ink); links Inter 15px
muted→ink: New · Used · Finance · Electric · Service · About; a soft rounded indigo-tint **"Ask Rebi"**
pill on the right. White bg, hairline `#E2E8F0` bottom border.

**Shared footer (identical every page):** light `#F8FAFC`, minimal — small brand, a single "Ask Rebi
anything" line, three tidy columns *Browse* (New, Used, Electric), *Services* (Finance, Service, Parts,
Trade-in), *Company* (About, Contact, Careers); fine print "Demo showcase — placeholder content, not a
real business."

## Page ownership (parallel — do NOT touch each other's files)
- **TRADITIONAL builds:** `inventory.astro`, `vehicle.astro`, `finance.astro` (incl. repayment
  **calculator UI** — price/deposit/term/rate + example repayment, static), `PLAN.md` (design language
  + full sitemap incorporating every Bundaberg-parity page). Pristine minimal grids, impeccable
  alignment, functional elegance.
- **EXPERIMENTAL builds:** `index.astro` (AI-forward conversational showpiece home — a calm "ask in
  plain English" hero where Rebi drives discovery) and `ev.astro` (an Electric hub — your signature
  page: soft depth, gentle motion, forward-looking but calm).

Both: nav links point to each other's real routes so it browses as one site.

## Hard rules (both)
- ISOLATION: only under `src/pages/concepts/team-3-clarity/`. Never modify shipped code or your
  teammate's/other teams' files.
- Desktop-only (~1440px, 1120px content). NO mobile responsiveness. NO JS/functionality — visual only
  (CSS animation OK). LIGHT-THEME. Dummy content; no real phone/address as fact.
- Each `.astro`: `import '../../../../styles/global.css';` + `export const prerender = false;`. No npm
  deps. Routes 200 at `http://localhost:4321/concepts/team-3-clarity/<page>` (dev on :4321).
- Verify your files: `npx astro check` clean + curl 200. Do not commit.
