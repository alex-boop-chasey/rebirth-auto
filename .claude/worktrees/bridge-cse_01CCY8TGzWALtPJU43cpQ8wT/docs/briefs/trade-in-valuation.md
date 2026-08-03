# Task brief — Trade-in valuation (stubbed Redbook)

Build a complete "what's my trade-in worth?" feature for shoppers, backed by a stub that is
behaviourally indistinguishable from a real Redbook valuation API. Follow the shared stub
convention in `docs/briefs/_stub-convention.md` (READ IT FIRST).

## Stack context
- Astro 7 SSR, Cloudflare Worker adapter, Tailwind v4, TypeScript. `npx astro check` must stay green (report before/after; zero new errors).
- Env is read via `cloudflare:workers` (see `src/chatbot/get-env.ts` for the exact pattern, incl. the `import.meta.env` fallback for non-CF local runs). Do NOT use `process.env` in worker code.
- API routes are thin wrappers with `export const prerender = false;`. Pattern: feature-flag → cheap body validation → per-IP rate limit (`checkRateLimit` from `src/lib/rate-limit.ts`, fail-open, distinct `keyPrefix`) → graceful degradation (never a 500 for an expected failure).
- **Config as data:** all dealer-facing values/toggles live in `src/config/dealer.ts`. Add a `tradeIn` config block under the dealer config (enabled flag, plus any copy/labels). There are TWO dealer config objects in that file (a schema/defaults object ~line 22-230 and a concrete dealer object ~line 334+) — add the block to BOTH consistently, matching how `journey`/`search` are declared in each.

## Build

### 1. Stub — `src/stubs/redbook.ts`
- Export a typed interface + function:
  ```ts
  export interface TradeInInput { make: string; model: string; year: number; odometerKm: number; condition: 'excellent'|'good'|'fair'|'poor'; }
  export interface TradeInValuation { low: number; mid: number; high: number; currency: string; confidence: 'stub'|'live'; disclaimer: string; }
  export async function getTradeInValuation(input: TradeInInput, currency: string): Promise<TradeInValuation>
  ```
- The stub returns a DETERMINISTIC, realistic valuation derived from the inputs (do NOT use Math.random — it's banned and non-deterministic): e.g. a base value that depreciates with age (year vs a passed-in "current year" — accept it as a param so no `new Date()` in the module), reduces with odometer, and adjusts by condition; produce low/mid/high as a ±band around mid. `confidence: 'stub'`. Include a clear `disclaimer` that it's an indicative estimate, not a firm offer.
- Leave `// TODO_KEYS: Redbook — REDBOOK_API_KEY (Redbook/NEVDIS valuation) — set in .dev.vars / wrangler secret` where the real call would go.

### 2. API route — `src/pages/api/trade-in.ts`
- `POST { make, model, year, odometerKm, condition }` → `{ valuation } | { error }` (HTTP 200 on expected failures).
- Resolve `useStub = !env.REDBOOK_API_KEY || truthy(env.STUB_REDBOOK)`. Real branch is a `// TODO_KEYS:` marker + throw-not-implemented (never reached while stubbed). Pass the current year into the stub from the request handler (compute it in the route where a request-time clock is fine — NOT at module top-level).
- Feature-flag off → 404/disabled response. Rate-limit with `keyPrefix: 'tradein'`.

### 3. UI — `src/pages/trade-in.astro`
- A clean, on-brand page: a short form (make, model, year, odometer, condition) that POSTs to `/api/trade-in` and renders the low/mid/high band + disclaimer. Use the site's existing visual language (reuse Tailwind classes/components already used on listing/compare pages; look at `src/pages/compare.astro` and `src/components/*` for the design vocabulary — cards, headings, buttons). Progressive: a small inline `<script>` doing the fetch + render is fine (match how other pages do client JS). Show a tasteful loading state.
- Link it in wherever "sell/trade" would naturally live IF there's an obvious nav/footer slot — but do NOT invent large nav changes; if unsure, just make the page reachable at `/trade-in` and note it in your report.

### 4. Register the stub
- Add a row to root `TODO_KEYS.md` "Stubbed integrations" table: `| Redbook trade-in | STUB_REDBOOK | REDBOOK_API_KEY | .dev.vars / wrangler secret | live trade-in valuations | ~1 day (API contract + mapping) |`.

## Scope guardrails — do NOT
- Do NOT wire this into Rebi/chat (separate follow-on). Do NOT touch the listing schema, grounding, or pricing logic. Do NOT add real Redbook HTTP calls. Do NOT commit. Do NOT edit `src/chatbot/get-env.ts` (read env directly in your route mirroring its pattern). Do NOT use `Math.random()` or module-top-level `new Date()`.

## Acceptance criteria (report each)
1. `src/stubs/redbook.ts` — interface + deterministic stub; sample output for a 2019 car, 80,000km, good condition.
2. `src/pages/api/trade-in.ts` — flag + validation + rate-limit + stub/real branch; how `useStub` resolves.
3. `src/pages/trade-in.astro` — renders form + result; reachable route; any nav link added or not.
4. `src/config/dealer.ts` — `tradeIn` block added to BOTH config objects.
5. `TODO_KEYS.md` row added.
6. `npx astro check` before N / after M (M ≤ N).

## Report format
Concise: files created/edited with one-line each, how useStub resolves, the sample stub output, astro check before/after, anything you couldn't do.
