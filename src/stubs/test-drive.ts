/**
 * Test-drive booking submission — STUB.
 * ---------------------------------------------------------------------------
 * Behaviourally indistinguishable from a real booking/scheduling submission (the
 * dealer's sales-desk / calendar pipeline): the SAME typed request → typed
 * response contract the live integration will implement, so going live is a
 * config change (add BOOKING_API_KEY), not a code change. See
 * docs/briefs/_stub-convention.md.
 *
 * The stub NEVER calls a paid API and NEVER writes to a third party. It logs a
 * clearly-mock `[test-drive:stub]` line and returns a DETERMINISTIC reference —
 * the same input always yields the same `TD-<hash>` id (no Math.random, no
 * module-level `new Date()`), so the demo is stable and SSR-safe. It reserves NO
 * slot and invents NO availability: this is a REQUEST the team confirms by phone
 * (determinism / honesty).
 */

export interface TestDriveBookingInput {
  name: string;
  contact: string;
  /** Slug of the chosen listing, when the shopper arrived from a vehicle. */
  vehicleSlug?: string | null;
  /** Human label for the chosen vehicle (e.g. "2022 Toyota HiLux"), if any. */
  vehicleLabel?: string | null;
  preferredDate: string;
  preferredTime?: string | null;
  notes?: string | null;
}

export interface TestDriveBookingResult {
  ok: boolean;
  /** Opaque reference the shopper can quote when the team confirms the time. */
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
 * Submit a test-drive booking request to the dealer's booking pipeline. STUB
 * implementation: logs the request and returns a deterministic reference. The
 * live integration replaces the body below with an authenticated HTTP call to the
 * booking/calendar API (auth via BOOKING_API_KEY), mapping its response onto
 * `{ ok, reference }` with confidence: 'live'.
 */
export async function submitTestDriveBooking(
  input: TestDriveBookingInput,
): Promise<TestDriveBookingResult> {
  // TODO_KEYS: Test-drive booking — BOOKING_API_KEY (dealer booking/calendar API) — set in .dev.vars / wrangler secret
  // Live integration goes here: authenticated HTTP POST to the dealer's booking
  // system, returning its real request id/status. Unreachable while stubbed.
  const reference = `TD-${stableHash(
    `${input.contact}|${input.vehicleSlug ?? ''}|${input.preferredDate}|${input.preferredTime ?? ''}`,
  )}`;
  // Do not log the contact (PII) — vehicle + reference only.
  console.log(
    `[test-drive:stub] captured : ${input.vehicleLabel ?? 'no vehicle chosen'} → ${reference}`,
  );
  return { ok: true, reference, confidence: 'stub' };
}
