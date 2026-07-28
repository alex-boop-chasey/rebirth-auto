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
 */
import { defineMiddleware } from 'astro:middleware';
import { getSupabase } from './lib/supabase';
import { dealerConfig } from './config/dealer';

export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = context.url.pathname;

  const isProtected = pathname === '/account' || pathname.startsWith('/account/');
  const isAuthRoute =
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/signup' ||
    pathname.startsWith('/signup/');

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
      return context.redirect('/login', 302);
    }

    if (isAuthRoute && user) {
      return context.redirect('/account', 302);
    }

    // Pass the user to locals so pages don't have to call Supabase again.
    context.locals.user = user;
  }

  return next();
});
