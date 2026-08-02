/**
 * Fleet & business enquiry submission — STUB.
 * ---------------------------------------------------------------------------
 * Behaviourally indistinguishable from a real fleet CRM / lead submission: the
 * SAME typed request → typed response contract the live integration will
 * implement, so going live is a config change (add FLEET_CRM_API_KEY), not a code
 * change. See docs/briefs/_stub-convention.md.
 *
 * The stub NEVER calls a paid API and NEVER writes to a third party. It logs a
 * clearly-mock `[fleet-enquiry:stub]` line and returns a DETERMINISTIC reference —
 * the same input always yields the same `FLEET-<hash>` id (no Math.random, no
 * module-level `new Date()`), so the demo is stable and SSR-safe. It quotes NO
 * price and commits NO terms: those are confirmed by the fleet team (determinism
 * / honesty).
 */

export interface FleetEnquiryInput {
  businessName: string;
  contact: string;
  /** Optional ABN, if the business supplied one. */
  abn?: string | null;
  /** Free-text fleet size / needs (e.g. "6 utes, priority servicing"). */
  fleetNeeds: string;
  notes?: string | null;
}

export interface FleetEnquiryResult {
  ok: boolean;
  /** Opaque reference the shopper can quote when the fleet team follows up. */
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
 * Submit a fleet enquiry to the dealer's fleet CRM / lead pipeline. STUB
 * implementation: logs the submission and returns a deterministic reference. The
 * live integration replaces the body below with an authenticated HTTP call to the
 * fleet CRM/lead API (auth via FLEET_CRM_API_KEY), mapping its response onto
 * `{ ok, reference }` with confidence: 'live'.
 */
export async function submitFleetEnquiry(input: FleetEnquiryInput): Promise<FleetEnquiryResult> {
  // TODO_KEYS: Fleet enquiry — FLEET_CRM_API_KEY (dealer fleet CRM/lead API) — set in .dev.vars / wrangler secret
  // Live integration goes here: authenticated HTTP POST to the dealer's fleet CRM,
  // returning its real lead id/status. Unreachable while stubbed.
  const reference = `FLEET-${stableHash(
    `${input.contact}|${input.businessName}|${input.abn ?? ''}|${input.fleetNeeds}`,
  )}`;
  // Do not log the contact (PII) — business + reference only.
  console.log(
    `[fleet-enquiry:stub] captured : ${input.businessName} → ${reference}`,
  );
  return { ok: true, reference, confidence: 'stub' };
}
