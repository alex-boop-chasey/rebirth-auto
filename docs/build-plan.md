# docs/build-plan.md — Sequenced Build Plan

> Orchestrator working plan for the autonomous build run. Every feature in `docs/todo.md`
> appears here — none skipped. Each carries a **complexity** rating (ROUTINE / COMPLEX),
> a **status** (DIRECT / STUBBED / DEFERRED), its **dependencies**, and the **current
> state** in the codebase (much of the "next up" list is already scaffolded or shipped —
> this plan finishes and hardens it rather than rebuilding it).
>
> Checked against `VISION.md`, `DECISIONS.md`, `AGENTS.md`, `LENSES.md`. Where the master
> orchestration prompt conflicts with those checked-in docs, the docs win (per the prompt's
> own instruction). Two such adaptations are recorded under **Operating adaptations** below.

---

## ⚠️ GROUND-TRUTH UPDATE (post-audit) — read this first

A full read-only audit of every `docs/todo.md` item against the code (see
`docs/reports/todo-ground-truth-audit.md`) found the backlog is **significantly stale**:

- **The entire "In progress / next up" section is already BUILT and shipped** — continuity
  journey (D1, folded into replies + return visits + beacons), Haiku reply flip, the
  centre-overlay greyscale-dream Rebi with mic/speaker/tones, unified "Ask Rebi" button,
  cross-function chat, colour search extraction + GROQ filter, staggered results, hero
  layout, filter min/max + from/to labels + year-bug fix, and the comparison "Ask Rebi"
  entry point. **The chatbot pipeline is at its 100% milestone.**
- Phases 0–3 of the plan below were therefore mostly *verification*, not building. Phase 0's
  agent confirmed 2 of 4 items were already committed; the audit confirmed the rest.

**Genuine remaining code work** (the only things actually unbuilt that are real code tasks):
1. **Fuel-economy / L-100km field** — the one clear, in-scope, high-value gap. BUILDING THIS RUN.
2. Rebi-in-Studio → fuller assistant (a one-shot generator already exists).
3. Everything else is either OWNER/INFRA or speculative/post-snapshot backlog.

**Why the rest is not being autonomously carpet-built this run** (per the prompt's own "docs
win on conflict" clause): `DECISIONS.md` warns against "over-building speculative machinery
for scale that may never come"; the dealer PWA is explicitly gated behind the **owner's
snapshot fork** (an owner action at the 100% milestone); the comparison-table contest is
**owner-judged** ("Judge is the owner") and the table is already shipped and polished, so an
autonomous redesign would risk regressing working UI; and customer accounts/auth, POS,
carsales, and manufacturer/review-source grounding are **security- or partnership-gated**
speculation. These are documented as planned stubs with drop-in points in `TODO_KEYS.md`
rather than half-scaffolded into a clean, at-milestone repo. The pipeline being *done* is the
designed decision point where the owner forks the snapshot and chooses what comes next — a
business-prioritization call the docs reserve for the owner. This run: build the one genuine
gap (fuel economy) + optionally one or two safe, high-value, self-contained demo stubs
(e.g. Price History / "Just Reduced"), then report the milestone and tee up the scope
decision. This honors "no feature gets skipped" as *documented with a precise drop-in point*
where autonomous building would be unwise, and "build it" where it genuinely is wise.

---

## Operating adaptations (read first)

1. **Sub-agents run via the harness Agent tool, not `claude --print` subprocesses.**
   Same outcome the prompt intends — fresh-context sub-agents doing the coding from a
   self-contained brief — but observable, cost-bounded, and conflict-safe. Parallel
   file-mutating agents get **worktree isolation**. Briefs are still written to
   `docs/briefs/<slug>.md` and reports captured to `docs/reports/<slug>.md`.

2. **No autonomous force-push to `main`.** Everything is built and committed locally, one
   commit per ticket. The final `git push --force-with-lease origin main` is the one
   genuinely irreversible, outward-facing act, and `AGENTS.md` makes it the owner's
   sign-off gate ("Push only when the owner explicitly approves — never push
   unilaterally"). The build runs to completion locally; the push waits for an explicit
   go-ahead. This honors "don't stop mid-build" (the build never stalls) while refusing
   the one unilateral irreversible action the repo forbids.

3. **Data writes stay dry-run / stubbed.** No Sanity `--commit`, no D1 `--remote`. Schema
   and script changes are authored and validated; the actual write is left as a marked,
   owner-run step (`TODO_KEYS.md`).

### Buildability tiers (honesty about scope)

Not every backlog item is a tonight-sized job. Each feature is tagged by how far this run
takes it:

- **SHIP** — completed to a real, demoable standard in the working tree.
- **STUB** — full feature code + UI + a fake pipeline behind an env flag; flip a var + add a
  credential to go live. Indistinguishable from real in behaviour.
- **SCAFFOLD** — genuinely multi-week surfaces (PWA, customer auth, POS). Built as a
  coherent, typed, demoable skeleton with stubs, not a pretend-complete production system.
  Called out plainly so nothing is oversold.
- **DEFERRED** — post-100%-milestone or needs a paid model / paid security review; planned,
  sequenced, not built this run.

---

## Dependency spine

```
src/ai/ provider layer  ──────────────►  (EXISTS — prereq satisfied)
        │
        ├─► continuity journey (D1)  ──►  chatbot quality to 100%
        │
Rebi overlay (Focus Stage)  ─────────►  cross-function chat ─► comparison "Ask Rebi" entry
   (largely SHIPPED)                        │                        │
        │                                   └────────► unified "Ask Rebi" button (all entry points)
        │
schema (vehicleSpecs/details) ──► colour attribute ──► search colour extraction
        │
        └─► fuel-economy field ──► Rebi running-cost answers
```

---

## Phase 0 — Foundation & quick wins  · ROUTINE · DIRECT

Low-risk, high-value, unblock consistency. No contest.

| # | Feature | Cx | Status | Current state | Notes |
|---|---------|----|--------|---------------|-------|
| 0.1 | **Flip chatbot reply → Haiku** (`src/ai/tiers.ts`) | ROUTINE | SHIP | one-line reorder; `chat-quality` tier already Haiku-backed | Point chatbot reply at `chat-quality` (or prepend Haiku to `chat-cheap`). Firewall stays. Ref memory `phase3-demo-swap-structured-model`. |
| 0.2 | **Filter drawer — price labels** "any/any" → "min/max" | ROUTINE | SHIP | `FilterDrawer.astro` | Copy-only. |
| 0.3 | **Filter drawer — year dropdowns** fix open/populate + label "from"/"to" | ROUTINE | SHIP | `FilterDrawer.astro` | Real bug: years not rendering. |
| 0.4 | **Unify "Ask Rebi" button** — one reusable component everywhere; rename compare tray "Ask AI" → "Ask Rebi" | ROUTINE | SHIP | `AskRebiButton.astro` exists; `CompareTray.astro` uses "Ask AI" | Consolidate to the global component + style. |

## Phase 1 — Chatbot pipeline to 100%  · mixed

| # | Feature | Cx | Status | Current state | Notes |
|---|---------|----|--------|---------------|-------|
| 1.1 | **Continuity journey** (D1-persisted, folded into every reply + return visits) | COMPLEX | SHIP | scaffolded: `chatbot/journey.ts`, `grounding/journey.ts`, `api/journey.ts`, `migrations/0003_journey.sql` (fail-open) | Audit → complete the fold-into-reply + return-visit recall + client beacons on nav. Migration stays owner-run (`--remote`). |
| 1.2 | **Colour attribute** — add to `vehicleSpecs`/`details[]` + search extraction | ROUTINE | SHIP | `vehicle-specs.ts`, `ai-search/schema.ts`, `vehicle-filter-extract.ts` | Deterministic mapping; ambiguous → WARN. Backfill script dry-run only. |

## Phase 2 — Chatbot UX overhaul  · COMPLEX

| # | Feature | Cx | Status | Current state | Notes |
|---|---------|----|--------|---------------|-------|
| 2.1 | **New chatbot look & feel** (centre overlay, greyscale-dream fade, colour chat, tones, speaker, mic, close/minimise, on-screen listing results any page, Telegram escalation) | COMPLEX | SHIP | **largely already built & merged** (boxless Rebi / Focus Stage / greyscale-dream / tones / speaker — see git log) | **Audit against the todo spec, close gaps, harden.** Contest NOT re-run from scratch — the design already landed; a contest would trample shipped work. Verify every listed capability survives. |
| 2.2 | **Cross-function chat** — any function (incl. inventory search) regardless of priming entry point | COMPLEX | SHIP | `chatbot/core.ts`, tool/intent routing | Decouple capability from entry-point priming. |
| 2.3 | **AI search — staggered results sequence** (grid fades out → typing bubble → response → filtered results fade in) | ROUTINE | SHIP | `search/stage-engine.ts`, `SearchDock.astro` | Sequencing/animation. |
| 2.4 | **AI search — colour recognition** (wire 1.2 into the bar) | ROUTINE | SHIP | depends on 1.2 | |
| 2.5 | **Hero layout** — search bar comfortable distance below heading; heading above carousel | ROUTINE | SHIP | `index.astro` | Layout. |

## Phase 3 — Comparison table  · COMPLEX · CONTEST

| # | Feature | Cx | Status | Notes |
|---|---------|----|--------|-------|
| 3.1 | **Comparison table design contest** — 3-agent sequential, each outdoes the last, **no critic** (per todo); freedom to add features/animations; judge is the owner | COMPLEX | SHIP (winner synthesized) | Run contest → synthesize → **present winner to owner for sign-off before merge** (todo says judge is owner; contest output is a major decision → sign-off gate). Build behind current compare page. |
| 3.2 | **Comparison "Ask Rebi" entry point** — "help me decide between these" as 4th Rebi entry | ROUTINE | SHIP | Depends on 2.1/2.2/0.4. Lens 1 retroactive discovery. |

## Phase 4 — Schema / Sanity Studio  · ROUTINE

| # | Feature | Cx | Status | Notes |
|---|---------|----|--------|-------|
| 4.1 | **Schema UX Tier 1** — groups→tabs, fieldsets+collapsible, conditional hidden/readOnly, options.list/radio/grid, initialValue, validation msgs, preview select/prepare | ROUTINE | SHIP | `schemaTypes/listing.ts`. Config-only, no data migration. |
| 4.2 | **Fuel economy / L-100km field** — closes running-cost gap for Rebi | ROUTINE | SHIP | Add to schema + `LISTING_FIELDS` + grounding. Backfill dry-run only. |
| 4.3 | **Sanity MCP plugin** | — | DEFERRED (owner action) | Owner installs via `/plugin install`. Documented. |

## Phase 5 — Data reconciliation & config stubs  · owner-gated writes

| # | Feature | Cx | Status | Notes |
|---|---------|----|--------|-------|
| 5.1 | **businessInfo Sanity doc** real facts | — | STUB | `knowledge.ts` placeholder already the fallback. Author a seed script (dry-run) + document `--commit` in `TODO_KEYS.md`. No write. |
| 5.2 | **GROUNDING_KV** namespace + binding | — | STUB/DOC | Optional cache; works without. Document binding steps. |
| 5.3 | **Reconcile demo brand data** (business-facts brands vs real inventory) | ROUTINE | STUB/DOC | Determinism rule: reconcile from real inventory; ambiguous → WARN. Dry-run diff only; `--commit` documented. |

## Phase 6 — Backlog features (stubbed)  · mixed · STUB

Full feature code + UI + fake pipeline behind an env flag. `src/stubs/<service>.ts` exports
the real interface; `// TODO_KEYS:` markers at every integration point; `TODO_KEYS.md` entry.

| # | Feature | Cx | Status | Stub |
|---|---------|----|--------|------|
| 6.1 | **Price History / "Just Reduced"** | ROUTINE | STUB | price-change history surfaced on listings; mock history generator until a real price log exists. |
| 6.2 | **Saved searches + email alerts** | COMPLEX | STUB | save a URL-filter search (uses `applyFilterUrl`); `src/stubs/email.ts` logs "sent". `STUB_EMAIL=true`. |
| 6.3 | **Redbook trade-in valuation** | ROUTINE | STUB | `src/stubs/redbook.ts` → realistic valuation object. `STUB_REDBOOK=true`. |
| 6.4 | **Manufacturer-website grounding** | COMPLEX | STUB | `src/stubs/manufacturer.ts` → structured model-info; grounding source plugs into existing grounding layer. |
| 6.5 | **Automotive review-source grounding** (Wheels etc.) | COMPLEX | STUB | `src/stubs/reviews.ts` → structured review objects. |
| 6.6 | **Upload listing to carsales.com.au** | COMPLEX | STUB | `src/stubs/carsales.ts` → mock listing id + URL. Draft-safe. |
| 6.7 | **Book a service** | ROUTINE | STUB | booking flow; `src/stubs/notify.ts` (SMS/email) returns success + console log. |
| 6.8 | **Customer accounts** (login, service history, alerts) | COMPLEX | SCAFFOLD/STUB | `src/stubs/auth.ts` → mock customer profile/session. Platinum-care skeleton; real auth is a later hardening pass. |
| 6.9 | **Web search for Rebi** (hardcoded URL allowlist) | ROUTINE | STUB | `src/stubs/websearch.ts` → canned results for allowlisted URLs. |

## Phase 7 — Dealer-side listing creation PWA  · DEFERRED (post-100%) · SCAFFOLD+STUB

> todo says: ship AFTER chatbot pipeline hits 100% and the snapshot is forked. Built this run
> as a coherent standalone scaffold with every external stubbed, not a finished product.

| # | Feature | Cx | Status | Stub |
|---|---------|----|--------|------|
| 7.1 | Rego/VIN → authoritative API (RedBook/NEVDIS) | COMPLEX | STUB | `src/stubs/vin-lookup.ts` → OEM factory spec object. `STUB_VIN=true`, ~AU$0.65/lookup noted. |
| 7.2 | Photo → vision extraction | COMPLEX | STUB | routes to `src/ai/` vision tier; `src/stubs/vision-extract.ts` fallback. Capture-UI accuracy levers noted. |
| 7.3 | Voice complement (~30s note) | ROUTINE | STUB | Web Speech API as the stub (free, functional); Whisper/Deepgram upgrade point marked. |
| 7.4 | Pipeline photo/voice → draft → dealer review → publish (draft-only) | COMPLEX | SCAFFOLD | Never publish direct. |
| 7.5 | Validate against schema before create (errors in review UI) | ROUTINE | SCAFFOLD | |
| 7.6 | Resolve references, never invent (GROQ fuzzy + "create new?") | ROUTINE | SCAFFOLD | Determinism rule. |
| 7.7 | Standalone PWA (Astro + Worker) | COMPLEX | SCAFFOLD | Shared extraction module, not baked into Studio/site. |
| 7.8 | Write token in Worker, listings-scoped, never client | — | DOC/STUB | `TODO_KEYS.md`. |

## Phase 8 — Tooling / infra / Studio assistant  · mixed

| # | Feature | Cx | Status | Notes |
|---|---------|----|--------|-------|
| 8.1 | **Rebi in Sanity Studio** (editor assistant, `useFormValue`, drafts from specs) | COMPLEX | STUB/SCAFFOLD | Check Sanity Agent Actions native coverage first; else custom via `src/ai/`. Different brain from visitor Rebi. |
| 8.2 | **Dependency version tracking** tooling | ROUTINE | SHIP | script/report for Astro + stack; no auto-upgrade. |
| 8.3 | **Cloudflare security tooling** — investigate + document integration | ROUTINE | DOC/SHIP | Audit + `TODO_KEYS.md` for anything needing account access. |

## Phase 9 — Vision / future  · DEFERRED

Planned & sequenced, not built this run (post-milestone, or needs paid model / paid human
security review per `DECISIONS.md`).

| # | Feature | Status | Reason |
|---|---------|--------|--------|
| 9.1 | Extract chatbot kernel (framework-agnostic core + pluggable grounding) | DEFERRED | Happens at/after the 100% fork milestone. |
| 9.2 | "Plug into any website" AI helper | DEFERRED | The post-fork product; needs 9.1 first. |
| 9.3 | Full agentic search (tools on a capable paid model) | DEFERRED/STUB | Needs paid model + tool-calling; anti-hallucination-by-construction. Interface can be stubbed; live run deferred (no real spend). |
| 9.4 | Experience Mode (AI-driven canvas) | DEFERRED | Post-milestone; prototype onboarding→standby→"boom" cheaply, test w/ ~5 users. |
| 9.5 | Multi-tenant SaaS | DEFERRED | `DECISIONS.md`: needs paid human security review before real dealer data. Conventions already point here. |
| 9.6 | Point-of-sale integration | DEFERRED/STUB | Per-dealer, depends on their platform + API. Long-term. |

## ⭐ Milestone — fork snapshot at 100%

After Phases 0–4 land, verified & stable (all three Rebi entry points + continuity), the
**owner** forks/copies the repo as the frozen snapshot base for the "plug into any website"
product. This is a human checkpoint, not an autonomous action.

---

## Execution order (linear)

`0.1 → 0.2 → 0.3 → 0.4` → `1.1 → 1.2` → `2.1 → 2.2 → 2.3 → 2.4 → 2.5` → `3.1 (contest) → 3.2`
→ `4.1 → 4.2` → `5.1 → 5.2 → 5.3` → `6.1 … 6.9` → `7.1 … 7.8` → `8.1 → 8.2 → 8.3`.
Phase 9 planned only.

**Per-ticket loop:** write brief → spawn Agent (worktree if parallel) → capture report →
review vs docs (config-as-data, all-AI-through-`src/ai/`, data-model rules, determinism,
Lens 1 for UI, stub completeness) → fix-brief if minor gaps → **commit locally** → next.

**Gates that pause for the owner (per docs, not per convenience):** the comparison contest
winner (3.1) and the final push. Everything else proceeds autonomously.

**Finalisation:** `npx astro check` clean → verify homepage + a listing page render →
commit remainder → **hold push for owner** → write `docs/BUILD_SUMMARY.md` → Telegram.

---

## /auto run 2 (autonomous) — scope + decisions

- **Comparison option 3 ("Balance"):** already shipped (`fa52bff`, light theme) — NOT rebuilt (audit-first).
- **Directional decision (this checkpoint):** replace the `/account` DEMO-stub (`src/stubs/auth.ts` +
  `/api/account`) with **real Supabase auth ported from `/Users/alex/components/astro-users-demo`**, using
  that project's existing `.env` credentials. Adaptations: env read via the Cloudflare-Worker pattern
  (not `@astrojs/node`), **light theme** to match this site, **config-as-data** for any dealer values,
  and **reuse the demo's Turnstile pair** for the auth widget. Ports: `getSupabase` cookie client, auth
  middleware (guard `/dashboard`), Astro Actions (signUp/signIn/signOut/requestPasswordReset/
  updatePassword), and the login/signup/dashboard/check-email/reset-password pages.
- **Contest designation (§6): NONE this run** — the auth is a faithful port, not an open design/coding
  problem; the comparison design contest already ran and was judged.
- **Then:** firm up the remaining backlog (parked vision items stay parked; owner data tasks stay
  owner-gated/dry-run).

---

## /auto run 3 (autonomous) — edits-1.txt fixes

Scope: the 3 open items from `docs/edits-1.txt` (item "Accounts dead-end" already done via Supabase auth).
**Contest designation (§6): NONE** — all three are defined fixes, not open design/coding problems.

1. **Rebi visual consistency + globalize his styles/sounds/layout into their own file.** Rebi shows the
   greyed+blurred backdrop from the inventory widget but a white feathered-edge backdrop from the compare
   table — unify so every Rebi instance matches the main chatbot. Extract the Rebi `<style is:global>` +
   the oscillator sound engine + layout out of `ChatWidget.astro` into a dedicated file for easy edits.
2. **Compare "Ask Rebi to choose" must stay the compare agent.** In `kind="compare"` context, a decision
   criterion ("low running costs") must make Rebi pick ONE of the tagged compare cars and open that
   listing — not run a generic inventory search (which abandons the compare role before release).
3. **Centre the search-results listings** within the site's 55px laptop gutters.
