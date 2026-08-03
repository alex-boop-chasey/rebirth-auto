/**
 * Sell-your-car enquiry endpoint — outright-sale valuation intake (stubbed CRM).
 *
 * POST { name, email, phone?, make, model, year, odometerKm, condition, notes? } →
 * { ok, reference } on success, or { error } (HTTP 200) on any expected failure.
 * Never a 500 for an expected condition — mirrors the /api/book-service +
 * /api/trade-in discipline: feature flag → cheap body validation → per-IP KV rate
 * limit (fail OPEN, DISTINCT `sell:` prefix) → optional fail-open Turnstile gate →
 * stubbed lead submission → graceful degradation.
 *
 * DETERMINISM: this is an ENQUIRY, not a firm offer. The route quotes no price
 * and invents no availability — it captures the lead; the copy says the buying
 * team will follow up with an indicative offer confirmed after inspection.
 * `condition` is validated against a fixed enum; nothing dealer-specific is
 * hardcoded here (copy + notify address come from `dealerConfig.sell`).
 *
 * Stub activation (shared stub convention): active when the real credential is
 * absent OR STUB_SELL is truthy —
 *   useStub = !env.SELL_CRM_API_KEY || truthy(env.STUB_SELL)
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
  submitSellEnquiry,
  type SellEnquiryInput,
  type SellEnquiryResult,
} from '~/stubs/sell-enquiry';
import { isValidEmail } from '~/lib/service-booking';

export const prerender = false; // dynamic route, not pre-rendered

const json = (body: unknown, status = 200, headers?: Record<string, string>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

/** Env this route needs — read straight from the worker env with a local fallback. */
function getSellEnv(): {
  SELL_CRM_API_KEY: string | undefined;
  STUB_SELL: unknown;
  RATE_LIMIT_KV: KVNamespaceLike | undefined;
  TURNSTILE_SECRET: string | undefined;
} {
  const e = cfEnv as unknown as Record<string, unknown>;
  return {
    SELL_CRM_API_KEY: (e.SELL_CRM_API_KEY as string | undefined) ?? import.meta.env.SELL_CRM_API_KEY,
    STUB_SELL: e.STUB_SELL ?? import.meta.env.STUB_SELL,
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
    // A verification hiccup never hard-fails a genuine request (fail-open).
    console.error('[sell-enquiry] Turnstile verification failed (allowing request)', err);
    return true;
  }
}

const CONDITIONS: readonly SellEnquiryInput['condition'][] = ['excellent', 'good', 'fair', 'poor'];

const MIN_YEAR = 1950;
const MAX_ODOMETER_KM = 1_000_000;
const MAX_NAME_LENGTH = 120;
const MAX_TEXT_LENGTH = 80;
const MAX_NOTES_LENGTH = 1000;

export const POST: APIRoute = async ({ request }) => {
  const cfg = dealerConfig.sell;
  const copy = cfg.copy;

  // Feature flag — a dealer can hide the sell tool without a deploy.
  if (!cfg.enabled) return json({ error: 'Sell enquiries are not available.' }, 404);

  const env = getSellEnv();

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
  const make = typeof b.make === 'string' ? b.make.trim().slice(0, MAX_TEXT_LENGTH) : '';
  const model = typeof b.model === 'string' ? b.model.trim().slice(0, MAX_TEXT_LENGTH) : '';

  // Request-time clock lives HERE (per request), never at module top-level.
  const currentYear = new Date().getFullYear();
  const year = Number(b.year);
  const odometerKm = Number(b.odometerKm);
  const condition = b.condition as SellEnquiryInput['condition'];

  const validYear = Number.isInteger(year) && year >= MIN_YEAR && year <= currentYear + 1;
  const validOdo = Number.isFinite(odometerKm) && odometerKm >= 0 && odometerKm <= MAX_ODOMETER_KM;

  if (
    !name ||
    !isValidEmail(email) ||
    !make ||
    !model ||
    !validYear ||
    !validOdo ||
    !CONDITIONS.includes(condition)
  ) {
    return json({ error: copy.invalidMessage }, 200);
  }

  const phone =
    typeof b.phone === 'string' && b.phone.trim() ? b.phone.trim().slice(0, 40) : null;
  const notes =
    typeof b.notes === 'string' && b.notes.trim()
      ? b.notes.trim().slice(0, MAX_NOTES_LENGTH)
      : null;
  const turnstileToken = typeof b.turnstileToken === 'string' ? b.turnstileToken : '';

  // Per-IP rate limit (KV). DISTINCT `sell:` prefix so it never shares another
  // endpoint's counter. Guard when unbound; fail OPEN so a KV hiccup never blocks.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.RATE_LIMIT_KV) {
    try {
      const rl = await checkRateLimit(env.RATE_LIMIT_KV, ip, cfg.rateLimit, 'sell:');
      if (!rl.allowed) {
        return json({ error: copy.rateLimitMessage }, 429, {
          'Retry-After': String(rl.retryAfterSeconds),
        });
      }
    } catch (err) {
      console.error('[sell-enquiry] rate limit check failed (allowing request)', err);
    }
  }

  // Optional bot protection (fail-open / skipped on localhost + when unconfigured).
  const host = new URL(request.url).host;
  if (!(await turnstileOk(env.TURNSTILE_SECRET, turnstileToken, host, ip))) {
    return json({ error: copy.errorMessage }, 200);
  }

  const input: SellEnquiryInput = { name, email, phone, make, model, year, odometerKm, condition, notes };

  // Stub activation (shared convention): auto-stub until a real key is added, or
  // whenever STUB_SELL is truthy.
  const useStub = !env.SELL_CRM_API_KEY || truthy(env.STUB_SELL);

  try {
    let result: SellEnquiryResult;
    if (useStub) {
      result = await submitSellEnquiry(input);
    } else {
      // TODO_KEYS: Sell enquiry — SELL_CRM_API_KEY (dealer lead/CRM API) — set in .dev.vars / wrangler secret
      // Real integration goes here: authenticated HTTP call to the dealer's
      // lead/CRM system, mapping its response onto SellEnquiryResult with
      // confidence: 'live'. Unreachable while stubbed.
      throw new Error('Live sell-enquiry submission not implemented — set STUB_SELL or add SELL_CRM_API_KEY.');
    }
    return json({ ok: true, message: copy.successMessage, reference: result.reference }, 200);
  } catch (err) {
    // Graceful 200 — an expected failure never surfaces as a 500 to the shopper.
    console.error('[sell-enquiry] submission failed', err);
    return json({ error: copy.errorMessage }, 200);
  }
};
