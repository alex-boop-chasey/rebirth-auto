# BUILD_SUMMARY.md — Autonomous build run

Branch: `build/autonomous-run` (not pushed — the final push is the owner's sign-off gate).
14 commits, one per ticket. `npx astro check`: **0 errors** across 125 files. Live-smoke-tested.

## Headline

The premise going in was a large unbuilt backlog. A full ground-truth audit
(`docs/reports/todo-ground-truth-audit.md`) found the **entire chatbot pipeline — the actual
near-term product goal — was already built and shipped** (all three Rebi entry points,
continuity journey, cross-function chat, colour search, staggered results, comparison
Ask-Rebi entry, Studio schema-UX). The todo.md "next up" list was stale. So this run: verified
that milestone end-to-end, closed the one genuine code gap (fuel economy), then built out the
**entire remaining backlog** as env-flagged, stub-backed, demoable features.

## What was built (this run)

### Genuine gap closed
- **Fuel economy (L/100km) field** — end-to-end: schema → projection → listing display →
  grounding (Rebi can now *state* a vehicle's economy) → compare dimension (skips pairs missing
  the figure). Determinism: real data only, never invented.

### New shopper features (all env-flagged, stub-backed)
- **Trade-in valuation** (`/trade-in`) — form → stubbed Redbook valuation band. *Enabled.*
- **Saved searches + email alerts** — "Save this search" (reuses the canonical filter query) →
  D1-persisted → stubbed confirmation email. Periodic alerting = documented cron drop-in. *Enabled.*
- **Book a service** (`/service`) — booking-request flow → D1 → stubbed confirmation. Copy is
  always "a request, not a confirmed appointment"; invents no availability. *Enabled.*
- **Price history / "Just Reduced"** — real `priceHistory` field + badge/timeline; a
  deterministic demo synthesizer that is **off in production** (only fills empty listings when
  `STUB_PRICE_HISTORY` is on — proven unreachable when off). *Enabled (real data only until demo flag on).*
- **Customer accounts** (`/account`) — DEMO-ONLY: email-only mock sign-in, service history,
  interests. **No password/session/credential handling**; 503s rather than wiring real identity;
  the mandatory paid security review is a recorded BLOCKER. *Off by default.*

### Rebi capability + dealer tools
- **Manufacturer + review grounding** — two new external-reference grounding sources
  (structured stubs), additive/fail-open/price-stripped, **off by default** and proven
  byte-identical to today when off; firewall allow-list cannot be widened by them.
- **Web search for Rebi** — URL-allowlist supplementary source, same off-by-default guarantee;
  stub only ever returns allowlisted-domain URLs.
- **Rebi in Studio** — the description generator extended into an editor assistant (selling
  points, tighten, tone-rewrite) through the same `writing` tier; default behaviour preserved;
  determinism + server-only `dealerNotes` intact.
- **Carsales upload** — dealer Studio document action → stubbed carsales id+URL. Published+active
  listings only (drafts can't be syndicated); Studio-origin restricted. *Off by default.*
- **Dealer listing-creation PWA** (`/capture`) — standalone mobile-first scaffold: photo + voice
  (Web Speech) + rego/VIN → deterministic assembly (source+confidence tracking, OEM>photo>voice
  merge) → resolve-never-invent make/model → schema validation → **draft-only** (Sanity write
  stubbed, owner-gated worker token). SW hard-scoped to `/capture`. *Off by default.*
- **Agentic search foundation** — deterministic `search_inventory`/`get_listing` tools
  (anti-hallucination by construction: enum-locked filters + GROQ, real stock only) + a gated-off
  agentic-loop scaffold; the multi-turn tool loop is the marked paid drop-in. *Off by default.*

### Tooling / infra / data
- **Deps report** (`scripts/deps-report.ts`) + `docs/dependency-tracking.md` (safe-bump process).
- **`docs/cloudflare-security.md`** audit + 6 owner account-action rows in TODO_KEYS (flags
  missing security response headers as the top gap).
- **Dry-run data scripts**: `seed-business-info.ts` (from placeholders, WARNs on unfillable),
  `reconcile-brands.ts` (surfaced the *real* brand diff: claimed-absent Jeep/Leapmotor vs
  present-unclaimed Ford/GWM/Holden/Mazda/Mitsubishi/Toyota). No `--commit` run.

### Verified live (no paid LLM calls)
Homepage renders hero + Rebi overlay + trade-in/service nav; `/trade-in` and `/service` render
(200); `/account` and `/capture` correctly redirect (302, off by default); `/compare` and the
shopper site intact; PWA manifest serves; **zero service-worker references on the shopper site**.

## Stub convention (every integration)
`src/stubs/<service>.ts` exports the real interface; `useStub = !env.<KEY> || truthy(env.STUB_<X>)`
(auto-stubs until a credential is added); `// TODO_KEYS:` markers at every integration point; a
row in `TODO_KEYS.md`. Going live = add the credential + flip the flag, no code change. Stubs are
deterministic (no `Math.random`, no module-level dates) and never call a paid API or write to a
third party. Data writes stay dry-run/owner-gated.

## What was deferred (post-milestone vision) — and why
Not built this run because the project's own docs gate them, and building now would be a harmful
refactor of working code or produce nothing demoable:
- **Extract the chatbot kernel / "plug into any website"** — gated behind the owner's 100%
  snapshot fork (an owner action); they're refactors of the whole codebase, not features.
- **Multi-tenant SaaS** — `DECISIONS.md` requires a paid human security review before real dealer
  data; conventions already point there (config-as-data).
- **Experience Mode** — a design-heavy UX prototype; a hollow flagged version would misrepresent it.
- **Point-of-sale integration** — per-dealer, targets an unknown platform; has no demonstrable
  surface, so a generic stub adds code without demo value. Documented drop-in instead.
- **Full multi-turn agentic tool loop** — needs a paid tool-calling model + provider transport
  (the deterministic tools + single-shot path ARE built; the loop is the marked drop-in).

## Audited next steps (prioritised)
1. **Review this branch + fork the 100% snapshot** (the designed decision point) — unblocks the
   kernel/plug-into-any-website line.
2. **Owner data/infra** (all in `TODO_KEYS.md`, no code): fill `businessInfo` (dry-run script
   ready); reconcile brands to real inventory (diff ready); apply the prod D1 migrations
   (`0003`–`0005`) `--remote`; add security response headers; optionally `GROUNDING_KV`.
3. **Turn on the demo flags you want to show** — trade-in/service/saved-search are already on;
   flip `accounts`, `capture`, the grounding sources, `webSearch`, `carsales`, and
   `STUB_PRICE_HISTORY` per what you want to demo.
4. **Restore Haiku on the `writing` tier** for the demo (per the standing memory note) — the chat
   reply is already Haiku; the description/structured tiers still default to the free stopgap.
5. **Activate real integrations in priority order** (each is a credential + flag): email (Resend)
   → Redbook (trade-in + VIN) → carsales → vision → then the security-reviewed customer auth.

## Known issues / things to check
- **Demo features are off by default** (accounts, capture, grounding sources, web-search,
  carsales, price-history synth) — they redirect/no-op until you flip the config/env flag.
- **Fuel economy / real price history are invisible until data exists** — no fabricated backfill;
  enter values in Studio (or flip `STUB_PRICE_HISTORY` for demo price drops).
- **Customer accounts is a demo scaffold, NOT secure** — do not point it at real PII before the
  security review; it 503s if a real auth key is added, by design.
- **Prod D1 tables** (journey `0003`, saved_searches `0004`, service_bookings `0005`) are
  local-only until the owner applies them `--remote`. All access is fail-open, so nothing breaks.
- **Chat now uses paid Haiku** — confirm OpenRouter credit before the demo, or the free fallbacks carry it.
- **Nothing pushed** — everything is local on `build/autonomous-run`. Review, then approve the push
  (`git push --force-with-lease origin main`, or merge the branch).

---

## /auto run 2 (autonomous mode) — additions

Ran under the new `/auto` mode (`.claude/commands/auto.md`): commit-per-checkpoint, no stopping.

- **Comparison "Balance" (contest v3)** — shipped as the real `/compare` in the site's light theme
  (`fa52bff`). The dark look was a `prefers-color-scheme: dark` block firing on OS dark mode; removed
  (site is light-only, now a standing memory). Scratch `/compare-lab` candidates cleaned up.
- **Real Supabase authentication** (`cdc58c6`) — replaced the `/account` demo stub with a real
  Supabase SSR auth foundation ported from `astro-users-demo` and adapted to this project: cookie
  client + middleware (guards `/account`, scoped off the shopper site) + Astro Actions
  (signUp/signIn/signOut/password-reset/update) with Cloudflare Turnstile; pages `/login /signup
  /account /check-email /reset-password`, re-skinned light, brand/copy from `dealerConfig.accounts`
  (config-as-data, `accounts.enabled` gate preserved). The Turnstile secret is read Worker-safe via
  `cloudflare:workers`. **Credentials live only in gitignored `.env`/`.dev.vars` — never committed.**
  Production hardening + the DECISIONS.md security review before real customer PII remain a documented
  TODO_KEYS blocker. `accounts` now defaults enabled (real, working feature); the other demo-only
  stub flags (capture, grounding sources, carsales) were reset to their `false` defaults.
- **Site-wide security headers** (`1ad7a81`) — nosniff + Referrer-Policy + X-Frame-Options SAMEORIGIN
  on every response (the top gap from `docs/cloudflare-security.md`). Permissions-Policy and a CSP are
  documented follow-ups (they'd break the chatbot mic / external scripts if added blindly).

### Still owner-gated / parked (unchanged this run)
- Owner data/infra (dry-run scripts ready; writes are yours): `businessInfo` fill, brand reconciliation,
  prod D1 migrations (`0003`–`0005` `--remote`), `GROUNDING_KV` binding, Sanity MCP install, the CSP +
  Permissions-Policy headers, the 100% snapshot fork.
- Parked vision items (per your instruction): kernel extraction, plug-into-any-website, multi-tenant,
  Experience Mode, POS, the paid multi-turn agentic loop.
- No contest was pending this run (the comparison contest already ran and you judged it).

### Local-only (not committed)
Your demo-flag toggles for testing (`dealer.ts` — capture/grounding/carsales were flipped on earlier)
were reset to committed defaults; flip them again locally to demo those. `STUB_PRICE_HISTORY=true`
lives in your gitignored `.dev.vars`. Your two `.rtf` docs were left untouched.

---

## /auto run 3 (autonomous) — edits-1.txt fixes

The 3 open items from `docs/edits-1.txt` (the "Accounts dead-end" item was already done via the
Supabase auth port). Contest designation: none. Checkpoint `3a3ba6e`.

- **Rebi visual consistency + globalize** (`e14398d`) — the `/compare` "white feathered" backdrop was
  caused by `.balance-page` painting its colour washes on `<body>` (which the dreaming filter skips so
  it can't clip `#reb-chat`); moved them onto a `.page-bg` body-child so Rebi's greyed+blurred backdrop
  now applies identically everywhere (visually confirmed). Extracted Rebi's styles → `src/styles/rebi.css`
  and the oscillator sounds → `src/components/widgets/rebi-sounds.ts` (behaviour byte-identical) for
  easy editing.
- **Compare-agent role** (`90d3a0d`) — in compare context a decision criterion no longer runs a generic
  inventory search. It maps the criterion to a compare-verdict dimension, deterministically ranks the
  COMPARED cars (`normDim`/`SCORE_DIMS`, read-only), and opens the winner's listing with a grounded
  announcement (new config-gated, rate-limited `/api/compare-pick`). Un-rankable → grounded-chat
  fallback (never a guess or a generic search). Role still releases on an explicit fresh-search intent;
  all other chat contexts unchanged. Endpoint verified deterministic (cheapest→value, low-kms→lowkm,
  newest→newer all return the correct compared car + slug).
- **Results centering** (`a5a3a31`) — `.inventory-grid` caps its width to the result count and
  `margin-inline:auto` centres a sparse result set within the 55px gutters; a full grid still fills.
