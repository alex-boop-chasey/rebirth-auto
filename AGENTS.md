# AGENTS.md — Working instructions for Claude Code in this repo

## What it is

Rebirth Auto — a commercial car-dealership listings website, automotive vertical only. A real product
intended for sale to dealerships; near-term target is Bundaberg Motor Group, whose real inventory
serves as demo data.

## Project docs

- **`VISION.md`** — what the product is trying to become, and why it matters
- **`DECISIONS.md`** — architectural intent and reasoning
- **`LENSES.md`** — design judgment for new features or reshaped surfaces

The orchestrator reads all three once at session start and operates from that context.

Sub-agents receive pre-digested task briefs and do not read `VISION.md`, `DECISIONS.md` or
`LENSES.md`. **They do read this file** — specifically the *Stack*, *Hard constraints* and *Field
notes* sections — before starting work. Every task brief must also restate, in the brief itself, the
specific constraints that bite for that task. A constraint that lives only in the orchestrator's head
is not a constraint.

## Roles

**Owner** — the ideas and business person. Makes all high-level business-shaped and architectural
decisions. Does not read or write code. Signs off on every major decision, every contest outcome, and
anything irreversible before it proceeds.

**Planning surface** — the Claude.ai project where the owner works. Turns business decisions into
architecture and into written tickets. When a ticket arrives from there already specified, implement
it rather than quietly re-planning it. If you disagree with the plan, say so and bring it back to the
owner — do not silently substitute your own.

**Orchestrator (you — the main Claude Code CLI session)** — plans, delegates, reviews. **You never
write or edit application code yourself.** Every coding task — features, bug fixes, refactors, tests,
data scripts, config changes in code — is handed to a sub-agent via a precisely scoped task brief;
you review and verify their output before integrating. Default to running **several sub-agents in
parallel** on independent tasks, and use the time while they work to plan the next moves. The whole
point is to keep *your* context sharp for planning, judgment, and review — not to fill it with
implementation detail. You bring every major decision and contest outcome back to the owner for
sign-off before implementing.

The only hands-on actions you perform directly — and these are **not** "coding" — are: planning and
writing task briefs; reading and surveying the codebase to plan and to review; reviewing, verifying,
and integrating sub-agent work; git commits, merges, and pushes (the sign-off gate — see *Commits and
pushing*); dependency and lockfile re-syncs, which must stay atomic and single-owned (see
*Dependencies & lockfile*); and editing the project docs (`AGENTS.md` / `DECISIONS.md` / `LENSES.md`
/ `VISION.md`). Anything that writes or changes code in the repo is delegated — no exceptions, even
for a one-line fix. If a task feels too small to delegate, it is still delegated; the discipline is
the point.

**Sub-agents (background Claude Code sessions)** — do **all** the actual coding in the repo under the
orchestrator's direction. Spawned per task with a precise scope; multiple may run in parallel on
independent tasks. Report back for review and integration. Do not make architectural decisions.

Mirror substantive updates, decisions, and blockers to both the CLI chat and the owner's Telegram.
The chat id is read from the environment (`OWNER_TELEGRAM_CHAT_ID`, set in `~/.claude/CLAUDE.md` or
local env) — **do not hardcode it in the repo.** Keep Telegram copy concise. Skip silently if
Telegram is not configured in the environment.

## Sub-agent contest

Pull this in on demand, not by default.

When the owner calls a contest on a hard or open-ended problem, run exactly **three sub-agents in
strict sequence** — never in parallel, never more than three:

1. **Agent 1 — first approach.** Briefed on the problem only. Proposes a solution and builds a
   working proof of it — enough to demonstrate the approach holds up, not production-quality code.
   Finishes completely before anything else starts.

2. **Agent 2 — competing approach.** Briefed on **the same problem statement and nothing whatsoever
   from Agent 1** — not the code, not a summary, not the general shape of it, not "do something
   different from X." Anchoring on the first answer is the exact failure this rule exists to prevent:
   an agent shown a prior solution produces a variation of it and calls it an alternative. **If Agent
   2's brief references Agent 1 in any way, the contest is void and must be re-run.** Agent 2 builds
   its own working proof.

3. **Agent 3 — the critic.** Only after Agent 2 has finished. Sees both proofs. Critiques both
   honestly — weaknesses, risks, edge cases, trade-offs — and writes a comparison report. Proposes
   nothing of its own.

**Synthesis.** The orchestrator names a winner and states explicitly what it imports from the losing
approach — or states that nothing was imported, and why. Reviewing prior work and layering on top of
it is not a contest and does not count as one. The synthesis goes to the owner for sign-off before
anything is implemented.

## Autonomous runs (`/auto`)

`/auto` is a mode where the orchestrator works through **already-approved** queued work without
pausing for turn-by-turn direction. It exists to burn down a backlog the owner has already signed off
on. It does not exist to decide what to build next.

**`/auto` may:** pick up tickets the owner has already approved; delegate them to sub-agents; review
and integrate their work; run tests and builds; make local commits; refresh the status docs it owns
(e.g. `docs/REMAINING-WORK.md`); report progress to chat and Telegram.

**`/auto` may never:**
- Push, deploy, run any data script with `--commit`, or write/rotate secrets.
- Start work that has not already been approved. If it runs out of approved work, it **stops and
  reports** — it does not invent the next ticket.
- Make an architectural decision, resolve a contest, or choose between competing approaches.
- Skip two-phase discipline. A phase-1 proposal waits for the owner; `/auto` does not approve its own
  plans.
- Overwrite, regenerate, or truncate the append-only audit records (see below).
- Edit `VISION.md`, `DECISIONS.md`, `LENSES.md`, or `AGENTS.md`.

If in doubt, `/auto` stops and asks. A stopped run costs a few minutes. An unreviewed irreversible
action costs a lot more, and the owner cannot catch it by reading the code.

## Stack

- **Astro 7** SSR with the **`@astrojs/cloudflare` v14** adapter, deployed as a **Cloudflare Worker —
  not Cloudflare Pages**. This distinction has caused real bugs.
- Runtime env is read via `import { env } from 'cloudflare:workers'`. The `locals.runtime.env` pattern
  was removed in this adapter version. `src/chatbot/get-env.ts` is the shared helper.
- **Sanity CMS** for content; **Tailwind v4**; **Cloudflare D1** (`CHAT_DB`) and **KV**
  (`RATE_LIMIT_KV`) for the chatbot; **Turnstile** for bot protection.
- **OpenRouter** for all LLM calls using the OpenAI-compatible API; free-tier models for now.
- Node scripts (seed, import, migrate) read secrets from `.env` via dotenv. The Sanity write token
  must be named `SANITY_TOKEN` and have Editor scope — read-only tokens pass dry-runs but fail on
  `--commit`.
- The Worker runtime reads `.dev.vars` locally and `wrangler secret` in production. These are separate
  from `.env` and must not be confused.

## Hard constraints

**Two-phase tickets** — Every ticket runs in two phases. **Phase 1:** investigate, read the relevant
code, and propose — what you found, what you'd change, which files you'd touch, what could go wrong,
what you're unsure about. Then **stop and wait for owner approval**. Phase 1 writes no code. **Phase
2:** execute the approved plan. This is not ceremony — it has repeatedly caught wrong assumptions and
mis-mappings before they reached the codebase, and it is the main thing standing in for the code
review the owner cannot perform. A ticket phrased as "just do X" still runs both phases unless the
owner explicitly waives phase 1 in that ticket.

**Private dealer data stays private** — See Decision 6 in `DECISIONS.md`. `dealerNotes`, cost or floor
pricing, private condition flags, and any other private field must never reach a shopper-facing
surface: not in rendered text, not in an API response, not paraphrased by Rebi, and **not as an input
to ranking, sorting, or recommendation**. Shopper-facing AI is grounded only on data drawn from the
public projection. Private context is passed only to dealer-facing AI features on dealer-facing paths.
This is a commercial promise to the dealer, not just a code convention.

**Config as data** — All dealer-specific values (name, logo, colours, domain, contact details, AI
persona, feature flags, rate limits) live in `src/config/dealer.ts` and are read at runtime. Never
hardcode a dealer value anywhere else.

**All AI through `src/ai/`** — All LLM calls route through the capability tier system via the `~/ai`
barrel exports (`generate`, `generateObject`, `generateStream`). Never import from `src/ai/providers/`
outside that folder, and never call OpenRouter — or any provider's API directly — from feature code.
Add a new tier if a needed capability isn't exposed yet.

**Data scripts** — Run in dry-run mode by default and require an explicit `--commit` flag to write.
Always show the diff and any WARN lines to the owner before running with `--commit`. Deletions and
patches must target explicit document IDs, never a broad query match.

**Filter state** — Shopper filter state lives in the URL and is read and written exclusively through
the `applyFilterUrl` helper. No feature constructs filter URLs independently.

**Determinism** — Only map data values that can be confidently matched. Anything ambiguous must fall
through to a logged WARN and never be silently guessed or defaulted.

## Commits and pushing

One commit per completed ticket. Push only when the owner explicitly approves — never push
unilaterally. Use `git push --force-with-lease` if a history rewrite is ever needed, never plain
`--force`.

## Audit records — append-only (never overwrite)

`docs/AUDIT-LEDGER.md` (the shipped/deferred findings ledger) and the audit artefacts it references
(`docs/AUDIT-FINDINGS.md`, `docs/AUDIT-PUSHBACK.md`, and any future `audits/` folder) are a
**permanent, append-only historical record**. They MUST NOT be overwritten, regenerated, truncated, or
deleted by any process — **including `/auto` and any other autonomous run**. A new audit **appends** a
new dated section; a correction **appends** a dated note — history is never rewritten. `/auto`'s
authority to refresh status docs (e.g. `docs/REMAINING-WORK.md`) explicitly does **not** extend to
these files.

## Dependencies & lockfile (prevents Cloudflare build failures)

This is an **npm** project (`package-lock.json`; `packageManager` is pinned to npm). Cloudflare's
build runs `npm ci`, which **fails the deploy** if `package.json` and `package-lock.json` drift — the
common Cloudflare Workers pain point. Rules:

- **Use Cloudflare's exact npm for ALL lock operations: `npx npm@10.9.2 …`** (the pinned
  `packageManager`), never the ambient local `npm`. The local `npm` here is 11.x and is NOT
  corepack-managed, so the `packageManager` pin is not enforced automatically — you must call
  `npx npm@10.9.2` explicitly. **npm 11 and npm 10.9.2 disagree about optional-peer packages:** npm 11
  prunes `@emnapi/*@2.0.0-alpha.3` (optional peers under `@tailwindcss/oxide-wasm32-wasi`) that npm
  10.9.2 requires, so a lock written by local npm 11 passes `npm ci` locally but Cloudflare's npm
  10.9.2 rejects it as out-of-sync. This has broken the deploy **twice**.
- After ANY dependency change, run a **full `npx npm@10.9.2 install`** (never a partial or offline
  install) and commit the updated `package-lock.json` **in the same commit**.
- **Verify with a REAL `npx npm@10.9.2 ci` before pushing — NOT `npm ci --dry-run`, and NOT the local
  npm 11.** Dry-run doesn't rebuild the full ideal tree; the wrong npm version produces a lock
  Cloudflare rejects (e.g. missing `@emnapi/*` optional peers). `npx npm@10.9.2 ci` reproduces
  Cloudflare's exact `npm clean-install` and is the only check that catches both. If the lock is truly
  wedged, regenerate cleanly: `rm -rf node_modules package-lock.json && npx npm@10.9.2 install`, then
  confirm with `npx npm@10.9.2 ci` (exit 0) plus `npm run build`.
- Never hand-edit dependency versions in `package.json` without re-running `npm install`.
- Do **not** introduce a second package manager (pnpm/yarn) or a second lockfile — the repo is
  npm-only. (`npm ci` is already the frozen-lockfile guard; that's a feature — it surfaces drift at
  build time rather than shipping a broken deploy.)
- Sub-agents must not run installs that could partially update the lock; the orchestrator owns
  dependency changes and re-syncs the lock.

## Data model

- **`vehicleSpecs`** — typed object holding filterable dimensions: `bodyType`, `transmission`,
  `fuelType`, `driveType`, `seatCount`, `year`, `odometer`, `condition`. Values are lowercase codes
  that also serve as URL filter params.
- **`details[]`** — loose key/value array for arbitrary extras (sunroof, tow pack). Not redundant with
  `vehicleSpecs` — keep both.
- **`dealerNotes`** — private field containing dealer shorthand. Never expose in any public-facing data
  projection. Consumed by dealer-facing AI features only. See the private-data hard constraint above.
- **`scripts/lib/vehicle-specs.ts`** — single source of truth for mapping `details[]` labels to
  `vehicleSpecs` fields. `petrol-electric` maps to `hybrid`, not `electric` (hybrid patterns tested
  before generic electric). Ambiguous transmission compounds fall through to WARN. Preserve both
  behaviours.
- **`LISTING_FIELDS`** in `src/lib/listing.ts` — shared GROQ projection used by all pages. Extend it
  when pages need new fields. Do not alter display helpers unless the ticket explicitly says to.
  `dealerNotes` is intentionally excluded, and any future private field must be too.
- Listings are Sanity documents. `category` is locked to `automotive` — do not reintroduce any
  real-estate schema or logic.

## Dev notes

- Start the dev server in background mode: `astro dev --background`. Manage with `astro dev stop`,
  `astro dev status`, `astro dev logs`.
- A Vite "file does not exist in optimize deps" 500 after a config or dependency change is a stale
  optimizer cache — delete `node_modules/.vite` and restart. Not a code bug.

## Field notes (hard-won — do not relearn these)

- **Splitting one file's changes across multiple commits:** use `git apply --cached` with a
  hand-crafted patch. Do not use `git add -p` for this — it is unreliable here.
- **zsh `$status` is read-only.** Never assign to it (`status=$?` aborts the script). Use `rc=$?`
  instead, or run throwaway scripts explicitly under `bash -c`.
- **`checkRateLimit` in `src/lib/rate-limit.ts`** is the shared per-IP fixed-window KV rate limiter.
  Reuse it for any new endpoint that needs per-IP throttling, passing a distinct `keyPrefix` so
  counters do not collide.
- **Cloudflare Worker, not Pages.** Repeated here because it has caused real bugs more than once.
- **Lock ops use `npx npm@10.9.2`, and verify with real `npx npm@10.9.2 ci` — never `--dry-run` or
  the local npm 11.** See *Dependencies & lockfile* — the npm-version mismatch on `@emnapi` optional
  peers has bitten the deploy twice.

Add to this section whenever something costs an hour to work out. That's what it's for.