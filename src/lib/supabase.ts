/**
 * Supabase SSR cookie client for the Cloudflare Worker runtime.
 * ---------------------------------------------------------------------------
 * Ported from the astro-users-demo reference. `getSupabase(request, cookies)`
 * returns a request-scoped server client that reads/writes the auth cookies via
 * Astro's cookie API, so the session survives across SSR requests.
 *
 * The URL + anon key are PUBLIC_ vars — Vite inlines them via `import.meta.env`
 * at build time, which works on the Worker (unlike the server-secret Turnstile
 * key, which must be read from the Worker runtime — see src/actions/index.ts).
 */
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { AstroCookies } from 'astro';

export function getSupabase(request: Request, cookies: AstroCookies) {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables: PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY',
    );
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
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
