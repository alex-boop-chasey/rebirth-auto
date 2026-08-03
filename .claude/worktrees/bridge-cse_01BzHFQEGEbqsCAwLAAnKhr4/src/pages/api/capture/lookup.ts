/**
 * Capture — VIN/rego OEM lookup endpoint.
 *
 * POST { vinOrRego } → { oemSpec } (or { oemSpec: null } when unknown). Never a
 * 500 for an expected condition. Flag/origin-guarded, rate-limited (`capture:`).
 *
 * Stub activation (shared convention): the VIN stub is active when the real
 * credential is absent OR STUB_VIN is truthy —
 *   useStub = !env.NEVDIS_API_KEY || truthy(env.STUB_VIN)
 * so it auto-stubs until a real NEVDIS key is added (no code change to go live).
 */
import type { APIRoute } from 'astro';
import { guardCaptureRequest, json } from '~/lib/capture/http';
import { truthy } from '~/lib/capture/env';
import { getOemSpec, type OemSpec } from '~/stubs/vin-lookup';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const guard = await guardCaptureRequest(request);
  if (!guard.ok) return guard.response;
  const env = guard.env;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  const raw = (body as { vinOrRego?: unknown })?.vinOrRego;
  const vinOrRego = typeof raw === 'string' ? raw.trim() : '';
  if (!vinOrRego) return json({ error: 'Enter a VIN or registration.' }, 400);

  const useStub = !env.NEVDIS_API_KEY || truthy(env.STUB_VIN);

  try {
    let oemSpec: OemSpec | null;
    if (useStub) {
      oemSpec = await getOemSpec(vinOrRego);
    } else {
      // TODO_KEYS: VIN lookup — NEVDIS_API_KEY (NEVDIS/OEM VIN decode, ~AU$0.65/lookup) — set in .dev.vars / wrangler secret
      // Live path: authenticated HTTP call to the NEVDIS/OEM decode API, mapping
      // its factory spec + PPSR status onto OemSpec (source:'live'). Unreachable
      // while stubbed.
      throw new Error('Live VIN lookup not implemented — set STUB_VIN or add NEVDIS_API_KEY.');
    }
    return json({ oemSpec, stub: useStub }, 200);
  } catch (err) {
    console.error('[capture/lookup] lookup failed', err);
    return json({ error: 'Could not look that up right now — please try again.' }, 200);
  }
};
