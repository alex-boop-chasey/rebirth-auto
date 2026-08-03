# Task brief C — unify every "Ask Rebi" trigger with a purposeful preloaded `kind`

You are a sub-agent. Read `CLAUDE.md` (Stack / Hard constraints / Field notes) before starting.
Context: `docs/briefs/rebi-drawer-redesign.md` §6.4 & §7a. The owner's requirement: *every* front-facing
"Ask Rebi" trigger opens the one shared Rebi drawer, and the ONLY difference between buttons is the
**preloaded instruction set** — carried by `data-rebi-kind` (+ `refs`/`title` when a specific car/set
is in context) so Rebi knows the intent before the first message.

**You own the page/component TRIGGER files ONLY.** Do NOT touch `src/components/widgets/ChatWidget.astro`,
`src/styles/rebi.css`, `src/components/search/stage-engine.ts`, or anything under `src/chatbot/**` —
other agents own those. Do NOT touch anything under `src/pages/concepts*/` (reference mockups only).

## Context you can rely on
A parallel agent is making the widget's delegated `data-rebi-open` listener open the drawer for **any**
trigger, with refs OPTIONAL (a page-intent open has no car ref). So a button may carry just
`data-rebi-open data-rebi-kind="finance"` and it will open + prime the finance greeting. The widget's
`buildOpening` will handle these kinds: `listing, compare, search, nav, finance, electric, test-drive,
parts, offers, careers, contact, sell, fleet, trade-in`. Use kinds from THAT list only.

## Work
1. **Give each generic page trigger its purposeful kind** (currently many are the catch-all `"nav"`):
   - `src/pages/finance.astro:172` → `data-rebi-kind="finance"`
   - `src/pages/test-drive.astro:193` → `data-rebi-kind="test-drive"`
   - `src/pages/electric.astro:112` → `data-rebi-kind="electric"`
   - `src/pages/parts.astro:172` → `data-rebi-kind="parts"`
   - `src/pages/offers.astro:113` → `data-rebi-kind="offers"`
   - `src/pages/404.astro:38` (has `data-rebi-open` with no kind) → add `data-rebi-kind="nav"`.
   - `src/pages/index.astro:210` homepage CTA → keep `data-rebi-kind="nav"` (general ask) unless a
     more specific intent is obviously right.
   - Leave the already-correct ones unchanged: `SiteNav`/`SiteFooter` (`nav`), `CompareTray` /
     `compare.astro` / `compare-tools.astro` (`compare` + refs + title), `listings/[slug].astro`
     (`listing` + ref + title).
   - If you find any OTHER shipped page with an "Ask Rebi"/AI-help affordance that is a mock, a dead
     button, or lacks the `data-rebi-open` seam, wire it to the real drawer with the right kind.
     (Do NOT invent brand-new buttons on pages that never had one — normalise what exists.)
2. **Remove the now-redundant local open-handler in `src/components/site/SiteNav.astro`** (~L371:
   `closest('[data-rebi-open][data-rebi-kind="nav"]')`). The global widget listener now owns opening.
   **Inspect it first:** if that handler ALSO does something else (e.g. closing the mega-menu / mobile
   menu before opening), preserve that side-effect and only drop the redundant chat-open part. If it
   only opens the chat, remove the whole handler. Verify the nav "Ask Rebi" buttons still open the
   drawer afterwards (they will, via the global listener).
3. Confirm no shipped surface is left where an AI/"Ask Rebi" trigger fails to open the real drawer.

## Hard constraints (RESTATED)
- **Config-as-data** — no dealer literals; you're only editing declarative `data-*` attributes / small
  handlers. **Light-theme.** Do not change button visual treatment beyond what's needed (the shared
  `AskRebiButton` styling stays the single source for the pill look).
- Do NOT change the `/api/chat` request shape or any chat logic — you only set declarative
  `data-rebi-*` attributes and remove a redundant local handler.
- Preserve every existing `data-rebi-ref`/`data-rebi-refs`/`data-rebi-title` on compare/listing
  triggers.

## Definition of done
- Every shipped "Ask Rebi" trigger carries a purposeful `kind` and opens the shared drawer; the
  redundant SiteNav local open-handler is gone (side-effects preserved).
- `npx astro check` green for your files.
- Report: every file/line changed, the final kind on each trigger, and what you did with the SiteNav
  handler.
