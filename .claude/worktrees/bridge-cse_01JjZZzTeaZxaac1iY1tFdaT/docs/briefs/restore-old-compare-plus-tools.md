# Task brief — Restore the original comparison table as /compare; move "Balance" to /compare-tools

The owner has decided: **keep the original (pre-contest) comparison table as `/compare`**, and keep the
contest-winner "Balance" design (currently at `/compare`) as an **extra page** reached by a
**"Comparison tools"** button placed **next to the "Ask Rebi to decide" button**.

## Order of operations (do this exactly, to avoid losing either design)
1. **First, preserve the Balance design as the new page.** The CURRENT `src/pages/compare.astro` IS the
   Balance design (with the `.page-bg` dreaming fix from commit `e14398d`). Copy it to
   `src/pages/compare-tools.astro` BEFORE overwriting `compare.astro`.
2. **Then restore the original** into `src/pages/compare.astro`:
   `git show fa52bff~1:src/pages/compare.astro > src/pages/compare.astro`
   (that is the original "Verdict Board" / `body.vboard` design the owner wants back; it already carries
   `fuelEconomy` and uses the current `compare-verdict`/`listing` APIs, so it should compile as-is —
   verify with astro check).

## Fix 1 — carry the Rebi-backdrop fix into the restored original
The original paints its background on `body.vboard` (a `.vboard { background: … }` rule). Rebi's dreaming
filter `body.reb-dreaming > :not(#reb-chat)` deliberately never touches `<body>`, so that body background
escapes the grey/blur → the exact "white background with feathered edge" bug the owner reported. Apply the
SAME fix used for the Balance page in commit `e14398d` (read that commit / current `compare.astro`'s
`.page-bg` approach as the reference): move the `.vboard` background onto a fixed, full-viewport,
`z-index:0` **body-child** `<div class="page-bg">` (a direct child of `body.vboard`, a sibling of the
content wrap and of `#reb-chat`), leaving `body.vboard` with only the flat `--bg` colour. Then
`body.reb-dreaming > :not(#reb-chat)` greys+blurs `.page-bg` in lockstep with the content. No
`prefers-color-scheme: dark` (light-only site). Verify: opening Rebi from `/compare` now greys AND blurs
the page (like the homepage), not a white backdrop.

## Fix 2 — the "Comparison tools" button on the restored /compare
Next to the existing `AskRebiButton` ("Ask Rebi to decide", ~line 337 of the restored file), add a
**"Comparison tools"** button/link that navigates to `/compare-tools` carrying the SAME `?ids=` (an
`<a href={\`/compare-tools?ids=${ids.join(',')}\`}>` styled to sit beside the Ask-Rebi button — match the
site's light button vocabulary, e.g. a slate outline/secondary button so Ask-Rebi stays primary). Place it
immediately adjacent so they read as a pair.

## The /compare-tools page (the Balance design)
- It is the copied Balance page. Adjust: it reads the same `?ids=` (already does). Add a clear way BACK to
  the main comparison — a link to `/compare?ids=<same ids>` (e.g. in its header, replacing/joining the
  "Back to inventory" link with a "Back to comparison" link, your judgment — keep both if clean).
- Keep its `src/components/compare/` imports, the `.page-bg` dreaming fix, the `AskRebiButton`
  (`data-rebi-kind="compare"`), and the light theme. Its eyebrow/title may say it's the "comparison tools"
  / weighing-room view so it's distinct from the main table.
- Both pages must default to the first 3 active listings ONLY if the original did — match each page's
  existing empty/ids behaviour (the original had its own; the Balance page had its own). Don't change
  either page's data-loading contract beyond what's needed.

## Rules
- Light-theme only, config-as-data, determinism. Reuse `compare-verdict.ts`/`listing.ts` read-only (do
  NOT modify them). No `Math.random` / module-top-level `new Date()` (request-time `new Date()` in
  `.astro` frontmatter for the footer year is fine — both files already do this). `npx astro check` green
  (before/after; zero new errors). Do NOT commit.
- The dev server is on http://localhost:4321. After building, curl `/compare?ids=<two real ids>` and
  `/compare-tools?ids=<same>` → both HTTP 200, populated. Grep both served pages for `prefers-color-scheme`
  (must be none). Confirm the "Comparison tools" link points to `/compare-tools?ids=…` and the tools page
  links back to `/compare?ids=…`.

## Report format
Concise: files (created/restored/edited); how the original was recovered; the `.page-bg` backdrop fix on
the restored page (file:line); the "Comparison tools" button (file:line + href) and the back-link;
curl statuses for both pages; `prefers-color-scheme` grep (empty); astro check before/after; anything
not done.
