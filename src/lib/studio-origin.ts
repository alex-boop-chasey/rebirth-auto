/**
 * Origin gate for the dealer-facing Studio API endpoints (generate-description,
 * carsales-upload, and any future Studio-only action).
 *
 * The embedded Sanity Studio (studioBasePath `/studio`) lives inside the SAME
 * Astro app as these endpoints, so its POSTs are inherently SAME-ORIGIN with the
 * request — whatever origin the site is actually served on. A request is allowed
 * when EITHER:
 *   1. `origin` is in the explicit cross-origin allowlist
 *      (`dealerConfig.ai.studioOrigins`, config-as-data — no host literals here), OR
 *   2. `origin` is same-origin with the request itself: its protocol + host
 *      (host includes port) equals that of `new URL(request.url)`. Behind
 *      Cloudflare / `astro dev`, `request.url` is the public URL, so this holds
 *      for a genuine deploy on any domain.
 *
 * A missing `Origin` header is NOT this function's concern — callers must reject
 * a null/empty origin BEFORE calling (browsers always send Origin on a
 * cross-* fetch, including the Studio's same-origin POST).
 */

/** Normalised `protocol//host` of a URL string, or null if unparseable. */
function protocolHost(url: string): string | null {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/**
 * True when `origin` may call a Studio endpoint: same-origin with `request`, or
 * present in the configured cross-origin `allowlist`. Assumes `origin` is a
 * non-empty string — callers reject the null-origin case themselves.
 */
export function isAllowedStudioOrigin(
  request: Request,
  origin: string,
  allowlist: readonly string[],
): boolean {
  if (allowlist.includes(origin)) return true;
  const requestOrigin = protocolHost(request.url);
  const callerOrigin = protocolHost(origin);
  return requestOrigin !== null && callerOrigin !== null && requestOrigin === callerOrigin;
}
