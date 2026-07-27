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
| Customer accounts (DEMO ONLY) | STUB_AUTH | AUTH_PROVIDER_KEY (real IdP/session — e.g. Cloudflare Access / an auth provider) | .dev.vars / wrangler secret | replaces the mock demoSignIn with real authenticated sign-in (feature also gated by `accounts.enabled`, DEFAULT OFF). ⚠️ BLOCKED on the security review below — do NOT go live before it | BLOCKER (see security review) — then ~several days (IdP + session + review) |
| Capture VIN/OEM decode | STUB_VIN | NEVDIS_API_KEY (NEVDIS/OEM VIN decode, ~AU$0.65/lookup, returns written-off/stolen status) | .dev.vars / wrangler secret | live factory-spec + PPSR status decode in the capture PWA (feature also gated by `capture.enabled`, DEFAULT OFF) | ~1 day (API contract + PPSR mapping) |
| Capture photo vision | STUB_VISION | OPENROUTER_API_KEY + a vision-capable tier (already flagged `supportsVision` in src/ai/tiers.ts) | .dev.vars / wrangler secret (flag OFF to prefer real vision) | photo → vehicle-attribute extraction routed through the `~/ai` vision tier instead of the deterministic stub | ~1 day (generateObject vision prompt + image parts) |
| Capture voice transcription | STUB_VOICE (client Web Speech is the stub) | WHISPER/DEEPGRAM_API_KEY (server transcription) | .dev.vars / wrangler secret | replaces the browser Web Speech capture with a server Whisper/Deepgram transcription of an uploaded audio clip (works cross-browser, higher accuracy) | ~1 day (upload + provider SDK) |
| Agentic search (tool-calling loop) | `ai.agenticSearch.enabled` (config flag, DEFAULT OFF) + OpenRouter credit for the tool-capable `agentic` tier (anthropic/claude-haiku-4-5) | OPENROUTER_API_KEY with credit; the `agentic` tier already points at a tool-capable model | .dev.vars / wrangler secret (credit) + `src/ai/` (build the tool-call transport) | the real multi-turn agent replaces the single-shot fallback in `src/ai/agentic/search-agent.ts` (see its TODO_KEYS marker). The deterministic inventory TOOLS (`src/ai/tools/inventory-tools.ts`) are already real + testable and can only return real stock. NOT wired into the live chatbot | ~2 days (provider `tools`/`tool_calls` transport in src/ai/ + loop) |

## Owner-gated data writes (no autonomous `--commit`)

| Action | Command | Blocker |
|--------|---------|---------|
| businessInfo real facts | `scripts/seed-business-info.ts --commit` | seeds `businessInfo-current` from knowledge.ts placeholders — owner MUST replace fictional name/phone/address/email with real dealer facts + supply Established year; needs Editor `SANITY_TOKEN`. Dry-run by default |
| brand reconciliation | `scripts/reconcile-brands.ts` (read-only, no `--commit`) | review dry-run diff, then edit `src/chatbot/knowledge.ts` BY HAND — it is a source file, not a Sanity doc (current diff: claimed-absent Jeep/Leapmotor; present-unclaimed Ford/GWM/Holden/Mazda/Mitsubishi/Toyota) |
| fuel-economy backfill | backfill script `--commit` | review dry-run diff first |
| D1 journey table (prod) | `wrangler d1 migrations apply astro-listings-chat --remote` | owner runs against prod |
| D1 saved_searches table (prod) | `wrangler d1 migrations apply astro-listings-chat --remote` | owner runs against prod (migration 0004) |
| D1 service_bookings table (prod) | `wrangler d1 migrations apply astro-listings-chat --remote` | owner runs against prod (migration 0005) |
| Service scheduling (POS/calendar) | per-dealer POS/calendar API | booking requests → CONFIRMED appointments (reserve real slots) — deferred; requests + notify ship now |
| Customer auth — real customer data | wire /account + /api/account to real identity/PII | **BLOCKER: paid human security review (DECISIONS.md) is mandatory before ANY real customer data flows.** Ships as a DEMO SCAFFOLD only (mock profiles, no password/session/credential/PII, `accounts.enabled` DEFAULT OFF). A data leak would be business-ending — do NOT connect real customer PII until the review signs off |
| Capture listing draft write | wire /api/capture/create-draft to a real `client.create()` | **Worker-scoped SANITY write token (listings dataset only), NEVER client-side — set as a wrangler secret.** Today the create-draft call goes through the STUB writer (src/stubs/listing-writer.ts) which logs + returns a mock draft id; no real write happens. Owner-gated: supply the scoped write token and replace the stub with a token-authed `client.create({ ...doc, _id: 'drafts.<uuid>' })` (draft perspective only). The pipeline already assembles + validates the draft; going live is this write + the token |

## Owner infra / account actions

| Action | Notes |
|--------|-------|
| GROUNDING_KV namespace + `wrangler.jsonc` binding | optional grounding cache; app works without it |
| Sanity MCP plugin | `/plugin install sanity@claude-plugins-official` |
| Cloudflare security tooling | account-level access required for some features. Full audit + priority order in `docs/cloudflare-security.md`. Owner rows below. |
| CF: security response headers (HSTS + baseline CSP) | **Biggest gap — currently absent.** Add via Cloudflare Transform Rule (response headers) or Astro middleware. Priority 1 |
| CF: WAF managed ruleset + Bot Fight Mode | Enable Cloudflare Managed Ruleset (+ OWASP) and Bot Fight Mode on the zone (Security → WAF / Bots). Priority 2 |
| CF: Access in front of Sanity Studio | Put the Studio route behind Cloudflare Access (Zero Trust) so only staff reach it. Priority 3 |
| CF: edge rate-limiting rules on `/api/*` | Zone-level rate-limiting to complement the in-app KV limiter (`checkRateLimit`). Priority 4 |
| CF: confirm TLS Full (strict) + Always Use HTTPS | Verify SSL/TLS mode and HTTP→HTTPS redirect. Priority 5 |
| CF: periodic Security Center review | Review Cloudflare's automated vulnerability/misconfig scan findings. Priority 6 |
