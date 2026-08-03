/**
 * Capture — extraction + assembly endpoint.
 *
 * POST { vinOrRego?, imageRefs?, transcript? } → the assembled candidate draft
 * with per-field source + confidence, the make/model reference resolution, and a
 * validation result. Never a 500 for an expected condition. Flag/origin-guarded,
 * rate-limited (`capture:`).
 *
 * Pipeline: OEM decode (VIN stub) + photo extraction (vision stub) + parsed voice
 * transcript → deterministic merge (src/lib/capture/pipeline.ts) → make/model
 * reference-resolve against REAL inventory (resolve-never-invent) → validate the
 * assembled draft. Nothing is written here — that's the separate create-draft step.
 *
 * Vision stub activation (shared convention):
 *   useVisionStub = truthy(env.STUB_VISION) || !hasVisionModel() || !OPENROUTER_API_KEY
 */
import type { APIRoute } from 'astro';
import { dealerConfig } from '~/config/dealer';
import { guardCaptureRequest, json } from '~/lib/capture/http';
import { truthy } from '~/lib/capture/env';
import { getOemSpec } from '~/stubs/vin-lookup';
import { extractFromImage, hasVisionModel, type ExtractedFields } from '~/stubs/vision-extract';
import { resolveReference } from '~/lib/capture/reference-resolver';
import {
  assembleCandidate,
  buildDraftDoc,
  parseVoiceTranscript,
} from '~/lib/capture/pipeline';
import { validateDraft } from '~/lib/capture/validate';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const guard = await guardCaptureRequest(request);
  if (!guard.ok) return guard.response;
  const env = guard.env;
  const cfg = dealerConfig.capture;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const vinOrRego = typeof b.vinOrRego === 'string' ? b.vinOrRego.trim() : '';
  const transcriptRaw = typeof b.transcript === 'string' ? b.transcript : '';
  const transcript = transcriptRaw.slice(0, cfg.maxTranscriptLength);
  const imageRefs = Array.isArray(b.imageRefs)
    ? b.imageRefs.filter((r): r is string => typeof r === 'string' && r.length > 0).slice(0, cfg.maxImages)
    : [];

  try {
    // 1. OEM decode (VIN stub) — only when a VIN/rego was supplied.
    const useVinStub = !env.NEVDIS_API_KEY || truthy(env.STUB_VIN);
    const oemSpec = vinOrRego && useVinStub ? await getOemSpec(vinOrRego) : null;

    // 2. Photo extraction. `realVisionAvailable` reports whether a vision-capable
    //    model + key are configured (the stub-activation decision per the shared
    //    convention: useStub = STUB_VISION || !hasVisionModel() || !OPENROUTER_API_KEY).
    //    The real vision path (routing photos to the ~/ai vision tier) is a marked
    //    TODO (see src/stubs/vision-extract.ts); until it lands the deterministic
    //    STUB is always the actual source, so `source` stays honestly 'stub'. Merge
    //    every photo's fields; earlier photos win a tie (deterministic).
    const realVisionAvailable =
      !truthy(env.STUB_VISION) && hasVisionModel() && !!env.OPENROUTER_API_KEY;
    let extracted: ExtractedFields | null = null;
    if (imageRefs.length) {
      const merged: ExtractedFields = { fields: {}, source: 'stub' };
      for (const ref of imageRefs) {
        const one = await extractFromImage(ref);
        for (const [k, v] of Object.entries(one.fields)) {
          if (!(k in merged.fields)) (merged.fields as Record<string, unknown>)[k] = v;
        }
      }
      extracted = merged;
    }

    // 3. Parse the voice transcript (human-only bits).
    const voice = parseVoiceTranscript(transcript);

    // 4. Reference-resolve make/model against REAL inventory (resolve-never-invent).
    const reference = await resolveReference(
      { make: oemSpec?.make, model: oemSpec?.model },
      env.SANITY_TOKEN,
      cfg.referenceMatchThreshold,
    );

    // 5. Deterministic merge → candidate.
    const candidate = assembleCandidate({ oemSpec, extracted, voice, reference, vinOrRego });

    // 6. Validate the assembled draft BEFORE any create step (errors go to the
    //    review UI, never into Studio).
    const draftDoc = buildDraftDoc(candidate, dealerConfig.locale.currency);
    const validation = validateDraft(draftDoc);

    return json(
      {
        candidate,
        validation,
        meta: {
          vinStub: useVinStub,
          // The stub is the actual photo-extraction source today (real path is a
          // TODO); `visionRealAvailable` reports upgrade-readiness only.
          visionStub: extracted != null,
          visionRealAvailable: realVisionAvailable,
          oemFound: oemSpec != null,
          photos: imageRefs.length,
        },
      },
      200,
    );
  } catch (err) {
    console.error('[capture/extract] assembly failed', err);
    return json({ error: 'Could not assemble a draft right now — please try again.' }, 200);
  }
};
