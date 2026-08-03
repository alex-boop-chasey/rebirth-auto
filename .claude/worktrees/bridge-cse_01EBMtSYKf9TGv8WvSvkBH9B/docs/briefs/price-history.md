# Task brief — Price History / "Just Reduced"

Surface a listing's price-change history and a "Just Reduced" badge. Follow
`docs/briefs/_stub-convention.md` (READ FIRST). **Determinism is the delicate part here** —
read the rule below carefully.

## The determinism rule (critical)
A fake price drop on a real dealer's real car shown to a real shopper is exactly the kind of
fabrication this project forbids. So:
- The schema gets a REAL `priceHistory` field that dealers / a future POS feed populate. When
  a listing has real history, the badge + history render from THAT — always honest.
- The demo STUB that synthesizes plausible history for listings with none is **OFF by default
  in production** and only ON behind `STUB_PRICE_HISTORY` (demo/dev). It must NEVER fabricate
  history when the flag is off. Gate every synthesized value on the flag.
- The stub is DETERMINISTIC (derive from the listing's price + listingDate + a hash of its id;
  no Math.random, no module-top-level new Date()). Same listing → same demo history.

## Stack / rules
- Astro 7 SSR, Sanity, Tailwind v4, TS. `npx astro check` stays green (before/after; zero new errors).
- **Config as data:** `priceHistory` block in BOTH dealer config objects — `enabled` (show the feature at all), `justReducedWithinDays` (badge window, e.g. 30), and the demo flag is env (`STUB_PRICE_HISTORY`) not config. Match journey/search style.
- Extend `LISTING_FIELDS` in `src/lib/listing.ts` (don't fork projections) so pages get the new field.

## Build
### 1. Schema — `src/sanity/schemaTypes/listing.ts`
- Add a `priceHistory` array field (under the `pricing` group) of objects `{ price: number, date: date, note?: string }`, described as "Price changes over time — most recent last. Populated as prices change; leave empty if unknown." Match surrounding field style. Optional/nullable.

### 2. Type + projection + a pure helper — `src/lib/listing.ts`
- Add `priceHistory?: { price: number; date: string; note?: string }[]` to the listing type.
- Add `priceHistory[]{ price, date, note }` to `LISTING_FIELDS`.
- Add a PURE helper `getPriceDrop(listing, opts)` that, given a listing + `{ nowMs, withinDays }`, returns `{ previous: number, current: number, dropped: boolean, daysAgo: number } | null` from REAL history only. `nowMs` is passed in (no module date). No stub logic here — this is honest-data-only.

### 3. Stub — `src/stubs/price-history.ts`
- `export function demoPriceHistory(listing, nowMs): PriceHistoryEntry[]` — deterministic synthesized history (e.g. a single earlier higher price ~5–12% above current, dated within the badge window) from the listing id hash + price + listingDate. Clearly commented demo-only. `// TODO_KEYS: Price history — real feed (dealer edits / POS price log) — populate listing.priceHistory`.
- A resolver `resolvePriceHistory(listing, { nowMs, useDemo })` that returns `listing.priceHistory` when present, else `useDemo ? demoPriceHistory(...) : []`. `useDemo` is passed in by the caller from the env flag — the stub file itself does not read env.

### 4. Display
- `src/components/ListingCard.astro` — a "Just Reduced" badge when `getPriceDrop(resolved, …)` shows a drop within the window. Resolve `useDemo` from `truthy(env.STUB_PRICE_HISTORY)` at the page/data layer (read env via `cloudflare:workers` where the listings are fetched — likely `src/lib/listings-query.ts` or the page frontmatter; do NOT edit get-env.ts) and thread it down, OR compute the drop in the card from an already-resolved history passed as a prop. Prefer resolving history once where listings are fetched and passing `priceDrop`/`resolvedHistory` as props to keep the card pure.
- Listing detail page (`src/pages/listings/[slug].astro`) — a small price-history display (previous price struck through + drop amount + a compact timeline) when history exists. Gate everything on `dealerConfig.priceHistory.enabled`.

## Scope guardrails — do NOT
- Do NOT fabricate history when `STUB_PRICE_HISTORY` is off. Do NOT write demo data into Sanity. Do NOT alter pricing logic or the firewall. Do NOT edit get-env.ts. No Math.random / module-top-level new Date(). Do NOT commit.
- Do NOT wire price history into Rebi/grounding this round (follow-on).

## Acceptance criteria (report each)
1. Schema field added (quote it).
2. Type + LISTING_FIELDS + `getPriceDrop` pure helper (nowMs passed in, real-data-only).
3. Stub: deterministic demo history; `resolvePriceHistory` with `useDemo` passed in; env flag read at the data layer, NOT in the stub or card.
4. Badge on card + history on detail page; both gated on config.enabled; **proof that nothing renders a synthesized drop when STUB_PRICE_HISTORY is off**.
5. TODO_KEYS row; config in BOTH dealer objects.
6. astro check before N / after M (M ≤ N).

## Report format
Concise: files, the schema field, how useDemo/env is threaded (and the off-by-default proof), astro check before/after, anything not done.
