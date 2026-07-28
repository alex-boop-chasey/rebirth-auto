/**
 * Auth middleware — real Supabase session guard, ported from astro-users-demo.
 * ---------------------------------------------------------------------------
 * Deliberately scoped to ONLY the auth surface (/account, /login, /signup) so it
 * never runs on the shopper site, the embedded Studio, API routes, or static
 * assets. It:
 *   - redirects unauthenticated visitors away from /account → /login
 *   - bounces already-authenticated visitors off /login and /signup → /account
 *   - stashes the resolved user on `context.locals.user` so pages don't re-fetch
 *
 * The whole auth surface is also gated by the `accounts.enabled` feature flag —
 * see each page's frontmatter (redirect home when disabled). The flag stays the
 * single on/off seam for the feature.
 *
 * It ALSO applies a small set of site-wide, non-breaking security response
 * headers to every response (the top gap flagged in docs/cloudflare-security.md).
 * Deliberately conservative: nosniff + Referrer-Policy + X-Frame-Options
 * (SAMEORIGIN, anti-clickjacking; same-origin embeds still allowed). NOT set
 * here: Permissions-Policy (would disable the chatbot microphone / capture-PWA
 * camera) and a Content-Security-Policy (needs per-source allow-listing for
 * Turnstile, Supabase, OpenRouter and Sanity Studio) — both are documented
 * follow-ups in docs/cloudflare-security.md, not safe to add blindly.
 */
import { defineMiddleware } from 'astro:middleware';
import { getSupabase } from './lib/supabase';
import { dealerConfig } from './config/dealer';

/** Site-wide, non-breaking security headers. Applied to every response. */
function applySecurityHeaders(headers: Headers): void {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // SAMEORIGIN, not DENY — the embedded Sanity Studio may frame same-origin.
  headers.set('X-Frame-Options', 'SAMEORIGIN');
}

export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = context.url.pathname;

  const isProtected = pathname === '/account' || pathname.startsWith('/account/');
  const isAuthRoute =
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/signup' ||
    pathname.startsWith('/signup/');

  // Resolve the response for every path (auth surface gets guarded first; all
  // other paths pass straight through), THEN stamp the security headers on it —
  // redirects included — before returning.
  let response: Response;

  // Only authenticate for the auth surface — skip everything else (shopper
  // pages, /studio, /api, assets) so there is zero auth overhead off-surface.
  // When the feature flag is off, do nothing here: each page's own
  // accounts.enabled guard redirects home, keeping the flag the single seam.
  if (dealerConfig.accounts.enabled && (isProtected || isAuthRoute)) {
    const supabase = getSupabase(context.request, context.cookies);

    // Securely resolve the user from the Supabase session. If the access token
    // is expired this auto-refreshes it via the refresh token and syncs cookies.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (isProtected && !user) {
      response = context.redirect('/login', 302);
    } else if (isAuthRoute && user) {
      response = context.redirect('/account', 302);
    } else {
      // Pass the user to locals so pages don't have to call Supabase again.
      context.locals.user = user;
      response = await next();
    }
  } else {
    response = await next();
  }

  applySecurityHeaders(response.headers);
  return response;
});
