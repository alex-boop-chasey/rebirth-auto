# System Map & Audit Checklist — Rebirth Auto

> A structured inventory of every file, system, process and external dependency the site
> runs on. Built by surveying the real codebase (paths verified to exist as of 2026-07-29).
> Companion to `docs/DECISIONS.md` (intent), `AGENTS.md` (rules), `docs/REMAINING-WORK.md`
> (backlog) and `TODO_KEYS.md` (stub/integration registry).

---

## 0. How to use this doc

- **Whole-system audit:** walk Section 2 top-to-bottom, ticking each subsystem's checklist,
  then run the cross-cutting sweeps in Section 3. Finish with the dependency table in Section 4.
- **Single-aspect audit:** jump to one `##` subsystem (e.g. "5. Chatbot", "9. Accounts") and work
  only its **Audit checklist** — each subsystem is self-contained (files, services, config, entry
  points, gotchas, checks).
- **Status legend** (one line per subsystem, plus per check-item boxes):
  `☐ unreviewed` · `✅ reviewed — clean` · `⚠️ issue found`. Annotate an issue with a short
  note + date, e.g. `⚠️ 2026-07-29: over-budget picks unflagged`.
- Tick a check item by changing `- [ ]` to `- [x]` as you verify it. Update the subsystem
  **Status:** line to match the worst finding across its items.

---

## 1. Runtime overview

A request is served entirely by **one Cloudflare Worker** (this is a Worker, not Pages —
`wrangler.jsonc` `main: @astrojs/cloudflare/entrypoints/server`). Astro 7 runs SSR inside it.

```
Shopper browser
   │  DNS + TLS + edge cache + (planned) WAF
   ▼
Cloudflare  ──►  Worker (Astro SSR)
                   │
                   ├─ src/middleware.ts ── stamps security headers on EVERY response;
                   │     guards ONLY /account /login /signup via Supabase session
                   │
                   ├─ Astro page (.astro, prerender=false) OR API endpoint (src/pages/api/*)
                   │
                   ├─ Sanity CMS (GROQ) ........ inventory + businessInfo  (src/sanity/lib/client)
                   ├─ D1  binding CHAT_DB ....... chat sessions/messages, journey,
                   │                              saved_searches, service_bookings
                   ├─ KV  binding RATE_LIMIT_KV . per-IP fixed-window limiter (+ optional GROUNDING_KV)
                   ├─ OpenRouter (via src/ai/) .. all LLM calls, capability-tier routed
                   ├─ Supabase Auth ............. sign-in/up/reset (real)
                   └─ Turnstile ................. bot protection on chat + auth
```

- Runtime env/bindings are read via **`import { env } from 'cloudflare:workers'`** — the
  `locals.runtime.env` pattern was removed in `@astrojs/cloudflare` v14. Shared readers:
  `src/chatbot/get-env.ts` (chat/journey), `src/lib/capture/env.ts`, `src/lib/generate-description/env.ts`,
  and an inline reader in `src/actions/index.ts`.
- **Two separate secret stores:** `.env` (+ `dotenv`) for Node scripts (seed/import/migrate);
  `.dev.vars` locally / `wrangler secret` in prod for the Worker. `PUBLIC_*` vars are inlined at
  build via `import.meta.env`; server secrets must be read from the Worker runtime, not
  `import.meta.env`.
- **No shared page layout.** Each top-level page defines its own `<html>` shell inline
  (`src/layouts/` holds only `AuthLayout.astro`). The `Layout.astro` referenced in
  `src/chatbot/README.md` does **not** exist — treat that as a stale doc note.

---

## 2. Subsystems

## 1. App shell, layouts & routing

**Status:** ☐ unreviewed

**What it does** — Serves the shopper site and every route; injects the site-wide chat widget,
compare tray and (per page) the search dock and filter drawer.

**Key files & dirs**
- Pages: `src/pages/index.astro` (home/inventory), `src/pages/listings/[slug].astro` (detail),
  `src/pages/404.astro`, plus feature pages (`compare.astro`, `compare-tools.astro`, `service.astro`,
  `trade-in.astro`, `account.astro`, `login.astro`, `signup.astro`, `check-email.astro`,
  `reset-password.astro`, `capture/index.astro`, `labs/*`).
- Partial: `src/pages/partials/inventory.astro` (fetch-swap fragment for filter results).
- Layout: `src/layouts/AuthLayout.astro` (auth pages only; other pages inline their own `<html>`).
- Middleware: `src/middleware.ts` (security headers site-wide + auth guard on the auth surface).
- Site-wide UI injected per page: `src/components/widgets/ChatWidget.astro`,
  `src/components/CompareTray.astro`.
- Nav/footer are defined inline within each page's shell (grep confirms `<footer>` in
  `index.astro`, `service.astro`, `trade-in.astro`, `compare*.astro`, `listings/[slug].astro`,
  `404.astro`).

**External services / bindings** — Sanity (inventory read on home/detail). No D1/KV directly at
the shell level.

**Config, env & flags** — `dealerConfig.inventory.*` (page size, sort, dimensions),
`dealerConfig.identity.name`, `dealerConfig.locale.*`; `astro.config.mjs` `site` URL for
canonical/OG/sitemap.

**Data flow / processes** — Home reads filter state from the URL, builds the shared GROQ query,
renders SSR; sets `Cache-Control: s-maxage=60, stale-while-revalidate=300`. `prerender = false`
on dynamic pages.

**Entry points** — `/`, `/listings/[slug]`, `/404`, and all feature routes below.

**Constraints & gotchas** — Config-as-data (no dealer literals in pages); light-theme standard
(`bg-slate-50/white/slate-900`); URL is the single source of truth for filter state. Gotcha: no
shared `Layout.astro` — shell changes must be made per page; the README reference is stale.

**Audit checklist**
- [ ] No hardcoded dealer values (name, domain, contact) in any `.astro` page — all from `dealerConfig`.
- [ ] Every dynamic page sets `prerender = false` and reads request-time data (no build-time staleness).
- [ ] Canonical URL / OG / sitemap derive from `astro.config.mjs` `site` (currently a `.pages.dev` placeholder — verify before launch).
- [ ] Security headers from `src/middleware.ts` land on page responses (incl. redirects).
- [ ] Light-theme + focus-ring conventions honoured; nav/footer consistent across pages.
- [ ] `Cache-Control` on `/` does not leak per-visitor content (anonymous only).

## 2. Dealer configuration (config-as-data)

**Status:** ☐ unreviewed

**What it does** — The single central object every dealer-specific value is read from at runtime —
the multi-tenant seam (DECISIONS.md Decision 1).

**Key files & dirs**
- `src/config/dealer.ts` — `DealerConfig` interface, the `dealerConfig` instance, and
  `getDealerConfig()`. Also exports `DESCRIPTION_TONES`, `BodyTypeCode`, `FilterDimension`, `SortKey`.

**External services / bindings** — none (pure data).

**Config, env & flags** — This IS the config. Notable feature flags: `chat.grounding.enabled`,
`chat.context.enabled`, `chat.journey.enabled`, `chat.search.enabled`, `ai.generateDescription.enabled`,
`ai.agenticSearch.enabled` (OFF), `priceHistory.enabled`, `tradeIn.enabled`, `savedSearch.enabled`,
`service.enabled`, `accounts.enabled` (ON), `capture.enabled` (ON — flipped in run 4),
`integrations.carsales.enabled` (OFF), plus per-feature `rateLimit` blocks and grounding sub-toggles.

**Data flow / processes** — Imported directly as `dealerConfig` or via `getDealerConfig()`
(forward-compatible with tenant resolution). `yearOptions` is a **lazy getter** (Workers pin the
clock to epoch during module eval — a top-level `new Date().getFullYear()` would yield 1970 and an
empty dropdown).

**Entry points** — none (imported library).

**Constraints & gotchas** — Config-as-data is the north-star rule: any dealer literal belongs here.
Model choice deliberately does NOT live here (owned by `src/ai/` tiers). `dealerNotes` never
appears. Gotcha: the lazy `yearOptions` getter must stay a getter.

**Audit checklist**
- [ ] Every dealer-specific literal in the codebase traces back to a `dealerConfig` key (see §3 sweep).
- [ ] No model ids or prompts leak into config (those belong to `src/ai/` and feature prompts).
- [ ] Feature flags default safely (new surfaces OFF unless deliberately enabled); `capture`/`accounts` ON is intentional and gated downstream.
- [ ] `yearOptions` remains a lazy getter; no other clock read at module top-level.
- [ ] Copy strings frame stubbed/request flows honestly (service = "request, not booked").
- [ ] Type unions (`SortKey`, `BodyTypeCode`, `FilterDimension`) stay in sync with schema + query layer.

## 3. Listings & inventory data model

**Status:** ☐ unreviewed

**What it does** — Defines the vehicle document, the shared GROQ projection, and all
listing display/formatting helpers.

**Key files & dirs**
- `src/sanity/schemaTypes/listing.ts` — the `listing` document (typed first-class fields +
  `vehicleSpecs` + loose `details[]` + staff-only fields).
- `src/lib/listing.ts` — `Listing`/`VehicleSpecs`/`PriceHistoryEntry` types, `LISTING_FIELDS`
  (shared projection), `buildSpecRows`, `formatPrice`, `getPriceDrop`, icon system, `isLowerBetter`.
- `src/lib/makes.ts` — `CAR_MAKE_OPTIONS` (make dropdown). `src/lib/portable-text.ts` — description rendering.
- `scripts/lib/vehicle-specs.ts` — single source of truth for `details[]` → `vehicleSpecs` mapping.

**External services / bindings** — Sanity (`src/sanity/lib/client.ts`, `src/sanity/lib/image.ts`).

**Config, env & flags** — `dealerConfig.locale.*` (price/date formatting),
`dealerConfig.inventory.bodyTypes`; `priceHistory` block for the drop badge.

**Data flow / processes** — Pages fetch `LISTING_FIELDS` via GROQ. `buildSpecRows` prefers typed
fields, falls back to `details[]`. `getPriceDrop` derives the "Just Reduced" badge from REAL
`priceHistory` only (request-time `nowMs` passed in — never a module-level clock).

**Entry points** — none directly (consumed by pages/chatbot/compare).

**Constraints & gotchas** — `category` locked to `automotive` (no real-estate schema). Staff-only
fields (`registrationPlate`, `stockNumber`, `dealerNotes`) are excluded from `LISTING_FIELDS` and must
never reach the public site. Keep both `vehicleSpecs` (typed/filterable) and `details[]` (one-offs).
`fuelEconomy` is stated only when present — never estimated. Gotcha: `detailIconName` still contains
legacy real-estate labels (bedroom/bathroom/land/pool) — harmless dead branches in an automotive-only site (verify).

**Audit checklist**
- [ ] `LISTING_FIELDS` excludes `dealerNotes`/`registrationPlate`/`stockNumber` (no public leak).
- [ ] All listing queries project through `LISTING_FIELDS` (no ad-hoc projection drift).
- [ ] `getPriceDrop` uses passed-in `nowMs`; no fabricated history reaches production (STUB gated — see §12).
- [ ] `fuelEconomy` never defaulted/estimated (determinism).
- [ ] Price/date formatting reads `dealerConfig.locale`, not hardcoded `en-AU`/`AUD`.
- [ ] Schema `category` stays `automotive`; no real-estate fields reintroduced.

## 4. Filters & search (structured)

**Status:** ☐ unreviewed

**What it does** — URL-driven server-side filtering + pagination of inventory, plus the
client-side fetch-swap of results and the active-filter chips.

**Key files & dirs**
- `src/lib/listings-query.ts` — `parseFilters`, `buildListingsFilter`/`buildListingsQuery`,
  `serializeFilters`/`hrefFor`, `activeChips`, enum code sets, `SORT_CLAUSES`.
- `src/lib/client/filter-url.ts` — `applyFilterUrl` (the ONE fetch-swap path) + `updateBadge`.
- Components: `src/components/filters/FilterDrawer.astro`, `.../InventoryResults.astro`,
  `.../ActiveFilterChips.astro`, `src/components/ListingCard.astro`,
  `src/components/search/SearchDock.astro` + `stage-engine.ts` + `stage.css`.
- Partial: `src/pages/partials/inventory.astro`.

**External services / bindings** — Sanity (GROQ). AI natural-language search adds OpenRouter (see below).

**Config, env & flags** — `dealerConfig.inventory.*` (pageSize, defaultSort, dimensions, bodyTypes,
price/year/odo options, showCondition); `dealerConfig.chat.search.*` for the AI search dock.

**Data flow / processes** — URL params → `parseFilters` → `buildListingsQuery` (all user values via
GROQ `$params`, never interpolated; only whitelisted sort clause + computed slice interpolated) →
SSR render or `/partials/inventory` swap via `applyFilterUrl`. Back/forward re-syncs from URL.

**Entry points** — `/` and `/?<filters>`, `/partials/inventory` (fragment). AI search: `POST /api/search`.

**Constraints & gotchas** — URL is the single source of truth; all filter-URL writes go through
`applyFilterUrl`. Unknown/malformed params fall through to a no-op (never a silent guess). Enum code
sets must mirror the Sanity schema (a `satisfies` check guards `SORT_KEYS`).

**Audit checklist**
- [ ] No feature constructs filter URLs outside `applyFilterUrl` / `serializeFilters`/`hrefFor`.
- [ ] All user filter values passed via GROQ `$params` (no string interpolation → no GROQ injection).
- [ ] Malformed params no-op rather than guess; enum sets match `src/sanity/schemaTypes/listing.ts`.
- [ ] Pagination total uses the same shared filter as the page slice (counts match results).
- [ ] Fetch-swap supersedes stale responses (the `seq` counter); popstate binds once.
- [ ] No-JS `<form>` GET still filters (repeated + comma params both parse).

## 5. Chatbot "Rebi"

**Status:** ☐ unreviewed

**What it does** — The visitor-facing AI assistant: grounded, deterministic-first replies over live
inventory + business facts, with anti-hallucination scrubbing, conversation memory, journey
continuity, and human handoff via Telegram.

**Key files & dirs**
- Core (portable, no framework deps): `src/chatbot/core.ts`, `state.ts` (D1 layer), `journey.ts`,
  `visitor.ts`, `telegram.ts`, `config.ts`, `context.ts`, `system-prompt.ts`, `knowledge.ts`
  (degraded fallback string), `get-env.ts`.
- Grounding: `src/chatbot/grounding/` — `index.ts` (orchestrator), `business-facts.ts`, `overview.ts`,
  `lookup.ts`, `context.ts`, `journey.ts`, `manufacturer.ts`, `reviews.ts`, `websearch.ts`,
  `verify.ts` (anti-hallucination firewall + `CAR_MAKES` lexicon), `cache.ts`.
- Endpoints: `src/pages/api/chat.ts`, `chat-poll.ts`, `journey.ts`, `telegram-webhook.ts`,
  `compare-pick.ts`.
- UI: `src/components/widgets/ChatWidget.astro`, `rebi-sounds.ts`, `src/components/AskRebiButton.astro`.
- Shared limiter: `src/lib/rate-limit.ts` (chatbot has its own inline `checkLimit` in `core.ts`).

**External services / bindings** — OpenRouter via `src/ai` (`chat-cheap` tier); Sanity (grounding
inventory/business facts); **D1 `CHAT_DB`** (`sessions`, `messages` — migration `0001`; `journey_events`
— `0003`); **KV `RATE_LIMIT_KV`** (per-IP limit) + optional **`GROUNDING_KV`** cache; Turnstile;
Telegram Bot API (escalation + team replies).

**Config, env & flags** — `dealerConfig.chat.grounding.*` (overview/lookup/manufacturer/reviews/
webSearch, anti-hallucination), `chat.context.*`, `chat.journey.*`. Secrets via `get-env.ts`:
`OPENROUTER_API_KEY`, `TELEGRAM_BOT_TOKEN/CHAT_ID/WEBHOOK_SECRET`, `CHATBOT_TURNSTILE_SECRET_KEY`
(falls back to `TURNSTILE_RB_LISTINGS_AUTO_SECRET_KEY`).

**Data flow / processes** — `POST /api/chat` → `core.ts`: rate-limit → Turnstile → grounding
(deterministic keyword/enum matching, no LLM) → LLM reply → `verify.ts` scrub against grounded
prices/brands → persist to D1. Escalation notifies Telegram; team quote-replies POST to
`/api/telegram-webhook` → flips session to `human_active`; widget polls `/api/chat-poll`.
`/api/journey` is a `sendBeacon` breadcrumb sink. Every grounding source is fail-open.

**Entry points** — `POST /api/chat`, `GET /api/chat-poll`, `POST /api/journey`,
`POST /api/telegram-webhook`, `POST /api/compare-pick`.

**Constraints & gotchas** — All AI through `src/ai/` (never OpenRouter directly). `dealerNotes` never
exposed. Grounding is deterministic + fail-open; the anti-hallucination firewall is load-bearing while
free-tier fallbacks are in the tier list. `knowledge.ts` identifying details are FICTIONAL
placeholders — must not be presented as a real business. Optional grounding (manufacturer/reviews/
webSearch) DEFAULT OFF and excluded from the firewall allow-list even when on. Brand list in
`knowledge.ts` is disputed (see §12 / REMAINING-WORK — the reconcile diff is INVALID; do not apply blindly).

**Audit checklist**
- [ ] All model calls route through `~/ai`; no direct OpenRouter calls in `src/chatbot/`.
- [ ] `verify.ts` firewall blocks/redacts any price or brand not in this turn's grounding (config `mode`).
- [ ] Grounding fails open: missing Sanity/D1/KV degrades gracefully, never 500s or invents stock.
- [ ] Telegram webhook verifies the shared secret before writing a `human` message (no spoofed handoff).
- [ ] Turnstile enforced on chat; per-IP rate limit active (KV fail-open acceptable).
- [ ] `knowledge.ts` never asserts fictional identity as real; brand claims match owner-confirmed franchise list.
- [ ] `dealerNotes` never enters any grounding block or reply.
- [ ] Session/journey cookies carry no PII (opaque UUID only).

## 6. AI capability-tier layer

**Status:** ☐ unreviewed

**What it does** — The single provider abstraction all LLM calls route through; maps feature
capabilities to concrete OpenRouter models with ordered fallbacks.

**Key files & dirs**
- `src/ai/index.ts` (the `~/ai` barrel), `tiers.ts` (capability → model map), `client.ts`
  (`generate`/`generateObject`/`generateStream` + fallback loop), `structured.ts`, `config.ts`,
  `types.ts`, `README.md`.
- Providers (internal only): `src/ai/providers/openrouter.ts`, `openrouter-sse.ts`.
- Tools: `src/ai/tools/inventory-tools.ts` (deterministic, real-stock-only executors).
- Agentic: `src/ai/agentic/search-agent.ts` (`runAgenticSearch`, GATED OFF).

**External services / bindings** — OpenRouter (`OPENROUTER_API_KEY`).

**Config, env & flags** — `TIERS`: `chat-cheap` (Haiku primary → gpt-oss-20b:free → gemma-4-26b:free),
`chat-quality`, `writing` (Haiku primary → gemma fallback), `structured` (Haiku → gemma),
`agentic` (Haiku only). `MODEL_CAPABILITIES` flags `supportsVision`. `ai.agenticSearch.enabled` (OFF).

**Data flow / processes** — Callers pass a `Capability`; `client.ts` resolves the ordered model list
and tries each until one succeeds (`AllModelsExhaustedError` if none). Guardrail script
`scripts/check-ai-imports.sh` fails if anything outside `src/ai/` imports `src/ai/providers/*`.

**Entry points** — none (library). Agentic loop is dormant (not wired into live chat).

**Constraints & gotchas** — All AI through `src/ai/` (DECISIONS.md Decision 3); never import
`providers/` externally; add a tier for a new capability rather than a one-off call. Free models are a
build-phase stopgap; MEMORY note: restore Haiku (done for `writing`/`structured`). `agentic` tier has
NO free fallback (free models can't tool-call). Agentic tool-call transport is not yet built (paid drop-in).

**Audit checklist**
- [ ] `scripts/check-ai-imports.sh` passes (no external `providers/` imports).
- [ ] Every feature LLM call goes through `generate`/`generateObject`/`generateStream`.
- [ ] Fallback loop degrades correctly and surfaces `AllModelsExhaustedError` (no silent empty output).
- [ ] Vision tier only used where `supportsVision` is true; unknown models default text-only.
- [ ] `ai.agenticSearch.enabled` OFF means the loop/tools never run and live chat is unaffected.
- [ ] Deterministic `inventory-tools.ts` executors can only return real stock (no fabrication).

## 7. Compare

**Status:** ☐ unreviewed

**What it does** — Side-by-side comparison of 2+ tagged vehicles with a "verdict"/dial UI, and a
Rebi compare-agent decision endpoint.

**Key files & dirs**
- Pages: `src/pages/compare.astro` (original Verdict Board), `src/pages/compare-tools.astro` (Balance).
- Components: `src/components/CompareTray.astro`, `src/components/compare/Contender.astro`, `Dial.astro`,
  `reckon.ts` (comparison logic), `src/lib/compare-verdict.ts`.
- Endpoint: `src/pages/api/compare-pick.ts` (Rebi picks one car for a stated criterion).

**External services / bindings** — Sanity (listing fetch via `LISTING_FIELDS`); OpenRouter via
`src/ai` for `/api/compare-pick`.

**Config, env & flags** — `dealerConfig.locale` (formatting); `chat.context` (`compare` kind primes Rebi).

**Data flow / processes** — Cars tagged into the compare tray via `?ids=a,b,c`; pages fetch and render
comparison rows; `reckon.ts`/`compare-verdict.ts` compute per-row winners (`isLowerBetter` from
`listing.ts`). `/api/compare-pick` keeps Rebi acting as the compare agent for a decision criterion.

**Entry points** — `/compare?ids=…`, `/compare-tools?ids=…`, `POST /api/compare-pick`.

**Constraints & gotchas** — No direct nav link (reachable only via the tray — deliberate, see
REMAINING-WORK §1). Winner heuristic (`isLowerBetter`) is a hardcoded demo heuristic — verify it
doesn't mislead (e.g. over-budget picks). All AI through `src/ai/`.

**Audit checklist**
- [ ] `?ids=` parsing validates ids and caps count; empty/1-car state handled gracefully.
- [ ] Winner heuristic is correct per row (lower-better set) and doesn't fabricate a verdict.
- [ ] `/api/compare-pick` stays grounded in the compared set (no invented alternatives).
- [ ] Compare fetch uses shared `LISTING_FIELDS` (no dealerNotes leak).
- [ ] Formatting reads `dealerConfig.locale`.

## 8. Capture (dealer listing PWA)

**Status:** ☐ unreviewed

**What it does** — A standalone installable dealer PWA to build a DRAFT listing from photos, a voice
note, and/or a VIN/rego lookup — assembled and validated, then handed to an owner-gated draft writer.

**Key files & dirs**
- Page/PWA: `src/pages/capture/index.astro`, `src/pages/capture/manifest.webmanifest.ts`.
- Endpoints: `src/pages/api/capture/lookup.ts`, `extract.ts`, `create-draft.ts`.
- Lib: `src/lib/capture/pipeline.ts` (deterministic source-priority merge), `reference-resolver.ts`,
  `validate.ts`, `types.ts`, `http.ts`, `env.ts`.
- Stubs: `src/stubs/vin-lookup.ts`, `vision-extract.ts`, `listing-writer.ts` (mock draft id).

**External services / bindings** — Sanity (reference resolution against real inventory; the draft
WRITE is stubbed). Stubbed: NEVDIS/OEM VIN decode, vision extraction, voice (client Web Speech).
OpenRouter vision tier when `STUB_VISION` off.

**Config, env & flags** — `dealerConfig.capture.*` (enabled ON, `allowedOrigins`, `maxImages`,
`maxTranscriptLength`, `referenceMatchThreshold`, rateLimit, copy). Env: `STUB_VIN`, `STUB_VISION`,
`NEVDIS_API_KEY`, `OPENROUTER_API_KEY`.

**Data flow / processes** — lookup (VIN/rego → OEM spec) + extract (photos/voice) → `pipeline.ts`
merges by fixed source priority (OEM specs win; photo wins colour; voice wins human-only fields), tracks
source+confidence, flags low-confidence → `validate.ts` → `create-draft.ts` calls
`src/stubs/listing-writer.ts` which **logs + returns a mock draft id (no real Sanity write)**.

**Entry points** — `/capture` (redirects home when disabled), `POST /api/capture/lookup|extract|create-draft`
(return 404 when disabled).

**Constraints & gotchas** — DEFAULT-OFF pattern (now ON via run 4 + a discreet flag-gated footer link);
endpoints enforce `allowedOrigins` + rate limit. Determinism: a make/model reference is never silently
invented — below `referenceMatchThreshold` the UI prompts "create new?". Sanity write is owner-gated; a
write token must be Worker-scoped, never client-side (TODO_KEYS.md).

**Audit checklist**
- [ ] `create-draft` never performs a real Sanity write (stub only) until an owner-supplied scoped token replaces it.
- [ ] Endpoints reject non-allowlisted origins and enforce the `capture:` rate limit.
- [ ] `pipeline.ts` merge invents nothing — a field is present only when a real source supplied it.
- [ ] Sub-threshold make/model matches prompt "create new?" rather than binding to inventory.
- [ ] `maxImages`/`maxTranscriptLength` caps enforced server-side.
- [ ] When disabled, `/capture` redirects and APIs 404 (flag is the single seam).

## 9. Accounts & authentication

**Status:** ☐ unreviewed

**What it does** — Real Supabase-backed customer auth (sign in/up, password reset) with a Turnstile
gate and a per-user account dashboard.

**Key files & dirs**
- Lib: `src/lib/supabase.ts` (request-scoped SSR cookie client).
- Actions: `src/actions/index.ts` (`signUp`/`signIn`/`signOut`/`requestPasswordReset`/`updatePassword`).
- Middleware: `src/middleware.ts` (guards `/account`; bounces authed users off `/login`/`/signup`).
- Pages: `login.astro`, `signup.astro`, `account.astro`, `check-email.astro`, `reset-password.astro`;
  layout `src/layouts/AuthLayout.astro`; `src/components/auth/AuthCard.astro`.

**External services / bindings** — Supabase Auth; Turnstile; D1 `CHAT_DB` (account dashboard reads
saved searches + service bookings BY EMAIL — no `user_id` column).

**Config, env & flags** — `dealerConfig.accounts.*` (enabled ON, rateLimit, copy). Env:
`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` (inlined), `TURNSTILE_SECRET_KEY` (Worker runtime),
`PUBLIC_TURNSTILE_SITE_KEY`, `PUBLIC_SITE_URL` (redirect origin).

**Data flow / processes** — Auth actions verify Turnstile then call Supabase; the SSR client syncs
auth cookies; middleware resolves the user via `supabase.auth.getUser()` (auto-refresh) and stashes it
on `locals.user`. Account dashboard joins in per-user D1 data via new by-email helpers (no migration).

**Entry points** — `/login`, `/signup`, `/account`, `/check-email`, `/reset-password`; Astro actions.

**Constraints & gotchas** — Real auth, NOT a stub — **production launch with real customer PII is
BLOCKED on a paid human security review** (DECISIONS.md; TODO_KEYS.md). `accounts.enabled` is the single
on/off seam (off = redirect home + middleware no-op). Server secret (Turnstile) must be read from the
Worker runtime, not `import.meta.env`. Middleware runs ONLY on the auth surface.

**Audit checklist**
- [ ] Turnstile verified on signUp/signIn/reset before any Supabase call (no bypass).
- [ ] Session/refresh cookies are httpOnly/secure/SameSite-correct; middleware auto-refresh syncs cookies.
- [ ] `/account` unreachable unauthenticated; authed users bounced off `/login`/`/signup`.
- [ ] No PII in logs; account-page copy/data scoped to the logged-in email only (no cross-user read).
- [ ] `accounts.enabled=false` fully disables the surface (redirect + middleware no-op).
- [ ] Paid security review completed BEFORE real customer PII flows in production (hard gate).

## 10. Saved searches & service bookings

**Status:** ☐ unreviewed

**What it does** — Persist a shopper's saved filter query (email-alert intent) and service-department
booking REQUESTS to D1, fail-open, with stubbed email/notify.

**Key files & dirs**
- Lib: `src/lib/saved-search.ts`, `src/lib/service-booking.ts` (both reuse chatbot `D1Like`; swallow all errors).
- Endpoints: `src/pages/api/saved-search.ts`, `src/pages/api/book-service.ts`.
- Pages: `src/pages/service.astro`; account dashboard reads both (§9).
- Migrations: `migrations/0004_saved_searches.sql`, `migrations/0005_service_bookings.sql`.
- Stub: `src/stubs/email.ts`.

**External services / bindings** — D1 `CHAT_DB` (`saved_searches`, `service_bookings`); email is stubbed.

**Config, env & flags** — `dealerConfig.savedSearch.*`, `dealerConfig.service.*` (enabled, rateLimit,
copy, `serviceTypes` allow-list, `notifyEmail`). Env: `STUB_EMAIL`, `RESEND_API_KEY` (future).

**Data flow / processes** — Endpoints: flag → validate → rate-limit (`savedsearch:` / `service:` KV
prefixes) → D1 insert (fail-open) → stubbed confirmation/notify. Rows key on anonymous
`visitor_id` + email (no `user_id`). The periodic "new match arrived" alerter needs a Cloudflare **cron**
trigger — OUT OF SCOPE / not built.

**Entry points** — `POST /api/saved-search`, `POST /api/book-service`; `/service` page.

**Constraints & gotchas** — Fail-open: safe to ship before prod tables exist (`0004`/`0005` are
local-only until applied — TODO_KEYS.md). Service copy must frame a REQUEST, not a confirmed
appointment (no invented availability). `serviceType` validated against the config allow-list. Never a
500 for an expected failure (HTTP 200 + `{ error }`).

**Audit checklist**
- [ ] Persistence truly fail-open (missing table / D1 error → silent no-op, never a visitor-facing 500).
- [ ] `service.serviceTypes` allow-list enforced server-side (reject off-list types).
- [ ] Rate limits use distinct KV prefixes (no counter collision with chat/search).
- [ ] Service copy never asserts a booked/confirmed slot (determinism — no invented availability).
- [ ] Prod migrations `0004`/`0005` applied before relying on the data (owner infra action).
- [ ] Saved-search re-run links reconstruct via the canonical filter query (`applyFilterUrl`).

## 11. Trade-in / valuation

**Status:** ☐ unreviewed

**What it does** — A standalone shopper tool that returns an indicative trade-in range from a stubbed
Redbook valuation.

**Key files & dirs**
- Page: `src/pages/trade-in.astro`. Endpoint: `src/pages/api/trade-in.ts`. Stub: `src/stubs/redbook.ts`.

**External services / bindings** — Redbook (stubbed); KV `RATE_LIMIT_KV` (`tradein:` prefix).

**Config, env & flags** — `dealerConfig.tradeIn.*` (enabled, rateLimit, copy). Env: `STUB_REDBOOK`,
`REDBOOK_API_KEY` (future).

**Data flow / processes** — `POST /api/trade-in { make, model, year, odometerKm, condition }` → flag →
validate → rate-limit → stubbed valuation → `{ valuation }` (or `{ error }` at HTTP 200). Does NOT touch Rebi.

**Entry points** — `/trade-in`, `POST /api/trade-in`.

**Constraints & gotchas** — Stubbed valuation must read as indicative, confirmed on inspection (copy
already frames this). Never a 500 for expected failures. Deterministic go-live: add key + flip `STUB_REDBOOK`.

**Audit checklist**
- [ ] Valuation framed as indicative (no guarantee); copy never overstates precision.
- [ ] Input validated; rate limit enforced (`tradein:` prefix, no collision).
- [ ] Expected failures return HTTP 200 `{ error }`, not 500.
- [ ] Stub swap to real Redbook is credential+flag only (no code change needed).

## 12. Stubs & integration registry

**Status:** ☐ unreviewed

**What it does** — Every third-party service that isn't live yet is a realistic, fail-safe stub behind
an env flag, registered 1:1 in `TODO_KEYS.md`.

**Key files & dirs** — `src/stubs/`: `redbook.ts`, `email.ts`, `price-history.ts`, `manufacturer.ts`,
`reviews.ts`, `websearch.ts`, `carsales.ts`, `vin-lookup.ts`, `vision-extract.ts`, `listing-writer.ts`
(10 stubs). Registry: `TODO_KEYS.md`.

**External services / bindings** — see Section 4 table. Each maps to a flag: `STUB_REDBOOK`, `STUB_EMAIL`,
`STUB_PRICE_HISTORY`, `STUB_MANUFACTURER`, `STUB_REVIEWS`, `STUB_WEBSEARCH`, `STUB_CARSALES`, `STUB_VIN`,
`STUB_VISION`, `STUB_VOICE` (client Web Speech).

**Config, env & flags** — Stub flags live in `.dev.vars` / `wrangler secret` (Worker), not `.env`.
`STUB_PRICE_HISTORY` is deliberately env (not config) so a fabricated price drop can never ship in prod config.

**Data flow / processes** — A stub either returns deterministic mock data or logs and returns a mock
result. `listing-writer.ts` returns a mock draft id (no write). Go-live per row: add credential, flip flag.

**Entry points** — none directly (consumed by their features).

**Constraints & gotchas** — Determinism: stubs must never let fabricated data reach shoppers as real
(price-history env-gated; grounding stubs price-free + firewall-excluded). Brand reconciliation
(`scripts/reconcile-brands.ts`) diff is INVALID and must NOT be applied blindly (REMAINING-WORK §3 /
TODO_KEYS owner-gated writes) — Rebi's list is new-vehicle franchises vs. all-inventory makes.

**Audit checklist**
- [ ] Every `src/stubs/*.ts` has a matching `TODO_KEYS.md` row (flag, credential, where, unlocks).
- [ ] No stub emits data presented as real without an honest frame or an env gate (esp. price history).
- [ ] Grounding stubs (manufacturer/reviews/websearch) stay price-free and firewall-excluded even when on.
- [ ] `listing-writer.ts` performs no real write; go-live requires a Worker-scoped token.
- [ ] Each go-live is credential+flag only (no code change) as the registry claims.
- [ ] Brand reconcile diff reviewed against the owner's real franchise list before any edit.

## 13. Data scripts & tooling

**Status:** ☐ unreviewed

**What it does** — Node/tsx scripts for seeding, importing demo inventory, migrating fields, and
read-only reports. DEMO-ONLY tooling, not shipped in the app bundle.

**Key files & dirs** — `scripts/seed.ts`, `import-bundaberg.ts` (+ `scripts/data/bundaberg-40.json`),
`migrate-details-to-specs.ts`, `migrate-details-to-fields.ts`, `cleanup-legacy-details.ts`,
`reconcile-brands.ts` (read-only), `seed-business-info.ts`, `deps-report.ts`,
`check-ai-imports.sh` (guardrail), `scripts/lib/vehicle-specs.ts` (mapping SoT).

**External services / bindings** — Sanity (write via `SANITY_TOKEN` with Editor scope for `--commit`).

**Config, env & flags** — Read secrets from `.env` via `dotenv` (NOT `.dev.vars`). npm scripts in
`package.json` (`seed`, `import:bundaberg`, `import:migrate-specs`, `deps:report`,
`seed:business-info`, `reconcile:brands`, `check:ai-imports`).

**Data flow / processes** — Dry-run by default; require an explicit `--commit` to write. Deletions/
patches must target explicit document IDs, never a broad query match. `vehicle-specs.ts`:
`petrol-electric` → `hybrid` (not electric); ambiguous transmission compounds fall through to WARN.

**Entry points** — CLI (`npm run <script>` / `tsx scripts/<file>`).

**Constraints & gotchas** — A read-only `SANITY_TOKEN` passes dry-run but fails on `--commit`. Always
show the diff + WARN lines to the owner before `--commit`. Owner-gated writes (business info, brand
reconcile, fuel-economy backfill, D1 prod migrations) never run autonomously.

**Audit checklist**
- [ ] Every write script is dry-run by default and needs explicit `--commit`.
- [ ] Patches/deletes target explicit doc IDs, not broad query matches.
- [ ] `vehicle-specs.ts` mapping preserves `petrol-electric`→hybrid and WARN-on-ambiguous behaviour.
- [ ] Scripts read `.env` (not `.dev.vars`); tokens are Editor-scoped for commits.
- [ ] `check-ai-imports.sh` is wired (CI/local) and passes.
- [ ] Owner-gated writes are never executed without sign-off + diff review.

## 14. Infrastructure & deploy

**Status:** ☐ unreviewed

**What it does** — Builds the Astro SSR app and deploys it as a single Cloudflare Worker with D1/KV/
assets bindings; applies site-wide security headers.

**Key files & dirs** — `astro.config.mjs` (Cloudflare adapter, Sanity/React/sitemap integrations,
Tailwind Vite plugin, embedded Studio at `/studio`), `wrangler.jsonc` (Worker config + bindings),
`src/middleware.ts` (security headers + auth guard), `migrations/` (`0001`–`0005`),
`worker-configuration.d.ts` (generated Env types), `.nvmrc`, `tsconfig.json`,
`docs/cloudflare-security.md`, `docs/dependency-tracking.md`.

**External services / bindings** — Cloudflare Worker; D1 `CHAT_DB` (`astro-listings-chat`, id in
`wrangler.jsonc`); KV `RATE_LIMIT_KV`; `ASSETS` binding → `./dist`; `observability` on;
compat date `2026-07-18`, flag `global_fetch_strictly_public`.

**Config, env & flags** — Two secret worlds: `.env` (scripts) vs `.dev.vars`/`wrangler secret` (Worker).
Public build vars via `import.meta.env`. Cloudflare build runs `npm ci` (lockfile parity mandatory).

**Data flow / processes** — `astro build` → Worker bundle in `dist` → deployed by Cloudflare (this repo
targets **Workers, not Pages**). Middleware sets `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN` on every response.
Prod D1 migrations (`0003`–`0005`) are owner-run (`wrangler d1 migrations apply --remote`).

**Entry points** — the Worker's fetch entrypoint (`@astrojs/cloudflare/entrypoints/server`).

**Constraints & gotchas** — Worker-not-Pages distinction has caused real bugs. `npm ci` fails the
deploy on `package.json`/`package-lock.json` drift — always full `npm install` + commit the lock in the
same commit; npm-only (no second package manager). Full CSP + Permissions-Policy deliberately NOT set
(would break Turnstile/Supabase/chat mic/capture camera) — documented follow-up. `astro.config.mjs`
`site` is still a `.pages.dev` placeholder. Vite "file does not exist in optimize deps" 500 = stale
`node_modules/.vite` cache, not a code bug.

**Audit checklist**
- [ ] `package.json` ↔ `package-lock.json` in sync (`npm ci --dry-run` clean); npm-only, one lockfile.
- [ ] `wrangler.jsonc` bindings match code usage (`CHAT_DB`, `RATE_LIMIT_KV`, `ASSETS`; `GROUNDING_KV` optional).
- [ ] Security headers land on all responses incl. redirects; no CSP that silently breaks Turnstile/Supabase.
- [ ] Prod D1 migrations `0003`–`0005` applied before features depend on them.
- [ ] `astro.config.mjs` `site` set to the real domain before launch (canonical/OG/sitemap).
- [ ] Secrets present in `wrangler secret` (prod) mirror `.dev.vars` keys; none committed to git.

## 15. Sanity Studio & CMS

**Status:** ☐ unreviewed

**What it does** — The embedded content studio (at `/studio`) where the dealer authors listings and
business info, plus AI/upload document actions.

**Key files & dirs** — `sanity.config.ts` (embedded Studio config + form/document overrides),
`src/sanity/schemaTypes/` (`index.ts`, `listing.ts`, `businessInfo.ts`),
`src/sanity/templates/` (`automotive.ts`, `index.ts`), `src/sanity/lib/` (`client.ts`, `image.ts`),
`src/sanity/components/` (`ListingFormFooter.tsx`, `GenerateDescriptionInput.tsx`,
`CarsalesUploadAction.tsx`).

**External services / bindings** — Sanity project (`PUBLIC_SANITY_PROJECT_ID`/`DATASET`/`API_VERSION`);
OpenRouter via `/api/generate-description`; carsales upload action (stubbed).

**Config, env & flags** — `studioBasePath: '/studio'`; `useCdn: false`. `SANITY_TOKEN` (Worker-side)
for server draft reads. `dealerConfig.integrations.carsales.enabled` gates the upload action;
`dealerConfig.ai.generateDescription.*` + `ai.studioOrigins` gate the description generator.

**Data flow / processes** — Studio served in-app at `/studio` (excluded from sitemap + auth middleware).
The "Generate description" input override calls `/api/generate-description` (Studio-only, origin-locked).
The "Upload to carsales" document action appears only when carsales is enabled.

**Entry points** — `/studio` (embedded Studio); `POST /api/generate-description`, `POST /api/carsales-upload`.

**Constraints & gotchas** — `businessInfo` is deliberately NOT a Studio singleton (fights the future
per-dealer-tagged model). Studio-only endpoints must enforce `ai.studioOrigins` (never hardcode origin).
`dealerNotes` lives in the schema (Studio-only tab) but is excluded from `LISTING_FIELDS`. Recommended:
put `/studio` behind Cloudflare Access (TODO_KEYS.md) — not yet done.

**Audit checklist**
- [ ] `/api/generate-description` enforces `ai.studioOrigins` + rate limit (no public access).
- [ ] `dealerNotes` visible only in Studio; never projected to public pages.
- [ ] carsales action registers only when `integrations.carsales.enabled`; endpoint re-checks origin + published/active.
- [ ] `businessInfo` remains a plain doc (no singleton constraint); resolved as `[_type=="businessInfo"][0]`.
- [ ] `/studio` access is restricted before production (Cloudflare Access) — owner action.

## 16. Styling & design system

**Status:** ☐ unreviewed

**What it does** — Tailwind v4 utility styling plus a small global CSS base (site width system,
focus rings, chatbot styles).

**Key files & dirs** — `src/styles/global.css` (Tailwind import, `@tailwindcss/typography`, focus-ring
base, `--site-gutter`/`--site-max` width system, `.site-container`), `src/styles/rebi.css` (chatbot UI).
Tailwind wired via `@tailwindcss/vite` in `astro.config.mjs`.

**External services / bindings** — none.

**Config, env & flags** — none dealer-level (front-of-house copy lives in `dealerConfig`, not CSS).

**Data flow / processes** — Pages `import '../styles/global.css'`; utilities compiled at build. Site
width is a single source of truth via CSS custom properties.

**Entry points** — none.

**Constraints & gotchas** — Light-theme standard (MEMORY note): build UI light-first
(`bg-slate-50`/`white`/`slate-900`); no dark-first designs. Guaranteed focus-visible ring site-wide.
Keep gutter/max-width changes in `global.css` (don't hardcode per component).

**Audit checklist**
- [ ] New/changed UI is light-first and consistent with `bg-slate-50`/white/`slate-900`.
- [ ] Every interactive element keeps a visible focus ring (accessibility).
- [ ] Page wrappers use `.site-container`; no per-component gutter/max-width literals.
- [ ] No dealer-facing copy embedded in CSS (belongs in `dealerConfig`).

## 17. Experience Mode (labs, experimental)

**Status:** ☐ unreviewed

**What it does** — Unlinked, experimental prototypes of the premium "Rebi drives the screen as a
canvas" mode — contest candidates for the owner to judge (REMAINING-WORK §6).

**Key files & dirs** — `src/pages/labs/experience.astro` (Candidate A), `src/pages/labs/experience-alt.astro`
(Candidate B); `src/components/experience/ExperienceCanvas.astro` + `matcher.ts`;
`src/components/experience-alt/ShowroomTour.tsx` + `taste.ts`.

**External services / bindings** — Sanity (reads real inventory via `LISTING_FIELDS`); may use `src/ai`.

**Config, env & flags** — `dealerConfig` for formatting/copy. No dedicated feature flag — reachability
is "unlinked route" only.

**Data flow / processes** — SSR routes not linked from nav; touch no existing page/component/config
(additive + isolated). Read live inventory at request time.

**Entry points** — `/labs/experience`, `/labs/experience-alt` (unlinked — direct URL only).

**Constraints & gotchas** — EXPERIMENTAL: do not treat as production surfaces; they are contest
prototypes pending owner sign-off. Must stay isolated (no coupling into shipped code). Being unlinked is
the only gate — verify they carry no risk if a URL is discovered.

**Audit checklist**
- [ ] Routes remain unlinked and touch no shipped page/component/config (isolation intact).
- [ ] Any AI use routes through `~/ai`; any inventory read uses `LISTING_FIELDS` (no dealerNotes).
- [ ] No fabricated inventory/prices reach the canvas (determinism, firewall parity if it chats).
- [ ] Clearly marked experimental; not linked from nav until an owner picks a winner.

---

## 3. Cross-cutting audit passes

Whole-codebase sweeps that cut across subsystems:

- [ ] **Config-as-data compliance** — no dealer-specific literal (name, domain, contact, colours,
      copy, limits) exists outside `src/config/dealer.ts`. (No automated lint for this yet — DECISIONS.md
      calls for one; `scripts/check-ai-imports.sh` only guards the AI layer.)
- [ ] **All-AI-through-`src/ai/`** — every LLM call uses `generate`/`generateObject`/`generateStream`;
      nothing imports `src/ai/providers/*` externally (`scripts/check-ai-imports.sh` passes); no direct
      OpenRouter calls in feature code.
- [ ] **Determinism / no fabricated data** — no feature guesses or defaults an ambiguous value; grounding +
      capture + valuation only surface real/sourced data; ambiguous mappings WARN, never silently guess;
      brand list reconciled against the owner's real franchises (not the invalid auto-diff).
- [ ] **Secrets hygiene** — `.env` (scripts) vs `.dev.vars`/`wrangler secret` (Worker) kept distinct;
      server secrets read from the Worker runtime, not `import.meta.env`; nothing sensitive committed
      (`.env`/`.dev.vars` git-ignored). Note the multiple Turnstile secret-var names
      (`TURNSTILE_SECRET_KEY`, `TURNSTILE_RB_LISTINGS_AUTO_SECRET_KEY`, `CHATBOT_TURNSTILE_SECRET_KEY`) — verify prod values.
- [ ] **Dependency / lockfile health** — `npm ci --dry-run` clean; `package.json`↔`package-lock.json` in
      sync; npm-only, single lockfile (Cloudflare `npm ci` fails the deploy on drift).
- [ ] **Security headers / CSP** — baseline headers ship via middleware; full CSP + Permissions-Policy
      still absent (documented in `docs/cloudflare-security.md`) — verify a CSP wouldn't break
      Turnstile/Supabase/chat/capture before adding.
- [ ] **Accessibility & light-theme consistency** — focus rings site-wide; light-first UI; ARIA labels on
      interactive stage/search chrome from config.
- [ ] **Error handling / fail-open** — persistence layers (journey, saved-search, service-booking) and
      grounding swallow errors and degrade; feature endpoints return HTTP 200 `{ error }` for expected
      failures, never a 500; rate limiters fail open with distinct KV prefixes (no counter collision).
- [ ] **dealerNotes never public** — excluded from `LISTING_FIELDS` and every public projection; consumed
      only by AI features server-side.

---

## 4. External dependencies & accounts

| Service | Used for | Where configured | Status |
|---|---|---|---|
| **Cloudflare Workers** | Hosting/runtime (SSR Worker), edge cache, `ASSETS` | `wrangler.jsonc`, `astro.config.mjs` | **Live** (deploy target) |
| **Cloudflare D1 (`CHAT_DB`)** | chat `sessions`/`messages`, `journey_events`, `saved_searches`, `service_bookings` | `wrangler.jsonc`; `migrations/0001`,`0003`,`0004`,`0005` | Live locally; prod `0003`–`0005` owner-apply |
| **Cloudflare KV (`RATE_LIMIT_KV`)** | per-IP fixed-window rate limiting | `wrangler.jsonc`; `src/lib/rate-limit.ts` | **Live** |
| **Cloudflare KV (`GROUNDING_KV`)** | optional grounding cache | not bound yet (`get-env.ts` reads if present) | Optional / not bound |
| **Sanity CMS** | inventory + `businessInfo` content, embedded Studio `/studio` | `astro.config.mjs`, `sanity.config.ts`, `PUBLIC_SANITY_*`, `SANITY_TOKEN` | **Live** |
| **OpenRouter** | all LLM calls (chat, search, description, vision, agentic) | `src/ai/`, `OPENROUTER_API_KEY` | **Live** (free-tier + Haiku) |
| **Supabase Auth** | customer sign-in/up/reset | `src/lib/supabase.ts`, `src/actions/`, `PUBLIC_SUPABASE_*` | **Live** (staging/demo); prod PII gated on security review |
| **Cloudflare Turnstile** | bot protection on chat + auth | `PUBLIC_TURNSTILE_SITE_KEY` + secret var(s) | **Live** |
| **Telegram Bot API** | human handoff (escalation + team replies) | `src/chatbot/telegram.ts`, `TELEGRAM_BOT_TOKEN`/`CHAT_ID`/`WEBHOOK_SECRET` | **Live** |
| **Resend (or similar email)** | confirmation + saved-search alert emails | `src/stubs/email.ts`, `STUB_EMAIL`/`RESEND_API_KEY` | **Stubbed** (TODO_KEYS) |
| **Redbook** | trade-in valuations | `src/stubs/redbook.ts`, `STUB_REDBOOK`/`REDBOOK_API_KEY` | **Stubbed** |
| **NEVDIS / OEM VIN decode** | capture VIN/rego → factory spec + PPSR status | `src/stubs/vin-lookup.ts`, `STUB_VIN`/`NEVDIS_API_KEY` | **Stubbed** |
| **Vision model** (via OpenRouter) | capture photo → attribute extraction | `src/stubs/vision-extract.ts`, `STUB_VISION` | **Stubbed** (real tier flagged) |
| **Voice transcription** (Whisper/Deepgram) | server-side voice capture (client Web Speech is the stub) | `STUB_VOICE` | **Stubbed** |
| **Manufacturer feed** | Rebi grounding: model-background block | `src/stubs/manufacturer.ts`, `STUB_MANUFACTURER` + `chat.grounding.manufacturer` | **Stubbed + flag OFF** |
| **Review source** (Wheels/CarsGuide/…) | Rebi grounding: review-sentiment block | `src/stubs/reviews.ts`, `STUB_REVIEWS` + `chat.grounding.reviews` | **Stubbed + flag OFF** |
| **Web search (allowlisted)** | Rebi grounding: allowlisted-domain snippet | `src/stubs/websearch.ts`, `STUB_WEBSEARCH` + `chat.grounding.webSearch` | **Stubbed + flag OFF** |
| **carsales.com.au** | listing syndication (Studio action) | `src/stubs/carsales.ts`, `STUB_CARSALES` + `integrations.carsales.enabled` | **Stubbed + flag OFF** |
| **Sanity draft write (listing-writer)** | capture create-draft persistence | `src/stubs/listing-writer.ts` (mock id) | **Stubbed** — owner-gated Worker-scoped token |
| **POS / calendar** | service booking → confirmed appointment | (none) | **Deferred** (per-dealer) |

Cross-reference `TODO_KEYS.md` for the exact credential + flag + effort to take any stubbed row live.
