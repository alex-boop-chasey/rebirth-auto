// SECURITY: demo scaffold only. Real customer auth requires the paid human security review
//  mandated by DECISIONS.md before ANY real customer data. Do NOT wire to real PII.
/**
 * Customer accounts endpoint — DEMO-ONLY sign-in (stubbed, OFF by default).
 *
 * POST { action: 'signin', email } → { profile, savedSearchCount } on success, or
 * { error } (HTTP 200) on an expected failure. Mirrors the /api/book-service +
 * /api/saved-search discipline: feature flag → cheap body validation → per-IP KV
 * rate limit (fail OPEN, DISTINCT `account:` prefix) → demo profile → graceful
 * degradation. Never a 500 for an expected condition.
 *
 * THIS IS NOT REAL AUTH. There is NO password field, NO session token, NO JWT, NO
 * credential storage, and NO real PII. The mock profile (src/stubs/auth.ts) is
 * returned INLINE in the response body — there is no server-side session. Going
 * live is a SECURITY-REVIEW BLOCKER (see TODO_KEYS.md), not a config change.
 *
 * OPTIONAL, read-only: if the visitor already has saved searches under their
 * journey visitor id, surface a COUNT via the existing getSavedSearches. Fully
 * fail-open and loosely coupled — a missing db/journey just yields 0.
 *
 * Env is read directly from `cloudflare:workers` here (mirroring
 * src/chatbot/get-env.ts, with the import.meta.env fallback for non-CF local
 * runs) — get-env.ts is left untouched by convention.
 */
import type { APIRoute } from 'astro';
import { env as cfEnv } from 'cloudflare:workers';
import { dealerConfig } from '~/config/dealer';
import { checkRateLimit } from '~/lib/rate-limit';
import { demoSignIn } from '~/stubs/auth';
import { getSavedSearches, isValidEmail } from '~/lib/saved-search';
import { resolveVisitor, withCookie } from '~/chatbot/visitor';
import type { KVNamespaceLike } from '~/chatbot/core';
import type { D1Like } from '~/chatbot/state';

export const prerender = false; // dynamic route, not pre-rendered

const json = (body: unknown, status = 200, headers?: Record<string, string>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

/** Env this route needs — read straight from the worker env with a local fallback. */
function getAccountEnv(): {
  AUTH_PROVIDER_KEY: string | undefined;
  STUB_AUTH: unknown;
  RATE_LIMIT_KV: KVNamespaceLike | undefined;
  CHAT_DB: D1Like | undefined;
} {
  const e = cfEnv as unknown as Record<string, unknown>;
  return {
    AUTH_PROVIDER_KEY:
      (e.AUTH_PROVIDER_KEY as string | undefined) ?? import.meta.env.AUTH_PROVIDER_KEY,
    STUB_AUTH: e.STUB_AUTH ?? import.meta.env.STUB_AUTH,
    RATE_LIMIT_KV: e.RATE_LIMIT_KV as KVNamespaceLike | undefined,
    CHAT_DB: e.CHAT_DB as D1Like | undefined,
  };
}

/** A flag is "truthy" unless it's absent/empty or an explicit falsey string. */
function truthy(v: unknown): boolean {
  if (v === true) return true;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s !== '' && s !== 'false' && s !== '0' && s !== 'no' && s !== 'off';
  }
  return false;
}

const MAX_EMAIL_LENGTH = 254; // RFC 5321 max address length
const MAX_SAVED_SEARCHES = 20;

export const POST: APIRoute = async ({ request }) => {
  const cfg = dealerConfig.accounts;
  const copy = cfg.copy;

  // Feature flag — DEMO SCAFFOLD, OFF by default. When off, the account surface is
  // not reachable and this endpoint returns 404 (nothing changes).
  if (!cfg.enabled) return json({ error: 'Accounts are not available.' }, 404);

  const env = getAccountEnv();

  // Resolve the visitor id (mints the opaque cookie if needed). Reuses the
  // journey identity ONLY to look up existing saved searches — fail-open.
  const { id: visitorId, setCookie } = resolveVisitor(request, dealerConfig.chat.journey);

  // Stub activation (shared convention): auto-stub until a real key is added, or
  // whenever STUB_AUTH is truthy. But this feature has NO live path: real auth is
  // a SECURITY-REVIEW BLOCKER (DECISIONS.md). So if a real AUTH_PROVIDER_KEY is
  // present (useStub === false), we deliberately REFUSE rather than silently wire
  // real identity/PII without the mandated review.
  const useStub = truthy(env.STUB_AUTH) || !env.AUTH_PROVIDER_KEY;
  if (!useStub) {
    console.error(
      '[account] live auth requested but BLOCKED pending the mandated security review (DECISIONS.md)',
    );
    return withCookie(json({ error: copy.errorMessage }, 503), setCookie);
  }

  // Parse + validate BEFORE spending a rate-limit slot.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withCookie(json({ error: 'Invalid request.' }, 400), setCookie);
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const action = typeof b.action === 'string' ? b.action : '';
  const email = typeof b.email === 'string' ? b.email.trim().slice(0, MAX_EMAIL_LENGTH) : '';

  // Only the demo sign-in action exists. NO password is read from the body — this
  // scaffold has no concept of a credential.
  if (action !== 'signin' || !isValidEmail(email)) {
    return withCookie(json({ error: copy.invalidMessage }, 200), setCookie);
  }

  // Per-IP rate limit (KV). DISTINCT `account:` prefix so it never shares another
  // endpoint's counter. Guard when unbound; fail OPEN so a KV hiccup never blocks.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.RATE_LIMIT_KV) {
    try {
      const rl = await checkRateLimit(env.RATE_LIMIT_KV, ip, cfg.rateLimit, 'account:');
      if (!rl.allowed) {
        return withCookie(
          json({ error: copy.rateLimitMessage }, 429, {
            'Retry-After': String(rl.retryAfterSeconds),
          }),
          setCookie,
        );
      }
    } catch (err) {
      console.error('[account] rate limit check failed (allowing request)', err);
    }
  }

  // Demo sign-in — deterministic mock profile from the email. No password, no
  // session, no credential stored anywhere. The profile is returned INLINE below.
  const profile = await demoSignIn(email);

  // OPTIONAL, read-only, fail-open: surface how many saved searches this visitor
  // already has (getSavedSearches returns [] on any error / missing db). Loosely
  // coupled — a failure here never affects the sign-in.
  let savedSearchCount = 0;
  try {
    const saved = await getSavedSearches(env.CHAT_DB, visitorId, MAX_SAVED_SEARCHES);
    savedSearchCount = saved.length;
  } catch (err) {
    console.error('[account] saved-search count lookup failed (ignored)', err);
  }

  return withCookie(json({ profile, savedSearchCount }, 200), setCookie);
};
