# Task brief — Saved searches + email alerts (stubbed email)

Let a shopper save their current search and be "alerted" when new matching stock arrives.
Follow `docs/briefs/_stub-convention.md` (READ FIRST). Email sending is stubbed.

## Stack context
- Astro 7 SSR, Cloudflare Worker, Tailwind v4, TS. `npx astro check` must stay green (before/after; zero new errors).
- Filter state lives in the URL and is read/written ONLY via `applyFilterUrl` / the helpers in `src/lib/listings-query.ts` + `src/lib/client/filter-url.ts`. A "saved search" is just a saved canonical filter query string — reuse the existing serialization, do NOT invent a new URL format.
- Persistence: Cloudflare D1 (`CHAT_DB`), same binding the chatbot/journey use. Add a NEW additive migration `migrations/0004_saved_searches.sql` (mirror `0003_journey.sql`: `CREATE TABLE IF NOT EXISTS`, an index, a header comment with the local + `--remote` apply commands). Access it fail-open exactly like `src/chatbot/journey.ts` (guard on the db binding, swallow errors, never surface to the user).
- Env via `cloudflare:workers` (mirror `get-env.ts`; do NOT edit get-env.ts). Rate-limit with `checkRateLimit` (distinct `keyPrefix: 'savedsearch:'`, fail-open).
- **Config as data:** add a `savedSearch` block to BOTH dealer config objects in `src/config/dealer.ts` (enabled flag, rateLimit, any copy). Match the `journey`/`search` declaration style.

## Build

### 1. Email stub — `src/stubs/email.ts`
- Export `export interface EmailMessage { to: string; subject: string; text: string; }` and `export async function sendEmail(msg: EmailMessage): Promise<{ ok: boolean; id: string }>`.
- Stub logs a clear `[email:stub] → {to} : {subject}` line and returns `{ ok: true, id: 'stub-<deterministic>' }` (deterministic id from a hash of to+subject; NO Math.random). Leave `// TODO_KEYS: Email — RESEND_API_KEY (or provider) — set in .dev.vars / wrangler secret`.
- Activation: `useStub = !env.RESEND_API_KEY || truthy(env.STUB_EMAIL)`.

### 2. Persistence layer — `src/lib/saved-search.ts`
- Fail-open D1 helpers mirroring `chatbot/journey.ts`: `saveSearch(db, { visitorId, email, query, label })` (INSERT, swallow errors, void) and optionally `getSavedSearches(db, visitorId)` (SELECT, `[]` on any error). Cap `query`/`label`/`email` lengths. Validate email shape defensively.

### 3. API route — `src/pages/api/saved-search.ts`
- `POST { email, query, label }` → `{ ok } | { error }` (HTTP 200 on expected failure). Feature flag → validate (email format, non-empty query) → rate-limit (`savedsearch:`) → persist (fail-open) → send a stubbed confirmation email ("We'll email you when new matches arrive"). Resolve the visitor id via the existing `resolveVisitor` from `src/chatbot/visitor.ts` (reuse it; set the cookie if minted).

### 4. UI — "Save this search"
- Add a tasteful "Save this search" affordance to the inventory results surface. Look at `src/components/filters/InventoryResults.astro` and/or `src/components/filters/ActiveFilterChips.astro` for where the current filter state is shown, and place it there (only meaningful when at least one filter is active — hide/disable on an empty search). Clicking opens a small inline email-capture (an email input + submit), POSTs the current canonical query string (read it from the current URL via the existing filter helpers, NOT hand-rolled) + an auto-generated human label (e.g. from the active filter chips) to `/api/saved-search`, and shows a success/failure message inline. Match the site's existing visual language and progressive-enhancement style (small inline `<script>`).

### 5. Register
- `TODO_KEYS.md`: add Email row `| Email alerts | STUB_EMAIL | RESEND_API_KEY | .dev.vars / wrangler secret | real confirmation + new-match alert emails | ~0.5 day (provider SDK) |`.
- The PERIODIC "new match arrived" alerting (a scheduled worker that re-runs saved queries and emails matches) is OUT OF SCOPE here — it needs a Cloudflare cron trigger. Leave a `// TODO_KEYS: Saved-search alerts — Cloudflare Cron trigger — wrangler.jsonc [triggers] + a scheduled handler` marker in `src/lib/saved-search.ts` and note it in your report. This feature ships the SAVE + confirmation now; the recurring alert is the documented next step.

## Scope guardrails — do NOT
- Do NOT build user accounts/auth (separate feature). Do NOT add the cron/scheduled matcher. Do NOT edit get-env.ts. Do NOT construct filter URLs by hand — reuse the helpers. Do NOT use Math.random / module-top-level new Date(). Do NOT commit.

## Acceptance criteria (report each)
1. `src/stubs/email.ts` — interface + stub; how useStub resolves.
2. `migrations/0004_saved_searches.sql` — schema (quote the CREATE TABLE).
3. `src/lib/saved-search.ts` — fail-open helpers; confirm they swallow errors like journey.ts.
4. `src/pages/api/saved-search.ts` — flag/validate/rate-limit/persist/confirm flow.
5. UI affordance — where placed; how it reads the canonical query via existing helpers; hidden on empty search.
6. `savedSearch` config in BOTH dealer objects; TODO_KEYS rows; cron marker present.
7. `npx astro check` before N / after M (M ≤ N).

## Report format
Concise: files created/edited (one line each), the CREATE TABLE, how the query string is read from the URL, useStub expression, astro check before/after, anything not done.
