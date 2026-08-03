/**
 * Trade-in valuation endpoint — "what's my car worth?" (stubbed Redbook).
 *
 * POST { make, model, year, odometerKm, condition } → { valuation } on success,
 * or { error } (HTTP 200) on any expected failure. Never a 500 for an expected
 * condition — mirrors the /api/search + /api/generate-description discipline:
 * feature flag → cheap body validation → per-IP KV rate limit (fail OPEN,
 * DISTINCT `tradein:` prefix) → graceful degradation.
 *
 * Stub activation (shared stub convention): the stub is active when the real
 * credential is absent OR the STUB_REDBOOK flag is truthy —
 *   useStub = !env.REDBOOK_API_KEY || truthy(env.STUB_REDBOOK)
 * so it auto-stubs until a real key is added (no code change to go live). The
 * real branch is a drop-in marker + throw (never reached while stubbed).
 *
 * Env is read directly from `cloudflare:workers` here (mirroring
 * src/chatbot/get-env.ts, with the import.meta.env fallback for non-CF local
 * runs) — get-env.ts is left untouched by convention; REDBOOK_* aren't part of
 * the chatbot's ChatEnv.
 */
import type { APIRoute } from 'astro';
import { env as cfEnv } from 'cloudflare:workers';
import { dealerConfig } from '~/config/dealer';
import { checkRateLimit } from '~/lib/rate-limit';
import type { KVNamespaceLike } from '~/chatbot/core';
import {
  getTradeInValuation,
  type TradeInInput,
  type TradeInValuation,
} from '~/stubs/redbook';

export const prerender = false; // dynamic route, not pre-rendered

const json = (body: unknown, status = 200, headers?: Record<string, string>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

/** Env this route needs — read straight from the worker env with a local fallback. */
function getTradeInEnv(): {
  REDBOOK_API_KEY: string | undefined;
  STUB_REDBOOK: unknown;
  RATE_LIMIT_KV: KVNamespaceLike | undefined;
} {
  const e = cfEnv as unknown as Record<string, unknown>;
  return {
    REDBOOK_API_KEY:
      (e.REDBOOK_API_KEY as string | undefined) ?? import.meta.env.REDBOOK_API_KEY,
    STUB_REDBOOK: e.STUB_REDBOOK ?? import.meta.env.STUB_REDBOOK,
    RATE_LIMIT_KV: e.RATE_LIMIT_KV as KVNamespaceLike | undefined,
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

const CONDITIONS: readonly TradeInInput['condition'][] = ['excellent', 'good', 'fair', 'poor'];

// Sanity bounds on the numeric inputs — reject nonsense before any work.
const MIN_YEAR = 1950;
const MAX_ODOMETER_KM = 1_000_000;

export const POST: APIRoute = async ({ request }) => {
  const cfg = dealerConfig.tradeIn;

  // Feature flag — a dealer can hide the trade-in tool without a deploy.
  if (!cfg.enabled) return json({ error: 'Trade-in valuation is not available.' }, 404);

  const env = getTradeInEnv();

  // Parse + validate BEFORE spending a rate-limit slot.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const make = typeof b.make === 'string' ? b.make.trim() : '';
  const model = typeof b.model === 'string' ? b.model.trim() : '';
  if (!make) return json({ error: 'Please enter the vehicle make.' }, 400);
  if (!model) return json({ error: 'Please enter the vehicle model.' }, 400);

  // Request-time clock lives HERE (a handler runs per request) — never at module
  // top-level — so the stub stays deterministic and SSR-safe.
  const currentYear = new Date().getFullYear();

  const year = Number(b.year);
  if (!Number.isInteger(year) || year < MIN_YEAR || year > currentYear + 1) {
    return json({ error: `Please enter a valid year (${MIN_YEAR}–${currentYear + 1}).` }, 400);
  }

  const odometerKm = Number(b.odometerKm);
  if (!Number.isFinite(odometerKm) || odometerKm < 0 || odometerKm > MAX_ODOMETER_KM) {
    return json({ error: 'Please enter a valid odometer reading in kilometres.' }, 400);
  }

  const condition = b.condition as TradeInInput['condition'];
  if (!CONDITIONS.includes(condition)) {
    return json({ error: 'Please choose a vehicle condition.' }, 400);
  }

  // Per-IP rate limit (KV). DISTINCT `tradein:` prefix so it never shares another
  // endpoint's counter. Guard when unbound; fail OPEN so a KV hiccup never blocks.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.RATE_LIMIT_KV) {
    try {
      const rl = await checkRateLimit(env.RATE_LIMIT_KV, ip, cfg.rateLimit, 'tradein:');
      if (!rl.allowed) {
        return json({ error: 'Valuation limit reached — please try again later.' }, 429, {
          'Retry-After': String(rl.retryAfterSeconds),
        });
      }
    } catch (err) {
      console.error('[trade-in] rate limit check failed (allowing request)', err);
    }
  }

  const input: TradeInInput = { make, model, year, odometerKm, condition };
  const currency = dealerConfig.locale.currency;

  // Stub activation (shared convention): auto-stub until a real key is added, or
  // whenever STUB_REDBOOK is truthy.
  const useStub = !env.REDBOOK_API_KEY || truthy(env.STUB_REDBOOK);

  try {
    let valuation: TradeInValuation;
    if (useStub) {
      valuation = await getTradeInValuation(input, currency, currentYear);
    } else {
      // TODO_KEYS: Redbook — REDBOOK_API_KEY (Redbook/NEVDIS valuation) — set in .dev.vars / wrangler secret
      // Real integration goes here: authenticated HTTP call to the Redbook
      // valuation API, mapping its response onto TradeInValuation with
      // confidence: 'live'. Unreachable while stubbed.
      throw new Error('Live Redbook valuation not implemented — set STUB_REDBOOK or add REDBOOK_API_KEY.');
    }
    return json({ valuation }, 200);
  } catch (err) {
    // Graceful 200 — an expected failure never surfaces as a 500 to the shopper.
    console.error('[trade-in] valuation failed', err);
    return json({ error: 'We could not estimate a value right now — please try again.' }, 200);
  }
};
