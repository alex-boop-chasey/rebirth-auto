/**
 * Careers register-interest submission — STUB.
 * ---------------------------------------------------------------------------
 * Behaviourally indistinguishable from a real lead/ATS submission (the dealer's
 * people/HR pipeline): the SAME typed request → typed response contract the live
 * integration will implement, so going live is a config change (add
 * CAREERS_API_KEY), not a code change. See docs/briefs/_stub-convention.md.
 *
 * The stub NEVER calls a paid API and NEVER writes to a third party. It logs a
 * clearly-mock `[careers-enquiry:stub]` line and returns a DETERMINISTIC
 * reference — the same input always yields the same `CAR-<hash>` id (no
 * Math.random, no module-level `new Date()`), so the demo is stable and SSR-safe.
 *
 * DETERMINISM: this is an EXPRESSION OF INTEREST, not a job application or an
 * offer — the copy never asserts a role exists or a hire will follow.
 */

export interface CareersEnquiryInput {
  name: string;
  email: string;
  phone?: string | null;
  /** Optional role id the visitor is interested in (from config `careers.roles`). */
  roleId?: string | null;
  message: string;
}

export interface CareersEnquiryResult {
  ok: boolean;
  /** Opaque reference the applicant can quote when the team follows up. */
  reference: string;
  confidence: 'stub' | 'live';
}

/**
 * Deterministic 32-bit rolling hash → unsigned hex. Mirrors the hashing style of
 * the other stubs (src/stubs/sell-enquiry.ts, src/stubs/redbook.ts) — cheap,
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
 * Submit a careers register-interest enquiry to the dealer's lead/ATS pipeline.
 * STUB implementation: logs the submission and returns a deterministic reference.
 * The live integration replaces the body below with an authenticated HTTP call to
 * the ATS/lead API (auth via CAREERS_API_KEY), mapping its response onto
 * `{ ok, reference }` with confidence: 'live'.
 */
export async function submitCareersEnquiry(
  input: CareersEnquiryInput,
): Promise<CareersEnquiryResult> {
  // TODO_KEYS: Careers enquiry — CAREERS_API_KEY (dealer lead/ATS API) — set in .dev.vars / wrangler secret
  // Live integration goes here: authenticated HTTP POST to the dealer's lead/ATS
  // system, returning its real lead id/status. Unreachable while stubbed.
  const reference = `CAR-${stableHash(
    `${input.email}|${input.roleId ?? ''}|${input.message}`,
  )}`;
  // Do not log the email address (PII) — role + reference only.
  console.log(
    `[careers-enquiry:stub] captured : ${input.roleId ?? 'general-interest'} → ${reference}`,
  );
  return { ok: true, reference, confidence: 'stub' };
}
