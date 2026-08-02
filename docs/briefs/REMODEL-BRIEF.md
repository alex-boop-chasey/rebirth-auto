# SITE REMODEL — DEFINITIVE BRIEF (read this before every action)

**This is the single source of truth for this job. Re-read it before planning or doing anything.**
If something I'm about to do contradicts this document, STOP.

---

## The job (said many times — do not get this wrong again)

1. **Completely remodel the ENTIRE site onto ONE design: `inline-contextual`**
   (`/concepts2/inline-contextual`). Every page adopts that design/IA.
   - The base design is **inline-contextual**. **NOT smart-hubs.** (I wrongly used smart-hubs as the
     base earlier — that was the mistake. Base = inline-contextual.)

2. **The TOP NAV MENU comes from `smart-hubs`** (`/concepts2/smart-hubs`) — and ONLY the top nav menu.
   Nothing else from smart-hubs. The smart-hubs mega-menu is the one thing lifted from that concept.

## Hard constraints (non-negotiable)

3. **The docs remain adhered to** — `VISION.md` / `DECISIONS.md` / `LENSES.md` / `AGENTS.md`:
   config-as-data (no dealer literals outside `src/config/dealer.ts`), all AI through `src/ai/`,
   filter state only via `applyFilterUrl`, `dealerNotes` never public, determinism (never fabricate
   data), light-theme standard, the data-model rules.

4. **The mechanics behind EVERY AI tool remain EXACTLY the same.** Reskin/re-IA the UI only. Do not
   change the behaviour of: Rebi chat, hero AI search + the query planner + regex fallback,
   generate-description, compare verdict, capture PWA, the `src/ai/` tier layer. Preserve all the DOM
   seams (`#reb-*`, `data-rebi-*`, `#inventory-*`, filter input names, `stage-engine` classes,
   compare `data-compare-*`, journey beacons). Endpoint request/response shapes unchanged.

## Process (how we do this — the standard flow)

5. **This is a big job → PLAN it first.** Two-phase: produce the plan, get owner sign-off, THEN build.
   Do not jump into building.

6. **Build on a NEW branch** (the way it's always done: run a contest → owner picks one → build the
   chosen design on a new branch). Working branch for this job: **`redesign/inline-contextual`**
   (currently created as `redesign/smart-hubs` — rename it; foundation already merged is still valid).

7. **Do not start until the owner says to start.** "Do you understand?" ≠ "go".

## Current state (as of this brief)

- New branch created off `main` (has the current AI: query planner + free-model tiers) and merged with
  the near-future-yard NFY visual foundation + both `concepts2` mockups. `astro check` = 0 errors.
  Branch is misnamed `redesign/smart-hubs` — rename to `redesign/inline-contextual`.
- NOTHING of the inline-contextual design has been built yet. The Wave-1 nav agent was cancelled
  (it was building the wrong thing — a smart-hubs base).

## Every page already exists as a template — copy it

All the pages are already built in the mockup and nest under `/concepts2/inline-contextual/`. **Every
nav/menu link has a matching mockup page to copy** — the design work is done; the job is to turn each
into a REAL route (real Sanity inventory + real AI mechanics + real form/endpoint wiring + the
smart-hubs top nav), not to design anything new.

Mockup pages to port (`src/pages/concepts2/inline-contextual/`): `index`, `listings`, `vehicle`,
`brand`, `electric`, `finance`, `offers`, `trade-in`, `sell`, `test-drive`, `service`, `parts`,
`fleet`, `about`, `contact`, `careers`, `account`, `rebi` — plus the `_shell/` (Layout, Nav, Footer,
RebiChat, data). Build each real route FROM its matching mockup page.

## Before I act, I check:
- [ ] Is the base design I'm building **inline-contextual**? (Not smart-hubs.)
- [ ] Is the ONLY thing taken from smart-hubs the **top nav menu**?
- [ ] Are all AI mechanics preserved unchanged?
- [ ] Do the docs' hard constraints still hold?
- [ ] Am I on the new `redesign/inline-contextual` branch?
- [ ] Has the owner told me to **start**? (Understanding ≠ permission to build.)
