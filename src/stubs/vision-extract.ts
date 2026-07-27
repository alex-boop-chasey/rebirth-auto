/**
 * Photo → vehicle-attribute extraction — STUB (with a real-AI upgrade seam).
 * ---------------------------------------------------------------------------
 * Behaviourally indistinguishable from a real vision extraction: same typed
 * request (an opaque image reference) → typed response (per-field values, each
 * with its OWN confidence) the live path will implement. See
 * docs/briefs/_stub-convention.md.
 *
 * UPGRADE SEAM: the intended live path routes photos to the real `~/ai` VISION
 * tier — the `writing`/`structured` tiers already flag `supportsVision` (see
 * src/ai/tiers.ts). `hasVisionModel()` reports whether a vision-capable model is
 * configured; the caller decides:
 *   useStub = truthy(env.STUB_VISION) || !hasVisionModel() || !OPENROUTER_API_KEY
 * so it auto-stubs until a real vision model + key are wired. The live
 * extraction (generateObject on a vision tier with the photo as an image part)
 * is marked TODO below — the stub is the fallback and today's demo path.
 *
 * Fully DETERMINISTIC: no Math.random, no module-level `new Date()`. The same
 * image reference always yields the same extraction, so the demo is stable and
 * SSR-safe. Confidence is PER FIELD — the pipeline flags low-confidence fields
 * for dealer review rather than trusting them (resolve-never-invent).
 */
import { TIERS, getModelCapabilities } from '~/ai';
import type { CaptureFieldKey, FieldConfidence } from '~/lib/capture/types';

/** One extracted attribute + how confident the extractor is in it. */
export interface ExtractedField {
  value: string | number;
  confidence: FieldConfidence;
}

/** The result of extracting from one or more photos. */
export interface ExtractedFields {
  /** Per-field extractions (a subset — a photo only reveals so much). */
  fields: Partial<Record<CaptureFieldKey, ExtractedField>>;
  /** Marks the extraction origin so nothing here is mistaken for a real decode. */
  source: 'stub' | 'ai-vision';
}

/**
 * Is a vision-capable model configured anywhere in the tier table? Used by the
 * caller to decide stub-vs-real. Vision extraction would run on such a tier.
 */
export function hasVisionModel(): boolean {
  for (const tier of Object.values(TIERS)) {
    for (const modelId of tier.models) {
      if (getModelCapabilities(modelId).supportsVision) return true;
    }
  }
  return false;
}

/** Deterministic unsigned 32-bit rolling hash of a reference string. */
function hashRef(ref: string): number {
  let hash = 0;
  for (let i = 0; i < ref.length; i++) {
    hash = (hash * 31 + ref.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// A small deterministic palette the stub "sees" in a photo. A photo reliably
// reveals colour + body style; badge text is harder (lower confidence); the
// odometer is only sometimes legible (medium, and flagged for review).
const COLOUR_CYCLE = ['white', 'silver', 'grey', 'blue', 'red', 'black'] as const;
const BODY_CYCLE = ['suv', 'ute', 'hatchback', 'sedan', 'wagon', 'van'] as const;

/**
 * Extract plausible per-field values from a photo reference.
 *
 * Only fields a camera can genuinely reveal are returned (colour, body, doors,
 * a soft condition read, and a sometimes-legible odometer). Make/model badging
 * is deliberately LOW confidence — the pipeline treats those as review-flagged
 * hints, never authoritative, so they never override the OEM decode.
 *
 * @param imageRef an opaque reference (data URL / asset id) the client holds.
 */
export async function extractFromImage(imageRef: string): Promise<ExtractedFields> {
  // TODO_KEYS: Vision — OPENROUTER_API_KEY + a vision-capable tier (already flagged
  // supportsVision in src/ai/tiers.ts) — the live path calls generateObject on a
  // vision tier with the photo as an image part; set STUB_VISION=false to prefer it.
  const h = hashRef(imageRef || 'demo');

  const colour = COLOUR_CYCLE[h % COLOUR_CYCLE.length];
  const bodyType = BODY_CYCLE[(h >> 3) % BODY_CYCLE.length];
  // A ute/van reads as fewer doors; SUV/wagon as 5. Deterministic, not random.
  const doors = bodyType === 'ute' ? 4 : bodyType === 'van' ? 3 : 5;
  // Odometer is only "read" on ~half the demo refs (dash sometimes in frame).
  const odoLegible = (h & 1) === 0;
  const odometer = 15000 + (h % 120) * 1000; // 15,000–134,000 km, stable per ref

  const fields: ExtractedFields['fields'] = {
    // High confidence — a photo shows colour + body style clearly.
    colour: { value: colour, confidence: 'high' },
    bodyType: { value: bodyType, confidence: 'high' },
    doors: { value: doors, confidence: 'medium' },
    // Soft read — always flagged for the dealer to confirm.
    condition: { value: 'used', confidence: 'low' },
  };
  if (odoLegible) {
    // Legible-but-imperfect dash read → medium, still worth a human glance.
    fields.odometer = { value: odometer, confidence: 'medium' };
  }

  return { fields, source: 'stub' };
}
