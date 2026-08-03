/**
 * Shared HTTP guards for the /api/capture/* endpoints.
 *
 * Every capture endpoint runs the same discipline (mirrors /api/generate-description
 * and /api/trade-in): feature flag → origin allowlist → per-IP KV rate limit
 * (fail OPEN, DISTINCT `capture:` prefix) → graceful degradation. Kept in one
 * place so the three routes can't drift.
 */
import { dealerConfig } from '~/config/dealer';
import { checkRateLimit } from '~/lib/rate-limit';
import { getCaptureEnv, type CaptureEnv } from './env';

export const json = (body: unknown, status = 200, headers?: Record<string, string>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

/**
 * Run the shared guard chain. Returns `{ ok: true, env }` to proceed, or
 * `{ ok: false, response }` with the Response to return immediately.
 */
export async function guardCaptureRequest(
  request: Request,
): Promise<{ ok: true; env: CaptureEnv } | { ok: false; response: Response }> {
  const cfg = dealerConfig.capture;

  // Feature flag — capture is a separate, opt-in surface (DEFAULT OFF).
  if (!cfg.enabled) {
    return { ok: false, response: json({ error: 'Capture is not available.' }, 404) };
  }

  // Origin allowlist — only the dealer's own PWA origin may call these endpoints.
  const origin = request.headers.get('Origin');
  if (!origin || !cfg.allowedOrigins.includes(origin)) {
    return { ok: false, response: json({ error: 'Forbidden.' }, 403) };
  }

  const env = getCaptureEnv();

  // Per-IP rate limit (KV). DISTINCT `capture:` prefix; guard when unbound; fail
  // OPEN so a KV hiccup never blocks a dealer mid-capture.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.RATE_LIMIT_KV) {
    try {
      const rl = await checkRateLimit(env.RATE_LIMIT_KV, ip, cfg.rateLimit, 'capture:');
      if (!rl.allowed) {
        return {
          ok: false,
          response: json({ error: 'Rate limit reached — please try again shortly.' }, 429, {
            'Retry-After': String(rl.retryAfterSeconds),
          }),
        };
      }
    } catch (err) {
      console.error('[capture] rate limit check failed (allowing request)', err);
    }
  }

  return { ok: true, env };
}
