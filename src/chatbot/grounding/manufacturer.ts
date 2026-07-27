/**
 * Manufacturer-reference grounding — OPTIONAL, additive, CONTEXT ONLY.
 * ------------------------------------------------------------------
 * Mirrors resolveJourney (journey.ts): fail-open (`null` on disabled / no
 * detected make/model / any error), deterministic (a stubbed table lookup, NO
 * LLM, NO HTTP), and it renders a PRICE-FREE, clearly-delimited block explicitly
 * framed as EXTERNAL REFERENCE — general model background, NOT our inventory,
 * stock, availability, or pricing. Live inventory / focus keep last-word
 * authority. The visitor's message is untrusted input: only a KNOWN make/model
 * (detected with the shared verify.ts lexicon) is looked up, and everything
 * rendered is defensively stripped of any price-looking token.
 *
 * DEFAULT OFF: gated on `cfg.enabled` (false in dealer config), so with the
 * default config this block never resolves and the composed prompt is identical
 * to today. Only when a dealer opts in does the reference appear.
 */
import { getModelInfo } from '../../stubs/manufacturer';
import { CAR_MAKES, findKnownMakes } from './verify';

/** The subset of dealer config this module reads (declared locally, like JourneyConfig). */
export interface ManufacturerGroundingConfig {
  enabled: boolean;
  /** Hard cap on key-feature items rendered into the block. */
  maxItems: number;
}

/** Strip any price-looking token so the block can never carry a price (mirrors journey.ts). */
function stripPrices(text: string): string {
  return text.replace(/\$\s?\d[\d,]*(?:\.\d+)?/g, '').replace(/\s{2,}/g, ' ').trim();
}

/** Title-case a lower-case make/model token for display ("cx-5" → "Cx-5", "ford" → "Ford"). */
function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/**
 * Resolve a MANUFACTURER REFERENCE block for a known make/model mentioned in the
 * visitor's message, or `null` when disabled / nothing detected / on any failure
 * (fail-open). `useStub` selects the stub data source (the live feed is gated by
 * the caller via env — MANUFACTURER_API_KEY / STUB_MANUFACTURER); today only the
 * stub exists, so a real fetch is never made here.
 */
export async function resolveManufacturer(
  userMessage: string,
  cfg: ManufacturerGroundingConfig,
  useStub: boolean,
): Promise<string | null> {
  if (!cfg.enabled) return null;
  try {
    const makes = findKnownMakes(userMessage, CAR_MAKES);
    if (!makes.length) return null;

    // Stub is the only data source today; `useStub` is threaded for parity with
    // the stub convention (real feed added behind MANUFACTURER_API_KEY later).
    void useStub;

    for (const make of makes) {
      const info = await getModelInfo(make, userMessage);
      if (!info) continue;

      const features = info.keyFeatures
        .slice(0, Math.max(0, cfg.maxItems))
        .map((f) => stripPrices(f))
        .filter(Boolean);
      const name = `${titleCase(info.make)} ${titleCase(info.model)}`;
      const lines = [
        '=== MANUFACTURER REFERENCE (external, not our inventory/stock/pricing) ===',
        `${name} — general model background (NOT our stock, availability, or pricing):`,
        stripPrices(info.overview),
      ];
      if (features.length) lines.push(`Notable features: ${features.join('; ')}.`);
      lines.push(
        'This is external background only — it is NOT a statement that we have this vehicle, and it carries no price, stock, or availability. The live inventory above is the only source of what we actually have.',
        '=== END MANUFACTURER REFERENCE ===',
      );
      return lines.join('\n');
    }
    return null;
  } catch (err) {
    console.error('[grounding] Manufacturer resolution failed (omitting manufacturer)', err);
    return null;
  }
}
