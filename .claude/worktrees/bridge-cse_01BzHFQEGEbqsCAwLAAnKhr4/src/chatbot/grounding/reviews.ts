/**
 * Independent-review grounding — OPTIONAL, additive, CONTEXT ONLY.
 * ------------------------------------------------------------------
 * Mirrors resolveJourney (journey.ts): fail-open (`null` on disabled / no
 * detected make/model / any error), deterministic (a stubbed table lookup, NO
 * LLM, NO HTTP), and it renders a PRICE-FREE, clearly-delimited block explicitly
 * framed as EXTERNAL REFERENCE — third-party review sentiment, NOT our inventory,
 * stock, availability, or pricing. Live inventory / focus keep last-word
 * authority. The visitor's message is untrusted input: only a KNOWN make/model
 * (detected with the shared verify.ts lexicon) is looked up, and everything
 * rendered is defensively stripped of any price-looking token.
 *
 * DEFAULT OFF: gated on `cfg.enabled` (false in dealer config), so with the
 * default config this block never resolves and the composed prompt is identical
 * to today. Only when a dealer opts in does the reference appear.
 */
import { getReviewSummary } from '../../stubs/reviews';
import { CAR_MAKES, findKnownMakes } from './verify';

/** The subset of dealer config this module reads (declared locally, like JourneyConfig). */
export interface ReviewsGroundingConfig {
  enabled: boolean;
  /** Hard cap on the number of pros and of cons rendered into the block. */
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
 * Resolve an INDEPENDENT REVIEW REFERENCE block for a known make/model mentioned
 * in the visitor's message, or `null` when disabled / nothing detected / on any
 * failure (fail-open). `useStub` selects the stub data source (the live feed is
 * gated by the caller via env — REVIEWS_API_KEY / STUB_REVIEWS); today only the
 * stub exists, so a real fetch is never made here.
 */
export async function resolveReviews(
  userMessage: string,
  cfg: ReviewsGroundingConfig,
  useStub: boolean,
): Promise<string | null> {
  if (!cfg.enabled) return null;
  try {
    const makes = findKnownMakes(userMessage, CAR_MAKES);
    if (!makes.length) return null;

    // Stub is the only data source today; `useStub` is threaded for parity with
    // the stub convention (real feed added behind REVIEWS_API_KEY later).
    void useStub;

    for (const make of makes) {
      const summary = await getReviewSummary(make, userMessage);
      if (!summary) continue;

      const cap = Math.max(0, cfg.maxItems);
      const pros = summary.pros.slice(0, cap).map((p) => stripPrices(p)).filter(Boolean);
      const cons = summary.cons.slice(0, cap).map((c) => stripPrices(c)).filter(Boolean);
      const name = `${titleCase(summary.make)} ${titleCase(summary.model)}`;
      // rating is a small out-of-5 score, never a price; render defensively anyway.
      const rating = stripPrices(`${summary.rating}/5`);
      const lines = [
        '=== INDEPENDENT REVIEW REFERENCE (external, not our inventory) ===',
        `${name} — independent review sentiment (source: ${stripPrices(summary.source)}). NOT our stock, pricing, or availability:`,
        `Overall rating: ${rating}.`,
      ];
      if (pros.length) lines.push(`Praised for: ${pros.join('; ')}.`);
      if (cons.length) lines.push(`Common criticisms: ${cons.join('; ')}.`);
      lines.push(
        'This is external third-party sentiment for general context only — not our inventory, price, or a claim of availability. The live inventory above has the last word on what we stock.',
        '=== END INDEPENDENT REVIEW REFERENCE ===',
      );
      return lines.join('\n');
    }
    return null;
  } catch (err) {
    console.error('[grounding] Review resolution failed (omitting reviews)', err);
    return null;
  }
}
