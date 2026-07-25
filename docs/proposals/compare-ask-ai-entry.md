# Build ticket — Compare-drawer "Ask AI" entry point (`kind: 'compare'`)

**Status:** approved (straight build, no contest — settled extension of the shipped priming seam).
This **extends** the "Grounded Focus" seam from `docs/proposals/grounded-focus-priming-seam.md`
(already merged for the per-listing entry point). It is **purely additive** — reuse the existing
pipe, add the `compare` kind on top.

## Goal
Add an **"Ask AI"** button to the floating compare drawer (`CompareTray.astro`). Clicking it opens
Rebi primed with the currently-selected vehicles (`kind: 'compare'`, `refs` = the selected listing
`_id`s) so Rebi opens ready to help the visitor **decide between those specific cars**, grounded in
their live data. It rides the exact same `{kind, refs}` channel the listing entry point uses.

## Hard rules (do not overwrite anything we rely on)
- **Additive only.** Do NOT change the behaviour of, or regress: the per-listing "Ask about this
  car" entry point (just shipped), the grounding modules, `core.ts`/`system-prompt.ts`, the
  `CompareTray`'s existing compare/clear/thumbnail/localStorage logic, or the `/compare` page. Extend;
  don't replace.
- Preserve all existing chatbot behaviour (streaming markers, Turnstile, D1 memory, handoff).
- `dealerNotes` stays excluded (public projection only). Config-as-data. Fail-open. All AI via `src/ai/`.
- No free text on the wire — only `{kind, refs}` (same anti-injection posture as v1).

## Changes (small, four files)
1. **`src/config/dealer.ts`** — add `'compare'` to `chat.context.allowedKinds` (it's `['listing']`
   today → `['listing', 'compare']`). `maxRefs` is already 4, which matches the compare tray's cap — good.
2. **`src/chatbot/grounding/context.ts`** (`resolveFocus`) — currently `if (context.kind !== 'listing')
   return null;`. Allow `'compare'` through. The multi-row rendering already exists (`renderFocusLine`
   indexes rows), so resolving several refs already works. Add **compare-specific framing** in
   `renderFocus` (keyed off the kind, or a small param): e.g. a header/instruction like *"The visitor
   is COMPARING these vehicles — help them weigh the trade-offs (price, running costs, space, features)
   and decide. Ground every claim in the live data below; never invent a difference not supported by
   it."* Keep the existing single-vehicle framing for `'listing'`. Projection unchanged (no `dealerNotes`).
3. **`src/components/widgets/ChatWidget.astro`** — extend priming to support **multiple refs**: the
   delegated `[data-rebi-open]` listener should read either `data-rebi-ref` (single, existing) **or**
   `data-rebi-refs` (comma-separated, new) into a `refs[]` array; `setActiveContext(kind, refs, title)`.
   Add a **compare-specific opening greeting** (vary `buildOpening` by kind), e.g. *"Happy to help you
   compare these — what matters most: price, running costs, space, or features?"* Keep the listing
   greeting for `kind:'listing'`. Do not change the listing path's behaviour.
4. **`src/components/CompareTray.astro`** — add an **"Ask AI"** button beside the existing
   "Clear"/"Compare (N)" controls. It reuses the widget's delegated listener (no new chat logic here) —
   just declarative attributes: `data-rebi-open data-rebi-kind="compare"`. Because the tray is
   JS-rendered, set `data-rebi-refs` (and a `data-rebi-title` like "these N vehicles") **dynamically in
   the existing `render()`** from the current `getIds()` (comma-joined), and show/hide the button with
   the tray (hidden at 0 selected). Do NOT alter the existing compare/clear/thumbnail behaviour or the
   `/compare` link.

## Verify (build agent must do this before reporting)
1. `npx astro check` → 0 errors.
2. `astro dev --background`, then:
   - Select 2–3 cars (localStorage `astro-listings-compare`) → the tray shows "Ask AI"; clicking it
     opens Rebi with **exactly one** greeting naming the comparison.
   - Ask "which is cheaper?" / "which is better for a family?" → answered from the live data of **those
     specific cars** (POST `/api/chat` with `{"context":{"kind":"compare","refs":[id1,id2,id3]}}` if
     you can't drive the browser).
   - The existing **"Compare (N)" → table** and **"Clear"** still work; the **per-listing** "Ask about
     this car" entry still works; **no-context** chat is unchanged; `dealerNotes` never appears.
3. Leave no scratch files. Do NOT commit — leave changes in the working tree for review.
