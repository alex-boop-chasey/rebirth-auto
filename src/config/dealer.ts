/**
 * Central dealer configuration — THE MULTI-TENANT SEAM.
 *
 * See DECISION.md, Decision 1 ("Config as data, never hardcoded"). Every value
 * that a different dealership might want different lives here and is read at
 * runtime — never hardcoded in components, pages, scripts, or logic. Today this
 * object holds the one current dealer; later it becomes keyed by tenant ID
 * resolved server-side from the domain, and "the current dealer" resolves from
 * that. If you're about to type a dealer-specific literal into a component,
 * stop — add it here and read it instead.
 *
 * Consumed via the `~/config/dealer` alias (`~/*` → `src/*`).
 */

// Type-only import (zero runtime cost, no import cycle — context.ts has no deps)
// so the config's `allowedKinds` stays in lockstep with the seam it configures.
import type { ConversationContextKind } from '../chatbot/context';

// A single dealer's configuration. When we go multi-tenant this becomes the
// per-tenant record shape; the resolver just picks which one is "current".
export interface DealerConfig {
  identity: {
    /** Display name for this dealer. */
    name: string;
  };
  /** Region/formatting settings — dealer- and region-specific. */
  locale: {
    /** BCP-47 locale used for number/price/date formatting (e.g. 'en-AU'). */
    locale: string;
    /** ISO-4217 currency code used as the default when a listing has none. */
    currency: string;
  };
  /**
   * Filter shape — "this dealer shows these dimensions / uses these bounds".
   * This is the knob a future tenant swap varies to change what the inventory
   * filter drawer offers, not what the drawer is technically capable of.
   */
  inventory: {
    /** How many vehicles this dealer shows per page. */
    pageSize: number;
    /** Default sort when the URL specifies none. Must be a SortKey. */
    defaultSort: SortKey;
    /** Upper bound (inclusive) of this dealer's price range control. */
    priceCap: number;
    /** Price steps this dealer offers in the price filter dropdowns (whole dollars). */
    priceOptions: readonly number[];
    /** Years this dealer offers in the year filter dropdowns (calendar years). */
    yearOptions: readonly number[];
    /** Odometer steps this dealer offers in the odometer filter dropdown (whole km). */
    odoOptions: readonly number[];
    /** Body types this dealer shows, in display order (subset of the schema enum). */
    bodyTypes: BodyTypeCode[];
    /** Whether this dealer surfaces the "condition" (new/used/demo) filter. */
    showCondition: boolean;
    /** Which filter dimensions appear for this dealer, in display order. */
    dimensions: FilterDimension[];
  };
  /** Labels / copy — the human-facing strings for this dealer. */
  copy: {
    /** Human labels for each sort option, keyed by SortKey. */
    sortLabels: Record<SortKey, string>;
  };
  /**
   * AI-feature settings — dealer-scoped toggles and limits only. The model
   * choice is owned centrally by src/ai/ capability tiers (DECISION.md
   * Decision 3) and the prompts are feature-scoped; neither belongs here.
   */
  ai: {
    /**
     * Voice/tone knobs read by the description generator prompt.
     * Multi-tenant seam: today one dealer; later keyed by tenant so each
     * dealership gets its own voice without prompt edits. See Decision 1 in
     * DECISION.md — never inline these into prompt strings elsewhere.
     */
    descriptionVoice: {
      /** Prompt voice. The tone the generator writes in for this dealer. */
      tone: DescriptionTone;
      /** BCP-47 locale steering spelling/idiom (e.g. 'en-AU' → 'colour', 'tyres'). */
      locale: string;
    };
    /**
     * Origin allowlist for Studio-only endpoints (generate-description). Tenant
     * seam — later keyed per dealer domain. NEVER hardcode the origin in the
     * endpoint; it reads this list.
     */
    studioOrigins: string[];
    /** Dealer-facing AI description generator (Studio "Generate description"). */
    generateDescription: {
      /** Master on/off — lets a dealer disable the button without a deploy. */
      enabled: boolean;
      /** Per-IP rate limit for the generate-description endpoint. */
      rateLimit: { windowSeconds: number; maxRequests: number };
    };
  };
  /** Chatbot (Rebi) settings — dealer-scoped toggles and grounding tunables. */
  chat: {
    /**
     * Live grounding for the chatbot: inject the current inventory + a
     * dealer-editable business-facts document into Rebi's system prompt.
     * All deterministic and fail-open (see src/chatbot/grounding/). Every knob
     * here is dealer-tunable — nothing about grounding is hardcoded in the
     * grounding modules.
     */
    grounding: {
      /** Master on/off. When false, Rebi uses the static prompt only. */
      enabled: boolean;
      /**
       * Anti-hallucination firewall (src/chatbot/grounding/verify.ts). A post-hoc
       * scrub of Rebi's reply against the grounded allow-list (exact prices + the
       * brands present in this turn's grounding): a free model that invents a car
       * or price is caught before it reaches the visitor. Load-bearing while the
       * reply runs on a free tier; harmless (near-never fires) once Haiku lands.
       * The known-brand LEXICON itself is dealer-agnostic and lives in verify.ts
       * (CAR_MAKES) — see DECISION.md Decision 1 (config is for dealer-specific
       * values; a world-wide brand list is not one). These are the tunables.
       */
      antiHallucination: {
        /** Master on/off for the firewall. */
        enabled: boolean;
        /** `block` swaps a violating reply for a grounded fallback; `redact` masks the bad tokens. */
        mode: 'block' | 'redact';
        /** The primary, reliable check: block any `$`-figure not in the grounded prices. */
        priceCheck: boolean;
        /** The best-effort secondary check: block a real brand that isn't in this turn's grounding. */
        makeCheck: boolean;
      };
      /**
       * The Sanity document `_type` holding this dealer's business facts.
       * Resolved as `*[_type == businessInfoType][0]` (the current dealer's doc).
       */
      businessInfoType: string;
      /** KV TTLs (seconds) for each cached grounding block. Ignored if no KV bound. */
      cacheTtlSeconds: {
        /** Business facts change rarely. */
        businessFacts: number;
        /** Inventory overview roll-ups. */
        overview: number;
        /** Per-query live lookup (short — collapses refinement bursts). */
        lookup: number;
      };
      /** Always-on inventory overview (breadth questions, backstops lookup misses). */
      overview: {
        enabled: boolean;
        /**
         * Price-band breakpoints (whole dollars, ascending). Bands are rendered
         * as "under $X", the in-between ranges, and "over $last".
         */
        priceBands: readonly number[];
      };
      /** Per-turn live lookup of matching vehicles (specific questions). */
      lookup: {
        enabled: boolean;
        /** Hard cap on vehicles listed in the injected block. */
        maxListings: number;
        /** Whether to derive a `title match` keyword from the message. */
        keywordSearch: boolean;
        /**
         * "low kms" / "low mileage" with no explicit figure maps to this
         * odometer ceiling (km). Dealer-tunable, never hardcoded.
         */
        lowKmThreshold: number;
        /**
         * Seat counts a "family car" request maps to (must be values the filter
         * accepts — see SEAT_OPTIONS in listings-query.ts).
         */
        familySeats: readonly number[];
      };
    };
    /**
     * Conversation priming/context seam (the "Ask about this car" button and,
     * later, compare/search entry points). When a visitor opens Rebi from a
     * specific surface, the widget sends `{ kind, refs }` and the server resolves
     * a live CONVERSATION FOCUS block. Deterministic + fail-open, and decoupled
     * from `grounding.enabled` above. Every knob here is dealer-tunable.
     */
    context: {
      /** Master on/off. When false, any sent context is ignored (no priming). */
      enabled: boolean;
      /** Which context kinds this dealer accepts. `listing`/`compare`/`search` wired. */
      allowedKinds: readonly ConversationContextKind[];
      /** Hard cap on refs a single context may carry (bounds the focus fetch). */
      maxRefs: number;
      /**
       * Hard cap on the CHARACTER length of a single ref. A `search` ref is a
       * serialized filter query string; capping it stops a multi-kilobyte ref from
       * bloating the KV cache key / focus query. Over-long refs are dropped.
       */
      maxRefLength: number;
      /** KV TTL (seconds) for a resolved focus block. Ignored if no KV bound. */
      cacheTtlSeconds: number;
    };
    /**
     * Rebi-fronted natural-language search (the homepage search dock + the
     * `/api/search` endpoint). Deterministic pre-pass → structured-tier LLM only
     * on a miss; fail-open. Front-of-house copy (placeholders, typewriter timings)
     * lives here too so a tenant swap restyles it without code edits.
     */
    search: {
      /** Master on/off — lets a dealer disable AI search without a deploy. */
      enabled: boolean;
      /** Reject queries longer than this (chars) before any AI call. */
      maxQueryLength: number;
      /** Per-IP rate limit for /api/search (its OWN `search:` KV counter). */
      rateLimit: { windowSeconds: number; maxRequests: number };
      /**
       * Soft-concept → filter guidance interpolated into the `/api/search`
       * extraction prompt (src/lib/ai-search/prompt.ts). Lets a dealer teach the
       * interpreter its local phrasing ("first car", "camping", "easy to park")
       * without a code edit. Each entry is a `phrase` (the buyer wording) and a
       * `maps` sentence telling the model which ENUM filters to emit — the output
       * stays enum-locked (the schema rejects anything off-vocabulary), so a
       * concept can only ever resolve to valid codes, never an invented value.
       */
      concepts: readonly { phrase: string; maps: string }[];
      /** Cycling typewriter placeholder examples for the hero search input. */
      placeholders: readonly string[];
      /** Typewriter animation timings (ms). */
      typewriter: { typeMs: number; deleteMs: number; dwellMs: number };
    };
  };
}

// Sort options are a fixed whitelist (see src/lib/listings-query.ts for how each
// maps to a GROQ order clause). `newest` is the safe default.
export type SortKey = 'newest' | 'price-asc' | 'price-desc' | 'year-desc' | 'odo-asc';

// The voices the AI description generator can write in. Kept a literal union so a
// config with an unknown tone fails typecheck rather than reaching the prompt.
export type DescriptionTone =
  | 'confident-professional'
  | 'friendly-casual'
  | 'premium-restrained';

// Body-type codes mirror the Sanity vehicleSpecs enum. Kept as a literal union so
// a config that lists an unknown code fails typecheck rather than at runtime.
export type BodyTypeCode =
  | 'sedan'
  | 'hatchback'
  | 'suv'
  | 'ute'
  | 'wagon'
  | 'van'
  | 'coupe'
  | 'convertible';

// The filter dimensions the drawer can render. `dimensions` above picks which of
// these a given dealer actually shows.
export type FilterDimension =
  | 'sort'
  | 'price'
  | 'year'
  | 'odometer'
  | 'bodyType'
  | 'transmission'
  | 'fuelType'
  | 'driveType'
  | 'seatCount'
  | 'condition';

export const dealerConfig: DealerConfig = {
  identity: {
    // Minimal stub — the broader migration of name/domain/contact out of pages
    // is a separate ticket. Only what this feature needs lives here today.
    name: 'Rebirth Auto',
  },
  locale: {
    locale: 'en-AU',
    currency: 'AUD',
  },
  inventory: {
    pageSize: 12,
    defaultSort: 'newest',
    priceCap: 150000,
    // Price steps this dealer offers in the price dropdowns (whole dollars).
    priceOptions: [
      5000, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 50000, 60000, 75000, 100000, 150000,
    ],
    // Years this dealer offers, newest-first: 2000 → current calendar year.
    // Generated at module load so the upper bound advances automatically on each
    // redeploy — the component never reads the runtime clock itself.
    yearOptions: (() => {
      const years: number[] = [];
      for (let y = new Date().getFullYear(); y >= 2000; y--) years.push(y);
      return years;
    })(),
    // Odometer steps this dealer offers in the odometer dropdown (whole km).
    odoOptions: [10000, 25000, 50000, 75000, 100000, 150000, 200000, 250000, 300000],
    bodyTypes: ['sedan', 'hatchback', 'suv', 'ute', 'wagon', 'van', 'coupe', 'convertible'],
    showCondition: true,
    dimensions: [
      'sort',
      'price',
      'year',
      'odometer',
      'bodyType',
      'transmission',
      'fuelType',
      'driveType',
      'seatCount',
      'condition',
    ],
  },
  copy: {
    sortLabels: {
      newest: 'Newest first',
      'price-asc': 'Price: low to high',
      'price-desc': 'Price: high to low',
      'year-desc': 'Year: newest',
      'odo-asc': 'Odometer: lowest',
    },
  },
  ai: {
    descriptionVoice: {
      tone: 'confident-professional',
      locale: 'en-AU',
    },
    studioOrigins: [
      'http://localhost:4321', // embedded Studio in `astro dev` (studioBasePath: '/studio')
      'https://rebirth-listings-auto.alexharris0079.workers.dev', // prod Studio origin
    ],
    generateDescription: {
      enabled: true,
      // Studio authoring is far lower-volume than shopper search, but still capped
      // per-IP to bound AI cost. 20/hour is generous for a dealer editing listings.
      rateLimit: { windowSeconds: 3600, maxRequests: 20 },
    },
  },
  chat: {
    grounding: {
      enabled: true,
      antiHallucination: {
        enabled: true,
        mode: 'block',
        priceCheck: true,
        makeCheck: true,
      },
      businessInfoType: 'businessInfo',
      cacheTtlSeconds: {
        businessFacts: 300, // 5 min — facts change rarely
        overview: 120, // 2 min — inventory shifts slowly
        lookup: 45, // collapse a burst of filter refinements
      },
      overview: {
        enabled: true,
        priceBands: [20000, 40000, 60000],
      },
      lookup: {
        enabled: true,
        maxListings: 6,
        keywordSearch: true,
        lowKmThreshold: 60000,
        familySeats: [7, 8],
      },
    },
    context: {
      enabled: true,
      allowedKinds: ['listing', 'compare', 'search'],
      maxRefs: 4,
      // A search ref is a serialized filter string; 512 chars is generous for one
      // (the URL contract's dimensions can't realistically exceed it).
      maxRefLength: 512,
      cacheTtlSeconds: 120, // a focused vehicle's price/status shifts slowly
    },
    search: {
      enabled: true,
      maxQueryLength: 300,
      // Shopper search is higher-volume than Studio authoring but still capped
      // per-IP to bound AI cost. Generous for genuine refining.
      rateLimit: { windowSeconds: 3600, maxRequests: 30 },
      // Soft phrases → enum filters. The model must still emit only valid codes;
      // these teach it how this dealer's buyers describe intent. P-plate / licence
      // status is deliberately NOT a filter dimension — the guidance says to map
      // the practical intent (small, auto, budget) and never invent a dimension.
      concepts: [
        {
          phrase: 'first car / P-plate / P-plater / L-plate / learner / new driver / young driver',
          maps: 'a small, easy-to-drive, affordable automatic: bodyType hatchback, transmission auto, and a modest priceMax (around 25000) if no budget is given. P-plate/licence status is NOT a filter — do not invent one; just map the practical intent and you may note the assumption in interpretation.',
        },
        {
          phrase: 'economical / cheap to run / good on fuel / low fuel / low fuel economy / fuel efficient / save on petrol',
          maps: 'running COST, not a fuel type: bodyType hatchback (small) and a modest priceMax (around 25000) if no budget is given. Do NOT emit a fuelType — a small petrol car is cheap to run, so forcing hybrid/electric wrongly excludes economical stock. Only add a fuelType when the visitor explicitly names a fuel (petrol/diesel/hybrid/electric). Never invent a fuel-economy (L/100km) figure — there is no such field.',
        },
        {
          phrase: 'easy to park / city car / runabout / small / compact / around town',
          maps: 'a small car: bodyType hatchback (add transmission auto if "easy" clearly implies it).',
        },
        {
          phrase: 'camping / touring / off-road / adventure / outback / 4x4 / beach',
          maps: 'driveType 4wd or awd, and bodyType suv or ute.',
        },
        {
          phrase: 'family / kids / school run / space for the family',
          maps: 'bodyType suv or wagon, and seats 7 or 8 when they mention several children.',
        },
        {
          phrase: 'towing / tow / caravan / trailer / boat',
          maps: 'bodyType ute or suv, and fuelType diesel (torque for towing).',
        },
      ],
      placeholders: [
        'Family SUV with 7 seats under $40,000',
        'Reliable diesel ute for towing, low kms',
        'First car for my daughter, automatic, under $15k',
        'Something economical for the commute',
        'Late-model hybrid with under 50,000 km',
      ],
      typewriter: { typeMs: 45, deleteMs: 25, dwellMs: 1800 },
    },
  },
};

/**
 * Resolve the current dealer's config. Today there is one dealer, so this is a
 * constant; when multi-tenant lands this takes the request/host and returns the
 * matching tenant record. Call this instead of importing `dealerConfig` directly
 * where you want to be forward-compatible with tenant resolution.
 */
export function getDealerConfig(): DealerConfig {
  return dealerConfig;
}
