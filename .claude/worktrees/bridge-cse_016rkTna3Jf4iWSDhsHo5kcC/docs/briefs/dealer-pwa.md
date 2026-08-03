# Task brief — Dealer listing-creation PWA (SCAFFOLD + all externals stubbed)

A standalone, mobile-first PWA where a dealer photographs a car, says a short voice note, and/or
enters a rego/VIN, and gets a complete DRAFT listing to review before publishing. Build this as a
coherent, typed, demoable SCAFFOLD — not a production-complete system. Follow
`docs/briefs/_stub-convention.md` (READ FIRST). Every external is stubbed; the Sanity write is
owner-gated (no real create).

## Overriding constraints
- **Draft-only, never publish direct.** The pipeline ends at a reviewable draft; the actual Sanity
  write is STUBBED (`src/stubs/listing-writer.ts`) because the Worker-scoped write token is
  owner-gated. Assemble the draft doc, VALIDATE it, and show it; the "create draft" call goes
  through the stub (logs + returns a mock draft id) with `// TODO_KEYS: Listing write — Worker-scoped
  SANITY write token (listings dataset only), never client-side — set as wrangler secret`.
- **Determinism / resolve-never-invent:** references (make/model) are resolved via GROQ fuzzy
  lookup against real inventory; on no confident match, PROMPT "create new?" — never silently invent
  a reference. Extraction confidence gates: low confidence → flag the field for dealer review, never
  auto-fill silently.
- Config as data: a `capture` (or `dealerTool`) block in BOTH dealer config objects, `enabled: false`
  default (it's a separate dealer surface). Match style.
- `npx astro check` green (before/after; zero new errors). Env via `cloudflare:workers` (mirror
  get-env.ts; do NOT edit it). No Math.random / module-top-level new Date(). Do NOT commit.

## Build (scaffold)
### 1. PWA shell
- A mobile-first area under `/capture` (e.g. `src/pages/capture/index.astro` + the flow pages). Add a
  web app manifest (`public/manifest.webmanifest` or an Astro-served one) and a minimal service worker
  (`public/sw.js`) registered from the capture pages only (do NOT globally install a SW on the main
  site — scope it to /capture to avoid caching surprises on the shopper site). Mobile-first layout,
  installable, offline shell only (no offline data sync — note that as future).

### 2. Stubs
- `src/stubs/vin-lookup.ts` — `getOemSpec(vinOrRego: string): Promise<OemSpec | null>` returning a
  realistic OEM factory spec object (make/model/year/body/fuel/transmission/drive/seats/engine) for a
  few demo VINs/regos, `null` unknown. `useStub = !env.NEVDIS_API_KEY || truthy(env.STUB_VIN)`.
  Note ~AU$0.65/lookup + written-off/stolen status fields. TODO_KEYS marker.
- `src/stubs/vision-extract.ts` — `extractFromImage(imageRef): Promise<ExtractedFields>` returning
  plausible per-field values WITH a `confidence` per field. Prefer routing to the real `~/ai` vision
  tier when available (the writing/structured tiers already flag `supportsVision`); the stub is the
  fallback. `useStub = truthy(env.STUB_VISION) || no vision model`. TODO_KEYS marker.

### 3. Extraction + assembly pipeline — `src/lib/capture/`
- `pipeline.ts` — orchestrates: inputs (vin/rego, photos, voice transcript) → `getOemSpec` +
  `extractFromImage` + parse the voice transcript (the voice text comes from the client via Web Speech;
  server just receives text) → merge into a candidate draft, tracking per-field source + confidence,
  low-confidence fields flagged for review. Deterministic merge (OEM spec wins for hard specs; voice
  fills the human-only bits like owner history/marks). No inventing.
- `reference-resolver.ts` — GROQ fuzzy lookup of make/model against real listings; returns match or a
  "create new?" prompt signal. Fail-open.
- `validate.ts` — validate the assembled draft against the listing schema's required shape BEFORE
  create; return field errors for the review UI (errors surface in the review screen, NOT inside Studio).

### 4. API routes (origin/flag-guarded, rate-limited `capture:`)
- `POST /api/capture/lookup` { vinOrRego } → OEM spec (stub). 
- `POST /api/capture/extract` { imageRefs, transcript } → assembled candidate draft + confidences + validation.
- `POST /api/capture/create-draft` { draft } → validates, then the STUBBED writer returns a mock draft id (never a real Sanity write). 
- Reuse `checkRateLimit` (`capture:`), read env via cloudflare:workers.

### 5. Review UI
- A review screen showing the assembled draft with low-confidence/invalid fields highlighted, a
  make/model "create new?" prompt when unresolved, edit affordances, and a "Create draft" button that
  calls create-draft (stub). Voice capture uses the Web Speech API client-side (feature-detect;
  graceful message if unsupported) as the stub for Whisper/Deepgram (mark the upgrade point).

### 6. Register — TODO_KEYS rows (VIN, vision, voice upgrade, worker write token).

## Scope guardrails — do NOT
- Do NOT perform a real Sanity write / publish. Do NOT put any write token client-side. Do NOT install a
  service worker on the main shopper site (scope to /capture). Do NOT call real NEVDIS/Redbook/vision
  APIs. Do NOT touch the shopper site, grounding, or chatbot. Do NOT edit get-env.ts. No Math.random /
  module-top-level new Date(). Do NOT commit.

## Acceptance criteria (report each)
1. PWA shell (manifest + scoped SW; SW NOT global). 
2. Stubs (vin-lookup, vision-extract) with confidence + useStub.
3. Pipeline: source/confidence tracking, deterministic merge, resolve-never-invent (how).
4. Validation before create; create-draft goes through the STUB (no real write) — prove no token is client-side and no real write happens.
5. `capture` config in BOTH objects, enabled:false; TODO_KEYS rows (incl. worker write token).
6. astro check before N / after M (M ≤ N).

## Report format
Concise: files, the pipeline flow, resolve-never-invent + validation handling, proof no real write / no client token, SW-scoped-to-/capture proof, astro check before/after, what's scaffold-only vs functional.
