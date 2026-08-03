/**
 * Sell-your-car enquiry submission — STUB.
 * ---------------------------------------------------------------------------
 * Behaviourally indistinguishable from a real lead/CRM submission (the dealer's
 * buying-desk pipeline): the SAME typed request → typed response contract the
 * live integration will implement, so going live is a config change (add
 * SELL_CRM_API_KEY), not a code change. See docs/briefs/_stub-convention.md.
 *
 * The stub NEVER calls a paid API and NEVER writes to a third party. It logs a
 * clearly-mock `[sell-enquiry:stub]` line and returns a DETERMINISTIC reference —
 * the same input always yields the same `SELL-<hash>` id (no Math.random, no
 * module-level `new Date()`), so the demo is stable and SSR-safe. It quotes NO
 * price: an outright-sale figure is only ever confirmed after a physical
 * inspection (determinism / honesty).
 */

export interface SellEnquiryInput {
  name: string;
  email: string;
  phone?: string | null;
  make: string;
  model: string;
  year: number;
  odometerKm: number;
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  notes?: string | null;
}

export interface SellEnquiryResult {
  ok: boolean;
  /** Opaque reference the shopper can quote when the buying team follows up. */
  reference: string;
  confidence: 'stub' | 'live';
}

/**
 * Deterministic 32-bit rolling hash → unsigned hex. Mirrors the hashing style of
 * the other stubs (src/stubs/redbook.ts, src/stubs/email.ts) — cheap, stable,
 * zero-dependency. Purely for a realistic-looking reference; not security.
 */
function stableHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0; // unsigned 32-bit
  }
  return hash.toString(16).padStart(8, '0').toUpperCase();
}

/**
 * Submit a sell-your-car enquiry to the dealer's lead/CRM pipeline. STUB
 * implementation: logs the submission and returns a deterministic reference. The
 * live integration replaces the body below with an authenticated HTTP call to the
 * CRM/lead API (auth via SELL_CRM_API_KEY), mapping its response onto
 * `{ ok, reference }` with confidence: 'live'.
 */
export async function submitSellEnquiry(input: SellEnquiryInput): Promise<SellEnquiryResult> {
  // TODO_KEYS: Sell enquiry — SELL_CRM_API_KEY (dealer lead/CRM API) — set in .dev.vars / wrangler secret
  // Live integration goes here: authenticated HTTP POST to the dealer's lead/CRM
  // system, returning its real lead id/status. Unreachable while stubbed.
  const reference = `SELL-${stableHash(
    `${input.email}|${input.make}|${input.model}|${input.year}|${input.odometerKm}|${input.condition}`,
  )}`;
  // Do not log the email address (PII) — vehicle + reference only.
  console.log(
    `[sell-enquiry:stub] captured : ${input.year} ${input.make} ${input.model} → ${reference}`,
  );
  return { ok: true, reference, confidence: 'stub' };
}
