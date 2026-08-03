/**
 * Rebirth Auto — Journey beacon API route (Astro wrapper)
 * ------------------------------------------------------------------
 * THIN wrapper only. All logic lives in the portable handler at
 * `~/chatbot/journey.ts`. Env is loaded via `~/chatbot/get-env.ts` (the shared
 * `cloudflare:workers` reader). The client fires this via navigator.sendBeacon /
 * keepalive fetch on listing + compare views; it always returns 204 and is fully
 * fail-open (no D1, no table, or any error → still a clean 204).
 */

import type { APIRoute } from 'astro';
import { handleJourneyBeacon } from '~/chatbot/journey';
import { getChatEnv } from '~/chatbot/get-env';

export const prerender = false; // CRITICAL: dynamic route, not pre-rendered

export const POST: APIRoute = async ({ request }) => {
  const env = getChatEnv();
  return handleJourneyBeacon(request, env);
};
