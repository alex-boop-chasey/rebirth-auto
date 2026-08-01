/**
 * Genuine-parts enquiry submission — STUB.
 * ---------------------------------------------------------------------------
 * Behaviourally indistinguishable from a real parts-desk / lead submission: the
 * SAME typed request → typed response contract the live integration will
 * implement, so going live is a config change (add PARTS_API_KEY), not a code
 * change. See docs/briefs/_stub-convention.md.
 *
 * The stub NEVER calls a paid API and NEVER writes to a third party. It logs a
 * clearly-mock `[parts-enquiry:stub]` line and returns a DETERMINISTIC reference —
 * the same input always yields the same `PARTS-<hash>` id (no Math.random, no
 * module-level `new Date()`), so the demo is stable and SSR-safe. It quotes NO
 * price and guarantees NO fitment: those are confirmed by the parts team
 * (determinism / honesty).
 */

export interface PartsEnquiryInput {
  name: string;
  contact: string;
  /** Free-text vehicle the part is for (from the shopper, or the prefilled title). */
  vehicle: string;
  /** Slug of the chosen listing, when the shopper arrived from a vehicle page. */
  vehicleSlug?: string | null;
  /** The part the shopper needs (free text). */
  part: string;
  notes?: string | null;
}

export interface PartsEnquiryResult {
  ok: boolean;
  /** Opaque reference the shopper can quote when the parts team follows up. */
  reference: string;
  confidence: 'stub' | 'live';
}

/**
 * Deterministic 32-bit rolling hash → unsigned hex. Mirrors the hashing style of
 * the other stubs (src/stubs/sell-enquiry.ts, src/stubs/test-drive.ts) — cheap,
 * stable, zero-dependency. Purely for a realistic-looking reference; not security.
 */
function stableHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0; // unsigned 32-bit
  }
  return hash.toString(16).padStart(8, '0').toUpperCase();
}

/**
 * Submit a parts enquiry to the dealer's parts-desk / lead pipeline. STUB
 * implementation: logs the submission and returns a deterministic reference. The
 * live integration replaces the body below with an authenticated HTTP call to the
 * parts/lead API (auth via PARTS_API_KEY), mapping its response onto
 * `{ ok, reference }` with confidence: 'live'.
 */
export async function submitPartsEnquiry(input: PartsEnquiryInput): Promise<PartsEnquiryResult> {
  // TODO_KEYS: Parts enquiry — PARTS_API_KEY (dealer parts-desk/lead API) — set in .dev.vars / wrangler secret
  // Live integration goes here: authenticated HTTP POST to the dealer's parts/lead
  // system, returning its real lead id/status. Unreachable while stubbed.
  const reference = `PARTS-${stableHash(
    `${input.contact}|${input.vehicleSlug ?? ''}|${input.vehicle}|${input.part}`,
  )}`;
  // Do not log the contact (PII) — vehicle + part + reference only.
  console.log(
    `[parts-enquiry:stub] captured : ${input.part} for ${input.vehicle} → ${reference}`,
  );
  return { ok: true, reference, confidence: 'stub' };
}
