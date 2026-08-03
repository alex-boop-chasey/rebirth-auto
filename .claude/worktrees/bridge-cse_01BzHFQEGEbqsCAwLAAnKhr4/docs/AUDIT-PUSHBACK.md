# Audit Pushback — Rebirth Auto

> Adversarial companion to **`docs/AUDIT-FINDINGS.md`**. A single skeptical reviewer re-opened every one of
> the 78 findings, read the cited `file:line` and its surrounding code, and rendered a verdict. Read this
> doc **side-by-side** with the audit: each entry below references the audit's finding ID (`1.1`, `1.2`, …)
> and gives a **verdict**, a **grounded rationale (file:line)**, and a **corrected severity/impact** wherever
> it differs from the audit. Nothing here changes source code — it is a review of the review.
>
> **Verdict vocabulary**
> - **CONFIRMED** — genuine defect, audit got it right (severity noted where it should change).
> - **PARTIALLY VALID** — real but narrower or materially over-rated; the delta is explained.
> - **NEEDS-DECISION** — real, but the "fix" is a behaviour-changing judgment call (SSR vs prerender,
>   full CSP, external Supabase config, config-as-data scope), not a clear-cut bug.
> - **FALSE POSITIVE** — not a real defect.
>
> Bottom line: the audit is **high quality**. No outright false positives. The main corrections are
> (a) a handful of over-rated HIGHs that are really MEDIUM/LOW, (b) several **duplicate findings** reported
> under multiple areas, and (c) a few "risks" that are conditional on external config or are documented,
> intentional deferrals rather than bugs.

---

## Overall verdict

| Verdict | Count |
|---|---|
| CONFIRMED | 60 |
| PARTIALLY VALID | 9 |
| NEEDS-DECISION | 9 |
| FALSE POSITIVE | 0 |
| **Total** | **78** |

### The findings that genuinely matter most (fix these)

| ID | Why it matters | My severity |
|---|---|---|
| **6.1** | `configureAI()` throws an **uncaught 500** when `generate-description` (omits `streamAttemptTimeoutMs`) and `chat`/`search` (include it) share a warm isolate. Can break the **buyer-facing** chat. One-line fix. | HIGH |
| **13.2** | `seed.ts` deletes with a **broad query match** `*[_type=="listing"]` and has **no `--commit`/dry-run gate** — a stray `npm run seed:clean` mass-deletes all listings. Direct hard-constraint violation. | HIGH |
| **13.1** | `import-bundaberg.ts` **writes to Sanity by default** (opt-out `--dry-run`, no `--commit`) — inverts the dry-run-by-default hard rule; default mode deletes+replaces. | HIGH |
| **5.1** | Anti-hallucination make firewall's `CAR_MAKES` omits the dealer's **own franchises** Jaecoo (3 in real inventory) + Leapmotor — the exact invented-brand class the firewall exists to stop. | MEDIUM |
| **4.1** | Public inventory query has **no status scoping** → `draft` listings are publicly listed and counted, diverging from the chatbot's `status=="active"` rule. | MEDIUM |
| **17.1 / 9.6** | Supabase session cookies (incl. ~400-day refresh token) written **without httpOnly/Secure** while only the SSR server client is used — one-line hardening; a genuine pre-launch security item. | HIGH (pre-launch) |
| **15.1 / 17.2 / 21.3** | Studio-only `generate-description` gated **only by a spoofable `Origin` header** → unauthenticated caller can trigger `dealerNotes`-grounded generation + AI-cost abuse. Code's own TODO admits it. | MEDIUM–HIGH |
| **12.1** | Email stub `console.log`s the **customer's email** (PII) on the default (stubbed) path for every saved-search/booking. | MEDIUM |

### Findings I'd throw out or heavily downgrade

- **1.1 (HIGH → LOW)** — "brand name hardcoded" is a maintainability/config-as-data nit on a **single-tenant** site today; the *identical* issue is correctly rated MEDIUM as **2.2**. The HIGH is inconsistent with the audit's own rating.
- **24.1 (HIGH → MEDIUM)** — real latent determinism nit, but the "shoppers see duplicates/dropped cars" impact is **unproven**: GROQ/Sanity return a stable internal order for tied sort keys in practice. Worth the `_id` tiebreaker, but not HIGH.
- **22.1 / 22.2 (HIGH → MEDIUM)** — the `</script>` breakout is a real encoding bug, but the only injection vector for `make/model/title` is an **authenticated Sanity Studio editor** (capture writes are stubbed, import is a local script). Author-XSS, not anonymous stored XSS.
- **19.1 (MEDIUM → LOW)** — the "deployed Worker carries plaintext secrets" claim is **conditional**: the inlining only happens if the secret is present as a *build-time* env var. Prod reads secrets from `wrangler secret` (runtime `env`), which the code prefers, so the production Worker most likely does **not** inline them. Real for local `dist/` hygiene (same as 19.2), not the prod exposure claimed.
- **6.2, 8.4, 11.1, 11.2, 15.3, 15.4, 14.5, 20.3, 3.3, 3.4** — correctly low/info: gated-off code, intentional deferrals, doc drift, or cosmetic.

### Duplicate findings (same defect, multiple areas)

- **1.1 ≡ 2.2** — dealer name hardcoded in shopper shells.
- **2.1 ≡ 5.2** — chatbot phone/domain/name hardcoded.
- **2.3 ≡ 3.2** — `detailDisplay` hardcodes `en-AU`.
- **9.3 ≡ 21.1** — `/account` reads PII by **unverified** email.
- **10.1 ≡ 21.2** — guest write endpoints accept arbitrary email → content injection.
- **15.1 ≡ 17.2 ≡ 21.3** — `generate-description` origin-only gate + dealerNotes; **15.2 ≡** carsales variant.
- **9.6 ≡ 17.1** — Supabase SSR cookie flags (17.1 is the fuller write-up).
- **14.3 / 14.4 / 14.5 / 22.3** — all facets of "headers/CSP/HSTS not fully applied" + its doc drift.
- **22.1 ≡ 22.2** — same `set:html` XSS class, two files (legitimately two instances).

---

# Part A — Subsystem audits (1–16)

## 1. App shell, layouts & routing

**1.1 — PARTIALLY VALID (severity HIGH → LOW).** Real: `src/pages/index.astro:44,46,87,139,179` hardcode `'Rebirth Auto'` while `dealerConfig.identity.name` exists (`src/config/dealer.ts:22-24`). But this is a config-as-data/maintainability omission with **no correctness or security impact** on a single-tenant site, and the audit rates the *same class* MEDIUM in **2.2** — HIGH here is internally inconsistent. Downgrade to LOW. Dup of 2.2.

**1.2 — NEEDS-DECISION.** Confirmed factually: `src/pages/listings/[slug].astro` uses `getStaticPaths()` and sets no `prerender=false`; `astro.config.mjs` has no `output` key so Astro defaults to `static` → the detail page is prerendered. Whether that is a *defect* is a design call (prerender-for-TTFB vs live-inventory freshness), not a bug. The audit's own suggested fix admits "if prerendering is intentionally desired… that decision should be recorded." Treat as an owner decision, not a fix-on-sight.

**1.3 — CONFIRMED (contingent on 1.2).** `src/middleware.ts:36-78` stamps the three security headers on the `next()` response for **every SSR path** (the `else` branch also applies them), but Astro middleware never runs for prerendered assets — so the prerendered `[slug]` and `404.astro` ship without them. Accurate. Severity LOW-MEDIUM; the fix is coupled to the 1.2 decision (or an edge/Transform-rule header, per 14.4).

## 2. Dealer configuration

**2.1 — CONFIRMED (MEDIUM).** `src/config/dealer.ts:21-25` `identity` exposes **only `name`** — no phone/contact/domain field — so the chatbot literals (`core.ts:199,489,629,829`, `system-prompt.ts:170`) genuinely cannot trace to config. Real config-as-data leak. Dup of 5.2.

**2.2 — CONFIRMED (MEDIUM).** Same defect as 1.1, correctly rated here. `index.astro`/`[slug].astro`/`404.astro` literals verified.

**2.3 — CONFIRMED (LOW).** `src/lib/listing.ts:218` hardcodes `'en-AU'`. Latent (matches current config). Dup of 3.2.

**2.4 — NEEDS-DECISION.** Accurate that `DealerConfig.identity` is a stub (verified: only `name`; grep finds no logo/colour/domain/persona field; comment at `dealer.ts:670` defers the migration). This is the *structural root cause* of 1.1/2.1/2.5/16.2, not an independent bug — it's a scope decision on how far config-as-data is built out now vs at multi-tenant time.

**2.5 — CONFIRMED (LOW/INFO).** Domain is expressed multiple ways with no single source (workers.dev origins, `rebirthauto.example`, `rebirthauto.com.au`, `.pages.dev` in `astro.config.mjs:20`). Real inconsistency; reconcile before launch.

## 3. Listings & inventory data model

**3.1 — CONFIRMED (MEDIUM).** `src/lib/listing.ts:150-156` hardcodes `toLocaleDateString('en-US', …)` while `dealerConfig.locale.locale` is `en-AU`. Genuinely **user-visible**: dates render `July 29, 2026` (US) instead of AU on the public detail page. `formatPrice` (`listing.ts:143`) already does it right, proving the pattern. The strongest of the locale findings.

**3.2 — CONFIRMED (LOW).** Dup of 2.3.

**3.3 — PARTIALLY VALID (LOW/cosmetic).** `src/lib/listing.ts:390-393` real-estate icon branches exist, and the substring matches `type`/`size`/`area` *could* fire on a one-off `details[]` label. But impact is a wrong icon only, and typed spec labels are filtered by `STANDARD_DETAIL_LABELS`. Narrow cosmetic edge, not a correctness issue.

**3.4 — CONFIRMED (INFO).** `listing.ts:139` returns `'Contact agent'` (real-estate copy) for zero/no price. Cosmetic copy leftover; automotive wording preferred.

## 4. Filters & search

**4.1 — CONFIRMED (MEDIUM).** `src/lib/listings-query.ts:216` filter is `_type=="listing" && category=="automotive"` + user filters, **no status clause**; `src/chatbot/grounding/lookup.ts:114` appends `&& status=="active"`. So the page grid shows/counts `draft` listings the chatbot hides. Real divergence; excluding `draft` at the page path is the right minimal fix. (Note: `context.ts:12` deliberately does *not* status-scope its by-`_id` resolve — that's intentional and separate.)

**4.2 — CONFIRMED (LOW).** `SearchDock.astro:507-514` regex-scrapes the English count copy from `InventoryResults.astro`. Robustness/coupling risk if copy is localized. Real, low.

**4.3 — CONFIRMED (LOW).** `FilterDrawer.astro:326-343` re-implements serialization in parallel to `serializeFilters`. It routes the final write through `applyFilterUrl`, so it's a DRY/drift risk, not a live bug. Accurate.

**4.4 — CONFIRMED (LOW).** `src/lib/client/filter-url.ts` catch-block navigates to a possibly-superseded URL without re-checking `seq`. Real but requires a network failure racing a rapid second apply. Low.

## 5. Chatbot "Rebi"

**5.1 — CONFIRMED (MEDIUM).** `src/chatbot/grounding/verify.ts:75-84` `CAR_MAKES` has no `jaecoo`/`leapmotor`; inventory contains Jaecoo (`grep` in `scripts/data/bundaberg-40.json`). This is precisely the invented-stocked-brand class the firewall targets. The price check still fires (partial coverage), so MEDIUM is right. Deriving the lexicon from a shared franchise source is the durable fix.

**5.2 — CONFIRMED (LOW).** Dup of 2.1.

**5.3 — CONFIRMED (LOW).** `core.ts:599-607` contact-only branch returns before the rate-limit gate at `core.ts:622` and calls `sendFollowUpToTelegram` unthrottled. Session ids are unguessable UUIDs, so the surface is small — LOW is correct.

**5.4 — CONFIRMED (LOW).** `telegram-webhook.ts:74` falls back to `getLatestHandoffSession()` for non-quote replies. Documented single-agent assumption, gated to the team chat_id. Low.

## 6. AI capability-tier layer

**6.1 — CONFIRMED (HIGH). The single most important finding.** Verified directly: `chat.ts:25-32` and `search.ts:165-171` pass `streamAttemptTimeoutMs: REQUEST_TIMEOUT_MS`; `generate-description.ts:175-180` **omits** it. `src/ai/config.ts:49-52` throws when `JSON.stringify(current) !== JSON.stringify(config)`, and neither `configureAI` call is wrapped in try/catch (`chat.ts:24-33` sits bare in the POST handler). On a warm isolate that already served one family, the other throws uncaught → HTTP 500. Because `chat` is buyer-facing, this can break shopper chat. The fix (add the field / share one config object) is trivial and correct.

**6.2 — PARTIALLY VALID (LOW/hygiene).** `inventory-tools.ts:186` interpolates `max` without `Math.floor`. But it's not injection (values go through `$params`), the feature is gated OFF (`agenticSearch.enabled=false`), and `max` is only ever the integer default today. Real code smell, negligible impact — closer to INFO than LOW.

## 7. Compare

**7.1 — PARTIALLY VALID (severity MEDIUM → LOW).** Real: `CompareTray.astro:51` `MAX=4` and `:136` builds the link with all ids, while `compare.astro:40` and `compare-tools.astro:48` both `.slice(0,3)`. So a 4th car is silently dropped. But this is a **UX inconsistency** with no data/security impact; LOW fits better than MEDIUM. Aligning the cap as config-as-data is the clean fix.

**7.2 — CONFIRMED (LOW).** `Contender.astro:24` builds `/listings/${slug}` and `compare-tools.astro:101` defaults slug to `''` → dead `/listings/` link for slug-less cars. `compare-pick.ts:237-240` already guards the same case, confirming the pattern. Low.

**7.3 — CONFIRMED (LOW/edge).** `compare.astro:204` feeds `winners()` a synthetic uniform `'currency'` unit array, bypassing the mixed-unit guard. Single-dealer inventory shares one currency, so it's an edge case. Accurate.

## 8. Capture (dealer PWA)

**8.1 — CONFIRMED (MEDIUM).** Traced the regex: `pipeline.ts:92` `grand` = `/\b(\d[\d,]*)\s*(k|grand|thousand)\b/` scans left-to-right and matches the odometer's `142k` before the spoken `25 grand`, so `price = 142*1000`. Contradicts the code's own comment at lines 86-89. Marked `medium` confidence → `needsReview=false`, so the wrong value is not flagged. Real determinism bug (dealer tool / demo, hence MEDIUM not HIGH).

**8.2 — CONFIRMED (MEDIUM).** Traced: `pipeline.ts:76` odometer regex — for `142k on the clock`, the `k on the clock` alternative consumes the `k`, so `(k)?` backtracks to empty and the `*1000` at line 79 never fires → `142` instead of `142000`, stored at `high` confidence (unflagged). Genuine.

**8.3 — CONFIRMED (LOW).** `vision-extract.ts` fabricates colour/bodyType at `confidence:'high'`; `pipeline.ts:144-147` records `source:'vision'` with no `'stub'` `FieldSource`, so invented demo data isn't review-flagged. Inherent to the demo stub. Low.

**8.4 — NEEDS-DECISION.** Capture PWA is dark-themed (`index.astro:40`) vs the light-theme standard. The audit itself calls it "arguably justified" (standalone installable tool). Owner call, not a bug.

**8.5 — CONFIRMED (INFO).** `http.ts:34-37` gates capture endpoints on a spoofable Origin + fail-open rate limit only. Accurate and acceptable **today** (all writes stubbed) but must be revisited before live VIN/vision/write paths — same class as 15.1/17.2.

## 9. Accounts & authentication

**9.1 — CONFIRMED (MEDIUM).** `src/actions/index.ts` has no `dealerConfig` import and no `accounts.enabled` check (verified by grep); the `server` action block is always registered, while every page and `middleware.ts:55` gate on the flag. So the flag is not a true single seam — actions stay callable when accounts is "off". Real.

**9.2 — CONFIRMED (MEDIUM, partly redundant).** `actions/index.ts:170-174` returns `session: data.session` (access+refresh tokens) though the client (`AuthCard.astro`) only reads `success`. Echoing tokens to JS is needless exposure. Note: because cookies are **not** httpOnly today (17.1), JS can already read them — so this compounds 17.1 rather than being independent. Fix both.

**9.3 — NEEDS-DECISION (conditional).** `account.astro:35,55-57` reads PII by `user.email` with no `email_confirmed_at` check (grep confirms zero such checks). The cross-user read only works **if Supabase email confirmation is disabled** — external project config not visible in code. Real pre-launch risk; the gate-on-`email_confirmed_at` fix is sound defense-in-depth. Dup of 21.1.

**9.4 — CONFIRMED (LOW).** No `checkRateLimit` in `actions/index.ts` (grep empty); `dealerConfig.accounts.rateLimit` is declared but unused. Turnstile is the only throttle. Accurate.

**9.5 — CONFIRMED (LOW).** Honeypot (`website`) is validated client-side only; the signUp input schema has no such field (grep empty). Decorative server-side. Accurate.

**9.6 — CONFIRMED (MEDIUM; precursor of 17.1).** `src/lib/supabase.ts:33-41` `setAll` forwards library-default cookie `options` verbatim with no explicit `httpOnly/secure/sameSite`. Verified. This is the same root as 17.1 — treat as one fix.

## 10. Saved searches & service bookings

**10.1 — CONFIRMED (LOW–MEDIUM).** `api/saved-search.ts`/`book-service.ts` accept an arbitrary caller-supplied email with only a shape check; `/account` later renders all rows matching the logged-in email. Content-injection into a trusted page is real (Astro auto-escapes, so **not XSS**). Impact is conditional on the read side (9.3/21.1). Dup of 21.2.

**10.2 — CONFIRMED (LOW).** `account.astro:67-70` `rerunHref` concatenates the stored query instead of round-tripping `serializeFilters/hrefFor`. Mitigated (stored query was produced canonically, re-parsed on landing), so drift risk not live bug. Accurate.

**10.3 — CONFIRMED (LOW).** Migrations index `(visitor_id, created_at)` while the only wired reads filter `lower(email)` (full scan); non-`ByEmail` helpers are exported but unused. Demo-safe. Accurate.

## 11. Trade-in / valuation

**11.1 — PARTIALLY VALID (LOW → INFO-ish).** `trade-in.ts:82` parses the body before the rate-limit slot, and make/model have no max length. The audit itself notes this is a **deliberate tradeoff** (comment at line 79) bounded by Cloudflare's body-size ceiling, and inputs aren't reflected. Barely a finding.

**11.2 — CONFIRMED (INFO, no code change).** Correct that the endpoint returns 4xx for validation/flag errors and only 200 `{error}` on compute failure; the SYSTEM-MAP prose is loose. Doc nit only, as the audit says.

## 12. Stubs & integration registry

**12.1 — CONFIRMED (MEDIUM).** `src/stubs/email.ts:51` `console.log(\`[email:stub] → ${msg.to} : ${msg.subject}\`)` logs the recipient email; callers pass the shopper's real address (`saved-search.ts`, `book-service.ts`), and the stub is the **default** path (no `RESEND_API_KEY`). PII-in-logs, genuine. Drop `msg.to` from the log.

**12.2 — CONFIRMED (LOW).** `manufacturer.ts:56` / `reviews.ts:56` / `websearch.ts:54` `void useStub` and always call the stub, contradicting each stub header's "config change, not code change" claim. Accuracy gap; not a spend/PII risk (offline, price-free, default-off). Accurate.

## 13. Data scripts & tooling

**13.1 — CONFIRMED (HIGH).** `scripts/import-bundaberg.ts:58` `dryRun = argv.includes('--dry-run')` → default is a **live import** (`:443` prints `*** LIVE IMPORT ***` when the flag is absent); no `--commit` gate. Inverts the dry-run-by-default hard constraint. Real and important.

**13.2 — CONFIRMED (HIGH).** `scripts/seed.ts:146` `client.delete({ query: '*[_type == "listing"]' })` — a **broad query-match delete**, directly violating "Deletions must target explicit IDs." No dry-run/`--commit` gate; `--clean` runs delete+reseed. Both hard-constraint violations verified. This is the most dangerous non-runtime finding.

**13.3 — CONFIRMED (MEDIUM).** No `.github/workflows` exists, so `check-ai-imports.sh` is advisory-only; a forbidden `src/ai/providers/*` import from feature code would ship. Real guardrail gap; either wire a prebuild hook or soften the comment.

**13.4 — CONFIRMED (LOW).** Error text/comments name `SANITY_API_TOKEN` while code reads `SANITY_TOKEN` (`seed.ts`, `import-bundaberg.ts`, `migrate-details-to-specs.ts`). Operator-confusing mismatch. Accurate.

## 14. Infrastructure & deploy

**14.1 — CONFIRMED (MEDIUM).** `core.ts:667` gates the Turnstile block on `env.CHATBOT_TURNSTILE_SECRET_KEY` truthiness — if falsy, the whole verify block is skipped (fail **open**), unlike the auth path which throws (`actions/index.ts`). `get-env.ts:34-38` reads two chat names (`CHATBOT_TURNSTILE_SECRET_KEY`, `TURNSTILE_RB_LISTINGS_AUTO_SECRET_KEY`) from runtime `env` first — good — but auth uses a *third* name (`TURNSTILE_SECRET_KEY`), so a wrangler-secret typo can silently disable chat bot-protection. Real; fail-closed + name consolidation is right.

**14.2 — CONFIRMED (MEDIUM).** `astro.config.mjs:20` `site` is the `.pages.dev` placeholder (doubly wrong: guess domain + Pages naming on a Worker deploy). Known but real pre-launch SEO/OG defect.

**14.3 — CONFIRMED (LOW).** `middleware.ts:29-34` sets nosniff/Referrer-Policy/X-Frame-Options but not HSTS, which is non-breaking on an HTTPS-only Worker and is the documented priority-1 gap. Accurate; easy add.

**14.4 — CONFIRMED (LOW).** `wrangler.jsonc` binds ASSETS with no `run_worker_first`, so static assets bypass middleware and lack the headers. Accurate; the "all responses" claim is overstated. Edge/Transform rule is the correct remedy (also covers 1.3).

**14.5 — CONFIRMED (LOW, doc).** `docs/cloudflare-security.md` still says "no response-header security policy exists," contradicted by `middleware.ts`. Stale doc. Accurate.

**14.6 — CONFIRMED (LOW).** `worker-configuration.d.ts` Env type omits several runtime secrets (`TURNSTILE_SECRET_KEY`, `SANITY_TOKEN`, `PUBLIC_SUPABASE_*`, etc.), and readers cast to `any`, so a missing prod secret isn't caught at typecheck. Accurate maintainability nit.

## 15. Sanity Studio & CMS

**15.1 — CONFIRMED (MEDIUM–HIGH).** `generate-description.ts:106-109` gates solely on the `Origin` header (self-acknowledged `TODO(multi-tenant)` at line 107); Origin is trivially forged by non-browser clients. Listing `_id`s are public via `LISTING_FIELDS`, and the endpoint reads the **draft incl. `dealerNotes`** with the server token and grounds the LLM on it. Real access-control weakness + AI-cost surface (bounded only by 20/hr per IP). Dup of 17.2/21.3. I'd call it HIGH as a class but note the response returns generated prose, not raw `dealerNotes`, so leakage is indirect.

**15.2 — CONFIRMED (MEDIUM).** `carsales-upload.ts:80-83` same Origin-only gate. Currently defanged by `integrations.carsales.enabled=false` (404) + token-less `status=="active"` read, so no draft/dealerNotes exposure today. Real but latent until the flag flips. Dup class of 15.1.

**15.3 — NEEDS-DECISION (owner action).** `/studio` served with no Cloudflare Access; Sanity's own login still gates data ops. Known, explicitly-tracked owner action, not a code defect. Accurate framing.

**15.4 — CONFIRMED (INFO, doc drift).** `src/sanity/lib/client.ts:8` `useCdn: import.meta.env.PROD` (CDN on in prod), while SYSTEM-MAP §15 says `useCdn:false`. Note the **`astro.config.mjs:27` sanity integration** separately sets `useCdn:false` — two different clients. Reconcile the doc; optionally force `useCdn:false` on the carsales publish read. Accurate.

## 16. Styling & design system

**16.1 — CONFIRMED (MEDIUM, accessibility).** Verified the specificity argument: `global.css:7` uses `:where(...):focus-visible` (specificity 0,1,0); Tailwind `focus:outline-none` compiles to `.focus\:outline-none:focus` (0,2,0) and wins. `InventoryResults.astro:110` and `FilterDrawer.astro:78` pair it with only `focus:border-slate-400` (no ring); `AuthCard.astro:27` tabBase has neither ring nor border change. Real WCAG 2.4.7 gap. (The audit correctly notes `AuthCard.astro:31,240` are fine because they add `focus:ring-2`.)

**16.2 — NEEDS-DECISION.** Brand colour `rgb(1 97 239)` hardcoded across ~6 files with no `dealerConfig` colour field. This is the same config-as-data-scope judgment as 2.4; SYSTEM-MAP §16 acknowledges colours intentionally live in CSS for now. Reconcile AGENTS.md vs the map — an owner decision, not a bug.

**16.3 — CONFIRMED (LOW).** `index.astro:132` `animate-pulse` dot has no `motion-reduce` guard (outlier vs rebi.css/stage.css which gate motion); `compare-tools.astro:495-496` webkit-only slider focus ring leaves Firefox keyboard users without one. Minor a11y edges. Accurate.

---

# Part B — Security-domain sweeps (17–24)

## 17. Authentication, session & access control

**17.1 — CONFIRMED (HIGH, pre-launch).** `src/lib/supabase.ts:33-41` forwards `@supabase/ssr` default cookie options (`httpOnly:false`, no `secure`, 400-day refresh token) unchanged. Only the SSR **server** client is used (no `createBrowserClient` in `src`), so forcing `httpOnly:true, secure:true` is safe and removes the token from JS. Genuine and a one-line fix. Caveat on exploitability: it needs an XSS to weaponize, and the only XSS in the repo (22.1/22.2) requires a Studio-author injection — so this is defense-in-depth/pre-launch hardening rather than an actively-exploitable hole today. Fuller write-up of 9.6.

**17.2 — CONFIRMED (MEDIUM–HIGH).** Same Origin-only gate as 15.1 across `generate-description.ts:108-111`, `carsales-upload.ts:81-84`, and `capture/http.ts:34-37`. Non-browser clients forge `Origin`. Real broken-access-control; the `dealerNotes`→LLM path is the sharpest edge. Dup of 15.1/21.3.

## 18. Injection

**18.1 — CONFIRMED (LOW).** `journey.ts:134-136` stores a client `label` with only a length cap; `grounding/journey.ts:26-29` renders it into the system prompt after `stripPrices()` only — newlines and `=== … ===` delimiters not neutralized, so delimiter-forging prompt injection into the system role is possible. Correctly rated LOW: rows are keyed to the attacker's **own** opaque cookie (self-session), and `dealerNotes` is excluded from chat grounding, so no cross-user or secret exfiltration. Real untrusted-input-to-instructions vector; sanitize the label.

## 19. Secrets & env exposure

**19.1 — PARTIALLY VALID (severity MEDIUM → LOW).** The pattern is real: `get-env.ts:22,29,31,33` and peers use `env.X ?? import.meta.env.X`, and Vite statically inlines `import.meta.env.X` **when the var is present at build time** — the audit verified this in a *local* `dist/server`. But the production claim is conditional: Cloudflare build-time env and `wrangler secret` (runtime `env`) are **separate**, and the code reads runtime `env` first. If the secrets are not build-time vars in the CF build (the documented deploy model), the production Worker inlines `undefined`, not the key. So this is best treated as **local build-artifact hygiene** (identical to 19.2), not a shipped-prod credential leak. Dropping the `import.meta.env` fallback for non-PUBLIC secrets is still the correct hardening.

**19.2 — CONFIRMED (LOW, build hygiene).** The adapter copies `.dev.vars` into `dist/server/.dev.vars` (plaintext secrets). `dist` is gitignored and `wrangler deploy` doesn't upload `.dev.vars`, so impact is limited to a leaked/archived build dir. Accurate; delete it post-build.

## 20. Rate-limiting & cost abuse

**20.1 — CONFIRMED (MEDIUM).** `api/journey.ts:17` → `handleJourneyBeacon` with **no** rate limit / Turnstile / origin (grep confirms no `checkRateLimit`), performing a D1 INSERT per call, and minting a fresh cookie per request if none is sent → unbounded row growth + write billing. The only unguarded D1-writing POST. Real cost/DoS vector; add a generous per-IP cap that still returns 204.

**20.2 — CONFIRMED (LOW).** `chat-poll.ts:29` GET runs two D1 reads on an attacker-controlled `sessionId` with no limiter. Session ids are unguessable UUIDs (so not a practical IDOR), but the unbounded read/enumeration surface is real. Low.

**20.3 — NEEDS-DECISION (INFO).** `search.ts:117` bounds LLM cost only by a per-IP 30/hr counter, no Turnstile — a **documented tradeoff** (shopper search is high-volume; free-tier model today). Adding a Turnstile/spend cap is a judgment call tied to restoring a paid model (phase-3 memo). Correctly INFO.

## 21. Data leakage, privacy & IDOR

**21.1 — NEEDS-DECISION (conditional).** Dup of 9.3 — cross-user read only if Supabase email confirmation is off (external config). Verified no `email_confirmed_at` check in `src`. Real pre-launch item; gate on it.

**21.2 — CONFIRMED (LOW).** Dup of 10.1 — guest write endpoints accept an arbitrary email; content injection into a trusted dashboard (auto-escaped, not XSS). The write itself is unconditional; the *display* impact is conditional on 21.1. Low.

**21.3 — CONFIRMED (INFO).** Dup of 15.1/17.2 — `generate-description` feeds `dealerNotes` to the LLM behind the forgeable Origin check; response is generated prose, not raw notes. Correctly INFO/low as the narrowest framing of the same issue.

## 22. XSS, output encoding & headers

**22.1 — PARTIALLY VALID (severity HIGH → MEDIUM).** Verified: `compare.astro:524` `<script … set:html={JSON.stringify(cars)} />` with `cars` (`:251-260`) built from CMS `make/model/title`; `JSON.stringify` does not escape `</script>`, and it's read back via `dataEl.textContent` + `JSON.parse` (`:855`). The encoding bug is **real and should be fixed** (escape `<`/`</script>` or use a data-attribute). But the only path that can set `make/model/title` is an **authenticated Sanity Studio editor** — capture writes are stubbed, import is a local operator script — so this is author-injected, not anonymous stored XSS. In this app's context that's MEDIUM, not HIGH.

**22.2 — PARTIALLY VALID (severity HIGH → MEDIUM).** Identical sink at `compare-tools.astro:326` (`cars` from `:63-65`). Same verdict as 22.1; a legitimate second instance (dup of 22.1's class).

**22.3 — NEEDS-DECISION (LOW).** No CSP (`middleware.ts` comment documents the deferral: per-source allow-listing for Turnstile/Supabase/OpenRouter/Sanity is non-trivial). It's the reason 22.1/22.2 lack defense-in-depth. Adding a baseline CSP is a real but deliberate, behaviour-sensitive project decision — correctly framed as a deferral, not a regression.

## 23. SSRF & untrusted fetch/upload

*No findings.* **Concur.** Spot-checked the claims: capture "uploads" become opaque `photo:name:size` strings fed to a hash stub (no network I/O); grounding web-search is allowlist-gated and stubbed; outbound `fetch`es target hardcoded hosts (OpenRouter/Turnstile/Telegram); Sanity image URLs are server-derived. Clean assessment stands.

## 24. Determinism & data integrity

**24.1 — PARTIALLY VALID (severity HIGH → MEDIUM).** Verified: `listings-query.ts:252` paginates `| order(${order}) [${offset}...${end}]` and `SORT_CLAUSES` (`:79-85`) carry **no `_id` tiebreaker**; default sort `newest` = `listingDate desc`, and the importer stamps one timestamp per run (`import-bundaberg.ts`), so the default view is one big tie set. Appending `_id asc` is the correct, cheap fix. **But** the audit's concrete impact ("shoppers see the same car twice and never see others") is **unproven**: GROQ/Sanity return a deterministic internal order for documents tied on the sort key within a dataset version, so cross-page duplication/omission is theoretical here, not demonstrated. Real latent robustness issue, MEDIUM.

**24.2 — CONFIRMED (LOW–MEDIUM).** `inventory-tools.ts:186`, `grounding/context.ts:166`, `grounding/lookup.ts:126` all `order(price asc)[0...max]` with no tiebreaker → the "cheapest N" set can vary among equal-priced cars. Same root as 24.1; the anti-hallucination guarantee relies on deterministic executors, so worth the `_id` tiebreaker. Records are real (no fabrication), so LOW–MEDIUM.

**24.3 — CONFIRMED (LOW).** `[slug].astro:52-54` related-listings `order(listingDate desc)[0...3]` on the identical-across-catalogue `listingDate`, no tiebreaker → arbitrary "related" picks. Cosmetic block, no data loss. Accurate; consider a real relatedness signal.

**24.4 — CONFIRMED (LOW).** `import-bundaberg.ts:74` `detailKey` uses `Math.random()` for Sanity array `_key`s → non-idempotent re-imports (churned/duplicated detail rows). Contained to the import script. Derive the key from content. Accurate.

---

## Reviewer's closing note

The audit is trustworthy: evidence pointers were accurate on every finding I re-opened, and there were **no false positives**. Prioritise **6.1** (a real, buyer-facing 500 with a one-line fix), the two destructive-script constraint violations **13.1/13.2**, the firewall-lexicon gap **5.1**, the draft-exposure **4.1**, and the cookie/Origin-gate pre-launch security items **17.1 / 15.1**. De-prioritise the over-rated **1.1** and **24.1** HIGHs, treat the config-as-data-scope items (**2.4, 16.2**) and prerender/CSP items (**1.2, 22.3**) as owner decisions, and collapse the duplicates listed above so the same fix isn't ticketed three times.
