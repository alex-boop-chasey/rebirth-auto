# Task brief B — Rebi chat widget: side-drawer + in-thread tiles/actions

You are a sub-agent. Read `CLAUDE.md` (Stack / Hard constraints / Field notes) before starting.
Full context spec: `docs/briefs/rebi-drawer-redesign.md` — **read the whole file**; it is definitive.
The visual target is the demo `src/pages/concepts2/inline-contextual/_shell/RebiChat.astro` (a static
mock — copy its LAYOUT and use the shipped tokens, but the production widget is fully wired).

**You own the WIDGET + its styling + the shared stage engine's opt-in thread mode ONLY.** Do NOT
touch `src/chatbot/**`, the chat API, or any page file. Another agent owns those.

## Files you own
- `src/components/widgets/ChatWidget.astro` (the ~1485-line widget)
- `src/styles/rebi.css`
- `src/components/search/stage-engine.ts` (add an OPT-IN thread layout mode — default unchanged)
- `src/components/search/stage.css` (thread-mode styles)

## What to build
Replace the centred **Focus-Stage carousel** presentation with the demo's **bottom-right docked side
drawer + normal scrolling thread**, and render in-thread **listing tiles** and **action buttons** from
the new response fields. See spec §4 (visual), §5 (integration facts), §7a (resolved decisions), §7
(acceptance checklist — your work must satisfy every line).

### 1. Geometry (match the demo exactly — spec §7a.1)
Corner-docked rounded panel: `right/bottom:22px`, `width:392px; max-width:calc(100vw-44px);
max-height:min(78vh,720px)`, column layout header/thread/composer, `--surface` bg, `--line` border,
`--r-lg` radius, `--sh-3` shadow. NOT centred, NOT full-height edge drawer. Mobile = near-full-width
sheet within `max-width:calc(100vw-44px)`. Header: `.orb` + "Rebi" + "Online · your AI navigator"
teal status dot + a **"Full view" chip linking to `/rebi`** + close ✕. Reuse theme.css tokens/
primitives (`.orb .ai-summary .scan .card .card-lift .chip .chip-ai .aisearch .btn`); do NOT redefine
tokens. There is **no `--orb` token** — the mark is the `.orb` class.

### 2. Thread, not carousel (spec §7a.3 — PREFERRED implementation)
Add an **opt-in** `layout: 'thread'` option to `createFocusStage` in `stage-engine.ts`. In thread
mode, `layout()` stacks turns in normal vertical document flow (newest at the BOTTOM, container
scrolls, **no translateZ / blur / recede / depth**). **The default (no option / `'stage'`) MUST stay
byte-for-byte the current cinematic behaviour** — SearchDock and `SmartSearch.tsx`/`useFocusStage.ts`
depend on it; verify you did not change their path. The widget passes `layout:'thread'`. Keep every
card-builder the engine already exposes (`addUserTurn`, `addRebiCard`, `openStreamingRebiCard`,
`addHumanCard`, `addSystemCard`, `addActionCard`, `addPinnedCard`, `showTyping`, avatars) working in
thread mode — restyle them to the demo look (user = right-aligned dark `.rb-user` bubble; Rebi = name
row + `.ai-summary` block). Streaming deltas still stream into the newest Rebi card.
(A bespoke thread renderer inside the widget is acceptable ONLY if it preserves every mechanic in §5
and touches nothing search uses — but the engine thread-mode path above is preferred.)

### 3. Listing tiles + action buttons (from the response — see spec §6.1 & the `## Impl notes — A`
section the backend agent appends to the spec; build to that exact contract)
The chat response gains optional `cards: RebiCard[]` and `actions: RebiAction[]` on the JSON reply and
the SSE `done` event. When present, render, inside/after the Rebi turn:
- **Tiles** — one `<a href="/listings/${slug}">` per card, styled like the demo `.rb-card`: thumbnail
  `<img src={imageUrl}>` (skip the img if `imageUrl` is null — show a neutral placeholder swatch, do
  NOT fabricate an image), a `.chip-ai` badge, `title`, `specLine`, and `price` (format with the
  existing AU price formatter). Tiles are keyboard-focusable links.
- **Actions** — a wrap-flex row of pill links `<a href={action.href}>` styled like `.rb-act` (indigo
  AI treatment, optional leading icon). Real links; a filter link may additionally use the existing
  `applyFilterUrl` SPA-swap if the widget already imports it — but a plain `<a>` is fine.
Add engine helpers if needed (e.g. `addListingCards(cards)` / extend `addActionCard`) — your call,
but keep them in thread mode only. Render nothing when the arrays are absent/empty.

### 4. Remove the old interface (spec §7a.2 & §2.5)
Once the drawer works, DELETE the leftovers: the `body.reb-dreaming > :not(#reb-chat)` greyscale+blur
rule and `#reb-glow` spotlight, the centred transparent `.reb-panel` wrapper styles, `@keyframes
reb-rise`, and any Focus-Stage-only CSS in `rebi.css` that the drawer no longer uses. Remove the JS
that toggles `reb-dreaming` on the body. Leave NO dead carousel CSS/JS. (Keep `#reb-log` in the DOM —
hidden — it is in the hard guard and used by `scroll()`.)

## Mechanics that MUST still work (spec §5 — do not regress any)
The `data-rebi-open` delegated listener + `data-rebi-kind/ref/refs/title` seam; `setActiveContext`;
the `reb:search` CustomEvent; `/api/chat` **request shape unchanged** (`{messages, sessionId?,
turnstileToken?, context:{kind,refs}, stream?}`); SSE `delta`/`done`/`escalate` handling; `/api/chat-poll`
human-handoff loop; Turnstile gate; contact-capture form (`#reb-contact`, relocated into the thread);
message sounds (`rebi-sounds.ts`, `#reb-speaker`); mic dictation (`#reb-mic`); confirm/download-end
dialog (`#reb-confirm`); aria-live (`#reb-live`); focus trap; badge; auto-grow textarea; Enter-to-send.
**Keep every element id in the getElementById block and all 10 guarded ids.** The composer becomes the
real working `.aisearch`-styled input (not the demo's inert one).

## Ref-less opens (REQUIRED — the owner wants EVERY Ask Rebi button to open the drawer)
The delegated `data-rebi-open` listener currently does `if (!refs.length) return;` (~L1274) — so a
page-intent trigger with a `kind` but no car ref (e.g. `data-rebi-kind="finance"`) does NOT open the
drawer today. Change this: **ANY `data-rebi-open` trigger opens the drawer.** Refs are optional — when
empty, prime the greeting from `kind` alone and set `context:{kind, refs:[]}` (the server already drops
empty refs and Rebi just chats — same as the `reb:search` `ref:''` path). Make `setActiveContext`
accept an empty `refs` array for page-intent kinds (still building the opening from `kind`+`title`);
listing/compare naturally still carry their refs. Do not break the refs-bearing paths.
(Note: a separate agent is removing the now-redundant local nav open-handler in `SiteNav.astro` so the
global listener owns all opens — you only own the widget's global listener.)

## Per-button preloaded context (spec §6.4)
Extend `buildOpening` (`ChatWidget.astro` ~L460) with a purposeful opening for EVERY kind that triggers
carry: `listing`, `compare`, `search`, `nav`, plus page intents `finance`, `electric`, `test-drive`,
`parts`, `offers`, `careers`, `contact`, `sell`, `fleet`, `trade-in`. Unknown kind → sensible generic
opening (do not throw). Openings stay CLIENT-ONLY (never sent to the server). `context.{kind,refs}`
continues to be sent unchanged.

## Hard constraints (RESTATED)
- **Light-theme** only. **Config-as-data** — no dealer literals in the widget. **Determinism** — never
  render a fabricated car/image/link; a null image shows a placeholder, not a fake photo.
- Preserve every `#reb-*` id and `data-rebi-*` attribute and the `/api/chat` request shape.
- Do not change the AI tier system or call any provider directly.

## Definition of done
- Drawer opens bottom-right, thread scrolls (no carousel/recede), tiles + actions render from the
  response, every mechanic in §5 verified working, old dreaming/carousel CSS+JS removed.
- SearchDock / SmartSearch unaffected (engine default mode unchanged) — state how you verified.
- `npx astro check` green for your files. Report files changed + how you kept the engine default intact.
