/**
 * Capture — create-draft endpoint (DRAFT-ONLY, owner-gated, NO real write).
 *
 * POST { draft } → validates the (possibly dealer-edited) draft, then hands it to
 * the STUB writer (src/stubs/listing-writer.ts) which LOGS + returns a MOCK draft
 * id. It does NOT write to Sanity and touches NO write token — the Worker-scoped
 * write token is owner-gated (see TODO_KEYS.md). Flag/origin-guarded, rate-limited
 * (`capture:`).
 *
 * Trust boundary: the client's `draft` is a hint. `status` is PINNED to 'draft'
 * and `category` to 'automotive' server-side (a client can never request publish),
 * `currency` comes from config, and the doc is whitelisted field-by-field — so an
 * unexpected client key can't reach the (future real) writer.
 */
import type { APIRoute } from 'astro';
import { dealerConfig } from '~/config/dealer';
import { guardCaptureRequest, json } from '~/lib/capture/http';
import { validateDraft } from '~/lib/capture/validate';
import { createListingDraft } from '~/stubs/listing-writer';
import type { DraftDocInput } from '~/lib/capture/types';

export const prerender = false;

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

/**
 * Whitelist the client draft into a trusted DraftDocInput. status/category are
 * pinned server-side (never client-controlled); currency comes from config.
 */
function sanitizeDraft(raw: Record<string, unknown>): DraftDocInput {
  const vsRaw = (raw.vehicleSpecs ?? {}) as Record<string, unknown>;
  const vehicleSpecs = {
    bodyType: str(vsRaw.bodyType),
    transmission: str(vsRaw.transmission),
    fuelType: str(vsRaw.fuelType),
    driveType: str(vsRaw.driveType),
    seatCount: num(vsRaw.seatCount),
    year: num(vsRaw.year),
    odometer: num(vsRaw.odometer),
    condition: str(vsRaw.condition),
  };
  const hasSpecs = Object.values(vehicleSpecs).some((v) => v != null);

  return {
    _type: 'listing',
    status: 'draft', // PINNED — capture never publishes.
    category: 'automotive', // PINNED — automotive-only dataset.
    currency: dealerConfig.locale.currency,
    title: str(raw.title),
    make: str(raw.make),
    model: str(raw.model),
    badge: str(raw.badge),
    series: str(raw.series),
    colour: str(raw.colour),
    engine: str(raw.engine),
    trim: str(raw.trim),
    doors: num(raw.doors),
    price: num(raw.price),
    vin: str(raw.vin),
    ...(hasSpecs ? { vehicleSpecs } : {}),
    dealerNotes: str(raw.dealerNotes),
  };
}

export const POST: APIRoute = async ({ request }) => {
  const guard = await guardCaptureRequest(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  const draftRaw = (body as { draft?: unknown })?.draft;
  if (!draftRaw || typeof draftRaw !== 'object') {
    return json({ error: 'Missing "draft".' }, 400);
  }

  // Whitelist + validate BEFORE the (stubbed) create. Errors go back to the review
  // UI — nothing reaches the writer unless it's valid.
  const doc = sanitizeDraft(draftRaw as Record<string, unknown>);
  const validation = validateDraft(doc);
  if (!validation.valid) {
    return json({ error: 'The draft has validation errors.', validation }, 200);
  }

  try {
    // STUB writer: logs + returns a mock draft id. NO real Sanity write, NO token.
    const result = await createListingDraft(doc);
    return json({ result, validation }, 200);
  } catch (err) {
    console.error('[capture/create-draft] draft create failed', err);
    return json({ error: 'Could not create the draft right now — please try again.' }, 200);
  }
};
