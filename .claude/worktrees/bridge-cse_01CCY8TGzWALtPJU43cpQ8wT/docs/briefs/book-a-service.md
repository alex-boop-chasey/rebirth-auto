# Task brief — Book a service (stubbed notify)

A service-department booking request flow for the dealership. Follow
`docs/briefs/_stub-convention.md` (READ FIRST). Confirmation is stubbed (reuse the email stub).

## Stack / rules
- Astro 7 SSR, Cloudflare Worker, Tailwind v4, TS. `npx astro check` stays green (before/after; zero new errors).
- Reuse `src/stubs/email.ts` `sendEmail` for the confirmation (do NOT duplicate it). If you want SMS too, add `src/stubs/sms.ts` mirroring the email stub (`useStub = !env.TWILIO_AUTH_TOKEN || truthy(env.STUB_SMS)`, log `[sms:stub] → …`, deterministic id, TODO_KEYS marker) — SMS is OPTIONAL; email confirmation is required.
- Persistence: D1 (`CHAT_DB`), new additive migration `migrations/0005_service_bookings.sql` (mirror 0003/0004 style). Fail-open access helpers in `src/lib/service-booking.ts` mirroring `chatbot/journey.ts` (guard on db, swallow errors, void/[]).
- Env via `cloudflare:workers` (mirror get-env.ts; do NOT edit it). Rate-limit `checkRateLimit` with `keyPrefix: 'service:'`, fail-open.
- **Config as data:** `service` block in BOTH dealer config objects — `enabled`, `rateLimit`, `serviceTypes` (a list like ['Logbook service','Brakes','Tyres','Air-con regas','General inspection'] — dealer-editable copy, NOT hardcoded in the page), booking hours/copy. Match journey/search style.
- Determinism: this is a booking REQUEST, not a confirmed appointment. Copy must say "request — our team will confirm a time", never assert a locked booking. No made-up availability.

## Build
1. `src/lib/service-booking.ts` — `saveBooking(db, {...})` + `getBookings(db, visitorId)` fail-open D1 helpers; length caps; email/phone defensive validation.
2. `migrations/0005_service_bookings.sql` — table: id, visitor_id, name, contact (email/phone), vehicle (free text: rego or make/model), service_type, preferred_date (text), notes, created_at; + index on (visitor_id, created_at).
3. `src/pages/api/book-service.ts` — POST { name, email, phone?, vehicle, serviceType, preferredDate, notes? } → { ok } | { error } (200 on expected fail). Flag → validate (name, valid email, serviceType ∈ config list, non-empty vehicle) → rate-limit (`service:`) → persist (fail-open) → stub confirmation email to the shopper AND a stub notification to the dealer's configured contact (best-effort, own try/catch). Resolve visitor via `resolveVisitor`.
4. `src/pages/service.astro` — on-brand booking form (name, email, phone optional, vehicle, service type dropdown from config, preferred date, notes), POSTs to the API, inline success/error. Reuse the site's visual vocabulary (see trade-in.astro / compare.astro). Config-gated homepage nav link like the trade-in one (reuse that pattern in index.astro).
5. `TODO_KEYS.md` — row(s) for STUB_SMS if you add it; the email row already exists (reused). Add a prod-migration owner row for 0005.

## Scope guardrails — do NOT
- No real calendar/POS integration (that's a separate deferred feature — leave a `// TODO_KEYS: Service scheduling — POS/calendar API — per-dealer` marker). No accounts/auth. No cron. Do NOT edit get-env.ts. No Math.random / module-top-level new Date(). Do NOT commit.

## Acceptance criteria (report each)
1. Files created/edited (one line each).
2. `migrations/0005_service_bookings.sql` — quote CREATE TABLE.
3. API flow (flag/validate/rate-limit/persist/confirm; dealer + shopper notify).
4. `service` config in BOTH dealer objects incl. serviceTypes; form reads types from config.
5. Determinism: quote the "request, not confirmed" copy.
6. astro check before N / after M (M ≤ N).

## Report format
Concise: files, CREATE TABLE, API flow, config location, the request-not-confirmed copy, astro check before/after, anything not done.
