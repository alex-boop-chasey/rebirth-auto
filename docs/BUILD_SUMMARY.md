# BUILD_SUMMARY.md — Autonomous build run

Branch: `build/autonomous-run` (not pushed — the final push is the owner's sign-off gate).
All work committed locally, one commit per ticket, `npx astro check` green (0 errors).

## Headline

The premise going in was a large unbuilt backlog. A full ground-truth audit
(`docs/reports/todo-ground-truth-audit.md`) found the opposite: **the entire chatbot
pipeline — the actual near-term product goal — is already built and at its 100% milestone.**
Every item in the todo's "In progress / next up" section was already implemented and wired.
So this run's real work was: verify that claim end-to-end, close the one genuine remaining
code gap, and honestly map what's actually left (which is speculative, business-shaped, and
mostly owner-gated).

## What was built (this run)

1. **Fuel-economy / L-100km field** (`ef73d9e`) — the one genuine, in-scope code gap. Adds
   `vehicleSpecs.fuelEconomy` end-to-end: Sanity schema field, `VehicleSpecs` type,
   `LISTING_FIELDS` projection, a listing-page display row, and — crucially — threaded into
   the **grounding** blocks (`grounding/context.ts` focus block + `grounding/lookup.ts` live
   matches) so Rebi can now *state* a vehicle's economy when it's present. Flipped the four
   "we don't hold economy" guards (system-prompt, ai-search prompt, dealer.ts intent-map,
   compare-verdict) to "state it when present, never invent when absent." Added an economy
   dimension to the comparison verdict that **skips any pair missing the figure** (proven
   can't-fabricate: `normDim` drops dimensions with <2 comparable cars), and fixed
   `isLowerBetter` so the compare table highlights the more economical car. Determinism
   intact: economy is only ever shown/scored from real populated data — no backfill, no
   estimation.

2. **Phase-0 foundation** (`9750d11`) — flipped Rebi's reply brain to Haiku primary in
   `src/ai/tiers.ts` (free models retained as fallbacks; grounding firewall untouched) and
   set the filter-drawer price defaults to "Min"/"Max". (The year-dropdown fix and the
   "Ask Rebi" button unification in the same brief were found already shipped in prior
   commits — verified, not rebuilt.)

3. **Planning + audit artifacts** — `docs/build-plan.md` (every todo item sequenced with
   complexity/status/dependency/ground-truth state), `docs/reports/todo-ground-truth-audit.md`
   (item-by-item BUILT/PARTIAL/ABSENT/OWNER classification), `TODO_KEYS.md` (drop-in registry).

### Verified working (live smoke-test, no paid LLM calls)
Dev server: homepage renders the hero stack + AI SearchDock + centre-overlay Rebi
(`reb-panel`) + "Ask Rebi"; a listing page renders real specs (price, odometer, transmission,
fuel); the compare page renders — all HTTP 200. The fuel-economy row correctly does **not**
appear on current listings because none have the field populated yet (by design).

## What was already built (audit-confirmed — NOT rebuilt)

The whole "next up" list: continuity journey (D1, folded into replies + return visits +
nav beacons), Haiku flip, the greyscale-dream centre-overlay Rebi with mic/speaker/tones/
escalation, unified "Ask Rebi" button, cross-function chat, colour search extraction + GROQ
filter, staggered results choreography, hero layout, filter min/max + from/to labels +
year-bug fix, comparison "Ask Rebi" entry point, and Sanity Studio schema-UX Tier 1. See the
audit report for file:line evidence on each.

## What was NOT autonomously built, and why (owner-gated / speculative)

Per the master prompt's own "docs win on conflict" clause and `DECISIONS.md`'s warning
against "over-building speculative machinery for scale that may never come," the following
were **documented with precise drop-in points** rather than half-scaffolded into a clean,
at-milestone repo on a real dealer's live inventory:

- **Comparison-table redesign contest** — the table is already shipped and polished, and the
  todo says *"Judge is the owner."* An autonomous redesign would risk regressing working UI
  and can't be owner-judged while the owner is away. Held for sign-off.
- **The dealer listing-creation PWA** (VIN lookup, photo/vision extraction, voice, review→
  publish pipeline, PWA shell, worker write-token) — the todo explicitly gates this behind
  the **owner's 100%-snapshot fork**, which is an owner action. Building it now would
  pre-empt that milestone. Deferred by design.
- **Backlog product features touching real-dealer data or external partnerships** — customer
  accounts/auth (security-gated; docs require a paid human security review), POS, carsales
  upload, manufacturer/review-source grounding (partnership-gated), saved searches + email
  alerts, trade-in valuation, price-history/"Just Reduced," service booking, web-search
  allowlist. Several of these would put **fabricated data on a real dealer's real cars shown
  to real shoppers** (e.g. a fake "Just Reduced" badge), which directly conflicts with the
  project's foundational "the AI never makes things up" determinism principle. Which of these
  to build — and what fabrication is acceptable in a demo — is a business-prioritization call
  the docs reserve for the owner.
- **Full agentic search** — needs a paid model + tool-calling; no real spend per the rules.

## What was deferred (post-milestone vision)

Extract the chatbot kernel, "plug into any website" grounding swap, Experience Mode,
multi-tenant SaaS. All post-100%-snapshot and/or gated on a paid human security review
(multi-tenant) per `DECISIONS.md`. Sequencing: they follow the owner's snapshot fork and the
agentic-search foundation.

## Audited next steps (prioritised)

1. **Owner: confirm the 100% milestone** by reviewing this branch, then **fork the snapshot**
   (the designed decision point) — this unblocks the PWA and the "plug into any website" line.
2. **Owner-gated data/infra** (all documented in `TODO_KEYS.md`, none need code): fill the
   `businessInfo` Sanity doc; reconcile demo brand data to real inventory; apply the prod D1
   journey migration (`wrangler d1 migrations apply astro-listings-chat --remote`); optionally
   add the `GROUNDING_KV` binding.
3. **Owner: pick the next build track** from the speculative backlog above — I'll build/stub
   whichever you prioritise, cleanly, with the env-flag + `src/stubs/` + `TODO_KEYS` pattern.
   My recommendation for highest demo-value/lowest-risk first: **Rebi-in-Studio assistant**
   (extends the existing one-shot generator; no fabrication risk) and **web-search allowlist
   for Rebi** (a real Rebi capability). Hold the fabricated-data-on-real-cars features
   (price history, saved-search alerts) until you decide what's acceptable in the demo.

## Known issues / things to check

- **Fuel economy is invisible on current demo data** — no listing has the field populated
  (no fabricated backfill, by design). To see it live, enter an L/100km value on a listing in
  Studio; then Rebi can state it, the listing shows the row, and compare weighs it.
- **Prod D1 journey table** — the migration is local-only until the owner runs it against
  `--remote`. Journey is fail-open, so nothing breaks meanwhile; return-visit recall just
  won't persist in prod until applied.
- **Haiku is now the chat primary** — this means the buyer-facing chat now makes **paid**
  OpenRouter calls. Confirm OpenRouter has credit before the demo, or the free fallbacks
  (gpt-oss-20b, gemma-4-26b) will carry it.
- **Nothing pushed** — everything is local on `build/autonomous-run`. Review, then approve the
  push (`git push --force-with-lease origin main` — or merge the branch) when you're ready.
