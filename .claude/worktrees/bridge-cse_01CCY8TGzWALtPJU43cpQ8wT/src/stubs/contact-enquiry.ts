/**
 * General contact enquiry submission — STUB.
 * ---------------------------------------------------------------------------
 * Behaviourally indistinguishable from a real lead/CRM submission (the dealer's
 * front-desk pipeline): the SAME typed request → typed response contract the live
 * integration will implement, so going live is a config change (add
 * CONTACT_API_KEY), not a code change. See docs/briefs/_stub-convention.md.
 *
 * The stub NEVER calls a paid API and NEVER writes to a third party. It logs a
 * clearly-mock `[contact-enquiry:stub]` line and returns a DETERMINISTIC
 * reference — the same input always yields the same `MSG-<hash>` id (no
 * Math.random, no module-level `new Date()`), so the demo is stable and SSR-safe.
 */

export interface ContactEnquiryInput {
  name: string;
  email: string;
  phone?: string | null;
  /** Optional department the visitor selected (navigation hint only). */
  department?: string | null;
  message: string;
}

export interface ContactEnquiryResult {
  ok: boolean;
  /** Opaque reference the shopper can quote when the team follows up. */
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
 * Submit a general contact enquiry to the dealer's lead/CRM pipeline. STUB
 * implementation: logs the submission and returns a deterministic reference. The
 * live integration replaces the body below with an authenticated HTTP call to the
 * CRM/lead API (auth via CONTACT_API_KEY), mapping its response onto
 * `{ ok, reference }` with confidence: 'live'.
 */
export async function submitContactEnquiry(
  input: ContactEnquiryInput,
): Promise<ContactEnquiryResult> {
  // TODO_KEYS: Contact enquiry — CONTACT_API_KEY (dealer lead/CRM API) — set in .dev.vars / wrangler secret
  // Live integration goes here: authenticated HTTP POST to the dealer's lead/CRM
  // system, returning its real lead id/status. Unreachable while stubbed.
  const reference = `MSG-${stableHash(
    `${input.email}|${input.department ?? ''}|${input.message}`,
  )}`;
  // Do not log the email address (PII) — department + reference only.
  console.log(
    `[contact-enquiry:stub] captured : ${input.department ?? 'general'} → ${reference}`,
  );
  return { ok: true, reference, confidence: 'stub' };
}
