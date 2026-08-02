# Task brief A — Rebi chat backend: `cards` + `actions` data seam

You are a sub-agent. Read `CLAUDE.md` (Stack / Hard constraints / Field notes) before starting.
Full context spec: `docs/briefs/rebi-drawer-redesign.md` — read §3, §6 in full; this brief implements
its §6.1–6.3. **You own the BACKEND only.** Do NOT touch `ChatWidget.astro`, `rebi.css`,
`stage-engine.ts`, or any page file — another agent owns those.

## Goal
The Rebi chat reply is plain text today. Add two **optional, additive** structured fields to the chat
response so the widget can render (a) clickable listing tiles and (b) best-guess action buttons —
**both derived deterministically server-side, with NO new LLM call.** The existing text-reply path,
request shape, and `/api/chat-poll` must be unchanged.

## Files you own
- `src/chatbot/grounding/context.ts`, `src/chatbot/grounding/lookup.ts`, `src/chatbot/grounding/index.ts`
- `src/chatbot/core.ts`
- NEW `src/lib/rebi-actions.ts` (action-button derivation helper)
- (Read-only refs: `src/lib/listing.ts` `LISTING_FIELDS`, `src/sanity/lib/image.ts` `urlFor`,
  `src/lib/listings-query.ts` `hrefFor`/`LISTINGS_PATH`, `src/lib/vehicle-filter-extract.ts`
  `extractFilters`, `src/config/nav.ts` `navHubs`/`footerColumns`, `src/config/dealer.ts` feature
  flags, `src/components/ListingCard.astro` for the image/href pattern.)

## Response contract to add (must match exactly — the widget builds to this)
Attach to the assistant turn on BOTH the JSON reply (`core.ts` ~L836) and the streaming `done` event
(`core.ts` ~L422, inside `finishNormal`, AFTER the inventory buffer so tiles don't flash early):

```ts
cards?: RebiCard[];      // ≤ 4, omit if none confidently resolve
actions?: RebiAction[];  // ≤ 5, omit if none

interface RebiCard {        // PUBLIC PROJECTION ONLY — never a private field
  slug: string;             // href = `/listings/${slug}`
  title: string;            // "2022 Honda CR-V VTi L7" — prefer year+make+model, fall back to title
  imageUrl: string | null;  // urlFor(images[0]).width(160).height(112).fit('crop').auto('format').url()
  price: number;
  currency: string;
  specLine: string;         // public specs only, e.g. "7 seats · Petrol · FWD"
  badge?: string;           // condition or a public tag — NEVER dealerNotes/cost/floor
}
interface RebiAction {
  label: string;            // "See all 7-seaters", "Work out repayments"
  href: string;             // a real, resolved destination
  icon?: string;            // optional icon key (see nav.ts icons)
}
```

## Tiles (`cards`) — where they come from
1. Widen `FOCUS_PROJECTION` (`context.ts` ~L43) and the lookup GROQ projection (`lookup.ts` ~L115)
   to ALSO select `images, slug, make, model` (they currently deliberately exclude images — that
   exclusion was for the text prompt; we now need them for tiles). Keep everything else.
2. Extend the `GroundedPrompt` return of `buildGroundedSystemPrompt` (`grounding/index.ts` ~L54, and
   populate at ~L209) to carry the **raw resolved rows** alongside `{ prompt, facts }` — e.g.
   `matches: MatchRow[]` (from lookup) and/or the focus rows (from context). Do not change the prompt
   text or `facts`.
3. In `core.ts`, after grounding, map those rows → `RebiCard[]`:
   - Use ONLY public-projection fields. Image via `urlFor(images[0])...` mirroring
     `ListingCard.astro:40`; href `/listings/${slug.current}`.
   - **Determinism:** a row missing `slug` or with no resolvable image → set `imageUrl: null` is OK,
     but a row with no `slug` is dropped with `console.warn('[rebi-cards] WARN dropped row — no slug', ...)`.
     Never fabricate a slug/price/image. Cap at 4. De-duplicate by slug.
   - Prefer the focus rows when the turn was primed on a specific listing/compare set; otherwise the
     lookup matches for the user's query.

## Action buttons (`actions`) — deterministic, no LLM (NEW `src/lib/rebi-actions.ts`)
Export `deriveRebiActions(input): RebiAction[]` taking: the user's latest message text, the resolved
`FilterState | null` for this turn (if grounding computed one), and `dealerConfig`. Rules:
1. **Filter link:** if a `FilterState` was resolved for the turn (search-kind grid, or `extractFilters`
   over the user message produced ≥1 facet), emit ONE "See all …" action with
   `href = hrefFor(state)` (`src/lib/listings-query.ts`). **Never hand-assemble a `/listings?…`
   string** — always go through `hrefFor` (filter-state constraint). Label it from the dominant facet
   (e.g. seats=7 → "See all 7-seaters"; fuelType includes electric → "See all electric cars").
2. **Fixed destinations:** a small deterministic keyword→destination map, each destination looked up
   in `navHubs`/`footerColumns` (`src/config/nav.ts`) and gated by the matching
   `dealerConfig.<feature>.enabled` flag (skip if disabled). Suggested map (only emit on a keyword
   hit): repayment|finance|afford|loan → Finance; "test drive"|drive → Test drive;
   ev|electric|hybrid|charge → Electric hub; service|parts|tyre|battery → Parts/Service;
   sell|trade|valuation → Sell/Trade-in; contact|call|talk|team → Contact.
3. Cap at 5 total, de-duplicate by href, filter-link first. Ambiguous/no hit → omit (never guess).
   Pure function, deterministic (no `Math.random`, no `Date.now()`).

Wire `deriveRebiActions` + the card mapping into `core.ts` at the two response points. Keep it all
behind the normal reply path (not for escalation/human-active/contact-only responses).

## Hard constraints (RESTATED — these bite here)
- **Private data NEVER leaves the public projection.** `dealerNotes`, cost, floor price, private
  condition flags must not appear in a tile, a spec line, a badge, an action, or influence ordering.
  Cards/actions are built only from `LISTING_FIELDS`-level public data.
- **Determinism:** only emit a tile/action you can confidently resolve to a real destination;
  ambiguous → `console.warn` WARN + omit. Never fabricate a car, price, image, slug, or link.
- **All AI through `src/ai/`** — you are adding NO LLM call here; this is pure deterministic data.
- **Filter URLs only via `hrefFor`** (which uses the shared filter contract) — never build query
  strings by hand.
- **Do not change** the `/api/chat` request shape, the SSE `delta` events, `/api/chat-poll`, grounding
  prompt text, the privacy firewall (`grounding/verify.ts`), or rate limiting.

## Definition of done
- `cards`/`actions` appear on the JSON reply and the streaming `done` event when data resolves; absent
  otherwise. Existing text reply unchanged.
- `npx astro check` is green for the files you touched.
- Add a 4–6 line note to the bottom of `docs/briefs/rebi-drawer-redesign.md` under a new
  `## Impl notes — A (backend)` heading: the exact field names/types you shipped and the module path,
  so the widget agent can confirm the contract. (Append only; do not edit other sections.)
- Report back: the exact response shape shipped, files changed, and any determinism WARNs you added.
