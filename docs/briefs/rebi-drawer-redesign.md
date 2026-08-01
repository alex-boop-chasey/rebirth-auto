# Brief — Rebi chat: side-drawer redesign with clickable tiles & action buttons

**Status:** spec / in progress (auto run)
**Branch:** `feat/rebi-drawer` (off `redesign/inline-contextual`)
**Definitive reference:** the live demo at `/concepts2/inline-contextual/` — its chat is
`src/pages/concepts2/inline-contextual/_shell/RebiChat.astro`.

This document is the spec to build against **and to check the finished product against**. Every
item in §7 (acceptance checklist) must be true before the task is considered done.

---

## 1. Why (the problem)

The site remodel onto the `inline-contextual` design shipped, but one critical piece of that demo was
left out: **the Rebi chat window's design and presentation.**

- **Today (wrong):** the production `ChatWidget.astro` opens a centred panel whose messages ride a
  "focus-stage" **carousel** — older messages roll out of view. It renders replies as plain text
  bubbles only.
- **Target (the demo):** Rebi opens as a **side drawer** with a normal top-to-bottom scrolling
  thread, and its replies contain **clickable listing tiles** (image + year/make/model + price →
  the vehicle page) and **auto-generated action buttons** — best-guess navigation links ("See all
  7-seaters", "Work out repayments", "Book a test drive", "Talk to Service") so the shopper taps to
  where they need to go instead of typing it all out.

The owner's words: *"it opens a side drawer and it includes clickable listing tiles with image,
auto-generated buttons with best-guess links (saving the user from having to type everything to
navigate to the info they need)."*

## 2. Scope

1. Replace the focus-stage carousel presentation with the demo's **side-drawer scrolling thread**.
2. Render, inside assistant replies, **clickable listing tiles** and **auto action buttons**.
3. **Preserve every existing chat mechanic** — the network seam, human handoff, Turnstile, contact
   capture, sounds, mic, confirm/download-end, aria-live, rate limiting, grounding/privacy firewall.
   This is a *presentation + response-enrichment* change, not a rewrite of the chat engine.
4. **Unify all "Ask Rebi" entry points**: every front-facing AI trigger opens this one drawer. The
   only thing that differs per button is a **preloaded instruction set** (context) so Rebi already
   knows what the user wants before the first message; the chat is then used only to refine if the
   answer is unclear.
5. **Remove all leftovers** of the old chat interface once the new one works (dead CSS, the
   focus-stage engine wiring if now unused, the old carousel markup).

## 3. Non-negotiable constraints (from AGENTS.md / DECISIONS.md)

- **Private data stays private.** Tiles and action links are built **only** from the public listing
  projection (`LISTING_FIELDS` in `src/lib/listing.ts`). `dealerNotes` / cost / floor price never
  reach a tile, a link, or ranking. Grounding for shopper-facing Rebi is public-projection only.
- **Determinism.** A tile or action link is emitted **only** when it can be confidently resolved to a
  real destination. Ambiguous → omit + `console.warn` WARN; never fabricate a car, price, image, or
  link. No guessed slugs.
- **Config-as-data.** No dealer literals; site destinations and any persona copy come from config
  (`src/config/dealer.ts` / nav config), not hardcoded in the widget.
- **All AI through `src/ai/`.** No direct provider calls.
- **Filter state via `applyFilterUrl`.** Any "See all …" link that carries filters is built through
  the existing filter-URL helper — the widget does not hand-assemble `/listings?...` query strings.
- **Light-theme UI standard.** The drawer uses the shipped NFY/inline-contextual tokens.

## 4. Target visual spec (from the demo — `RebiChat.astro`)

Structure to reproduce in production (adapting class names to the widget's `reb-` namespace, but
matching the layout and using the shared design tokens):

- **Launcher:** a pill/orb, `position: fixed; right: 22px; bottom: 22px`, label "Ask Rebi".
- **Drawer panel (`.rebi-dock` equivalent):** `position: fixed`, docked bottom-right,
  `width: 392px; max-width: calc(100vw - 44px); max-height: min(78vh, 720px)`, rounded (`--r-lg`),
  `box-shadow: var(--sh-3)`, `border: 1px solid var(--line)`, `background: var(--surface)`. Column
  flex layout: header / scrolling thread / composer. On mobile it should be a comfortable
  near-full-width sheet (respect `max-width: calc(100vw - 44px)`).
- **Header:** orb + "Rebi" + "Online · your AI navigator" status dot, a "Full view" chip, and a
  close ✕. Uses the teal/indigo tint gradient from the demo.
- **Thread (`.rebi-thread`):** `flex:1; overflow-y:auto`, gap between turns; **normal document flow,
  newest at the bottom, nothing rolls out of view** (this is the whole point — no carousel).
  - **User turn:** right-aligned dark bubble (`.rb-user`).
  - **Rebi turn:** name row (orb + "Rebi") then an `.ai-summary` reply card.
  - **Listing tile (`.rb-card`):** an `<a>` to the vehicle page — thumbnail image, a chip
    ("Value pick" / "Top spec" / condition), `year make model`, a spec line
    (`seats · fuel · drive`), and price + "drive away". **Uses a real listing image.**
  - **Action buttons (`.rb-actions` / `.rb-act`):** pill links with a small icon — best-guess
    destinations. Indigo AI treatment.
- **Composer (`.rebi-composer`):** the `.aisearch` input + send button (in production this is the
  real, working composer, not the demo's inert one).

## 5. Production integration facts (verified)

- **Widget file:** `src/components/widgets/ChatWidget.astro` (~1484 lines). Client script owns
  open/close, the `data-rebi-*` seam, message rendering, the `/api/chat` + `/api/chat-poll` network
  loop, Turnstile, contact capture, sounds, mic, confirm-end. **Keep this script's mechanics; swap
  its rendering + markup.**
- **The seam is already correct and must be reused, not reinvented:** `AskRebiButton.astro` +
  buttons carrying `data-rebi-open` / `data-rebi-kind` / `data-rebi-refs` / `data-rebi-title`. A
  delegated listener in the widget reads these and calls `setActiveContext(kind, refs, title)` →
  `buildOpening(kind, title)`. **This is exactly the "preloaded instruction set per button"
  mechanism the owner described** — extend `buildOpening` with the kinds we need; do not build a
  parallel system.
- **Vehicle page URL (production):** `/listings/<slug>` (from `ListingCard.astro:44`,
  `href = /listings/${listing.slug.current}`). The demo's `/vehicle?id=` is mock-only — do **not**
  ship it.
- **Listing image (production):** `urlFor(listing.images[0]).width(...).height(...).fit('crop')
  .auto('format').url()` via `src/sanity/lib/image.ts` (see `ListingCard.astro:40`). Tiles must use
  this real image pipeline, not gradient placeholders.
- **Design tokens:** the demo pulls `src/styles/global.css` (→ theme). Reuse the same tokens
  (`--surface`, `--line`, `--ink`, `--ink-faint`, `--indigo`, `--indigo-deep`, `--teal`,
  `--teal-deep`, `--r-lg`, `--r-pill`, `--sh-2`, `--sh-3`, `.orb`, `.ai-summary`, `.card`, `.chip`)
  so the production drawer matches the demo without redefining them.

## 6. Data seam for tiles & actions — DECISION (resolved)

**Both tiles and actions are derived deterministically server-side and returned as new structured
fields on the chat response. No new LLM call is added; the plain-text reply path is untouched.**

### 6.1 Response contract (additive)

Extend the JSON reply (`core.ts:836`) and the streaming `done` event (`core.ts:422`, inside
`finishNormal`, after the inventory buffer so tiles don't flash early) with two optional arrays:

```ts
// attached to the assistant turn
cards?: RebiCard[];      // clickable listing tiles
actions?: RebiAction[];  // best-guess nav buttons

interface RebiCard {   // PUBLIC PROJECTION ONLY
  slug: string;              // → href `/listings/${slug}`
  title: string;             // "2022 Honda CR-V VTi L7" (or make+model+year)
  imageUrl: string | null;   // urlFor(images[0]).width(160).height(112).fit('crop').auto('format').url()
  price: number; currency: string;
  specLine: string;          // e.g. "7 seats · Petrol · FWD"  (public specs only)
  badge?: string;            // e.g. "Value pick" / condition — never a private flag
}
interface RebiAction {
  label: string;             // "See all 7-seaters"
  href: string;              // resolved, real destination
  icon?: string;             // key into the shared icon set
}
```

Both arrays are **optional and bounded** (cards ≤ 4, actions ≤ 5). Omit entirely when nothing
confidently resolves.

### 6.2 Where tiles come from
Grounding already resolves specific in-stock records at reply time but discards them. Work:
1. Widen `FOCUS_PROJECTION` (`grounding/context.ts:43`) and the lookup projection
   (`grounding/lookup.ts:115`) to also select `images, slug, make, model`.
2. Return the raw resolved rows from `buildGroundedSystemPrompt` (`grounding/index.ts:54` + `:209`)
   alongside `{ prompt, facts }`.
3. In `core.ts`, map those rows → `RebiCard[]` using the **public projection only**
   (`LISTING_FIELDS`), image via `urlFor` (mirror `ListingCard.astro:40`), href `/listings/<slug>`.
   A row missing slug/image is dropped with a `console.warn` WARN (determinism), never faked.

### 6.3 Where action links come from — deterministic, no LLM
1. **Filter link** (the "See all N <descriptor>"): the grounding path already computed the
   `FilterState` for the turn (`context.ts` search-kind via `parseFilters`/`buildListingsFilter`;
   `lookup.ts` via the LLM-free `extractFilters`, `src/lib/vehicle-filter-extract.ts`). Turn it into
   a real URL with `hrefFor(state)` (`src/lib/listings-query.ts:293`) — **never hand-assemble a query
   string** (filter-state constraint).
2. **Fixed destinations** (finance, test-drive, electric, parts, contact, …): map from the canonical
   `navHubs` / `footerColumns` in `src/config/nav.ts`, **gated by `dealerConfig.<feature>.enabled`**
   so a disabled feature never produces a button. Config-as-data; no literals in the widget.
3. Intent → which fixed buttons: a small deterministic keyword map (repayments/finance→/finance;
   "test drive"→/test-drive; ev/electric/hybrid→the electric hub; service/parts→/parts or contact).
   Bounded to ≤5, de-duplicated, each verified to resolve. Ambiguous → omit (WARN), never guess.

### 6.4 Per-button preloaded context (kinds) — the owner's "preloaded instruction set"
The existing `data-rebi-*` seam already IS this mechanism. Every "Ask Rebi" trigger passes a
`data-rebi-kind` (+ optional `refs`/`title`); the widget's `setActiveContext` → `buildOpening`
produces the primed opening so Rebi knows the intent before the first message. Work:
- Audit every `data-rebi-open` trigger across `src/**`; ensure each carries a purposeful `kind`.
- Extend `buildOpening` (`ChatWidget.astro:460`) with an opening for every kind in use
  (`listing`, `compare`, `search`, `nav`, plus page intents `finance`, `electric`, `test-drive`,
  `parts`, `offers`, `careers`, `contact`, `sell`, `fleet`, `trade-in`). Openings are client-only
  (never sent to the server — anti-injection), and `context.{kind,refs}` continues to be sent so
  grounding can resolve tiles/actions for that intent.

## 7. Acceptance checklist (check the built product against every line)

- [ ] Rebi opens as a **bottom-right side drawer**, not a centred modal.
- [ ] The thread scrolls top→bottom; **no message rolls out of view / no carousel**.
- [ ] Assistant replies can render **clickable listing tiles** with a **real image**, linking to
      `/listings/<slug>`.
- [ ] Assistant replies can render **auto action buttons** with best-guess links that actually
      resolve (filter URLs via `applyFilterUrl`; fixed destinations from config).
- [ ] Tiles/links are built from **public projection only** — no `dealerNotes`/cost/floor leakage.
- [ ] Ambiguous tile/link data is **omitted with a WARN**, never fabricated.
- [ ] **Every** "Ask Rebi" button on the site opens **this** drawer, each with its own preloaded
      `kind` context; chat refines from there.
- [ ] All existing mechanics still work: send/receive, human handoff poll, Turnstile, contact
      capture, sounds, mic, confirm/download-end, aria-live, rate limiting.
- [ ] **Old focus-stage carousel markup/CSS/JS is removed** where now unused (no dead code left).
- [ ] `npx astro check` is green; the drawer is verified rendering in a running dev server
      (screenshot), not just typechecked.
- [ ] Compared side-by-side against `/concepts2/inline-contextual/` — the production drawer matches
      the demo's layout and affordances.

## 7a. Resolved decisions (prior-decision reversals — owner-authorised)

Exploration surfaced that the current centred **Focus Stage carousel** and the greyed/blurred
**"dreaming" backdrop** were *deliberate* prior decisions (`src/styles/rebi.css` comments;
`docs/briefs/fix-rebi-consistency-globalize.md`). The owner's instruction explicitly names those as
the problem ("opens in the middle of the screen and messages roll out of view on a carousel") and
points to the `/concepts2/inline-contextual/` demo as the target. Owner instruction overrides the
older brief. Decisions:

1. **Geometry = the demo exactly.** A bottom-right **docked rounded-corner panel** (`right/bottom:22px`,
   `width:392px; max-width:calc(100vw-44px); max-height:min(78vh,720px)`), not a centred modal and not
   a full-height edge drawer (that geometry exists in no mockup). Mobile = comfortable near-full-width
   sheet within `max-width:calc(100vw-44px)`.
2. **Drop the dreaming/greyscale backdrop** (`body.reb-dreaming > :not(#reb-chat)` filter + `#reb-glow`
   spotlight). The demo is a corner card over an untouched page; a full-page dim behind a small corner
   card is incoherent. Remove that CSS/JS as part of the "remove old interface" cleanup.
3. **No carousel.** Replace the receding 3D Focus Stage layout for chat with a normal vertical
   scroll-flow thread (newest at bottom, nothing recedes/blurs). **Preferred implementation:** add an
   opt-in `layout:'thread'` mode to `createFocusStage` (`src/components/search/stage-engine.ts`) that
   the widget passes; **the default must stay the current cinematic mode so SearchDock / `SmartSearch`
   are byte-for-byte unchanged.** (A bespoke thread renderer in the widget is acceptable only if it
   preserves every mechanic in §5 and touches nothing search uses.)
4. **Seams preserved (hard).** Every `#reb-*` id (incl. the 10 guarded ones and hidden `#reb-log`),
   every `data-rebi-*` attribute, the `reb:search` CustomEvent, and the **`/api/chat` request shape**
   (`{messages, sessionId?, turnstileToken?, context:{kind,refs}, stream?}`) stay unchanged. `cards`
   and `actions` are **added to the response only** — additive, optional, back-compatible.
5. **Token note:** there is no `--orb` custom property — the mark is the `.orb` class fed by
   `--aurora` (theme.css). Reuse `.orb`, `.ai-summary`, `.scan`, `.card`, `.card-lift`, `.chip`,
   `.chip-ai`, `.aisearch`, `.btn` and the tokens `--surface/--line/--ink/--ink-faint/--indigo/
   --indigo-deep/--teal/--teal-deep/--indigo-glow/--r-lg/--r-pill/--sh-2/--sh-3` from theme.css.
6. **"Full view" chip** in the drawer header links to `/rebi` (the existing full-page Rebi surface),
   matching the demo.
7. **Not a contest.** The design is fixed by an owner-approved demo; built directly, no owner judging
   step.

## 8. Out of scope

- Rewiring the grounding/privacy engine, the AI tier system, or the query planner's internals.
- New third-party integrations (test-drive booking etc. stay stubbed as they already are).
- The concept/demo pages under `src/pages/concepts*` — reference only; do not ship changes there.
</content>
</invoke>

## Impl notes — A (backend)

Shipped, additive & optional (omitted when empty), deterministic, no new LLM call, public-projection
only. Attached to the assistant turn on BOTH the JSON reply and the streaming `done` event (after the
buffered reply text, so tiles never flash early):

```ts
cards?: RebiCard[];      // ≤ 4, de-duped by slug   — interface exported from src/chatbot/core.ts
actions?: RebiAction[];  // ≤ 5, de-duped by href   — interface exported from src/lib/rebi-actions.ts

interface RebiCard { slug: string; title: string; imageUrl: string | null; price: number;
                     currency: string; specLine: string; badge?: string; }
interface RebiAction { label: string; href: string; icon?: string; }
```

- `imageUrl` = `urlFor(images[0]).width(160).height(112).fit('crop').auto('format').url()` (or `null`).
- `title` prefers `year make model`, falls back to the listing title. `specLine` = `seats · Fuel · DRIVE`
  (fallback: body type). `badge` = condition only.
- Tiles come from the resolved grounding rows (`GroundedPrompt.cardRows`, public projection incl.
  `slug, images, make, model`): the primed focus rows when a listing/compare/search context is present,
  else the live-lookup matches. Determinism: a row with no `slug` or no finite `price` is dropped with a
  `console.warn('[rebi-cards] WARN …')`; an unresolvable image → `imageUrl: null`. Never fabricated.
- Actions (`src/lib/rebi-actions.ts` → `deriveRebiActions({ message, filterState, dealerConfig })`):
  one "See all …" filter link via `hrefFor(state)` (from the primed search grid `GroundedPrompt.filterState`
  or a message-level `extractFilters`), plus keyword→fixed destinations resolved in `navHubs`/`footerColumns`
  and gated by `dealerConfig.<feature>.enabled`. Ambiguous/disabled → omitted (WARN on nav-config drift).
- Only on the normal reply path — never on escalation/human-active/contact-only/both-failed turns. Request
  shape, SSE `delta` events, `/api/chat-poll`, prompt text, and the privacy firewall are unchanged.
