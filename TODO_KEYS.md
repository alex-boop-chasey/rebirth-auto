# TODO_KEYS.md — Drop-in registry for stubbed integrations & owner actions

Every stubbed third-party service and every owner-gated write is registered here. To take
one live: add the credential where noted, flip the env flag, done — no code change.

Format: **Service** — what's needed — where to add it — what it unlocks — activation effort.

Flags live in `.dev.vars` (local) / `wrangler secret` (prod) for the Worker, and `.env` for
Node scripts. See `AGENTS.md` for which is which.

---

## Stubbed integrations

_(populated as Phase 6–8 stubs land — each `src/stubs/<service>.ts` gets a row here)_

| Service | Env flag | Credential needed | Where to add | Unlocks | Effort |
|---------|----------|-------------------|--------------|---------|--------|
| Redbook trade-in | STUB_REDBOOK | REDBOOK_API_KEY | .dev.vars / wrangler secret | live trade-in valuations | ~1 day (API contract + mapping) |
| Email alerts | STUB_EMAIL | RESEND_API_KEY | .dev.vars / wrangler secret | real confirmation + new-match alert emails | ~0.5 day (provider SDK) |
| Price history | STUB_PRICE_HISTORY | none — real `listing.priceHistory` (dealer edits / POS price log) | .dev.vars / wrangler secret (flag ON = demo only); real data via Studio/POS | "Just Reduced" badge + price-history timeline from real data; flag synthesizes demo history for empty listings (dev/demo ONLY, off in prod) | ~0 (data-driven; POS feed later) |
| Manufacturer grounding | STUB_MANUFACTURER | MANUFACTURER_API_KEY (manufacturer / partner model-info feed) | .dev.vars / wrangler secret | Rebi folds an external, price-free manufacturer model-background reference block (feature also gated by `chat.grounding.manufacturer.enabled`, DEFAULT OFF) | ~1 day (feed contract + per-brand mapping) |
| Review grounding | STUB_REVIEWS | review source licence (Wheels/CarsGuide/etc.) | .dev.vars / wrangler secret | Rebi folds an external, price-free independent-review sentiment reference block (feature also gated by `chat.grounding.reviews.enabled`, DEFAULT OFF) | ~1 day (per-source licence + mapping) |
| Web search (allowlisted) | STUB_WEBSEARCH | WEBSEARCH_API_KEY (search API) or a real `fetch()`+extract step | .dev.vars / wrangler secret | Rebi folds an external, price-free reference block from a hardcoded URL allowlist (feature also gated by `chat.grounding.webSearch.enabled`, DEFAULT OFF; only allowlisted-domain URLs ever returned) | ~1 day (fetch+extract or search API + mapping) |
| carsales upload | STUB_CARSALES | CARSALES_API_KEY + dealer account | .dev.vars / wrangler secret | real carsales.com.au syndication (Studio "Upload to carsales" action; also gated by `integrations.carsales.enabled`, DEFAULT OFF) | ~2-3 days (their API onboarding) |

## Owner-gated data writes (no autonomous `--commit`)

| Action | Command | Blocker |
|--------|---------|---------|
| businessInfo real facts | seed script `--commit` | needs real dealer facts + Editor `SANITY_TOKEN` |
| brand reconciliation | reconcile script `--commit` | review dry-run diff first |
| fuel-economy backfill | backfill script `--commit` | review dry-run diff first |
| D1 journey table (prod) | `wrangler d1 migrations apply astro-listings-chat --remote` | owner runs against prod |
| D1 saved_searches table (prod) | `wrangler d1 migrations apply astro-listings-chat --remote` | owner runs against prod (migration 0004) |
| D1 service_bookings table (prod) | `wrangler d1 migrations apply astro-listings-chat --remote` | owner runs against prod (migration 0005) |
| Service scheduling (POS/calendar) | per-dealer POS/calendar API | booking requests → CONFIRMED appointments (reserve real slots) — deferred; requests + notify ship now |

## Owner infra / account actions

| Action | Notes |
|--------|-------|
| GROUNDING_KV namespace + `wrangler.jsonc` binding | optional grounding cache; app works without it |
| Sanity MCP plugin | `/plugin install sanity@claude-plugins-official` |
| Cloudflare security tooling | account-level access required for some features |
