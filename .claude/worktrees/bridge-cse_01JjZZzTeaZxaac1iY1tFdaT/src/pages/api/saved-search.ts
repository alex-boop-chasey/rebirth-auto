/**
 * Saved-search endpoint — "save this search + email me new matches" (stubbed email).
 *
 * POST { email, query, label } → { ok } on success, or { error } (HTTP 200) on
 * any expected failure. Never a 500 for an expected condition — mirrors the
 * /api/trade-in + /api/search discipline: feature flag → cheap body validation →
 * per-IP KV rate limit (fail OPEN, DISTINCT `savedsearch:` prefix) → fail-open D1
 * persist → stubbed confirmation email → graceful degradation.
 *
 * A "saved search" is just the canonical serialized filter query string (the URL
 * contract in src/lib/listings-query.ts) — the client reads it from the current
 * URL via the existing filter helpers; this route never constructs a filter URL.
 *
 * Visitor identity reuses the journey's `resolveVisitor` (opaque UUID cookie, no
 * PII) so the save is tied to the same anonymous id the continuity journey uses;
 * the cookie is attached to the response when freshly minted.
 *
 * Email sending is STUBBED (src/stubs/email.ts). Stub activation (shared stub
 * convention): active when the real credential is absent OR STUB_EMAIL is truthy —
 *   useStub = !env.RESEND_API_KEY || truthy(env.STUB_EMAIL)
 * so it auto-stubs until a real key is added (no code change to go live).
 *
 * Env is read directly from `cloudflare:workers` here (mirroring
 * src/chatbot/get-env.ts, with the import.meta.env fallback for non-CF local
 * runs) — get-env.ts is left untouched by convention.
 */
import type { APIRoute } from 'astro';
import { env as cfEnv } from 'cloudflare:workers';
import { dealerConfig } from '~/config/dealer';
import { checkRateLimit } from '~/lib/rate-limit';
import { saveSearch, isValidEmail } from '~/lib/saved-search';
import { resolveVisitor, withCookie } from '~/chatbot/visitor';
import { sendEmail, type EmailMessage } from '~/stubs/email';
import type { KVNamespaceLike } from '~/chatbot/core';
import type { D1Like } from '~/chatbot/state';

export const prerender = false; // dynamic route, not pre-rendered

const json = (body: unknown, status = 200, headers?: Record<string, string>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

/** Env this route needs — read straight from the worker env with a local fallback. */
function getSavedSearchEnv(): {
  RESEND_API_KEY: string | undefined;
  STUB_EMAIL: unknown;
  RATE_LIMIT_KV: KVNamespaceLike | undefined;
  CHAT_DB: D1Like | undefined;
} {
  const e = cfEnv as unknown as Record<string, unknown>;
  return {
    RESEND_API_KEY: (e.RESEND_API_KEY as string | undefined) ?? import.meta.env.RESEND_API_KEY,
    STUB_EMAIL: e.STUB_EMAIL ?? import.meta.env.STUB_EMAIL,
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

// Bounds mirrored from the persistence layer — reject nonsense before any work.
const MAX_QUERY_LENGTH = 512;
const MAX_LABEL_LENGTH = 120;

export const POST: APIRoute = async ({ request }) => {
  const cfg = dealerConfig.savedSearch;
  const copy = cfg.copy;

  // Feature flag — a dealer can hide saved searches without a deploy.
  if (!cfg.enabled) return json({ error: 'Saved searches are not available.' }, 404);

  const env = getSavedSearchEnv();

  // Resolve the visitor id (mints the opaque cookie if needed). Reuses the
  // journey identity so a save is tied to the same anonymous id. Fail-open →
  // { id: null } if the journey is disabled or a cookie can't be parsed.
  const { id: visitorId, setCookie } = resolveVisitor(request, dealerConfig.chat.journey);

  // Parse + validate BEFORE spending a rate-limit slot.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withCookie(json({ error: 'Invalid request.' }, 400), setCookie);
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const email = typeof b.email === 'string' ? b.email.trim() : '';
  if (!isValidEmail(email)) {
    return withCookie(json({ error: copy.invalidEmailMessage }, 200), setCookie);
  }

  const query = typeof b.query === 'string' ? b.query.trim().slice(0, MAX_QUERY_LENGTH) : '';
  if (!query) {
    return withCookie(json({ error: copy.errorMessage }, 200), setCookie);
  }

  const label =
    typeof b.label === 'string' && b.label.trim()
      ? b.label.trim().slice(0, MAX_LABEL_LENGTH)
      : null;

  // Per-IP rate limit (KV). DISTINCT `savedsearch:` prefix so it never shares
  // another endpoint's counter. Guard when unbound; fail OPEN so a KV hiccup
  // never blocks a genuine save.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.RATE_LIMIT_KV) {
    try {
      const rl = await checkRateLimit(env.RATE_LIMIT_KV, ip, cfg.rateLimit, 'savedsearch:');
      if (!rl.allowed) {
        return withCookie(
          json({ error: copy.rateLimitMessage }, 429, {
            'Retry-After': String(rl.retryAfterSeconds),
          }),
          setCookie,
        );
      }
    } catch (err) {
      console.error('[saved-search] rate limit check failed (allowing request)', err);
    }
  }

  // Persist — fully fail-open (void, never throws). A missing db/table or a null
  // visitorId (journey disabled) is a silent no-op; the shopper still gets a
  // confirmation so the experience never leaks an internal failure.
  await saveSearch(env.CHAT_DB, { visitorId, email, query, label });

  // Confirmation email (best-effort, never blocks the response). Stub activation:
  // auto-stub until a real key is added, or whenever STUB_EMAIL is truthy.
  const useStub = !env.RESEND_API_KEY || truthy(env.STUB_EMAIL);
  try {
    const msg: EmailMessage = {
      to: email,
      subject: copy.emailSubject,
      text: label ? `${copy.emailIntro}\n\nYour search: ${label}` : copy.emailIntro,
    };
    if (useStub) {
      await sendEmail(msg);
    } else {
      // TODO_KEYS: Email — RESEND_API_KEY (or provider) — set in .dev.vars / wrangler secret
      // Real integration goes here: authenticated HTTP call to the email provider
      // (e.g. Resend), returning its message id. Unreachable while stubbed.
      throw new Error('Live email sending not implemented — set STUB_EMAIL or add RESEND_API_KEY.');
    }
  } catch (err) {
    // Email is best-effort — a send failure never fails the save. Swallow.
    console.error('[saved-search] confirmation email failed (ignored)', err);
  }

  return withCookie(json({ ok: true, message: copy.successMessage }, 200), setCookie);
};
