# Reskin Audit — AI engine, API endpoints & interactive components (contract to PRESERVE)

> All endpoints are `src/pages/api/*`, every one `prerender=false` (SSR on the CF adapter). A reskin
> must keep these request/response shapes AND the client DOM contracts below. **Verify by driving the
> flow, not screenshots.** Two shared integration seams tie the AI surfaces together — keep both names:
> (1) the `data-rebi-open` / `data-rebi-kind` / `data-rebi-ref(s)` / `data-rebi-title` attribute
> contract; (2) the custom DOM event **`reb:search`** (SearchDock → ChatWidget).

## API endpoints (path · body · response · who calls · keep-working)
- **POST `/api/chat`** — Rebi send. Body `{messages[], sessionId?, turnstileToken?(first), context?{kind,refs[]}, contact?, stream?}`. Returns JSON `{reply, sessionId, lastId, status:'ai_active'|'escalated'|'human_active'|'closed', resolved?}` OR SSE (`stream:true`) events `delta`/`done`/`escalate`/`error`. Caller: `ChatWidget`. Keep SSE event shapes + `status`/`reply`/`resolved`.
- **GET `/api/chat-poll?sessionId=&afterId=`** — handoff updates. Returns `{status, messages:{id,role:'visitor'|'ai'|'human'|'system',content,created_at}[], lastId}`. Cursor is monotonic `id`. Caller: `ChatWidget` (interval while escalated/human).
- **POST `/api/telegram-webhook`** — team→visitor. Header `X-Telegram-Bot-Api-Secret-Token` verified first. No markup coupling — reskin-safe (don't change secret check).
- **POST `/api/search`** — AI NL search. Body `{query, filters?, refine?}`. Always HTTP 200: `{interpretation, confidence:'high'|'medium'|'low', clarifyingQuestion, filters:FilterState, matchReasons[]}`. Deterministic pre-pass (`extractFilters`) then LLM only if ambiguous. Callers: `SearchDock` (drives grid via `applyFilterUrl(hrefFor(...))`), `ChatWidget` (`applyInventorySearch`). Callers read `data.filters`/`confidence`/`interpretation`/`clarifyingQuestion`.
- **POST `/api/compare-pick`** — compare verdict (NO LLM, deterministic). Body `{refs[2..maxRefs], criterion}`. HTTP 200: `{matched, rankable?, dim?, slug?, name?, announce?}`. Ranks a PUBLIC projection (never dealerNotes). Caller: `ChatWidget.tryCompareDecision` (compare context). On rankable → announces + navigates `/listings/${slug}`.
- **POST `/api/generate-description`** — Studio-only (Origin allowlist `dealerConfig.ai.studioOrigins`). NOT public reskin (keep allowlist).
- **POST `/api/trade-in`** — body `{make,model,year,odometerKm,condition:excellent|good|fair|poor}` → `{valuation}` / `{error}` (200). Stubbed Redbook. Any reskinned trade-in form must POST these exact fields.
- **POST `/api/book-service`** — `{name,email,vehicle,serviceType(∈dealerConfig.service.serviceTypes),phone?,preferredDate?,notes?}` → `{ok,message}`/`{error}`. `serviceType` select is config-driven.
- **POST `/api/saved-search`** — `{email, query(canonical serialized filter string ≤512), label?}`. `query` MUST be the canonical string from `listings-query.ts`.
- **capture `/api/capture/{lookup,extract,create-draft}`** — flag+Origin guarded; PWA surface. Reskin-safe unless capture UI is reskinned. create-draft is STUB (no real write).
- **POST `/api/carsales-upload`** — Studio-only, stubbed. **POST `/api/journey`** — always 204, fail-open; fired via `navigator.sendBeacon` on listing + compare pages (preserve the beacon script if journey continuity wanted). **GET `/api/health`** — `{ok:true}`.
- Rate-limit prefixes are distinct per endpoint: `rl:`,`search:`,`comparepick:`,`desc:`,`tradein:`,`service:`,`savedsearch:`,`capture:`,`carsales:`.

## Client components — DOM contracts (renaming = silent break)
### `components/widgets/ChatWidget.astro` (+ `rebi-sounds.ts`)
- **HARD-guard IDs (widget dies if ANY missing):** `#reb-chat` (root; data-attrs `data-poll-interval`,`data-escalation-timeout`,`data-turnstile-key`,`data-stream`), `#reb-launcher`,`#reb-panel`,`#reb-close`,`#reb-log`,`#reb-column`,`#reb-live`,`#reb-form`,`#reb-input`,`#reb-send`.
- Optional (degrade): `#reb-minimise`,`#reb-mic`,`#reb-badge`,`#reb-turnstile`,`#reb-contact(+-input)`,`#reb-confirm(+-title/-sub/-primary/-secondary/-x)`,`#reb-glow`,`#reb-speaker`.
- Classes: `.reb-open` (root open state + launcher orb↔✕), `.reb-dreaming` on `<body>`, `.reb-recording`, `.muted`. Focus-stage cards use shared `.focus-stage` + `stage.css`.
- **Page-wide delegated trigger:** `[data-rebi-open]` + `data-rebi-kind`/`data-rebi-ref(s)`/`data-rebi-title` → opens panel with context. Also listens for custom event `reb:search`, and checks `#inventory-results` presence to apply-vs-navigate.
- Storage: `sessionStorage['reb-chat-history'|'reb-active-context']`, `localStorage['reb-session-id'|'rebi:chat:muted']`.

### `components/search/SearchDock.astro` (+ `stage-engine.ts`)
- **Guard IDs:** `#search-dock` (carries `data-config` JSON), `#search-dock-form`,`-input`,`-submit`,`-column`(must have `.focus-stage`),`-sound`,`-live`. Optional `#search-dock-manual`,`#hero-subhead`.
- **External nodes it drives (NOT owned):** `#inventory-results` (swaps + fades; **regex-scrapes `[data-results-count]` text** `/of ([\d,]+)/`,`/No vehicles match/i`), `#inventory-heading` (flips label), `#filters-trigger` (`.click()`). `.search-dock[hidden]` revealed by JS. `.rebi-stage` holds `--rebi-*`/`--ink`/`--muted` tokens.
- `stage-engine.ts` builds cards with fixed classes `.turn/.card/.bubble/.body/.name/.avatar/.word/.dots/.actions/.newsearch` — SHARED by SearchDock + ChatWidget; one reskin of these hits both.

### `components/CompareTray.astro`
- Owned IDs: `#compare-tray`,`#compare-thumbs`,`#compare-count`,`#compare-go`(href `/compare?ids=`),`#compare-ask-ai`. Toggles `.hidden`.
- **Card contract it READS:** `[data-compare-toggle]` + `data-id`/`data-category`/`data-title`/`data-thumb`; `[data-compare-label]`,`[data-compare-remove]`,`[data-compare-clear]`; state via `aria-pressed`+`disabled` (styling attribute-driven). WRITES `data-rebi-refs`/`data-rebi-title` onto `#compare-ask-ai`.
- Storage (source of truth): `localStorage['astro-listings-compare'|'astro-listings-compare-meta']` (written together; cap 4; same-category).

### compare-tools (`reckon.ts`/`Contender.astro`/`Dial.astro`)
- `c3-*` classes + `data-dim`/`data-weight`/`data-score`/`data-seg-dim`/`data-car-id`/`data-remove`/`data-bar` queried by the page client script for live re-ranking; `--dc`/`--fill`/`--sc` CSS vars carry per-dim color. Page IDs `#balance-data`,`#board-rows`,`#dials`,`#board`,`#legend`,`#presets`,`#reset`.

### `components/AskRebiButton.astro`
- Presentational; forwards all `data-rebi-*` verbatim (`{...rest}`). Restyle freely; keep the forwarded attrs. Brand blue `rgb(1 97 239)`.

### `components/ContactModal.astro`
- `dialog[data-contact-modal]` + `data-trigger` + `[data-modal-close]`; native `showModal()`. Reskin-safe if hooks remain.

## Reskin rule
Preserve every guard ID, `data-*` attribute, the `[data-results-count]` wording, the `data-rebi-*`
seam, the `reb:search` event, and the shared `.focus-stage`/`stage-engine` classnames. Restyle
everything else. Test: send a chat, stream a reply, escalate; run AI search from the dock; ask Rebi to
filter; tag 2 cars → compare → ask Rebi to pick; submit trade-in/service/saved-search.
