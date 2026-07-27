/**
 * Price history — DEMO SYNTHESIZER (stub).
 * ---------------------------------------------------------------------------
 * A fake price drop shown on a REAL dealer's REAL car to a REAL shopper is
 * exactly the fabrication this project forbids (see docs/briefs/_stub-convention.md,
 * rule 4). So this synthesizer is DEMO/DEV-ONLY and NEVER runs in production:
 *
 *   • The REAL `listing.priceHistory` (dealer / future POS feed) always wins and
 *     always renders honestly.
 *   • This synthesizer only fills in plausible history for listings that have
 *     NONE, and only when the caller passes `useDemo: true` — which the data
 *     layer resolves SOLELY from the STUB_PRICE_HISTORY env flag. This file does
 *     NOT read env, and neither does the card; the flag is read once where
 *     listings are fetched and threaded down.
 *
 * The synthesized history is fully DETERMINISTIC — no Math.random, no
 * module-level `new Date()`. It derives from the listing's id-hash + price +
 * listingDate, and the request-time clock (`nowMs`) is passed IN. Same listing →
 * same demo history every render, so SSR and any re-fetch agree.
 */

import type { Listing, PriceHistoryEntry } from '../lib/listing';

/**
 * Deterministic 32-bit rolling hash → unsigned int. Mirrors the hashing style in
 * src/stubs/redbook.ts / email.ts — cheap, stable, zero-dependency. Not security.
 */
function stableHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0; // unsigned 32-bit
  }
  return hash;
}

/** Round to the nearest $50 so the earlier price reads like a real figure. */
function roundTo50(n: number): number {
  return Math.round(n / 50) * 50;
}

/**
 * Synthesize a plausible two-point price history for a listing that has none:
 * a single earlier, HIGHER price (~5–12% above current) dated a deterministic
 * number of days ago (within a ~7–34 day window, so it lands inside a typical
 * "Just Reduced" badge window), followed by the current price today.
 *
 * DEMO ONLY. Callers must gate this behind the STUB_PRICE_HISTORY flag via
 * `resolvePriceHistory({ useDemo })`.
 *
 * @param nowMs request-time clock, passed in (no module-level `new Date()`).
 */
export function demoPriceHistory(listing: Listing, nowMs: number): PriceHistoryEntry[] {
  // TODO_KEYS: Price history — real feed (dealer edits / POS price log) — populate listing.priceHistory
  // The live path needs no key: once dealers/POS populate listing.priceHistory,
  // resolvePriceHistory returns THAT and this synthesizer is never reached.

  const price = listing.price;
  // A demo drop only makes sense for a real, positive price.
  if (!Number.isFinite(price) || price <= 0) return [];

  const seed = stableHash(`${listing._id}|${price}|${listing.listingDate ?? ''}`);

  // Earlier price: +5%..+12% above current, deterministic per listing.
  const upliftPct = 5 + (seed % 8); // 5..12
  const previousPrice = roundTo50(price * (1 + upliftPct / 100));
  if (previousPrice <= price) return []; // guard: never a non-drop

  // The reduction landed 7..34 days ago (deterministic), so it sits inside a
  // typical badge window (justReducedWithinDays, e.g. 30) for most listings.
  const daysAgo = 7 + ((seed >> 3) % 28); // 7..34
  const changeMs = nowMs - daysAgo * 86_400_000;
  const changeDate = new Date(changeMs).toISOString().slice(0, 10); // YYYY-MM-DD
  const todayDate = new Date(nowMs).toISOString().slice(0, 10);

  // Most-recent LAST (matches the schema/real convention).
  return [
    { price: previousPrice, date: changeDate, note: 'Demo price history' },
    { price, date: todayDate, note: 'Demo price history' },
  ];
}

/**
 * Resolve the effective price history for a listing:
 *   • the REAL `listing.priceHistory` when present (always — honest data wins);
 *   • otherwise the deterministic demo history IF `useDemo` is true;
 *   • otherwise an empty array (nothing to show).
 *
 * `useDemo` is passed IN by the caller (resolved from STUB_PRICE_HISTORY at the
 * data layer). This file never reads env, so a synthesized history is impossible
 * whenever the flag is off.
 */
export function resolvePriceHistory(
  listing: Listing,
  opts: { nowMs: number; useDemo: boolean },
): PriceHistoryEntry[] {
  if (Array.isArray(listing.priceHistory) && listing.priceHistory.length > 0) {
    return listing.priceHistory;
  }
  return opts.useDemo ? demoPriceHistory(listing, opts.nowMs) : [];
}
