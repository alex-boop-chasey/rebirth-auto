// SECURITY: demo scaffold only. Real customer auth requires the paid human security review
//  mandated by DECISIONS.md before ANY real customer data. Do NOT wire to real PII.
/**
 * Customer accounts — DEMO-ONLY auth STUB.
 * ---------------------------------------------------------------------------
 * This is NOT a real authentication system and must never become one without the
 * paid human security review DECISIONS.md mandates before ANY real customer data
 * flows. It exists so the "my account" surface is fully demoable now.
 *
 * What it deliberately does NOT do (see docs/briefs/customer-accounts.md):
 *   - NO passwords. NO password field, hashing, or verification.
 *   - NO session tokens, JWTs, or cookies-as-credentials. The route returns the
 *     mock profile inline; there is no server-side session.
 *   - NO credential storage of any kind. NO real PII. NO third-party IdP call.
 *
 * The "sign-in" accepts only an email and returns a DETERMINISTIC, obviously-mock
 * CustomerProfile derived from a stable hash of that email — no Math.random and no
 * module-top-level `new Date()`, so the demo is stable and SSR-safe. Every profile
 * is fabricated demo data; the UI labels it loudly as such.
 *
 * Going live is a SECURITY-REVIEW BLOCKER, not a config change: a real integration
 * would replace `demoSignIn` with an authenticated identity provider (e.g.
 * Cloudflare Access / an auth provider) plus real session handling — and only
 * after the review. See TODO_KEYS.md.
 */

/** A customer's account profile. All fields are fabricated demo data in the stub. */
export interface CustomerProfile {
  id: string;
  email: string;
  name: string;
  serviceHistory: { date: string; vehicle: string; service: string }[];
  vehicleInterests: string[];
}

/**
 * Deterministic 32-bit rolling hash of a string → unsigned int. Mirrors the
 * hashing style used by the email/redbook stubs — cheap, stable, zero-dependency.
 * Purely for stable demo derivation; NOT security and NOT a credential.
 */
function stableHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0; // unsigned 32-bit
  }
  return hash;
}

// Fixed demo pools. A stable hash of the email picks entries, so the same email
// always yields the same fabricated profile without any randomness or clock read.
const FIRST_NAMES = ['Jordan', 'Riley', 'Casey', 'Morgan', 'Alex', 'Sam', 'Taylor', 'Jamie'];
const LAST_NAMES = ['Smith', 'Nguyen', 'Patel', 'Brown', 'Wilson', 'Taylor', 'Lee', 'Walker'];

// Deterministic "service history" material. Dates are fixed demo strings (NOT
// derived from the current clock) so the demo never drifts and stays SSR-safe.
const HISTORY_POOL: { date: string; vehicle: string; service: string }[] = [
  { date: '2025-02-14', vehicle: 'Toyota Corolla 2019', service: 'Logbook service' },
  { date: '2024-11-03', vehicle: 'Toyota Corolla 2019', service: 'Tyres' },
  { date: '2025-05-22', vehicle: 'Mazda CX-5 2021', service: 'Brakes' },
  { date: '2024-08-09', vehicle: 'Mazda CX-5 2021', service: 'Air-con regas' },
  { date: '2025-01-18', vehicle: 'Ford Ranger 2020', service: 'General inspection' },
  { date: '2024-06-27', vehicle: 'Ford Ranger 2020', service: 'Logbook service' },
];

const INTERESTS_POOL = [
  'Family SUV under $40,000',
  'Low-km diesel ute',
  'Automatic hatchback',
  'Late-model hybrid',
  '7-seat wagon',
  'First car under $15,000',
];

/** Pick an element deterministically from a pool using a hash + offset. */
function pick<T>(pool: readonly T[], hash: number, offset: number): T {
  return pool[(hash + offset) % pool.length];
}

/**
 * "Sign in" a demo customer. STUB implementation: accepts an email and returns a
 * DETERMINISTIC mock profile derived from a hash of that email. No password, no
 * session, no credential, no real PII.
 *
 * The live integration is a SECURITY-REVIEW BLOCKER (see TODO_KEYS.md): it would
 * replace this with an authenticated identity provider + real session handling,
 * and only after the paid human review DECISIONS.md mandates.
 */
export async function demoSignIn(email: string): Promise<CustomerProfile> {
  // TODO_KEYS: Customer auth — real IdP/session (e.g. Cloudflare Access / Auth provider) + security review — BLOCKER before real data
  // The live integration replaces everything below. It MUST NOT be wired to real
  // customer PII until the paid human security review DECISIONS.md mandates has
  // signed off. Unreachable while this demo scaffold is the only implementation.
  const normalized = email.trim().toLowerCase();
  const hash = stableHash(normalized);

  const name = `${pick(FIRST_NAMES, hash, 0)} ${pick(LAST_NAMES, hash, 3)}`;

  // Two stable service-history rows for the same fabricated vehicle.
  const first = HISTORY_POOL[hash % HISTORY_POOL.length];
  const second = HISTORY_POOL[(hash + 1) % HISTORY_POOL.length];
  const serviceHistory = [first, second];

  const vehicleInterests = [
    pick(INTERESTS_POOL, hash, 0),
    pick(INTERESTS_POOL, hash, 2),
  ];

  return {
    // `demo-` prefixed, hash-derived id — clearly not a real account identifier.
    id: `demo-${hash.toString(16).padStart(8, '0')}`,
    email: normalized,
    name,
    serviceHistory,
    vehicleInterests,
  };
}
