# Task brief — Upload listing to carsales.com.au (stubbed)

A dealer-facing action to push a PUBLISHED listing to carsales.com.au and get back a listing
id + URL. Follow `docs/briefs/_stub-convention.md` (READ FIRST). The carsales API is stubbed.

## Stack / rules
- Astro 7 SSR + Sanity Studio (embedded). `npx astro check` stays green (before/after; zero new errors).
- Env via `cloudflare:workers` (mirror get-env.ts; do NOT edit it). Rate-limit `checkRateLimit` (`keyPrefix: 'carsales:'`, fail-open).
- **Config as data:** `integrations.carsales` block in BOTH dealer config objects — `{ enabled: false, ... }`. Default OFF (a dealer opts in). Match existing style.
- Determinism: the stub returns a plausible-but-clearly-mock carsales id + URL. It must never claim a real upload happened. Response includes `mode: 'stub'`.

## Build
### 1. Stub — `src/stubs/carsales.ts`
- `export interface CarsalesListingInput { listingId: string; title: string; price: number; make?: string; model?: string; year?: number; }`
- `export interface CarsalesUploadResult { carsalesId: string; url: string; mode: 'stub' | 'live'; message: string; }`
- `export async function uploadToCarsales(input, opts): Promise<CarsalesUploadResult>` — deterministic mock id (hash of listingId, e.g. `RB-STUB-<hash>`), url `https://www.carsales.com.au/cars/details/stub/<carsalesId>` (clearly a stub path), `mode:'stub'`. No Math.random. `// TODO_KEYS: carsales — CARSALES_API_KEY + dealer account — set in .dev.vars / wrangler secret`.
- `useStub = !env.CARSALES_API_KEY || truthy(env.STUB_CARSALES)`.

### 2. API route — `src/pages/api/carsales-upload.ts`
- `POST { listingId }` → `{ result } | { error }` (200 on expected fail). Flag → validate listingId → rate-limit (`carsales:`) → read the PUBLISHED listing from Sanity server-side (reuse the existing Sanity client `src/sanity/lib/client.ts` + `LISTING_FIELDS`; only allow status === 'active'/published — never a draft) → call stub → return result.
- Restrict to Studio/dealer origins the same way `generate-description.ts` restricts (look at how it validates Studio origins) — this is a dealer action, not public. Reuse that origin-guard approach.

### 3. Dealer trigger — Sanity document action
- Add a Sanity document action (in `sanity.config.ts` document actions, or a new file it imports) that appears on `listing` documents and, when clicked, POSTs the listing id to `/api/carsales-upload` and surfaces the returned carsales URL (toast/dialog). Look at how `src/sanity/components/ListingFormFooter.tsx` / `GenerateDescriptionInput.tsx` integrate custom Studio UI, and follow that integration style. Gate it on the config flag. Keep it minimal and robust; if a full document action is too heavy, a footer button on the listing form (like the existing description generator) is an acceptable equivalent — note which you chose.

### 4. Register
- `TODO_KEYS.md`: `| carsales upload | STUB_CARSALES | CARSALES_API_KEY + dealer account | .dev.vars / wrangler secret | real carsales.com.au syndication | ~2-3 days (their API onboarding) |`.

## Scope guardrails — do NOT
- Do NOT upload drafts (published/active only). Do NOT make real carsales calls. Do NOT touch the public site UI, grounding, or pricing. Do NOT edit get-env.ts. No Math.random / module-top-level new Date(). Do NOT commit.

## Acceptance criteria (report each)
1. Stub (interface + sample result for a listing).
2. API route (flag/validate/rate-limit/published-only read/origin-guard/stub call).
3. Studio trigger (document action or form footer button — which, and how gated).
4. `integrations.carsales` in BOTH configs, enabled:false; TODO_KEYS row.
5. astro check before N / after M (M ≤ N).

## Report format
Concise: files, sample stub result, published-only + origin-guard proof, which Studio trigger, astro check before/after, anything not done.
