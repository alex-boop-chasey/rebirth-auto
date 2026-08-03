# Task brief — Real Supabase auth (port from astro-users-demo), replacing the /account demo stub

Replace the current `/account` DEMO stub with **real Supabase auth**, ported from the reference
project at `/Users/alex/components/astro-users-demo`, adapted to THIS project (Astro 7 SSR on the
`@astrojs/cloudflare` Worker adapter, light theme, config-as-data). Credentials are already wired
into this repo's gitignored `.env` and `.dev.vars` (Supabase URL + anon key + Turnstile pair +
`PUBLIC_SITE_URL=http://localhost:4321`). Deps `@supabase/ssr` + `@supabase/supabase-js` are installed.

## Read the reference (port these, faithfully but adapted)
- `/Users/alex/components/astro-users-demo/src/lib/supabase.ts` — `getSupabase(request, cookies)` cookie client
- `/Users/alex/components/astro-users-demo/src/middleware.ts` — auth middleware
- `/Users/alex/components/astro-users-demo/src/actions/index.ts` — signUp/signIn/signOut/requestPasswordReset/updatePassword + Turnstile verify
- `/Users/alex/components/astro-users-demo/src/pages/{login,signup,dashboard,check-email}.astro`, `src/components/AuthCard.astro`, `src/layouts/Layout.astro` — the UI to port + RE-SKIN light
- `/Users/alex/components/astro-users-demo/src/env.d.ts` — `App.Locals.user` typing

## Adaptations required for THIS project
1. **Env access (critical — Worker adapter, not node):**
   - `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` / `PUBLIC_TURNSTILE_SITE_KEY` are `PUBLIC_` →
     `import.meta.env.*` works on Workers (Vite-inlined). Fine to use directly.
   - The server secret `TURNSTILE_SECRET_KEY` must be read via the Worker runtime, NOT `import.meta.env`.
     Read it the way `src/chatbot/get-env.ts` does — `import { env } from 'cloudflare:workers'` with an
     `import.meta.env` fallback for non-CF local runs. Do NOT edit `get-env.ts`; add a tiny local reader
     or extend the auth lib. (This repo already verifies Turnstile for the chatbot — mirror that style.)
2. **Routes / naming:** the authenticated area is **`/account`** (this replaces the demo `/dashboard`
   and the current `/account` stub). Build: `/login`, `/signup`, `/account` (the protected dashboard —
   greet the user, show email/name, a sign-out button, and space for service history / saved searches),
   `/check-email`, `/reset-password`. Middleware (`src/middleware.ts`) guards `/account` (→ `/login` if
   not authed) and bounces authed users away from `/login`/`/signup` (→ `/account`). Keep the middleware
   scoped to just these paths (like the demo) so it never runs on the shopper site/assets.
3. **Light theme + on-brand:** the demo's dark AuthCard/Layout must be RE-SKINNED to THIS site's light
   theme — `bg-slate-50` page, white cards, slate-900/800/500 inks, `ring-slate-900/10` hairlines,
   emerald for success, the Rebi-blue accent/gradient, the `.site-container` gutters, and a header/footer
   matching `src/pages/index.astro`. Reuse the site's visual vocabulary; do NOT ship a dark design and do
   NOT add a `prefers-color-scheme: dark` block (this is a light-only site).
4. **Config as data:** brand name / any dealer copy come from `src/config/dealer.ts` (there's an
   `accounts` block already — adapt it: keep an `enabled` flag gating the whole auth surface, plus copy).
   No hardcoded dealer literals. When `accounts.enabled` is false, `/login`/`/signup`/`/account` should
   behave as they did (redirect home) — preserve the feature flag.
5. **Turnstile:** use the demo's pair — the widget on login/signup/reset uses `PUBLIC_TURNSTILE_SITE_KEY`;
   the action verifies with `TURNSTILE_SECRET_KEY`. Port the demo's `verifyTurnstile` exactly (it already
   uses `cf-connecting-ip`).
6. **Remove the stub:** delete `src/stubs/auth.ts` and `src/pages/api/account.ts` (the demo-stub account).
   Update any references (the homepage `/account` nav link stays — it now points at the real flow).
   Remove the stub's TODO_KEYS "demo auth" rows; the security-review note still applies to PRODUCTION use
   (keep a `// TODO_KEYS: Supabase auth — production hardening + security review before real customer PII`
   marker + a TODO_KEYS row, since real customer data still warrants the DECISIONS.md review before launch).
7. `src/env.d.ts` — add `App.Locals.user` typing (Supabase `User | null`), merging with any existing
   `env.d.ts` content (do not clobber existing declarations).

## Hard rules
- Do NOT print, log, or COMMIT any secret values. `.env`/`.dev.vars` are gitignored — never `git add` them.
- All the usual project rules: config-as-data, determinism, light-theme. No `Math.random` / module-top-level
  `new Date()` (request-time `new Date()` in `.astro` frontmatter is fine). Astro Actions are Astro-7 built-in.
- `npx astro check` green (report before/after; zero new errors). The dev server runs on
  http://localhost:4321 — after building, curl `/login`, `/signup`, `/account` (unauthed → expect a redirect
  to /login), `/check-email`, `/reset-password` and confirm they render/redirect correctly. Do NOT attempt a
  real signup that creates a live user or sends email during verification — rendering + wiring + astro check
  is the bar; note the real round-trip as a manual step.
- Do NOT commit (the orchestrator reviews + commits).

## Acceptance criteria (report each)
1. Files created/edited/deleted (one line each).
2. Env adaptation: how PUBLIC_ vs TURNSTILE_SECRET_KEY are read (Worker-safe); get-env.ts untouched.
3. Routes + middleware: /login /signup /account /check-email /reset-password; middleware scope + guards.
4. Light-theme proof: no dark block; tokens match the site (quote a few).
5. Config-as-data: accounts.enabled gate preserved; no dealer literals.
6. Stub removed: src/stubs/auth.ts + /api/account.ts gone; references updated; security-review TODO_KEYS kept.
7. Renders: curl statuses for the five routes (unauthed).
8. astro check before N / after M (M ≤ N).

## Report format
Concise: files, env-read approach, route/middleware map, light-theme proof, curl statuses, astro check before/after, anything not done / needing a real-auth manual test.
