/**
 * carsales.com.au upload endpoint — Studio/dealer-only (stubbed carsales).
 *
 * POST { listingId } → { result } on success, or { error } (HTTP 200) on an
 * expected failure. Never a 500 for an expected condition — mirrors the
 * /api/generate-description + /api/trade-in discipline: feature flag → origin
 * allowlist → cheap body validation → per-IP KV rate limit (fail OPEN, DISTINCT
 * `carsales:` prefix) → PUBLISHED-only Sanity read → stub call.
 *
 * PUBLISHED / ACTIVE ONLY: the listing is read via the public, token-LESS
 * @sanity/client (src/sanity/lib/client.ts) with LISTING_FIELDS, and the query
 * additionally requires `status == "active"`. A token-less client cannot see
 * drafts, and the status guard rejects a published-but-not-active listing — a
 * draft is never syndicated. This is a DEALER action (Studio), not public, so
 * it is origin-restricted the same way generate-description.ts is.
 *
 * Stub activation (shared stub convention): active when the real credential is
 * absent OR STUB_CARSALES is truthy —
 *   useStub = !env.CARSALES_API_KEY || truthy(env.STUB_CARSALES)
 * so it auto-stubs until a real key is added (no code change to go live).
 *
 * Env is read directly from `cloudflare:workers` here (mirroring
 * src/chatbot/get-env.ts, with the import.meta.env fallback for non-CF local
 * runs) — get-env.ts is left untouched by convention; CARSALES_* aren't part of
 * the chatbot's ChatEnv.
 */
import type { APIRoute } from 'astro';
import { env as cfEnv } from 'cloudflare:workers';
import { dealerConfig } from '~/config/dealer';
import { isAllowedStudioOrigin } from '~/lib/studio-origin';
import { client } from '~/sanity/lib/client';
import { LISTING_FIELDS, type Listing } from '~/lib/listing';
import { checkRateLimit } from '~/lib/rate-limit';
import type { KVNamespaceLike } from '~/chatbot/core';
import {
  uploadToCarsales,
  type CarsalesListingInput,
  type CarsalesUploadResult,
} from '~/stubs/carsales';

export const prerender = false; // dynamic route, not pre-rendered

const json = (body: unknown, status = 200, headers?: Record<string, string>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

/** Env this route needs — read straight from the worker env with a local fallback. */
function getCarsalesEnv(): {
  CARSALES_API_KEY: string | undefined;
  STUB_CARSALES: unknown;
  RATE_LIMIT_KV: KVNamespaceLike | undefined;
} {
  const e = cfEnv as unknown as Record<string, unknown>;
  return {
    CARSALES_API_KEY:
      (e.CARSALES_API_KEY as string | undefined) ?? import.meta.env.CARSALES_API_KEY,
    STUB_CARSALES: e.STUB_CARSALES ?? import.meta.env.STUB_CARSALES,
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

export const POST: APIRoute = async ({ request }) => {
  const cfg = dealerConfig.integrations.carsales;

  // Feature flag — a dealer opts into carsales syndication; hidden without a deploy.
  if (!cfg.enabled) return json({ error: 'carsales upload is not available.' }, 404);

  // Origin gate — this endpoint is only for the dealer's Studio, never public.
  // Allow same-origin (the Studio is embedded in this same app) OR a configured
  // cross-origin studio. Still reject a missing Origin header.
  // TODO(multi-tenant): replace origin check with Studio session validation before real dealer data flows
  const origin = request.headers.get('Origin');
  if (!origin || !isAllowedStudioOrigin(request, origin, dealerConfig.ai.studioOrigins)) {
    return json({ error: 'Forbidden.' }, 403);
  }

  const env = getCarsalesEnv();

  // Parse + validate the body BEFORE spending a rate-limit slot or a read.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  const rawId = (body as { listingId?: unknown })?.listingId;
  // Never syndicate a draft — reject a `drafts.`-prefixed id outright.
  const listingId = typeof rawId === 'string' ? rawId.trim() : '';
  if (!listingId) return json({ error: 'Missing "listingId" (a non-empty string).' }, 400);
  if (listingId.startsWith('drafts.')) {
    return json({ error: 'Publish the listing before uploading to carsales.' }, 400);
  }

  // Per-IP rate limit (KV). DISTINCT `carsales:` prefix so it never shares another
  // endpoint's counter. Guard when unbound; fail OPEN so a KV hiccup never blocks.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.RATE_LIMIT_KV) {
    try {
      const rl = await checkRateLimit(env.RATE_LIMIT_KV, ip, cfg.rateLimit, 'carsales:');
      if (!rl.allowed) {
        return json({ error: 'Upload limit reached — please try again later.' }, 429, {
          'Retry-After': String(rl.retryAfterSeconds),
        });
      }
    } catch (err) {
      console.error('[carsales-upload] rate limit check failed (allowing request)', err);
    }
  }

  // PUBLISHED + ACTIVE ONLY. The public client carries NO token, so it can only
  // see published documents (never drafts); the `status == "active"` clause
  // further rejects a published-but-inactive listing. A draft can never reach
  // the stub.
  let listing: Listing | null;
  try {
    const query = `*[_type == "listing" && _id == $id && status == "active"][0]{ ${LISTING_FIELDS} }`;
    listing = await client.fetch<Listing | null>(query, { id: listingId });
  } catch (err) {
    console.error('[carsales-upload] listing fetch failed', err);
    return json({ error: 'Could not load the listing.' }, 200);
  }
  if (!listing) {
    return json(
      { error: 'Listing not found, or it is not published and active. Publish it first.' },
      400,
    );
  }

  // Stub activation (shared convention): auto-stub until a real key is added, or
  // whenever STUB_CARSALES is truthy.
  const useStub = !env.CARSALES_API_KEY || truthy(env.STUB_CARSALES);

  const input: CarsalesListingInput = {
    listingId: listing._id,
    title: listing.title,
    price: listing.price,
    make: listing.make,
    model: listing.model,
    year: listing.vehicleSpecs?.year,
  };

  try {
    let result: CarsalesUploadResult;
    if (useStub) {
      result = await uploadToCarsales(input, { dealerAccountId: dealerConfig.identity.name });
    } else {
      // TODO_KEYS: carsales — CARSALES_API_KEY + dealer account — set in .dev.vars / wrangler secret
      // Real integration goes here: authenticated HTTP call to the carsales
      // syndication API under the dealer's account, mapping its response onto
      // CarsalesUploadResult with mode: 'live'. Unreachable while stubbed.
      throw new Error('Live carsales upload not implemented — set STUB_CARSALES or add CARSALES_API_KEY.');
    }
    return json({ result }, 200);
  } catch (err) {
    // Graceful 200 — an expected failure never surfaces as a 500 to the dealer.
    console.error('[carsales-upload] upload failed', err);
    return json({ error: 'Could not upload to carsales right now — please try again.' }, 200);
  }
};
