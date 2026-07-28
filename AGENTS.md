# AGENTS.md — Working instructions for Claude Code in this repo

## What it is

A commercial car-dealership listings website — automotive vertical only. Real product intended for sale to dealerships; near-term target is Bundaberg Motor Group, whose real inventory serves as demo data.

## Project docs

- **DECISIONS.md** — architectural intent and reasoning
- **LENSES.md** — design judgment for new features or reshaped surfaces

Orchestrator reads both once at session start and operates from that context. Sub-agents receive pre-digested task briefs and do not read these docs themselves.

## Roles

**Owner** — the ideas and business person. Makes all high-level business-shaped and architectural decisions. Does not read or write code. Signs off on every major decision, every contest outcome, and anything irreversible before it proceeds.

**Orchestrator (you — the main Claude Code CLI session)** — reads the project docs, plans the next build phase with the owner, writes precisely scoped task briefs for sub-agents, then reviews and verifies their output before integrating. Does not write all the code itself. Brings every major decision and contest outcome back to the owner for sign-off before implementing.

**Sub-agents (background Claude Code sessions)** — do the actual coding in the repo under the orchestrator's direction. Spawned per task with a precise scope. Report back for review and integration. Do not make architectural decisions.

Mirror substantive updates, decisions, and blockers to both the CLI chat and the owner's Telegram (`chat_id` `7616953556`). Keep Telegram copy concise. Skip silently if Telegram is not configured in the environment.

## Sub-agent contest

Pull this in on demand, not by default.

When the owner calls a contest on a hard or open-ended problem, run exactly **three sub-agents in strict sequence** — never in parallel, never more than three:

1. **Agent 1 — first proposal.** Proposes a solution and writes the code for it, compiling and running it to prove it works. Finishes completely before anything else starts.
2. **Agent 2 — a genuinely different proposal.** Only after Agent 1 has finished, Agent 2 is briefed on Agent 1's result and builds a genuinely different approach — not a variation of the first.
3. **Agent 3 — the critic.** Only after Agent 2 has finished, Agent 3 critiques both proposals — weaknesses, risks, edge cases, trade-offs — and writes a comparison report. Proposes nothing of its own.

Orchestrator then synthesises the winner (one proposal whole, or the best parts of each combined) and presents it to the owner for sign-off before implementing.

## Stack

- **Astro 7** SSR with the **`@astrojs/cloudflare` v14** adapter, deployed as a **Cloudflare Worker — not Cloudflare Pages**. This distinction has caused real bugs.
- Runtime env is read via `import { env } from 'cloudflare:workers'`. The `locals.runtime.env` pattern was removed in this adapter version. `src/chatbot/get-env.ts` is the shared helper.
- **Sanity CMS** for content; **Tailwind v4**; **Cloudflare D1** (`CHAT_DB`) and **KV** (`RATE_LIMIT_KV`) for the chatbot; **Turnstile** for bot protection.
- **OpenRouter** for all LLM calls using the OpenAI-compatible API; free-tier models for now.
- Node scripts (seed, import, migrate) read secrets from `.env` via dotenv. The Sanity write token must be named `SANITY_TOKEN` and have Editor scope — read-only tokens pass dry-runs but fail on `--commit`.
- The Worker runtime reads `.dev.vars` locally and `wrangler secret` in production. These are separate from `.env` and must not be confused.

## Hard constraints

**Config as data** — All dealer-specific values (name, logo, colours, domain, contact details, AI persona, feature flags, rate limits) live in `src/config/dealer.ts` and are read at runtime. Never hardcode a dealer value anywhere else.

**All AI through `src/ai/`** — All LLM calls route through the capability tier system via the `~/ai` barrel exports (`generate`, `generateObject`, `generateStream`). Never import from `src/ai/providers/` outside that folder or call OpenRouter directly from feature code. Add a new tier if a needed capability isn't exposed yet.

**Data scripts** — Run in dry-run mode by default and require an explicit `--commit` flag to write. Always show the diff and any WARN lines to the owner before running with `--commit`. Deletions and patches must target explicit document IDs, never a broad query match.

**Filter state** — Shopper filter state lives in the URL and is read and written exclusively through the `applyFilterUrl` helper. No feature constructs filter URLs independently.

**Determinism** — Only map data values that can be confidently matched. Anything ambiguous must fall through to a logged WARN and never be silently guessed or defaulted.

## Commits and pushing

One commit per completed ticket. Push only when the owner explicitly approves — never push unilaterally. Use `git push --force-with-lease` if a history rewrite is ever needed, never plain `--force`.

## Dependencies & lockfile (prevents Cloudflare build failures)

This is an **npm** project (`package-lock.json`; `packageManager` is pinned to npm). Cloudflare's build runs `npm ci`, which **fails the deploy** if `package.json` and `package-lock.json` drift — the common Cloudflare Workers pain point. Rules:

- After ANY dependency change, run a **full `npm install`** (never a partial/offline install) and commit the updated `package-lock.json` **in the same commit**. Verify with `npm ci --dry-run` before pushing.
- Never hand-edit dependency versions in `package.json` without re-running `npm install`.
- Do **not** introduce a second package manager (pnpm/yarn) or a second lockfile — the repo is npm-only. (`npm ci` is already the frozen-lockfile guard; that's a feature — it surfaces drift at build time rather than shipping a broken deploy.)
- Sub-agents must not run installs that could partially update the lock; the orchestrator owns dependency changes and re-syncs the lock.

## Data model

- **`vehicleSpecs`** — typed object holding filterable dimensions: `bodyType`, `transmission`, `fuelType`, `driveType`, `seatCount`, `year`, `odometer`, `condition`. Values are lowercase codes that also serve as URL filter params.
- **`details[]`** — loose key/value array for arbitrary extras (sunroof, tow pack). Not redundant with `vehicleSpecs` — keep both.
- **`dealerNotes`** — private field containing dealer shorthand. Never expose in any public-facing data projection. Consumed by AI features only.
- **`scripts/lib/vehicle-specs.ts`** — single source of truth for mapping `details[]` labels to `vehicleSpecs` fields. `petrol-electric` maps to `hybrid`, not `electric` (hybrid patterns tested before generic electric). Ambiguous transmission compounds fall through to WARN. Preserve both behaviours.
- **`LISTING_FIELDS`** in `src/lib/listing.ts` — shared GROQ projection used by all pages. Extend it when pages need new fields. Do not alter display helpers unless the ticket explicitly says to. `dealerNotes` is intentionally excluded.
- Listings are Sanity documents. `category` is locked to `automotive` — do not reintroduce any real-estate schema or logic.

## Dev notes

- Start the dev server in background mode: `astro dev --background`. Manage with `astro dev stop`, `astro dev status`, `astro dev logs`.
- A Vite "file does not exist in optimize deps" 500 after a config or dependency change is a stale optimizer cache — delete `node_modules/.vite` and restart. Not a code bug.
- In zsh, `$status` is read-only. Never assign to it (`status=$?` will abort the script). Use `rc=$?` instead, or run throwaway scripts explicitly under `bash -c`.
- `checkRateLimit` in `src/lib/rate-limit.ts` is the shared per-IP fixed-window KV rate limiter. Reuse it for any new endpoint that needs per-IP throttling by passing a distinct `keyPrefix` so counters do not collide.