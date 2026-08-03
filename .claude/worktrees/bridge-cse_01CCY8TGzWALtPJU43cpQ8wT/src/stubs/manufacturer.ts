/**
 * Manufacturer new-model information — STUB.
 * ---------------------------------------------------------------------------
 * Behaviourally indistinguishable from a real manufacturer / partner model-info
 * feed: the SAME typed request → typed response contract the live integration
 * will implement, so going live is a config change (add MANUFACTURER_API_KEY),
 * not a code change. See docs/briefs/_stub-convention.md.
 *
 * Fully DETERMINISTIC — no Math.random, no `new Date()`. The same make/model
 * always yields the same structured info, so the demo is stable and SSR-safe.
 * Deliberately carries NO prices, NO stock, NO availability — this is general
 * background about a model line, never a claim about our inventory.
 */

export interface ModelInfo {
  make: string;
  model: string;
  year?: number;
  overview: string;
  keyFeatures: string[];
}

// A small, deterministic table of well-known AU-market model lines. Keyed by
// lower-cased make, then lower-cased model. NO prices anywhere — general
// background only. Extend freely; the live feed replaces this table wholesale.
const MODEL_TABLE: Record<string, Record<string, Omit<ModelInfo, 'make' | 'model'>>> = {
  ford: {
    ranger: {
      overview:
        'The Ford Ranger is a mid-size dual-cab ute, one of Australia’s best-selling ' +
        'vehicles, popular for work, towing, and family duty. Later generations offer a range ' +
        'of turbo-diesel drivetrains and a well-regarded cabin.',
      keyFeatures: ['Turbo-diesel engine options', 'Strong braked towing capacity', 'Dual-cab practicality', 'Available 4WD'],
    },
    everest: {
      overview:
        'The Ford Everest is a seven-seat SUV built on the Ranger platform, aimed at families ' +
        'wanting genuine off-road ability alongside on-road comfort.',
      keyFeatures: ['Seven seats', 'Turbo-diesel drivetrains', 'Serious off-road ability', 'Roomy cabin'],
    },
  },
  toyota: {
    corolla: {
      overview:
        'The Toyota Corolla is a small hatch/sedan with a long reputation for reliability and ' +
        'low running costs, a common choice for first-car buyers and commuters. Recent models ' +
        'offer a petrol-hybrid option.',
      keyFeatures: ['Reputation for reliability', 'Hybrid option on recent models', 'Low running costs', 'Easy to park'],
    },
    hilux: {
      overview:
        'The Toyota HiLux is a mid-size ute renowned for durability, a fixture on Australian ' +
        'work sites and touring routes.',
      keyFeatures: ['Renowned durability', 'Turbo-diesel options', 'Strong resale reputation', 'Available 4WD'],
    },
    rav4: {
      overview:
        'The Toyota RAV4 is a mid-size SUV, hugely popular for its practicality and its ' +
        'efficient petrol-hybrid drivetrain.',
      keyFeatures: ['Popular hybrid drivetrain', 'Practical family SUV', 'Good fuel efficiency', 'AWD available'],
    },
  },
  mitsubishi: {
    triton: {
      overview:
        'The Mitsubishi Triton is a mid-size dual-cab ute positioned as a value-focused work ' +
        'and lifestyle vehicle, typically covered by a long manufacturer warranty.',
      keyFeatures: ['Value positioning', 'Long warranty reputation', 'Turbo-diesel drivetrain', 'Available 4WD'],
    },
    outlander: {
      overview:
        'The Mitsubishi Outlander is a mid-size SUV available in seven-seat and plug-in hybrid ' +
        '(PHEV) variants, aimed at families.',
      keyFeatures: ['Seven-seat option', 'Plug-in hybrid variant', 'Family-focused cabin', 'Long warranty reputation'],
    },
  },
  mazda: {
    'cx-5': {
      overview:
        'The Mazda CX-5 is a mid-size SUV known for a refined interior and engaging drive, a ' +
        'popular choice among family SUV buyers.',
      keyFeatures: ['Refined interior', 'Engaging to drive', 'Petrol and diesel options', 'AWD available'],
    },
  },
  isuzu: {
    'd-max': {
      overview:
        'The Isuzu D-Max is a mid-size dual-cab ute built around a durable turbo-diesel ' +
        'drivetrain, favoured for work and towing.',
      keyFeatures: ['Durable turbo-diesel', 'Strong towing focus', 'Work-ute practicality', 'Available 4WD'],
    },
  },
  hyundai: {
    i30: {
      overview:
        'The Hyundai i30 is a small hatch/sedan offering strong value, a comfortable drive, and ' +
        'a long manufacturer warranty — a common first-car and commuter pick.',
      keyFeatures: ['Strong value', 'Long warranty reputation', 'Comfortable ride', 'Easy to park'],
    },
  },
  kia: {
    sportage: {
      overview:
        'The Kia Sportage is a mid-size SUV with a roomy cabin and a long warranty reputation, ' +
        'popular with families.',
      keyFeatures: ['Roomy cabin', 'Long warranty reputation', 'Petrol and diesel options', 'Family-friendly'],
    },
  },
};

/**
 * Look up general manufacturer/model background for a make + free-text hint.
 *
 * @param make      a known car make (lower/any case).
 * @param modelHint free text (typically the visitor's message) in which a known
 *                  model name for that make is sought as a whole word. Kept as
 *                  the `model` param to match the live integration's signature.
 * @returns structured {@link ModelInfo}, or `null` when the make is unknown or no
 *          known model for it appears in the hint. NO prices, ever.
 */
export async function getModelInfo(make: string, model: string): Promise<ModelInfo | null> {
  // TODO_KEYS: Manufacturer grounding — MANUFACTURER_API_KEY / partner feed — per-brand — set in .dev.vars / wrangler secret
  // The live integration replaces the table lookup below with an HTTP call to the
  // manufacturer/partner model-info feed (auth via MANUFACTURER_API_KEY), keyed by
  // make + model, and still returns NO price/stock/availability fields.
  const makeKey = make.trim().toLowerCase();
  const table = MODEL_TABLE[makeKey];
  if (!table) return null;

  const hay = ` ${model.toLowerCase()} `;
  for (const modelKey of Object.keys(table)) {
    // Whole-word / phrase match so "ranger" doesn't match inside another token.
    const re = new RegExp(`(?:^|[^a-z0-9])${modelKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z0-9])`, 'i');
    if (re.test(hay)) {
      const entry = table[modelKey];
      return {
        make: makeKey,
        model: modelKey,
        overview: entry.overview,
        keyFeatures: [...entry.keyFeatures],
      };
    }
  }
  return null;
}
