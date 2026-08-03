/**
 * Automotive review sentiment — STUB.
 * ---------------------------------------------------------------------------
 * Behaviourally indistinguishable from a real licensed review feed (Wheels,
 * CarsGuide, etc.): the SAME typed request → typed response contract the live
 * integration will implement, so going live is a config change (add a review
 * source licence / REVIEWS_API_KEY), not a code change. See
 * docs/briefs/_stub-convention.md.
 *
 * Fully DETERMINISTIC — no Math.random, no `new Date()`. The same make/model
 * always yields the same summary, so the demo is stable and SSR-safe. Every
 * summary is CLEARLY attributed as demo data via `source`, carries NO prices,
 * and is never a claim about our stock or availability.
 */

export interface ReviewSummary {
  make: string;
  model: string;
  rating: number;
  pros: string[];
  cons: string[];
  source: string;
}

const SOURCE_LABEL = 'demo review data';

// A small, deterministic table of independent-style review sentiment. Keyed by
// lower-cased make, then lower-cased model. Ratings are fixed (no randomness) and
// there are NO prices anywhere. The live feed replaces this table wholesale.
const REVIEW_TABLE: Record<string, Record<string, Omit<ReviewSummary, 'make' | 'model' | 'source'>>> = {
  ford: {
    ranger: {
      rating: 4.4,
      pros: ['Strong towing and payload', 'Comfortable, well-built cabin', 'Capable off-road'],
      cons: ['Larger size can be tricky to park', 'Options can add up'],
    },
    everest: {
      rating: 4.3,
      pros: ['Genuine off-road ability', 'Roomy seven-seat cabin', 'Refined on-road manners'],
      cons: ['Thirstier than a car-based SUV', 'Sizeable to manoeuvre'],
    },
  },
  toyota: {
    corolla: {
      rating: 4.3,
      pros: ['Excellent reliability record', 'Efficient hybrid option', 'Cheap to run'],
      cons: ['Firmer ride on some variants', 'Modest boot space in the hatch'],
    },
    hilux: {
      rating: 4.2,
      pros: ['Bulletproof reputation', 'Strong resale value', 'Proven off-road'],
      cons: ['Ride can be firm unladen', 'Cabin tech trails some rivals'],
    },
    rav4: {
      rating: 4.5,
      pros: ['Very efficient hybrid', 'Practical family SUV', 'Strong resale'],
      cons: ['Popular models can have wait times', 'Road noise on coarse surfaces'],
    },
  },
  mitsubishi: {
    triton: {
      rating: 4.1,
      pros: ['Sharp value', 'Long warranty', 'Easy to drive for a ute'],
      cons: ['Payload trails some rivals', 'Cabin plastics feel utilitarian'],
    },
    outlander: {
      rating: 4.2,
      pros: ['Seven-seat flexibility', 'PHEV option for low running costs', 'Long warranty'],
      cons: ['Third row best for kids', 'PHEV commands a premium'],
    },
  },
  mazda: {
    'cx-5': {
      rating: 4.4,
      pros: ['Premium-feeling interior', 'Engaging to drive', 'Well equipped'],
      cons: ['Boot smaller than some rivals', 'No seven-seat option'],
    },
  },
  isuzu: {
    'd-max': {
      rating: 4.2,
      pros: ['Durable diesel drivetrain', 'Strong towing focus', 'Good safety kit'],
      cons: ['Firm unladen ride', 'Engine a touch noisy'],
    },
  },
  hyundai: {
    i30: {
      rating: 4.3,
      pros: ['Great value', 'Comfortable and easy to drive', 'Long warranty'],
      cons: ['Base engine is modest', 'Some rivals feel plusher inside'],
    },
  },
  kia: {
    sportage: {
      rating: 4.3,
      pros: ['Roomy and practical', 'Long warranty', 'Strong feature list'],
      cons: ['Some engines feel ordinary', 'Firmer ride on larger wheels'],
    },
  },
};

/**
 * Look up independent-style review sentiment for a make + free-text hint.
 *
 * @param make      a known car make (lower/any case).
 * @param model     free text (typically the visitor's message) in which a known
 *                  model name for that make is sought as a whole word. Kept as
 *                  the `model` param to match the live integration's signature.
 * @returns structured {@link ReviewSummary} (clearly attributed via `source`), or
 *          `null` when the make is unknown or no known model appears. NO prices.
 */
export async function getReviewSummary(make: string, model: string): Promise<ReviewSummary | null> {
  // TODO_KEYS: Review grounding — review source licence (Wheels/CarsGuide/etc.) — per-source — set in .dev.vars / wrangler secret
  // The live integration replaces the table lookup below with an HTTP call to the
  // licensed review feed, keyed by make + model, mapping its rating/pros/cons and
  // setting `source` to the real publication. It still returns NO price fields.
  const makeKey = make.trim().toLowerCase();
  const table = REVIEW_TABLE[makeKey];
  if (!table) return null;

  const hay = ` ${model.toLowerCase()} `;
  for (const modelKey of Object.keys(table)) {
    const re = new RegExp(`(?:^|[^a-z0-9])${modelKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z0-9])`, 'i');
    if (re.test(hay)) {
      const entry = table[modelKey];
      return {
        make: makeKey,
        model: modelKey,
        rating: entry.rating,
        pros: [...entry.pros],
        cons: [...entry.cons],
        source: SOURCE_LABEL,
      };
    }
  }
  return null;
}
