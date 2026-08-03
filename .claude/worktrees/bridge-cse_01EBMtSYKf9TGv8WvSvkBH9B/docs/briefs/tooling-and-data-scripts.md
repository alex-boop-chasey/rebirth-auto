# Task brief — Tooling + owner-gated data scripts (scripts/docs only, no runtime changes)

Four deliverables, all node scripts or docs. No changes to `src/` runtime, no worker code, no
external calls, no data writes. `npx astro check` stays green.

## Context
- Node scripts live in `scripts/` and read secrets from `.env` via dotenv (see `scripts/seed.ts`,
  `scripts/import-bundaberg.ts`, `scripts/migrate-details-to-specs.ts` for the established pattern:
  dotenv, a Sanity client with `SANITY_TOKEN`, **dry-run by default, `--commit` to write**, print a
  diff + WARN lines, target explicit document ids never broad queries).
- Determinism: only map values that can be confidently matched; anything ambiguous → a logged WARN,
  never a silent guess (this is a hard project rule).

## 1. Dependency version tracking — `scripts/deps-report.ts` + `docs/dependency-tracking.md`
- Script: read `package.json` (+ `package-lock.json` if helpful) and print a report of current
  pinned versions for the key stack (astro, @astrojs/cloudflare, @sanity/*, tailwindcss, wrangler,
  typescript). If `npm outdated --json` is available it MAY shell out and format it, but must
  DEGRADE GRACEFULLY (offline / command failure → just report current pinned versions, never crash).
  No writes, no upgrades. `--json` flag optional for machine output.
- Doc: `docs/dependency-tracking.md` — the safe update process for THIS stack (the known-tricky bits
  from AGENTS.md: the Cloudflare adapter v14 `cloudflare:workers` env pattern, the `node_modules/.vite`
  stale-optimizer gotcha, "Worker not Pages"), plus a checklist for a safe dependency bump.

## 2. Cloudflare security tooling — `docs/cloudflare-security.md`
- An audit/roadmap doc: what Cloudflare features are relevant (WAF managed rules, Bot Fight/Turnstile —
  note Turnstile is ALREADY used for the chatbot, rate limiting, Access for Studio, security headers,
  Cloudflare's automated vulnerability scanning), what's already in place vs available, and which need
  owner/account-level action. Add corresponding owner-action rows to `TODO_KEYS.md`.

## 3. businessInfo seed — `scripts/seed-business-info.ts` (DRY-RUN default)
- Read the current placeholder business facts from `src/chatbot/knowledge.ts` and the `businessInfo`
  Sanity schema (`src/sanity/schemaTypes/businessInfo.ts`) to build a `businessInfo` document draft
  (phone, hours, brands, years in business, address, services) from the placeholder values as a
  STARTING POINT for the owner to edit.
- **Dry-run by default**: print the document it WOULD create/patch + WARN on any field it can't fill
  confidently (leave those blank, never invent). `--commit` (which you will NOT run) would upsert the
  single `businessInfo` doc by its explicit id. Print clearly that real facts must be reviewed by the
  owner before `--commit`. Add/confirm the owner-gated row in `TODO_KEYS.md`.

## 4. Brand reconciliation — `scripts/reconcile-brands.ts` (DRY-RUN default, read-only analysis)
- Compare the brand list Rebi believes is stocked (in `src/chatbot/knowledge.ts`, ~lines 36-41) against
  the ACTUAL makes present in inventory. Source the real makes from `scripts/data/bundaberg-40.json`
  (the demo inventory) and/or a Sanity read if a token is present (fail-open to the json file if not).
- Print: brands claimed-but-absent (e.g. Honda/Hyundai/Kia) and makes present-but-unclaimed (e.g.
  Ford/Mitsubishi), as a reconciliation diff, with a recommended aligned brand list. Determinism: only
  report confident matches; ambiguous names → WARN. This is ANALYSIS ONLY (no writes at all; there is
  no `--commit` path needed — it just reports the diff the owner acts on). Note in output that
  `knowledge.ts` is a source file the owner edits, not a Sanity doc.

## Scope guardrails — do NOT
- Do NOT run any script with `--commit`. Do NOT actually write to Sanity. Do NOT change `src/` runtime
  code (editing `knowledge.ts` is NOT part of this — the reconcile script only REPORTS). Do NOT make
  real network calls that require credentials (degrade gracefully when a token/network is absent). Do
  NOT use Math.random. Do NOT commit.

## Acceptance criteria (report each)
1. `scripts/deps-report.ts` + `docs/dependency-tracking.md` — what the report prints; graceful-offline behaviour.
2. `docs/cloudflare-security.md` — sections; TODO_KEYS owner rows added.
3. `scripts/seed-business-info.ts` — dry-run output shape; confirm no write path is triggered; WARN behaviour.
4. `scripts/reconcile-brands.ts` — the diff it prints for the current data (claimed-absent / present-unclaimed); read-only.
5. `npx astro check` before N / after M (M ≤ N). If a script can be run in dry-run safely (no token needed, e.g. deps-report and reconcile-brands off the json), run it and paste the actual output.

## Report format
Concise: files, the actual dry-run output of deps-report + reconcile-brands (run them — they need no secrets), confirmation the two Sanity scripts have dry-run defaults and were NOT committed, astro check before/after.
