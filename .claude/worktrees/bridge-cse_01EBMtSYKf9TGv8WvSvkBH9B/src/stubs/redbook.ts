/**
 * Redbook trade-in valuation — STUB.
 * ---------------------------------------------------------------------------
 * Behaviourally indistinguishable from a real Redbook/NEVDIS valuation call:
 * same typed request → typed response contract the live integration will
 * implement, so going live is a config change (add REDBOOK_API_KEY), not a
 * code change. See docs/briefs/_stub-convention.md.
 *
 * The valuation is fully DETERMINISTIC — no Math.random, no `new Date()`. The
 * same inputs always yield the same band, so the demo is stable and SSR-safe.
 * The "current year" is passed IN by the caller (a request-time clock lives in
 * the route, never at module top-level) so age depreciation is honest without
 * a non-deterministic module-level date.
 *
 * `confidence: 'stub'` and the `disclaimer` make clear this is an indicative
 * estimate, never a firm offer or real market data.
 */

export interface TradeInInput {
  make: string;
  model: string;
  year: number;
  odometerKm: number;
  condition: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface TradeInValuation {
  low: number;
  mid: number;
  high: number;
  currency: string;
  confidence: 'stub' | 'live';
  disclaimer: string;
}

const DISCLAIMER =
  'This is an indicative estimate generated for demonstration only — not a firm offer, ' +
  'valuation, or guarantee of price. A final trade-in figure is subject to a physical ' +
  'inspection of your vehicle by the dealership.';

// Condition multipliers — a used-car band by presentation/mechanical state.
const CONDITION_FACTOR: Record<TradeInInput['condition'], number> = {
  excellent: 1.08,
  good: 1.0,
  fair: 0.86,
  poor: 0.68,
};

// Per-year retained value (~15% straight depreciation compounding).
const ANNUAL_RETENTION = 0.85;
// Value lost per km driven (trade-in wholesale-style penalty).
const PER_KM_PENALTY = 0.05;
// Floor so an old/high-km car never drops to an absurd/negative number.
const VALUE_FLOOR = 1000;
// Half-width of the low↔high band around mid (±8%).
const BAND = 0.08;

/**
 * Deterministic pseudo-base "as-new" price derived from make+model text, so
 * different vehicles get different-but-stable figures without any real pricing
 * data or randomness. Maps a simple string hash into a plausible AUD-scale
 * band (~$22k–$68k). Purely cosmetic realism for the stub.
 */
function pseudoBaseValue(make: string, model: string): number {
  const key = `${make.trim().toLowerCase()}|${model.trim().toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0; // unsigned 32-bit rolling hash
  }
  const min = 22000;
  const span = 46000; // → max ~68000
  return min + (hash % span);
}

/** Round to the nearest $50 so figures read like a real quote, not cents. */
function roundTo50(n: number): number {
  return Math.round(n / 50) * 50;
}

/**
 * Produce an indicative trade-in valuation for the given vehicle.
 *
 * @param input    make/model/year/odometer/condition of the trade-in vehicle.
 * @param currency ISO-4217 code echoed back on the valuation (dealer default).
 * @param currentYear request-time calendar year, passed in by the caller so
 *                    this stays deterministic and SSR-safe (no module `new Date()`).
 */
export async function getTradeInValuation(
  input: TradeInInput,
  currency: string,
  currentYear: number,
): Promise<TradeInValuation> {
  // TODO_KEYS: Redbook — REDBOOK_API_KEY (Redbook/NEVDIS valuation) — set in .dev.vars / wrangler secret
  // The live integration replaces everything below with an HTTP call to the
  // Redbook valuation API (auth via REDBOOK_API_KEY), mapping its wholesale/
  // retail band onto { low, mid, high } and setting confidence: 'live'.

  const age = Math.max(0, currentYear - input.year);
  const base = pseudoBaseValue(input.make, input.model);

  // Depreciate with age, then subtract an odometer penalty, then adjust by
  // condition. Everything is clamped at a sensible floor.
  const afterAge = base * Math.pow(ANNUAL_RETENTION, age);
  const afterOdo = afterAge - Math.max(0, input.odometerKm) * PER_KM_PENALTY;
  const conditioned = afterOdo * CONDITION_FACTOR[input.condition];

  const mid = Math.max(VALUE_FLOOR, roundTo50(conditioned));
  const low = Math.max(VALUE_FLOOR, roundTo50(mid * (1 - BAND)));
  const high = roundTo50(mid * (1 + BAND));

  return {
    low,
    mid,
    high,
    currency,
    confidence: 'stub',
    disclaimer: DISCLAIMER,
  };
}
