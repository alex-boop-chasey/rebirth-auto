# Task brief — fix the /labs/experience hero orb overlap

## Problem (verified by screenshot)
On `http://localhost:4321/labs/experience`, the animated blue **Rebi orb** is absolutely
positioned in the vertical centre of the hero and **overlaps the H1 headline** ("Don't shop
the lot. Let it come to you.") — the orb sits on top of the words. The sibling page
`src/pages/labs/experience-alt.astro` shows the CORRECT, balanced pattern: the orb sits
*above* the headline, everything centred and vertically rhythmic.

## Fix
Reposition/rebalance the experience hero so the orb no longer overlaps the headline and the
hero reads as horizontally and vertically balanced — the orb should sit **above** the
eyebrow/headline (as in experience-alt), or otherwise be given its own space in the vertical
flow. Tighten the excessive empty top whitespace so the hero block is optically centred.

Likely files (confirm by reading): `src/pages/labs/experience.astro` and
`src/components/experience/ExperienceCanvas.astro` (+ its CSS). Keep the orb's existing
animation/behaviour; only its **layout position** changes.

## Constraints (restate — they bite here)
- **Isolation:** these are experimental, unlinked `labs/` surfaces. Change ONLY the experience
  page + its own `experience/` components/CSS. Do NOT touch shipped pages/components/config, and
  do NOT touch `experience-alt` or the shared chat widget.
- **Light-theme standard** (CLAUDE.md): keep it light-first — do not restyle to dark.
- **No new deps.** No package.json/lockfile changes. Config-as-data: no dealer literals.
- Additive/surgical: smallest change that fixes the overlap and balances the hero.

## Verify before reporting
1. `npx astro check` → 0 errors.
2. Re-screenshot and eyeball it:
   `/usr/local/bin/playwright screenshot --full-page --viewport-size "1440,900" http://localhost:4321/labs/experience /Users/alex/components/rebirth-auto/design-concepts/audit/experience-fixed.png`
   Confirm the orb is clear of the headline and the hero is balanced. (Dev server is already
   running on :4321.)

Report: files+lines changed, `astro check` result, and confirm the re-screenshot shows no
orb/headline overlap. Do not commit.
