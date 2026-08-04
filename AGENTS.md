# AGENTS.md — Working instructions for Claude Code in this repo

## START HERE — every session, every agent

Read this file. Then **stop and wait for a ticket**.

Do not read `VISION.md`, `DECISIONS.md`, `LENSES.md`, or `REMAINING-WORK.md` unless
the ticket you are working from explicitly names them. Do not survey the codebase.
Do not plan ahead. The ticket tells you what to read and what to do.

A ticket that arrives already specified gets implemented — not re-planned. If you
disagree with the plan, say so and bring it back to the owner. Do not silently
substitute your own approach.

---

## What this repo is

Rebirth Auto — a commercial car-dealership listings website, automotive vertical only.
Near-term target: Bundaberg Motor Group (real inventory, real demo). Long-term: a
multi-tenant SaaS platform sold across Australian dealerships.

---

## Roles

**Owner** — the ideas and business person. Makes all high-level business-shaped and
architectural decisions. Does not read or write code. Signs off on every major
decision, every contest outcome, and anything irreversible before it proceeds.

**Planning surface** — the Claude.ai project where the owner works. Turns business
decisions into architecture and written tickets.

**Orchestrator (you — the main Claude Code CLI session)** — plans, delegates, reviews.
You never write or edit application code yourself. Every coding task is handed to a
sub-agent via a precisely scoped task brief; you review and verify their output before
integrating. Bring every major decision and contest outcome to the owner for sign-off
before implementing.

The only hands-on actions you perform directly: writing task briefs; reading the
codebase to plan and review; reviewing and integrating sub-agent work; git commits,
merges, and pushes; dependency and lockfile re-syncs; editing the project docs
(`AGENTS.md` / `DECISIONS.md` / `LENSES.md` / `VISION.md`). Anything that writes or
changes code is delegated — no exceptions, even for a one-line fix.

**Sub-agents** — do all the actual coding under the orchestrator's direction. Spawned
per task with a precise scope. Do not make architectural decisions.

Mirror substantive updates, decisions, and blockers to the owner's Telegram. The chat
ID is read from the environment (`OWNER_TELEGRAM_CHAT_ID`) — never hardcode it in the
repo. Keep Telegram copy concise. Skip silently if not configured.

---

## Project docs (read only when a ticket says to)

- `VISION.md` — what the product is trying to become
- `DECISIONS.md` — architectural decisions and reasoning
- `LENSES.md` — design judgment for new features
- `REMAINING-WORK.md` — outstanding work and current status

---

## Sub-agent contest (on demand only — not default)

When the owner calls a contest on a hard or open-ended problem, run exactly **three
sub-agents in strict sequence** — never in parallel, never more than three:

1. **Agent 1 — first approach.** Briefed on the problem only. Proposes and builds a
   working proof. Finishes completely before anything else starts.

2. **Agent 2 — competing approach.** Briefed on **the same problem statement and
   nothing whatsoever from Agent 1** — not the code, not a summary, not the general
   shape. If Agent 2's brief references Agent 1 in any way, the contest is void and
   must be re-run. Agent 2 builds its own working proof.

3. **Agent 3 — the critic.** Only after Agent 2 has finished. Sees both proofs.
   Critiques both honestly — weaknesses, risks, edge cases, trade-offs. Proposes
   nothing of its own.

**Synthesis.** The orchestrator names a winner and states explicitly what it imports
from the losing approach, or states that nothing was imported and why. Goes to the
owner for sign-off before anything is implemented.

---

## Autonomous runs (`/auto`)

`/auto` works through already-approved queued work without pausing for turn-by-turn
direction. It exists to burn down a backlog the owner has already signed off on.

**`/auto` may:** pick up approved tickets; delegate to sub-agents; review and integrate
their work; run tests and builds; make local commits; update `REMAINING-WORK.md`.

**`/auto` may never:**
- Push, deploy, run any data script with `--commit`, or write/rotate secrets.
- Start work that has not already been approved. If it runs out of approved work, it
  stops and reports — it does not invent the next ticket.
- Make an architectural decision, resolve a contest, or choose between competing
  approaches.
- Skip two-phase discipline. A phase-1 proposal waits for the owner.
- Overwrite, regenerate, or truncate the append-only audit records.
- Edit `VISION.md`, `DECISIONS.md`, `LENSES.md`, or `AGENTS.md`.

If in doubt, `/auto` stops and asks.

---

## SUB-AGENT START HERE
## Stack

- **Astro 7** SSR with **`@astrojs/cloudflare` v14**, deployed as a **Cloudflare
  Worker — not Cloudflare Pages**. This distinction has caused real bugs.
- Runtime env: `import { env } from 'cloudflare:workers'`. The `locals.runtime.env`
  pattern was removed in this adapter version. `src/chatbot/get-env.ts` is the shared
  helper.
- **Sanity CMS** for content; **Tailwind v4**; **Cloudflare D1** (`CHAT_DB`) and
  **KV** (`RATE_LIMIT_KV`) for the chatbot; **Turnstile** for bot protection.
- **OpenRouter** for all LLM calls via the OpenAI-compatible API; free-tier models
  for now.
- Node scripts (seed, import, migrate) read secrets from `.env` via dotenv. The
  Sanity write token must be named `SANITY_TOKEN` with Editor scope — read-only tokens
  pass dry-runs but fail on `--commit`.
- The Worker runtime reads `.dev.vars` locally and `wrangler secret` in production.
  These are separate from `.env` and must not be confused.

---

## Hard constraints

**Two-phase tickets** — Every ticket runs in two phases. Phase 1: investigate, read
the relevant code, and propose — what you found, what you'd change, which files you'd
touch, what could go wrong. Then stop and wait for owner approval. Phase 1 writes no
code. Phase 2: execute the approved plan. A ticket phrased as "just do X" still runs
both phases unless the owner explicitly waives phase 1 in that ticket.

**Private dealer data stays private** — `dealerNotes`, cost or floor pricing, and
private condition flags must never reach a shopper-facing surface: not in rendered
text, not in an API response, not paraphrased by Rebi, and not as an input to ranking,
sorting, or recommendation. Shopper-facing AI is grounded only on public projection
data. Private context goes only to dealer-facing AI features on dealer-facing paths.
This is a commercial promise to the dealer, not just a code convention.

**Config as data** — All dealer-specific values (name, logo, colours, domain, contact
details, AI persona, feature flags, rate limits) live in `src/config/dealer.ts` and
are read at runtime. Never hardcode a dealer value anywhere else.

**All AI through `src/ai/`** — All LLM calls route through the capability tier system
via the `~/ai` barrel exports (`generate`, `generateObject`, `generateStream`). Never
import from `src/ai/providers/` outside that folder, and never call OpenRouter or any
provider directly from feature code. Add a new tier if a needed capability isn't
exposed yet.

**Data scripts** — Dry-run mode by default; require explicit `--commit` to write.
Always show the diff and WARN lines to the owner before `--commit`. Deletions and
patches must target explicit document IDs, never a broad query match.

**Filter state** — Shopper filter state lives in the URL and is read and written
exclusively through the `applyFilterUrl` helper. No feature constructs filter URLs
independently.

**Determinism** — Only map data values that can be confidently matched. Anything
ambiguous must fall through to a logged WARN and never be silently guessed or
defaulted.

---

## Commits and pushing

One commit per completed ticket. Push only when the owner explicitly approves — never
push unilaterally. Use `git push --force-with-lease` if a history rewrite is needed,
never plain `--force`.

---

## Audit records — append-only, never overwrite

`docs/AUDIT-LEDGER.md` and the audit artefacts it references (`docs/AUDIT-FINDINGS.md`,
`docs/AUDIT-PUSHBACK.md`, any future `audits/` folder) are a permanent, append-only
historical record. They must not be overwritten, regenerated, truncated, or deleted by
any process — including `/auto`. A new audit appends a new dated section; a correction
appends a dated note. History is never rewritten. `/auto`'s authority to refresh status
docs does not extend to these files.

---

## Dependencies & lockfile

This is an **npm** project. Cloudflare's build runs `npm ci`, which fails the deploy
if `package.json` and `package-lock.json` drift.

- **Use `npx npm@10.9.2` for ALL lock operations** — never the ambient local npm
  (which is 11.x here and not corepack-managed). npm 11 and npm 10.9.2 disagree on
  optional-peer packages: npm 11 prunes `@emnapi/*@2.0.0-alpha.3` that npm 10.9.2
  requires. This has broken the deploy twice.
- After any dependency change, run a full `npx npm@10.9.2 install` and commit the
  updated `package-lock.json` in the same commit.
- **Verify with real `npx npm@10.9.2 ci` before pushing** — not `--dry-run`, not
  local npm 11. If the lock is wedged: `rm -rf node_modules package-lock.json &&
  npx npm@10.9.2 install`, then confirm with `npx npm@10.9.2 ci` (exit 0) plus
  `npm run build`.
- Never hand-edit dependency versions without re-running install.
- Do not introduce a second package manager or lockfile. Sub-agents must not run
  installs; the orchestrator owns all lockfile changes.

---

## Data model

- **`vehicleSpecs`** — typed filterable dimensions: `bodyType`, `transmission`,
  `fuelType`, `driveType`, `seatCount`, `year`, `odometer`, `condition`. Values are
  lowercase codes that also serve as URL filter params.
- **`details[]`** — loose key/value array for arbitrary extras (sunroof, tow pack).
  Not redundant with `vehicleSpecs` — keep both.
- **`dealerNotes`** — private field, dealer shorthand. Never expose on any
  public-facing surface. Dealer-facing AI features only. See private-data constraint.
- **`scripts/lib/vehicle-specs.ts`** — single source of truth for mapping `details[]`
  labels to `vehicleSpecs` fields. `petrol-electric` maps to `hybrid`, not `electric`.
  Ambiguous transmission compounds fall through to WARN. Preserve both behaviours.
- **`LISTING_FIELDS`** in `src/lib/listing.ts` — shared GROQ projection used by all
  pages. Extend it when pages need new fields; do not alter display helpers unless the
  ticket explicitly says to. `dealerNotes` is intentionally excluded; any future
  private field must be too.
- Listings are Sanity documents. `category` is locked to `automotive` — do not
  reintroduce real-estate schema or logic.

---

## Dev notes

- Start the dev server in background mode: `astro dev --background`. Manage with
  `astro dev stop`, `astro dev status`, `astro dev logs`.
- A Vite "file does not exist in optimize deps" 500 after a config or dependency
  change is a stale optimiser cache — delete `node_modules/.vite` and restart.

---

## Field notes (hard-won — do not relearn these)

- **Splitting one file's changes across multiple commits:** use `git apply --cached`
  with a hand-crafted patch. Do not use `git add -p` — it is unreliable here.
- **zsh `$status` is read-only.** Never assign to it. Use `rc=$?` instead, or run
  throwaway scripts explicitly under `bash -c`.
- **`checkRateLimit` in `src/lib/rate-limit.ts`** is the shared per-IP fixed-window
  KV rate limiter. Reuse it for any new endpoint that needs per-IP throttling, passing
  a distinct `keyPrefix` so counters don't collide.
- **Cloudflare Worker, not Pages.** Repeated here because it has caused real bugs.
- **Lock ops use `npx npm@10.9.2`, verified with real `npx npm@10.9.2 ci`** — never
  `--dry-run` or local npm 11. The `@emnapi` optional-peer mismatch has broken the
  deploy twice.

Add to this section whenever something costs an hour to work out.