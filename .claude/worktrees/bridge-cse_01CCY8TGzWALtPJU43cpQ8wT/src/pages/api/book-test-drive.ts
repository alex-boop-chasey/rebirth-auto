/**
 * Book-a-test-drive endpoint — test-drive booking REQUEST (stubbed booking API).
 *
 * POST { name, contact, vehicleSlug?, vehicleLabel?, preferredDate, preferredTime?, notes? } →
 * { ok, reference } on success, or { error } (HTTP 200) on any expected failure.
 * Never a 500 for an expected condition — mirrors the /api/book-service +
 * /api/trade-in discipline: feature flag → cheap body validation → per-IP KV rate
 * limit (fail OPEN, DISTINCT `testdrive:` prefix) → optional fail-open Turnstile
 * gate → stubbed booking submission → graceful degradation.
 *
 * DETERMINISM: this is a booking REQUEST, not a confirmed slot. The route reserves
 * no time and invents no availability — it captures the request; the copy says the
 * team will confirm by phone. Nothing dealer-specific is hardcoded here (copy +
 * notify address come from `dealerConfig.testDrive`). The chosen vehicle is passed
 * through as an opaque slug/label; the endpoint asserts no price or status about it.
 *
 * Stub activation (shared stub convention): active when the real credential is
 * absent OR STUB_TEST_DRIVE is truthy —
 *   useStub = !env.BOOKING_API_KEY || truthy(env.STUB_TEST_DRIVE)
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
import type { KVNamespaceLike } from '~/chatbot/core';
import {
  submitTestDriveBooking,
  type TestDriveBookingInput,
  type TestDriveBookingResult,
} from '~/stubs/test-drive';

export const prerender = false; // dynamic route, not pre-rendered

const json = (body: unknown, status = 200, headers?: Record<string, string>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

/** Env this route needs — read straight from the worker env with a local fallback. */
function getBookTestDriveEnv(): {
  BOOKING_API_KEY: string | undefined;
  STUB_TEST_DRIVE: unknown;
  RATE_LIMIT_KV: KVNamespaceLike | undefined;
  TURNSTILE_SECRET: string | undefined;
} {
  const e = cfEnv as unknown as Record<string, unknown>;
  return {
    BOOKING_API_KEY: (e.BOOKING_API_KEY as string | undefined) ?? import.meta.env.BOOKING_API_KEY,
    STUB_TEST_DRIVE: e.STUB_TEST_DRIVE ?? import.meta.env.STUB_TEST_DRIVE,
    RATE_LIMIT_KV: e.RATE_LIMIT_KV as KVNamespaceLike | undefined,
    TURNSTILE_SECRET:
      (e.SECRET_USER_TURNSTILE_KEY as string | undefined) ??
      import.meta.env.SECRET_USER_TURNSTILE_KEY,
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

/**
 * Cloudflare Turnstile server-side verification — OPTIONAL and fail-open, matching
 * the chatbot gate (src/chatbot/core.ts): only enforced when a secret is
 * configured AND a token is present AND the request is not localhost. Absent any
 * of those, the check is SKIPPED so a demo (no keys) is never blocked. Returns
 * true when the request may proceed.
 */
async function turnstileOk(
  secret: string | undefined,
  token: string,
  host: string,
  ip: string,
): Promise<boolean> {
  const isLocalhost = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host);
  if (!secret || !token || isLocalhost) return true; // fail-open / skip
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error('[book-test-drive] Turnstile verification failed (allowing request)', err);
    return true;
  }
}

const MAX_NAME_LENGTH = 120;
const MAX_CONTACT_LENGTH = 120;
const MAX_TEXT_LENGTH = 80;
const MAX_SLUG_LENGTH = 200;
const MAX_LABEL_LENGTH = 160;
const MAX_NOTES_LENGTH = 1000;

export const POST: APIRoute = async ({ request }) => {
  const cfg = dealerConfig.testDrive;
  const copy = cfg.copy;

  // Feature flag — a dealer can hide the test-drive tool without a deploy.
  if (!cfg.enabled) return json({ error: 'Test-drive booking is not available.' }, 404);

  const env = getBookTestDriveEnv();

  // Parse + validate BEFORE spending a rate-limit slot.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const name = typeof b.name === 'string' ? b.name.trim().slice(0, MAX_NAME_LENGTH) : '';
  const contact = typeof b.contact === 'string' ? b.contact.trim().slice(0, MAX_CONTACT_LENGTH) : '';
  const preferredDate =
    typeof b.preferredDate === 'string' ? b.preferredDate.trim().slice(0, MAX_TEXT_LENGTH) : '';

  if (!name || !contact || !preferredDate) {
    return json({ error: copy.invalidMessage }, 200);
  }

  const vehicleSlug =
    typeof b.vehicleSlug === 'string' && b.vehicleSlug.trim()
      ? b.vehicleSlug.trim().slice(0, MAX_SLUG_LENGTH)
      : null;
  const vehicleLabel =
    typeof b.vehicleLabel === 'string' && b.vehicleLabel.trim()
      ? b.vehicleLabel.trim().slice(0, MAX_LABEL_LENGTH)
      : null;
  const preferredTime =
    typeof b.preferredTime === 'string' && b.preferredTime.trim()
      ? b.preferredTime.trim().slice(0, MAX_TEXT_LENGTH)
      : null;
  const notes =
    typeof b.notes === 'string' && b.notes.trim()
      ? b.notes.trim().slice(0, MAX_NOTES_LENGTH)
      : null;
  const turnstileToken = typeof b.turnstileToken === 'string' ? b.turnstileToken : '';

  // Per-IP rate limit (KV). DISTINCT `testdrive:` prefix so it never shares another
  // endpoint's counter. Guard when unbound; fail OPEN so a KV hiccup never blocks.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.RATE_LIMIT_KV) {
    try {
      const rl = await checkRateLimit(env.RATE_LIMIT_KV, ip, cfg.rateLimit, 'testdrive:');
      if (!rl.allowed) {
        return json({ error: copy.rateLimitMessage }, 429, {
          'Retry-After': String(rl.retryAfterSeconds),
        });
      }
    } catch (err) {
      console.error('[book-test-drive] rate limit check failed (allowing request)', err);
    }
  }

  // Optional bot protection (fail-open / skipped on localhost + when unconfigured).
  const host = new URL(request.url).host;
  if (!(await turnstileOk(env.TURNSTILE_SECRET, turnstileToken, host, ip))) {
    return json({ error: copy.errorMessage }, 200);
  }

  const input: TestDriveBookingInput = {
    name,
    contact,
    vehicleSlug,
    vehicleLabel,
    preferredDate,
    preferredTime,
    notes,
  };

  // Stub activation (shared convention): auto-stub until a real key is added, or
  // whenever STUB_TEST_DRIVE is truthy.
  const useStub = !env.BOOKING_API_KEY || truthy(env.STUB_TEST_DRIVE);

  try {
    let result: TestDriveBookingResult;
    if (useStub) {
      result = await submitTestDriveBooking(input);
    } else {
      // TODO_KEYS: Test-drive booking — BOOKING_API_KEY (dealer booking/calendar API) — set in .dev.vars / wrangler secret
      // Real integration goes here: authenticated HTTP call to the dealer's
      // booking/calendar system, mapping its response onto TestDriveBookingResult
      // with confidence: 'live'. Unreachable while stubbed.
      throw new Error('Live test-drive booking not implemented — set STUB_TEST_DRIVE or add BOOKING_API_KEY.');
    }
    return json({ ok: true, message: copy.successMessage, reference: result.reference }, 200);
  } catch (err) {
    // Graceful 200 — an expected failure never surfaces as a 500 to the shopper.
    console.error('[book-test-drive] submission failed', err);
    return json({ error: copy.errorMessage }, 200);
  }
};
