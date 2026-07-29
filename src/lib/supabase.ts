/**
 * Supabase SSR cookie client for the Cloudflare Worker runtime.
 * ---------------------------------------------------------------------------
 * Ported from the astro-users-demo reference. `getSupabase(request, cookies)`
 * returns a request-scoped server client that reads/writes the auth cookies via
 * Astro's cookie API, so the session survives across SSR requests.
 *
 * The URL is a PUBLIC_ build-time var — Vite inlines it via `import.meta.env`.
 * The publishable key is intentionally NOT a PUBLIC_ var: it is a server-only
 * runtime var read from the Worker env via `cloudflare:workers` (populated in
 * production by the Worker runtime, and in `astro dev` by the adapter's bundled
 * @cloudflare/vite-plugin from .dev.vars). Reading it at runtime — inside the
 * function, never at module load — keeps it out of the client bundle entirely.
 */
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { env as cfEnv } from 'cloudflare:workers';
import type { AstroCookies } from 'astro';

export function getSupabase(request: Request, cookies: AstroCookies) {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = (cfEnv as unknown as Record<string, unknown>)
    .SUPABASE_PUBLISHABLE_KEY as string | undefined;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      'Missing Supabase environment variables: PUBLIC_SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY',
    );
  }

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get('Cookie') ?? '') as {
          name: string;
          value: string;
        }[];
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookies.set(name, value, options);
          });
        } catch {
          // Safe to ignore in SSR rendering environments if cookies are already sent.
        }
      },
    },
  });
}
