# Task brief — Lock in Contest Candidate 3 ("Balance") as the real /compare, LIGHT theme

The owner chose contest Candidate 3 ("Rebi's Balance" — the weight-dial instrument at
`/compare-lab/3`). Make it THE comparison page (`/compare`), fully aligned to the site's
**light theme**. The site is **light-only** — do NOT ship a dark variant.

## Why this brief exists
Candidate 3 already has a light base, BUT it also has an `@media (prefers-color-scheme: dark)`
block that flips it dark for any visitor whose OS is in dark mode — that made it look wrong.
The site (`src/pages/index.astro` body is `bg-slate-50 text-slate-800`; `src/styles/global.css`)
has NO dark mode. So: remove the dark override entirely and align tokens to the site palette.

## The site's canonical LIGHT palette (use these exact values)
From `global.css` + `index.astro` + the current `compare.astro`:
- Page background: `#f8fafc` (slate-50). White cards `#ffffff`.
- Ink: headings slate-900 `#0f172a`; body slate-800 `#1e293b`; muted slate-500 `#64748b`; dim slate-400 `#94a3b8`.
- Hairlines/rings: `rgba(15,23,42,0.10)` (the site's `ring-slate-900/10` signature); softer `rgba(15,23,42,0.06)`.
- "Good / winner": emerald `#059669` (text/badge), `#047857` (strong). Use these, NOT #0ea472.
- Gold accent: `#f5b942` / deep `#d99414` / gold-ink `#a15c07`. Use these, NOT #e0a83a.
- Rebi accent: `rgb(1 97 239)` blue + the violet gradient are already correct — keep. One faint
  Rebi-blue radial glow over the slate-50 page is on-brand (index/hero + current compare do this).
- Focus ring: the global `:focus-visible` rule already applies — don't fight it.
Cross-check contrast (WCAG AA) for text on white/slate-50.

## What to do
1. **Make Candidate 3 the new `/compare`.** Rewrite `src/pages/compare.astro` to render the
   "Balance" experience (dials → live re-ranking podium → segmented score bars → live verdict).
   Preserve the CURRENT `compare.astro`'s real data-loading frontmatter: `?ids=` parsing (compare
   tray flow, cap 3), the `LISTING_FIELDS` Sanity fetch, the `CompareCar` mapping (incl.
   `fuelEconomy`), and `buildVerdict`/`LENSES`/`compare-verdict.ts` (READ-ONLY reuse — do not edit
   compare-verdict.ts). Keep the graceful EMPTY state when no/one id, and Candidate 3's
   "default to first 3 active listings" only as a fallback if that matches the current page's
   behaviour — otherwise keep the current empty-state. (Check how compare.astro handles 0/1 ids and preserve it.)
2. **Preserve the page shell:** `<title>`, the header with the "back to inventory" link, the
   footer, `<ChatWidget />`, the `AskRebiButton` compare entry (`data-rebi-kind="compare"`), the
   site gutters (`.site-container` / the site width system), and site-wide focus rings.
3. **Relocate the components** from the scratch `src/components/compare-lab/` into a permanent home
   `src/components/compare/` (the C3 ones: the reckon engine `C3_reckon.ts`, `C3_Dial.astro`,
   `C3_Contender.astro`). Rename to drop the `C3_` prefix if you like. Update imports. Do NOT touch
   the other lab files (1/2/CarBar/C2_*) — the orchestrator removes those separately.
4. **Light-only:** DELETE the `@media (prefers-color-scheme: dark)` block and any dark tokens.
   Re-map Candidate 3's CSS vars to the site palette values above. The result must look native
   beside `/` and the old `/compare` — slate-50 page, white glass panels with `ring-slate-900/10`
   hairlines, emerald winners, gold medals, Rebi-blue accent.
5. Keep everything Candidate 3 did well: draggable weight dials (accessible: keyboard/touch, real
   `<input type=range>`), FLIP re-ranking, per-dimension segment colours, preset-lens dial-snap,
   live grounded verdict re-narration, honest "not stated" handling (fuel economy), min-two remove
   guard, reduced-motion fallback, mobile breakpoints.

## Hard rules
- Real data only — never fabricate a spec/price. Do NOT edit `compare-verdict.ts`, `CompareTray.astro`,
  or any other page. Do NOT edit `get-env.ts`. No `Math.random` / module-top-level `new Date()`
  (a request-time `new Date()` in the `.astro` frontmatter for the footer year is fine — the current
  compare.astro does this). `npx astro check` green (before/after; zero new errors). Do NOT commit.
- The dev server is running on http://localhost:4321 — after building, curl `http://localhost:4321/compare`
  (and `http://localhost:4321/compare?ids=<two real slugs/ids>` if the page keys off ids) to confirm HTTP 200
  and that it renders populated. Confirm NO `prefers-color-scheme: dark` remains (grep it).

## Report format
Concise: files created/edited/moved; how data-loading + empty-state were preserved; confirm the dark
block is gone (grep result) and tokens match the site palette; how ids vs first-3 fallback resolves;
curl status of /compare; astro check before/after; anything not done.
