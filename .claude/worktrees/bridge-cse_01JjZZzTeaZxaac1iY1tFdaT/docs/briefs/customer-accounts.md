# Task brief — Customer accounts (DEMO-ONLY auth scaffold, OFF by default)

A "my account" surface — service history, saved searches, vehicle interests — behind a
STUBBED, demo-only sign-in. Follow `docs/briefs/_stub-convention.md` (READ FIRST).

## THE SAFETY RULE THAT DOMINATES THIS FEATURE
`DECISIONS.md` requires **a paid human security review before any real customer data flows**,
and warns a data leak would be business-ending. So this feature is a DEMO SCAFFOLD, not a real
auth system:
- `accounts.enabled: false` by default in BOTH dealer configs. Off ⇒ no account routes render,
  the API returns 404, nothing changes.
- The stub "sign-in" does NOT handle passwords, sessions tokens, or real identity. It accepts an
  email and returns a MOCK customer profile (`src/stubs/auth.ts`), clearly labelled demo data.
  NO password field, no credential storage, no real cookie-based auth session.
- Put a loud banner in the UI ("Demo account — not a real, secured login") AND a top-of-file
  warning comment in `src/stubs/auth.ts` and the API route:
  `// SECURITY: demo scaffold only. Real customer auth requires the paid human security review
  //  mandated by DECISIONS.md before ANY real customer data. Do NOT wire to real PII.`
- `// TODO_KEYS: Customer auth — real IdP/session (e.g. Cloudflare Access / Auth provider) + security review — BLOCKER before real data`.

## Stack / rules
- Astro 7 SSR, Cloudflare Worker, Tailwind v4, TS. `npx astro check` green (before/after; zero new errors).
- **Config as data:** `accounts` block in BOTH dealer objects (`enabled: false`, copy). Match style.
- Env via `cloudflare:workers` (mirror get-env.ts; do NOT edit it). `useStub = truthy(env.STUB_AUTH) || !env.AUTH_PROVIDER_KEY` (default stub).
- Determinism: mock profile derived from the email (deterministic hash), no Math.random / module-top-level new Date().

## Build
### 1. Stub — `src/stubs/auth.ts`
- `export interface CustomerProfile { id: string; email: string; name: string; serviceHistory: { date: string; vehicle: string; service: string }[]; vehicleInterests: string[]; }`
- `export async function demoSignIn(email: string): Promise<CustomerProfile>` — deterministic mock profile (name + a couple of service-history rows + interests) from an email hash. Security warning comment at top.

### 2. API route — `src/pages/api/account.ts`
- `POST { action: 'signin', email }` → `{ profile }` (demo) | `{ error }`. Flag → validate email → rate-limit (`account:`) → `demoSignIn`. NO password. Returns the mock profile directly in the response body (demo; no server session). Security warning comment at top.
- (Saved searches: if the visitor has saved searches under their journey visitor id, you MAY surface a count via the existing `getSavedSearches` — optional, read-only, fail-open. Do not couple hard.)

### 3. UI — `src/pages/account.astro`
- Config-gated. A demo sign-in (email only) → on success shows the mock profile: service history table, vehicle interests, and a link to saved searches. Prominent "Demo account — not a secured login" banner. On-brand (reuse trade-in/service page vocabulary). Progressive inline `<script>` for the fetch.
- Config-gated homepage nav link like the trade-in/service ones.

### 4. Register — TODO_KEYS rows (auth blocker + security review).

## Scope guardrails — do NOT
- Do NOT build real password auth, sessions, JWTs, or store any credential. Do NOT enable by default. Do NOT connect to real customer PII. Do NOT touch grounding/pricing/the chatbot. Do NOT edit get-env.ts. No Math.random / module-top-level new Date(). Do NOT commit.

## Acceptance criteria (report each)
1. Stub + API + page created; security warning comments quoted.
2. Default-off proof (routes/API inert when accounts.enabled=false).
3. NO password/credential/session handling anywhere (confirm).
4. Demo banner present; config in BOTH objects; TODO_KEYS rows (incl. security-review BLOCKER).
5. astro check before N / after M (M ≤ N).

## Report format
Concise: files, the security warning comment, default-off + no-credential proof, astro check before/after, anything not done.
