/**
 * Book-a-service endpoint — "request a service booking" (stubbed notify).
 *
 * POST { name, email, phone?, vehicle, serviceType, preferredDate?, notes? } →
 * { ok } on success, or { error } (HTTP 200) on any expected failure. Never a 500
 * for an expected condition — mirrors the /api/saved-search + /api/trade-in
 * discipline: feature flag → cheap body validation → per-IP KV rate limit (fail
 * OPEN, DISTINCT `service:` prefix) → fail-open D1 persist → stubbed confirmation
 * (shopper) + notification (dealer) → graceful degradation.
 *
 * DETERMINISM: this is a booking REQUEST, not a confirmed appointment. The route
 * reserves no slot and invents no availability — it captures the request and both
 * emails say the team will confirm a time. `serviceType` is validated against the
 * dealer's CONFIGURED list (config as data), never a hardcoded set.
 *
 * Visitor identity reuses the journey's `resolveVisitor` (opaque UUID cookie, no
 * PII); the cookie is attached to the response when freshly minted.
 *
 * Notifications are STUBBED (src/stubs/email.ts). Stub activation (shared stub
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
import { saveBooking, isValidEmail } from '~/lib/service-booking';
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
function getBookServiceEnv(): {
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
const MAX_NAME_LENGTH = 120;
const MAX_VEHICLE_LENGTH = 160;
const MAX_PREFERRED_DATE_LENGTH = 80;
const MAX_NOTES_LENGTH = 1000;

export const POST: APIRoute = async ({ request }) => {
  const cfg = dealerConfig.service;
  const copy = cfg.copy;

  // Feature flag — a dealer can hide the booking tool without a deploy.
  if (!cfg.enabled) return json({ error: 'Service booking is not available.' }, 404);

  const env = getBookServiceEnv();

  // Resolve the visitor id (mints the opaque cookie if needed). Reuses the
  // journey identity so a request is tied to the same anonymous id. Fail-open →
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

  const name = typeof b.name === 'string' ? b.name.trim().slice(0, MAX_NAME_LENGTH) : '';
  const email = typeof b.email === 'string' ? b.email.trim() : '';
  const vehicle = typeof b.vehicle === 'string' ? b.vehicle.trim().slice(0, MAX_VEHICLE_LENGTH) : '';
  const serviceType = typeof b.serviceType === 'string' ? b.serviceType.trim() : '';

  // serviceType MUST be one of the dealer's CONFIGURED types (config as data) —
  // never a hardcoded set. An off-list value is rejected like any invalid field.
  const serviceTypeOk = cfg.serviceTypes.includes(serviceType);

  if (!name || !isValidEmail(email) || !vehicle || !serviceTypeOk) {
    return withCookie(json({ error: copy.invalidMessage }, 200), setCookie);
  }

  const phone =
    typeof b.phone === 'string' && b.phone.trim() ? b.phone.trim().slice(0, 40) : null;
  const preferredDate =
    typeof b.preferredDate === 'string' && b.preferredDate.trim()
      ? b.preferredDate.trim().slice(0, MAX_PREFERRED_DATE_LENGTH)
      : null;
  const notes =
    typeof b.notes === 'string' && b.notes.trim()
      ? b.notes.trim().slice(0, MAX_NOTES_LENGTH)
      : null;

  // Per-IP rate limit (KV). DISTINCT `service:` prefix so it never shares another
  // endpoint's counter. Guard when unbound; fail OPEN so a KV hiccup never blocks
  // a genuine request.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.RATE_LIMIT_KV) {
    try {
      const rl = await checkRateLimit(env.RATE_LIMIT_KV, ip, cfg.rateLimit, 'service:');
      if (!rl.allowed) {
        return withCookie(
          json({ error: copy.rateLimitMessage }, 429, {
            'Retry-After': String(rl.retryAfterSeconds),
          }),
          setCookie,
        );
      }
    } catch (err) {
      console.error('[book-service] rate limit check failed (allowing request)', err);
    }
  }

  // Persist — fully fail-open (void, never throws). A missing db/table or a null
  // visitorId (journey disabled) is a silent no-op; the shopper still gets a
  // confirmation so the experience never leaks an internal failure.
  await saveBooking(env.CHAT_DB, {
    visitorId,
    name,
    email,
    phone,
    vehicle,
    serviceType,
    preferredDate,
    notes,
  });

  // Stub activation (shared convention): auto-stub until a real key is added, or
  // whenever STUB_EMAIL is truthy.
  const useStub = !env.RESEND_API_KEY || truthy(env.STUB_EMAIL);

  // Build a plain-text summary of the request (shared by both notifications).
  const summaryLines = [
    `Name: ${name}`,
    `Email: ${email}`,
    phone ? `Phone: ${phone}` : null,
    `Vehicle: ${vehicle}`,
    `Service: ${serviceType}`,
    preferredDate ? `Preferred date: ${preferredDate}` : null,
    notes ? `Notes: ${notes}` : null,
  ].filter(Boolean);
  const summary = summaryLines.join('\n');

  // Shopper confirmation (best-effort, never blocks the response). The copy
  // frames this as a REQUEST the team will confirm — it asserts no booked slot.
  try {
    const shopperMsg: EmailMessage = {
      to: email,
      subject: copy.emailSubject,
      text: `${copy.emailIntro}\n\nYour request:\n${summary}`,
    };
    if (useStub) {
      await sendEmail(shopperMsg);
    } else {
      // TODO_KEYS: Email — RESEND_API_KEY (or provider) — set in .dev.vars / wrangler secret
      // Real integration goes here: authenticated HTTP call to the email provider
      // (e.g. Resend), returning its message id. Unreachable while stubbed.
      throw new Error('Live email sending not implemented — set STUB_EMAIL or add RESEND_API_KEY.');
    }
  } catch (err) {
    // Email is best-effort — a send failure never fails the request. Swallow.
    console.error('[book-service] shopper confirmation email failed (ignored)', err);
  }

  // Dealer notification to the CONFIGURED service-desk address (own try/catch so
  // it never affects the shopper response). Best-effort, same stub gate.
  try {
    const dealerMsg: EmailMessage = {
      to: cfg.notifyEmail,
      subject: copy.dealerEmailSubject,
      text: `A new service booking request has come in:\n\n${summary}`,
    };
    if (useStub) {
      await sendEmail(dealerMsg);
    } else {
      // TODO_KEYS: Email — RESEND_API_KEY (or provider) — set in .dev.vars / wrangler secret
      // Real integration goes here: authenticated HTTP call to the email provider.
      // Unreachable while stubbed.
      throw new Error('Live email sending not implemented — set STUB_EMAIL or add RESEND_API_KEY.');
    }
  } catch (err) {
    console.error('[book-service] dealer notification email failed (ignored)', err);
  }

  return withCookie(json({ ok: true, message: copy.successMessage }, 200), setCookie);
};
