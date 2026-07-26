/**
 * Rebirth Auto — Visitor identity (PORTABLE, zero-dep)
 * ==================================================================
 * A tiny, opaque per-visitor id used only for the continuity journey. The id is
 * a random UUID stored in an HttpOnly cookie — NO PII, ever. Everything here is
 * fail-open: if the journey is disabled or a cookie can't be parsed, the caller
 * simply gets `{ id: null }` and Rebi behaves exactly as it does today.
 *
 * Framework-agnostic (standard `Request` + Web `crypto`), so it runs unchanged
 * on the Astro Cloudflare Worker and any other Fetch-API runtime — mirroring the
 * dependency-free style of core.ts / state.ts.
 * ==================================================================
 */

/**
 * The subset of `dealerConfig.chat.journey` this module reads. Declared locally
 * (structurally compatible with the config) so this file needs no config import
 * and stays portable.
 */
export interface JourneyConfig {
  enabled: boolean;
  cookieName: string;
  cookieMaxAgeSeconds: number;
  retentionSeconds: number;
  maxEventsFolded: number;
  maxLabelLength: number;
}

/**
 * True when the request's Host is a local dev origin. Mirrors the localhost
 * detection in core.ts so a cookie minted in `astro dev` (plain HTTP) omits the
 * `Secure` attribute and therefore actually sticks.
 */
function isLocalhostHost(request: Request): boolean {
  const host = request.headers.get('host') || '';
  return /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host);
}

/**
 * Parse the visitor id out of the request's Cookie header, or `null` when the
 * cookie is absent/unparseable. Never throws.
 */
export function readVisitorId(request: Request, cfg: JourneyConfig): string | null {
  try {
    const header = request.headers.get('cookie');
    if (!header) return null;
    const name = cfg.cookieName;
    for (const part of header.split(';')) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      const key = part.slice(0, eq).trim();
      if (key === name) {
        const value = part.slice(eq + 1).trim();
        return value || null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve the visitor id for this request. If a cookie is present, return its id
 * (no Set-Cookie needed). If absent AND the journey is enabled, mint a fresh
 * opaque UUID and return a `Set-Cookie` string the caller MUST attach to every
 * outgoing Response. When the journey is disabled, returns `{ id: null }` and
 * mints nothing. Never throws (fail-open → `{ id: null }`).
 */
export function resolveVisitor(
  request: Request,
  cfg: JourneyConfig,
): { id: string | null; setCookie?: string } {
  try {
    if (!cfg.enabled) return { id: null };

    const existing = readVisitorId(request, cfg);
    if (existing) return { id: existing };

    const id = crypto.randomUUID();
    // Omit `Secure` on localhost (plain HTTP) so the cookie sticks in dev; keep
    // it everywhere else. HttpOnly + SameSite=Lax + Path=/ always.
    const secure = isLocalhostHost(request) ? '' : ' Secure;';
    const setCookie =
      `${cfg.cookieName}=${id}; HttpOnly;${secure} SameSite=Lax; Path=/; Max-Age=${cfg.cookieMaxAgeSeconds}`;
    return { id, setCookie };
  } catch {
    return { id: null };
  }
}

/**
 * Attach a `Set-Cookie` header to a Response without mutating the original
 * (Response headers are immutable once constructed for some body types, and the
 * SSE Response streams — so we clone the head and re-wrap the same body). When
 * there's no cookie to set (visitor already had one, or journey disabled), the
 * original Response is returned untouched. Never throws — on any error the
 * original Response is returned so a cookie hiccup can never break a reply.
 */
export function withCookie(resp: Response, setCookie?: string): Response {
  if (!setCookie) return resp;
  try {
    const headers = new Headers(resp.headers);
    headers.append('Set-Cookie', setCookie);
    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers,
    });
  } catch {
    return resp;
  }
}
