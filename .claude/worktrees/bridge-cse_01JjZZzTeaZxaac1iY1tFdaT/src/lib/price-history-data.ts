/**
 * Price history — DATA LAYER (the single place the demo flag is read).
 * ---------------------------------------------------------------------------
 * The determinism/honesty rule for this feature lives here: a SYNTHESIZED price
 * drop must NEVER render in production. That is enforced by reading the
 * STUB_PRICE_HISTORY flag ONCE, here, at the data layer (server-only, via the
 * `cloudflare:workers` env — the same mechanism as get-env.ts, which we do NOT
 * edit), and threading the resolved `useDemo` boolean + the computed
 * `PriceDrop`/history DOWN as plain props. The stub file and the ListingCard
 * never read env themselves, so nothing downstream can re-enable the demo.
 *
 * When STUB_PRICE_HISTORY is off (the production default), `usePriceHistoryDemo()`
 * returns false → `resolvePriceHistory` returns only REAL history → the demo
 * synthesizer is unreachable → no fabricated drop can render.
 */

import { env as cfEnv } from 'cloudflare:workers';
import { dealerConfig } from '../config/dealer';
import { getPriceDrop, type Listing, type PriceDrop, type PriceHistoryEntry } from './listing';
import { resolvePriceHistory } from '../stubs/price-history';

/** A flag is "truthy" unless it's absent/empty or an explicit falsey string.
 *  Mirrors the helper in the API routes (trade-in.ts / book-service.ts). */
function truthy(v: unknown): boolean {
  if (v === true) return true;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s !== '' && s !== 'false' && s !== '0' && s !== 'no' && s !== 'off';
  }
  return false;
}

/**
 * Whether the DEMO price-history synthesizer is active for this request. OFF by
 * default (production): only true when STUB_PRICE_HISTORY is explicitly truthy.
 * Read straight from the worker env, with an `import.meta.env` fallback for
 * `astro dev`. Never cached at module scope so it always reflects current env.
 */
export function usePriceHistoryDemo(): boolean {
  const e = cfEnv as unknown as Record<string, unknown>;
  const flag = e.STUB_PRICE_HISTORY ?? import.meta.env.STUB_PRICE_HISTORY;
  return truthy(flag);
}

/**
 * The effective (real-or-demo) price history for one listing. Empty when the
 * feature is disabled, when there's no real history, and the demo is off.
 */
export function resolveHistory(
  listing: Listing,
  nowMs: number,
  useDemo: boolean,
): PriceHistoryEntry[] {
  if (!dealerConfig.priceHistory.enabled) return [];
  return resolvePriceHistory(listing, { nowMs, useDemo });
}

/**
 * The honest `PriceDrop` for one listing (or null). Feeds the resolved history
 * into the pure `getPriceDrop` via a shallow clone, so the derivation stays
 * honest-data-only while still covering the demo path when it's enabled.
 */
export function priceDropFor(
  listing: Listing,
  nowMs: number,
  useDemo: boolean,
): PriceDrop | null {
  if (!dealerConfig.priceHistory.enabled) return null;
  const history = resolveHistory(listing, nowMs, useDemo);
  if (history.length < 2) return null;
  return getPriceDrop(
    { priceHistory: history },
    { nowMs, withinDays: dealerConfig.priceHistory.justReducedWithinDays },
  );
}

/**
 * Build an `_id → PriceDrop|null` map for a grid of listings, resolving the demo
 * flag once. Returned as a plain object so it threads cleanly through
 * `.astro` component props (InventoryResults → ListingCard).
 */
export function priceDropsFor(
  listings: Listing[],
  nowMs: number,
): Record<string, PriceDrop | null> {
  const useDemo = usePriceHistoryDemo();
  const out: Record<string, PriceDrop | null> = {};
  for (const l of listings) out[l._id] = priceDropFor(l, nowMs, useDemo);
  return out;
}
