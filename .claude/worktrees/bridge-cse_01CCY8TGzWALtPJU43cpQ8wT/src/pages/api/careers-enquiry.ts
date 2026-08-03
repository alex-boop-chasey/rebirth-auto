/**
 * Careers register-interest endpoint — people/HR lead intake (stubbed ATS).
 *
 * POST { name, email, phone?, roleId?, message } → { ok, reference } on success,
 * or { error } (HTTP 200) on any expected failure. Never a 500 for an expected
 * condition — mirrors the /api/sell-enquiry discipline: feature flag → cheap body
 * validation → per-IP KV rate limit (fail OPEN, DISTINCT `careers:` prefix) →
 * optional fail-open Turnstile gate → stubbed lead submission → graceful
 * degradation.
 *
 * DETERMINISM: this is an EXPRESSION OF INTEREST, not a job application or offer.
 * It captures a lead only and asserts no role exists. `roleId` is accepted only as
 * a hint and is NOT validated against config (a role may be delisted between page
 * render and submit) — nothing dealer-specific is hardcoded (copy + notify address
 * come from `dealerConfig.careers`).
 *
 * Stub activation (shared stub convention): active when the real credential is
 * absent OR STUB_CAREERS is truthy —
 *   useStub = !env.CAREERS_API_KEY || truthy(env.STUB_CAREERS)
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
  submitCareersEnquiry,
  type CareersEnquiryInput,
  type CareersEnquiryResult,
} from '~/stubs/careers-enquiry';
import { isValidEmail } from '~/lib/service-booking';

export const prerender = false; // dynamic route, not pre-rendered

const json = (body: unknown, status = 200, headers?: Record<string, string>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

/** Env this route needs — read straight from the worker env with a local fallback. */
function getCareersEnv(): {
  CAREERS_API_KEY: string | undefined;
  STUB_CAREERS: unknown;
  RATE_LIMIT_KV: KVNamespaceLike | undefined;
  TURNSTILE_SECRET: string | undefined;
} {
  const e = cfEnv as unknown as Record<string, unknown>;
  return {
    CAREERS_API_KEY:
      (e.CAREERS_API_KEY as string | undefined) ?? import.meta.env.CAREERS_API_KEY,
    STUB_CAREERS: e.STUB_CAREERS ?? import.meta.env.STUB_CAREERS,
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
 * the chatbot gate: only enforced when a secret is configured AND a token is
 * present AND the request is not localhost. Absent any of those, the check is
 * SKIPPED so a demo (no keys) is never blocked. Returns true when the request may
 * proceed.
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
    console.error('[careers-enquiry] Turnstile verification failed (allowing request)', err);
    return true;
  }
}

const MAX_NAME_LENGTH = 120;
const MAX_ROLE_ID_LENGTH = 80;
const MAX_MESSAGE_LENGTH = 2000;

export const POST: APIRoute = async ({ request }) => {
  const cfg = dealerConfig.careers;
  const copy = cfg.copy;

  // Feature flag — a dealer can hide the careers form without a deploy.
  if (!cfg.enabled) return json({ error: 'Careers enquiries are not available.' }, 404);

  const env = getCareersEnv();

  // Parse + validate BEFORE spending a rate-limit slot.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const name = typeof b.name === 'string' ? b.name.trim().slice(0, MAX_NAME_LENGTH) : '';
  const email = typeof b.email === 'string' ? b.email.trim() : '';
  const message =
    typeof b.message === 'string' ? b.message.trim().slice(0, MAX_MESSAGE_LENGTH) : '';

  if (!name || !isValidEmail(email) || !message) {
    return json({ error: copy.invalidMessage }, 200);
  }

  const phone =
    typeof b.phone === 'string' && b.phone.trim() ? b.phone.trim().slice(0, 40) : null;
  const roleId =
    typeof b.roleId === 'string' && b.roleId.trim()
      ? b.roleId.trim().slice(0, MAX_ROLE_ID_LENGTH)
      : null;
  const turnstileToken = typeof b.turnstileToken === 'string' ? b.turnstileToken : '';

  // Per-IP rate limit (KV). DISTINCT `careers:` prefix so it never shares another
  // endpoint's counter. Guard when unbound; fail OPEN so a KV hiccup never blocks.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.RATE_LIMIT_KV) {
    try {
      const rl = await checkRateLimit(env.RATE_LIMIT_KV, ip, cfg.rateLimit, 'careers:');
      if (!rl.allowed) {
        return json({ error: copy.rateLimitMessage }, 429, {
          'Retry-After': String(rl.retryAfterSeconds),
        });
      }
    } catch (err) {
      console.error('[careers-enquiry] rate limit check failed (allowing request)', err);
    }
  }

  // Optional bot protection (fail-open / skipped on localhost + when unconfigured).
  const host = new URL(request.url).host;
  if (!(await turnstileOk(env.TURNSTILE_SECRET, turnstileToken, host, ip))) {
    return json({ error: copy.errorMessage }, 200);
  }

  const input: CareersEnquiryInput = { name, email, phone, roleId, message };

  // Stub activation (shared convention): auto-stub until a real key is added, or
  // whenever STUB_CAREERS is truthy.
  const useStub = !env.CAREERS_API_KEY || truthy(env.STUB_CAREERS);

  try {
    let result: CareersEnquiryResult;
    if (useStub) {
      result = await submitCareersEnquiry(input);
    } else {
      // TODO_KEYS: Careers enquiry — CAREERS_API_KEY (dealer lead/ATS API) — set in .dev.vars / wrangler secret
      // Real integration goes here: authenticated HTTP call to the dealer's
      // lead/ATS system, mapping its response onto CareersEnquiryResult with
      // confidence: 'live'. Unreachable while stubbed.
      throw new Error('Live careers-enquiry submission not implemented — set STUB_CAREERS or add CAREERS_API_KEY.');
    }
    return json({ ok: true, message: copy.successMessage, reference: result.reference }, 200);
  } catch (err) {
    // Graceful 200 — an expected failure never surfaces as a 500 to the shopper.
    console.error('[careers-enquiry] submission failed', err);
    return json({ error: copy.errorMessage }, 200);
  }
};
