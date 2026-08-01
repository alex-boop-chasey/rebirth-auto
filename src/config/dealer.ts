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
    /**
     * Agentic inventory search ("Rebi as an agent with tools" —
     * src/ai/agentic/search-agent.ts). The deterministic inventory TOOLS are real
     * and testable, but the model-driven tool-calling LOOP needs a paid
     * tool-capable model plus a provider tool-call transport that src/ai/ does not
     * have yet. DEFAULT OFF — with `enabled: false`, `runAgenticSearch` returns
     * null and NOTHING runs; the live grounded chatbot is entirely unaffected
     * (this feature is not wired into it). Flip to true only once the paid drop-in
     * lands (see the TODO_KEYS marker in search-agent.ts).
     */
    agenticSearch: {
      /** Master on/off. False = feature dormant; the loop and tools never run. */
      enabled: boolean;
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
      /**
       * OPTIONAL manufacturer new-model reference (src/chatbot/grounding/
       * manufacturer.ts, stub in src/stubs/manufacturer.ts). Additive, fail-open,
       * CONTEXT ONLY: when enabled, a known make/model in the visitor's message
       * folds a PRICE-FREE "external, not our inventory" background block. DEFAULT
       * OFF — with `enabled: false` the composed prompt + firewall are identical to
       * today, and the block is excluded from the firewall allow-list even when on.
       */
      manufacturer: {
        /** Master on/off. False keeps Rebi byte-identical to today. */
        enabled: boolean;
        /** Hard cap on key-feature items rendered into the reference block. */
        maxItems: number;
      };
      /**
       * OPTIONAL independent-review reference (src/chatbot/grounding/reviews.ts,
       * stub in src/stubs/reviews.ts). Additive, fail-open, CONTEXT ONLY: when
       * enabled, a known make/model in the visitor's message folds a PRICE-FREE
       * "external, not our inventory" review-sentiment block. DEFAULT OFF — with
       * `enabled: false` the composed prompt + firewall are identical to today, and
       * the block is excluded from the firewall allow-list even when on.
       */
      reviews: {
        /** Master on/off. False keeps Rebi byte-identical to today. */
        enabled: boolean;
        /** Hard cap on the number of pros and of cons rendered into the block. */
        maxItems: number;
      };
      /**
       * OPTIONAL allowlisted web-reference source (src/chatbot/grounding/
       * websearch.ts, stub in src/stubs/websearch.ts). Additive, fail-open,
       * CONTEXT ONLY: when enabled, the visitor's message is used as a query into a
       * hardcoded ALLOWLIST of trusted domains/URLs and any relevant, PRICE-FREE
       * "external, not our inventory" snippet is folded in. DEFAULT OFF — with
       * `enabled: false` the composed prompt + firewall are identical to today, and
       * the block is excluded from the firewall allow-list even when on. Only
       * allowlisted-domain URLs can ever appear (enforced in the stub).
       */
      webSearch: {
        /** Master on/off. False keeps Rebi byte-identical to today. */
        enabled: boolean;
        /**
         * Dealer-editable allowlist of TRUSTED domains/URLs (config as data). The
         * ONLY sources a reference snippet can come from — a non-allowlisted URL is
         * never returned. Entries may be bare domains or full URLs.
         */
        allowlist: readonly string[];
        /** Hard cap on the number of reference snippets rendered into the block. */
        maxItems: number;
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
     * Continuity journey — server-persisted, opaque per-visitor breadcrumb trail
     * (searches, listings viewed, compares, chats) that Rebi folds into its
     * replies for a "picks up where you left off" feel. Fully fail-open: if D1,
     * the table, or the cookie is missing/errors, Rebi behaves exactly as today.
     * Every knob is dealer-tunable. The `enabled` default is safe even before the
     * prod table exists — fail-open covers the not-yet-migrated database.
     */
    journey: {
      /** Master on/off. When false, no cookie is minted and nothing is folded. */
      enabled: boolean;
      /** Name of the opaque visitor-id cookie (no PII — just a random UUID). */
      cookieName: string;
      /** Cookie lifetime (seconds). */
      cookieMaxAgeSeconds: number;
      /** How far back journey events are considered (seconds). */
      retentionSeconds: number;
      /** Hard cap on how many recent events are folded into a prompt. */
      maxEventsFolded: number;
      /** Hard cap on the character length of a stored/rendered event label. */
      maxLabelLength: number;
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
       * LLM query planner — the PRIMARY interpreter (Stage 0) ahead of the regex
       * pre-pass (src/ai/search/query-planner.ts). `enabled:false` OR no
       * OPENROUTER_API_KEY → regex-only, today's behaviour (config-as-data
       * kill-switch). `timeoutMs` bounds the between-submit-and-results wait; on
       * timeout/failure the request falls through to the regex + Stage-2 chain.
       */
      planner: { enabled: boolean; timeoutMs: number };
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
      /**
       * Copy for the inline AI search bubble (SearchDock's "Rebi speaks"
       * message above the pill). All dealer-tunable — no literals in the
       * component. `{count}` in `resultsRefine` is interpolated with the real
       * match total read back from the swapped inventory grid.
       */
      messages: {
        /** Shown with the waiting dots while /api/search + the grid swap run. */
        finding: string;
        /** Applied a filter with matches. Supports a `{count}` token. */
        resultsRefine: string;
        /** Applied a filter but nothing matched. */
        noMatch: string;
        /** Couldn't confidently extract filters (fallback when the server sends none). */
        unclear: string;
        /** Label for the "start over" button shown in the results state. */
        newSearchLabel: string;
      };
      /**
       * Rebi's opening greeting on the Focus Stage. When `showOnLoad` is true the
       * stage seats this card immediately so the shopper is greeted before typing.
       */
      greeting: { showOnLoad: boolean; text: string };
      /**
       * Notification-sound behaviour for the Focus Stage. `enabled` is the master
       * switch (a tenant can ship silent); `defaultMuted` is the initial toggle
       * state before the visitor's own `localStorage` preference (if any) wins.
       */
      sounds: { enabled: boolean; defaultMuted: boolean };
      /**
       * Front-of-house labels and hints for the Focus Stage chrome. Kept in config
       * so a tenant restyles the surface's copy (and its accessible names) without
       * a code edit — the component hardcodes no dealer-facing string.
       */
      stage: {
        /** Submit button + stage aria-label ("Ask Rebi"). */
        askLabel: string;
        /** Tiny label on the frosted shelf where older turns tuck away. */
        shelfLabel: string;
        /** One-line helper under the entry field. */
        hint: string;
        /** Label for the "open the classic filters drawer" link. */
        refineManualLabel: string;
        /** Accessible label for the free-text entry input. */
        inputAriaLabel: string;
        /** Accessible label/title for the sound toggle when sounds are ON. */
        muteLabel: string;
        /** Accessible label/title for the sound toggle when sounds are muted. */
        unmuteLabel: string;
      };
    };
  };
  /**
   * Price history + "Just Reduced" badge. When a listing carries a REAL
   * `priceHistory` (dealer edits / a future POS price feed), the badge and the
   * detail-page history render from THAT honest data. A demo synthesizer fills
   * plausible history for listings with none ONLY behind the STUB_PRICE_HISTORY
   * env flag (dev/demo) — deliberately env, NOT config, so a fabricated drop can
   * never ship in a production config. Every knob here is dealer-tunable.
   */
  priceHistory: {
    /** Master on/off — show the price-history feature (badge + history) at all. */
    enabled: boolean;
    /** "Just Reduced" badge window: a price drop counts as recent within this
     *  many days of the most recent change. */
    justReducedWithinDays: number;
  };
  /**
   * Trade-in valuation ("what's my car worth?"). A standalone shopper tool (the
   * `/trade-in` page + `/api/trade-in` endpoint) backed by a STUBBED Redbook
   * valuation — see docs/briefs/_stub-convention.md. Deliberately NOT under
   * `chat`: it does not touch Rebi. Every dealer-facing string/toggle lives here
   * so a tenant swap restyles it without a code edit.
   */
  tradeIn: {
    /** Master on/off — a dealer can hide the trade-in tool without a deploy. */
    enabled: boolean;
    /** Per-IP rate limit for /api/trade-in (its OWN `tradein:` KV counter). */
    rateLimit: { windowSeconds: number; maxRequests: number };
    /** Front-of-house copy for the trade-in page and its nav link. */
    copy: {
      /** Short nav/link label (e.g. "Trade-in"). */
      navLabel: string;
      /** Page eyebrow kicker. */
      eyebrow: string;
      /** Page H1. */
      heading: string;
      /** One-line intro under the heading. */
      subheading: string;
      /** Submit button label. */
      submitLabel: string;
      /** Loading-state text shown while the estimate is fetched. */
      loadingLabel: string;
    };
  };
  /**
   * Saved searches + email alerts ("save this search, email me new matches").
   * A shopper saves their current canonical filter query (see listings-query.ts)
   * and is "alerted" when new matching stock arrives. Email sending is STUBBED
   * (see docs/briefs/_stub-convention.md and src/stubs/email.ts); persistence is
   * fail-open Cloudflare D1. Deliberately its OWN block (not under `chat`): it does
   * not touch Rebi. Every dealer-facing string/toggle lives here so a tenant swap
   * restyles it without a code edit. The PERIODIC alerting (a scheduled worker that
   * re-runs saved queries and emails matches) is a separate cron-triggered ticket.
   */
  savedSearch: {
    /** Master on/off — a dealer can hide the "Save this search" affordance without a deploy. */
    enabled: boolean;
    /** Per-IP rate limit for /api/saved-search (its OWN `savedsearch:` KV counter). */
    rateLimit: { windowSeconds: number; maxRequests: number };
    /** Front-of-house copy for the save-search affordance and its confirmation email. */
    copy: {
      /** Label on the toggle button that reveals the email-capture (e.g. "Save this search"). */
      toggleLabel: string;
      /** Heading shown above the email input when the capture is open. */
      heading: string;
      /** One-line description under the heading. */
      description: string;
      /** Placeholder for the email input. */
      emailPlaceholder: string;
      /** Submit button label. */
      submitLabel: string;
      /** Inline success message after a save. */
      successMessage: string;
      /** Inline generic-failure message. */
      errorMessage: string;
      /** Inline message when the entered email is invalid. */
      invalidEmailMessage: string;
      /** Inline message when the per-IP rate limit is hit. */
      rateLimitMessage: string;
      /** Subject line of the stubbed confirmation email. */
      emailSubject: string;
      /** Lead line of the confirmation email body ("We'll email you when new matches arrive."). */
      emailIntro: string;
    };
  };
  /**
   * Book-a-service — a service-department booking REQUEST flow (the `/service`
   * page + `/api/book-service` endpoint). A shopper asks for a service; the
   * dealer's team then confirms a time out-of-band. This is deliberately a
   * REQUEST, never a confirmed appointment: there is NO calendar/POS integration
   * here (that's a separate deferred ticket), so the copy must never assert a
   * locked booking or invent availability. Confirmation email to the shopper AND
   * the dealer notification are STUBBED (see docs/briefs/_stub-convention.md and
   * src/stubs/email.ts); persistence is fail-open Cloudflare D1. Its OWN block
   * (not under `chat`) — it does not touch Rebi. Every dealer-facing string,
   * toggle, and the offered service-type list lives here so a tenant swap
   * restyles it without a code edit.
   */
  service: {
    /** Master on/off — a dealer can hide the booking tool without a deploy. */
    enabled: boolean;
    /** Per-IP rate limit for /api/book-service (its OWN `service:` KV counter). */
    rateLimit: { windowSeconds: number; maxRequests: number };
    /**
     * The service types this dealer offers, in display order. Populates the form
     * dropdown AND is the server-side allow-list the API validates against — a
     * booking whose `serviceType` isn't in this list is rejected. Dealer-editable
     * copy; NEVER hardcoded in the page or the endpoint.
     */
    serviceTypes: readonly string[];
    /**
     * Where the dealer receives the stubbed booking-request notification. A
     * dealer-specific address — never hardcoded in the endpoint.
     */
    notifyEmail: string;
    /** Front-of-house copy for the booking page, its nav link, and both emails. */
    copy: {
      /** Short nav/link label (e.g. "Book a service"). */
      navLabel: string;
      /** Page eyebrow kicker. */
      eyebrow: string;
      /** Page H1. */
      heading: string;
      /** One-line intro under the heading. Must read as a REQUEST, not a booking. */
      subheading: string;
      /** Submit button label. */
      submitLabel: string;
      /** Loading-state text shown while the request is sent. */
      loadingLabel: string;
      /** Small helper line about hours / turnaround. Sets the "we'll confirm" expectation. */
      hours: string;
      /**
       * Inline success message. MUST frame this as a request the team will
       * confirm — never "your appointment is booked".
       */
      successMessage: string;
      /** Inline generic-failure message. */
      errorMessage: string;
      /** Inline message when a required field is missing/invalid. */
      invalidMessage: string;
      /** Inline message when the per-IP rate limit is hit. */
      rateLimitMessage: string;
      /** Subject line of the stubbed shopper confirmation email. */
      emailSubject: string;
      /**
       * Lead line of the shopper confirmation email. MUST say the request was
       * received and the team will confirm a time — never assert a booked slot.
       */
      emailIntro: string;
      /** Subject line of the stubbed dealer notification email. */
      dealerEmailSubject: string;
    };
  };
  /**
   * Finance & repayments — a CLIENT-SIDE indicative repayment calculator (the
   * `/finance` page). NO lender/product names and NO approval claims: the copy is
   * generic and config-driven and the figure is explicitly indicative, not a quote
   * or an offer of finance (DECISIONS.md determinism). Deliberately its OWN block
   * (not under `chat`) — it does not touch Rebi. Every dealer-facing default and
   * string lives here so a tenant swap restyles it without a code edit.
   */
  finance: {
    /** Master on/off — a dealer can hide the finance tool without a deploy. */
    enabled: boolean;
    /** Default comparison rate (% p.a.) seeding the calculator. Indicative ONLY — never an offer of finance. */
    defaultAprPct: number;
    /** Default loan term in months. */
    defaultTermMonths: number;
    /** Default deposit as a percentage of the vehicle price. */
    depositPct: number;
    /** Fallback vehicle price when the page is opened without a `?price=`. */
    fallbackPrice: number;
    /** Slider bounds — dealer-tunable, never hardcoded in the page. */
    bounds: {
      price: { min: number; max: number };
      deposit: { min: number; max: number };
      termMonths: { min: number; max: number };
      aprPct: { min: number; max: number };
    };
    /** Front-of-house copy for the finance page and its nav link. */
    copy: {
      /** Short nav/link label (e.g. "Finance"). */
      navLabel: string;
      /** Page eyebrow kicker. */
      eyebrow: string;
      /** Page H1. */
      heading: string;
      /** One-line intro under the heading. */
      subheading: string;
      /** MUST make clear the figure is indicative — not a quote or an offer of finance. */
      disclaimer: string;
    };
  };
  /**
   * Offers & specials — CONFIG-AS-DATA current deals (the `/offers` page). The
   * `items` array is the single source of truth; DEFAULT [] renders a graceful
   * empty state. NEVER fabricate a deal, price, or discount (DECISIONS.md
   * determinism) — an offer only appears when the dealer has entered it here. Its
   * OWN block (not under `chat`). Every dealer-facing string lives here.
   */
  offers: {
    /** Master on/off — a dealer can hide the offers page without a deploy. */
    enabled: boolean;
    /**
     * The dealer's CURRENT deals, in display order. DEFAULT [] → the page shows a
     * "no current offers" state. NEVER invent an entry; only real, dealer-entered
     * deals belong here.
     */
    items: readonly DealerOffer[];
    /** Front-of-house copy for the offers page and its nav link. */
    copy: {
      /** Short nav/link label (e.g. "Offers"). */
      navLabel: string;
      /** Page eyebrow kicker. */
      eyebrow: string;
      /** Page H1. */
      heading: string;
      /** One-line intro under the heading. */
      subheading: string;
      /** Heading shown when `items` is empty. */
      emptyHeading: string;
      /** Body shown when `items` is empty. */
      emptyBody: string;
      /** Small print under the offers grid. */
      disclaimer: string;
    };
  };
  /**
   * Sell your car — an OUTRIGHT-SALE valuation-intake form (the `/sell` page +
   * `/api/sell-enquiry` endpoint). Distinct from a trade-in: the shopper walks
   * away with cash, no purchase required. The submission is captured to a STUBBED
   * lead/CRM integration (src/stubs/sell-enquiry.ts) — no real spend, PII, or
   * write; see docs/briefs/_stub-convention.md. A REQUEST for an indicative offer,
   * never a firm figure: the copy must never assert a locked price. Its OWN block
   * (not under `chat`). Every dealer-facing string/toggle lives here.
   */
  sell: {
    /** Master on/off — a dealer can hide the sell tool without a deploy. */
    enabled: boolean;
    /** Per-IP rate limit for /api/sell-enquiry (its OWN `sell:` KV counter). */
    rateLimit: { windowSeconds: number; maxRequests: number };
    /** Where the dealer receives the stubbed sell-enquiry lead. Dealer-specific. */
    notifyEmail: string;
    /** Front-of-house copy for the sell page and its nav link. */
    copy: {
      /** Short nav/link label (e.g. "Sell your car"). */
      navLabel: string;
      /** Page eyebrow kicker. */
      eyebrow: string;
      /** Page H1. */
      heading: string;
      /** One-line intro under the heading. */
      subheading: string;
      /** Submit button label. */
      submitLabel: string;
      /** Loading-state text shown while the enquiry is sent. */
      loadingLabel: string;
      /** MUST frame this as an enquiry the team will follow up — never a locked offer. */
      successMessage: string;
      /** Inline generic-failure message. */
      errorMessage: string;
      /** Inline message when a required field is missing/invalid. */
      invalidMessage: string;
      /** Inline message when the per-IP rate limit is hit. */
      rateLimitMessage: string;
      /** Small print under the form — indicative only, final after inspection. */
      disclaimer: string;
    };
  };
  /**
   * Book a test drive — a booking-REQUEST form (the `/test-drive` page +
   * `/api/book-test-drive` endpoint). Reads `?vehicle=<slug>` to prefill the
   * chosen car from REAL inventory. The submission goes to a STUBBED booking
   * integration (src/stubs/test-drive.ts) — no real calendar write; see
   * docs/briefs/_stub-convention.md. A REQUEST, never a confirmed slot: the copy
   * must never assert a locked time or invent availability. Its OWN block (not
   * under `chat`). Every dealer-facing string/toggle lives here.
   */
  testDrive: {
    /** Master on/off — a dealer can hide the test-drive tool without a deploy. */
    enabled: boolean;
    /** Per-IP rate limit for /api/book-test-drive (its OWN `testdrive:` KV counter). */
    rateLimit: { windowSeconds: number; maxRequests: number };
    /** Where the dealer receives the stubbed test-drive request. Dealer-specific. */
    notifyEmail: string;
    /** Front-of-house copy for the test-drive page and its nav link. */
    copy: {
      /** Short nav/link label (e.g. "Book a test drive"). */
      navLabel: string;
      /** Page eyebrow kicker. */
      eyebrow: string;
      /** Page H1. */
      heading: string;
      /** One-line intro under the heading. */
      subheading: string;
      /** Submit button label. */
      submitLabel: string;
      /** Loading-state text shown while the request is sent. */
      loadingLabel: string;
      /** MUST frame this as a request the team will confirm — never "your drive is booked". */
      successMessage: string;
      /** Inline generic-failure message. */
      errorMessage: string;
      /** Inline message when a required field is missing/invalid. */
      invalidMessage: string;
      /** Inline message when the per-IP rate limit is hit. */
      rateLimitMessage: string;
    };
  };
  /**
   * Customer accounts — REAL Supabase auth ("my account"): the /login, /signup,
   * /account, /check-email and /reset-password routes plus src/middleware.ts and
   * the Supabase-backed Astro actions (src/actions/index.ts). Sign-in is real
   * (Supabase Auth + Cloudflare Turnstile), so this is NOT a demo stub. DEFAULT
   * behaviour is still gated: `enabled` is the single on/off seam for the whole
   * surface (off = every route redirects home and the middleware no-ops).
   *
   * PRODUCTION NOTE: real customer PII still warrants the paid human security
   * review DECISIONS.md mandates before launch — see the TODO_KEYS marker in
   * src/pages/account.astro and TODO_KEYS.md. Its OWN block (not under `chat`) —
   * it does not touch Rebi. Every dealer-facing string/toggle lives here so a
   * tenant swap restyles it without a code edit.
   */
  accounts: {
    /** Master on/off for the whole auth surface (login/signup/account/reset). */
    enabled: boolean;
    /** Reserved per-IP rate limit for account endpoints (its OWN `account:` KV counter). */
    rateLimit: { windowSeconds: number; maxRequests: number };
    /** Front-of-house copy for the account surface and its nav link. */
    copy: {
      /** Short nav/link label (e.g. "My account"). */
      navLabel: string;
      /** Account-page eyebrow kicker. */
      eyebrow: string;
      /** Account-page H1 / title base. */
      heading: string;
      /** One-line intro / meta description for the account surface. */
      subheading: string;
      /** Heading above the service-history section on the account page. */
      serviceHistoryHeading: string;
      /** Label for the link through to saved searches. */
      savedSearchesLabel: string;
    };
  };
  /**
   * Dealer listing-creation PWA ("capture") — the standalone `/capture` surface
   * where a dealer photographs a car, records a short voice note, and/or enters a
   * rego/VIN and gets a complete DRAFT listing to review before publishing. A
   * SEPARATE dealer surface (its OWN installable PWA, scoped service worker), so
   * it is deliberately its own block (not under `ai`/`chat`) and DEFAULT OFF — a
   * dealer opts in. Every external it touches is STUBBED (VIN/OEM lookup, vision
   * extraction, voice transcription) and the Sanity write is OWNER-GATED: the
   * pipeline only ever assembles + validates a draft and hands it to a STUB
   * writer (src/stubs/listing-writer.ts) that returns a MOCK id — no real Sanity
   * write ever happens here, and no write token is ever client-side (see
   * TODO_KEYS.md). Every dealer-facing string/toggle lives here so a tenant swap
   * restyles it without a code edit.
   */
  capture: {
    /** Master on/off — a SEPARATE dealer surface, DEFAULT OFF (opt-in). While off,
     *  the /capture pages redirect home and the /api/capture/* endpoints return 404. */
    enabled: boolean;
    /** Per-IP rate limit for the /api/capture/* endpoints (its OWN `capture:` KV counter). */
    rateLimit: { windowSeconds: number; maxRequests: number };
    /**
     * Origin allowlist for the capture endpoints (same discipline as
     * ai.studioOrigins) — the endpoints only accept requests from the dealer's
     * own PWA origin. NEVER hardcode the origin in an endpoint; it reads this.
     */
    allowedOrigins: string[];
    /** Hard cap on photos accepted in one extraction (bounds work + payload). */
    maxImages: number;
    /** Hard cap on the character length of a submitted voice transcript. */
    maxTranscriptLength: number;
    /**
     * Minimum fuzzy-match score (0–1) the make/model reference resolver must reach
     * against real inventory to count as a CONFIDENT match. Below this the UI is
     * signalled to prompt "create new?" — a reference is NEVER silently invented.
     */
    referenceMatchThreshold: number;
    /** Front-of-house copy for the capture PWA (installable name, headings, prompts). */
    copy: {
      /** PWA short name / nav label. */
      appName: string;
      /** Page H1 on the capture screen. */
      heading: string;
      /** One-line intro under the heading. */
      subheading: string;
      /** Label for the VIN/rego lookup submit. */
      lookupLabel: string;
      /** Label for the "assemble draft" action. */
      assembleLabel: string;
      /** Label for the final "create draft" button (draft-only, never publish). */
      createDraftLabel: string;
      /** Message shown when the browser lacks Web Speech (voice) support. */
      voiceUnsupported: string;
      /** Prompt shown when make/model can't be confidently resolved. */
      createNewReferencePrompt: string;
    };
  };
  /**
   * Third-party syndication integrations — pushing a listing OUT to external
   * marketplaces. Today: carsales.com.au. The upload itself is STUBBED (see
   * docs/briefs/_stub-convention.md and src/stubs/carsales.ts); this block only
   * holds the dealer-facing toggle + copy so a tenant swap restyles it without a
   * code edit. DEFAULT OFF — a dealer opts in (and a real CARSALES_API_KEY +
   * account is a separate go-live step, see TODO_KEYS.md). It is deliberately
   * its OWN block (not under `ai`/`chat`): it does not touch Rebi or the AI layer.
   */
  integrations: {
    /** carsales.com.au listing syndication (the Studio "Upload to carsales" action). */
    carsales: {
      /** Master on/off — the Studio action only appears for a dealer who opts in. */
      enabled: boolean;
      /**
       * Per-IP rate limit for /api/carsales-upload (its OWN `carsales:` KV counter).
       * Studio authoring is low-volume, but still capped to bound abuse.
       */
      rateLimit: { windowSeconds: number; maxRequests: number };
      /** Short label for the Studio document action (e.g. "Upload to carsales"). */
      actionLabel: string;
    };
  };
}

/**
 * A single current deal shown on `/offers`. CONFIG AS DATA — the `offers.items`
 * array is the only source; the page never invents one. `brand`/`tag` are the
 * dealer's own words (no fabricated discounts). `href` is where "View stock" goes
 * (a listings filter URL or a landing page); it defaults to the inventory grid.
 */
export interface DealerOffer {
  /** Stable id (used as the render key). */
  id: string;
  /** Short badge, the dealer's own wording (e.g. "Drive-away", "Low rate"). */
  tag: string;
  /** Deal headline. */
  title: string;
  /** One-line description of the deal. */
  description: string;
  /** Optional brand label shown on the card. */
  brand?: string;
  /** Optional "View stock" destination (defaults to /listings). */
  href?: string;
}

// Sort options are a fixed whitelist (see src/lib/listings-query.ts for how each
// maps to a GROQ order clause). `newest` is the safe default.
export type SortKey = 'newest' | 'price-asc' | 'price-desc' | 'year-desc' | 'odo-asc';

// The voices the AI description generator can write in. Kept as a `const` tuple —
// the single source of truth — so it is available BOTH as a runtime list (the
// Studio tone selector reads it; the endpoint validates against it — nothing
// hardcodes the tone vocabulary) AND as a literal-union type derived from it (a
// config with an unknown tone fails typecheck rather than reaching the prompt).
export const DESCRIPTION_TONES = [
  'confident-professional',
  'friendly-casual',
  'premium-restrained',
] as const;
export type DescriptionTone = (typeof DESCRIPTION_TONES)[number];

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
  | 'colour'
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
    // Years this dealer offers, newest-first: current calendar year → 2000.
    // A LAZY GETTER, not a value computed at module load. On Cloudflare Workers the
    // clock is pinned to the Unix epoch during global-scope (module) evaluation, so a
    // top-level `new Date().getFullYear()` returns 1970 and the descending loop
    // produces an EMPTY list — the cause of empty year dropdowns in production.
    // Reading per-access defers the clock read to SSR render, which runs inside a
    // request where the clock is live, so the upper bound still advances
    // automatically on each render without a redeploy.
    get yearOptions(): readonly number[] {
      const years: number[] = [];
      for (let y = new Date().getFullYear(); y >= 2000; y--) years.push(y);
      return years;
    },
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
      'colour',
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
    // Agentic search — DEFAULT OFF. The tools are real; the tool-calling loop is
    // the paid drop-in (see src/ai/agentic/search-agent.ts). Not wired into the
    // live chatbot — flipping this changes nothing about Rebi's grounded chat.
    agenticSearch: {
      enabled: false,
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
        // A household's family car — especially a second car — is overwhelmingly a
        // 5-seat hatch/wagon/SUV, not a people-mover. Shared with the regex
        // fallback AND the LLM planner so both paths agree (family-trap fix).
        familySeats: [5],
      },
      // OPTIONAL supplementary reference sources — DEFAULT OFF. With enabled:false
      // the composed system prompt and the anti-hallucination firewall are
      // byte-identical to today; flip to true to fold the external, price-free
      // reference blocks (see grounding/manufacturer.ts and grounding/reviews.ts).
      manufacturer: {
        enabled: false,
        maxItems: 4,
      },
      reviews: {
        enabled: false,
        maxItems: 3,
      },
      // OPTIONAL allowlisted web-reference source — DEFAULT OFF. With
      // enabled:false the composed system prompt and the anti-hallucination
      // firewall are byte-identical to today. `allowlist` is dealer-editable
      // config-as-data: the ONLY trusted domains/URLs a reference snippet may come
      // from (a manufacturer site + AU government / safety sources here). Flip to
      // true to fold the external, price-free reference block (see
      // grounding/websearch.ts).
      webSearch: {
        enabled: false,
        allowlist: [
          'ancap.com.au',
          'greenvehicleguide.gov.au',
          'mazda.com.au',
        ],
        maxItems: 3,
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
    journey: {
      enabled: true,
      cookieName: 'reb_vid',
      cookieMaxAgeSeconds: 15552000, // 180 days
      retentionSeconds: 15552000, // 180 days
      maxEventsFolded: 8,
      maxLabelLength: 80,
    },
    search: {
      enabled: true,
      maxQueryLength: 300,
      // Shopper search is higher-volume than Studio authoring but still capped
      // per-IP to bound AI cost. Generous for genuine refining.
      rateLimit: { windowSeconds: 3600, maxRequests: 30 },
      // LLM query planner (Stage 0) — primary interpreter ahead of the regex
      // pre-pass. `enabled:false` OR no OPENROUTER_API_KEY → regex-only (today's
      // behaviour). timeoutMs sits between submit and results: 7s leaves room for
      // one structured-tier shot plus a repair retry on the Haiku-class model while
      // keeping perceived latency acceptable; on exceed we fall back to the regex
      // chain (always the floor), so a slow model degrades rather than blocks.
      planner: { enabled: true, timeoutMs: 7000 },
      // Soft phrases → enum filters. The model must still emit only valid codes;
      // these teach it how this dealer's buyers describe intent. P-plate / licence
      // status is deliberately NOT a filter dimension — the guidance says to map
      // the practical intent (small, auto, budget) and never invent a dimension.
      concepts: [
        {
          phrase: 'first car / P-plate / P-plater / L-plate / learner / new driver / young driver',
          maps: 'a small, easy-to-drive automatic: bodyType hatchback, transmission auto. Where budget is implied but unstated, do NOT invent a priceMax — leave it null and flag budget instead. P-plate/licence status is NOT a filter — do not invent one; just map the practical intent and you may note the assumption in interpretation.',
        },
        {
          phrase: 'economical / cheap to run / good on fuel / low fuel / low fuel economy / fuel efficient / save on petrol',
          maps: 'running COST, not a fuel type: bodyType hatchback (small). Do NOT emit a fuelType — a small petrol car is cheap to run, so forcing hybrid/electric wrongly excludes economical stock. Only add a fuelType when the visitor explicitly names a fuel (petrol/diesel/hybrid/electric). Where budget is implied but unstated, do NOT invent a priceMax — flag budget instead. Never invent a fuel-economy (L/100km) figure — a fuel-economy figure may exist per vehicle; never invent one when a vehicle lacks it.',
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
          // The "5" here MUST track `chat.grounding.lookup.familySeats` above (both
          // are 5). Written literally (not a token) because this string renders RAW
          // into BOTH the LLM planner prompt and the legacy Stage-2 SYSTEM_PROMPT —
          // a placeholder would leak unexpanded into the latter.
          maps: 'seats 5 — room for the family; do NOT force a body type (a family car can be a hatch, wagon, sedan or SUV); use 7–8 seats ONLY on explicit large-family cues (several kids / third row / people-mover / a stated 7+).',
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
      messages: {
        finding: 'Finding your results…',
        resultsRefine:
          'Here are your {count} matches — tell me more to narrow it down, or start a new search.',
        noMatch: 'Nothing matched that one — try describing it a different way.',
        unclear:
          "I couldn't quite pin that down — try adding a budget, body type, or fuel type.",
        newSearchLabel: 'New search',
      },
      greeting: {
        showOnLoad: true,
        text: "G'day — I'm Rebi. Tell me what you're after and I'll comb the lot for you.",
      },
      sounds: { enabled: true, defaultMuted: false },
      stage: {
        askLabel: 'Ask Rebi',
        shelfLabel: 'earlier',
        hint: 'Ask in plain English — Rebi reads your search and lines up the matches.',
        refineManualLabel: 'Refine manually',
        inputAriaLabel: "Describe the car you're looking for",
        muteLabel: 'Mute notification sounds',
        unmuteLabel: 'Unmute notification sounds',
      },
    },
  },
  priceHistory: {
    enabled: true,
    // A drop shown as "Just Reduced" is one whose most recent change landed
    // within the last 30 days. Dealer-tunable.
    justReducedWithinDays: 30,
  },
  tradeIn: {
    enabled: true,
    // Shopper-facing valuation; capped per-IP to bound abuse. Generous for a
    // genuine "value a couple of cars" session.
    rateLimit: { windowSeconds: 3600, maxRequests: 30 },
    copy: {
      navLabel: 'Trade-in',
      eyebrow: 'Trade-in valuation',
      heading: "What's your car worth?",
      subheading:
        "Tell us a few details and we'll give you an indicative trade-in range in seconds. " +
        "Bring it in and we'll confirm with a quick inspection.",
      submitLabel: 'Get my estimate',
      loadingLabel: 'Valuing your car…',
    },
  },
  savedSearch: {
    enabled: true,
    // Saving a search is a light action but still capped per-IP to bound abuse
    // (and stubbed-email noise). Generous for a genuine shopper.
    rateLimit: { windowSeconds: 3600, maxRequests: 20 },
    copy: {
      toggleLabel: 'Save this search',
      heading: 'Get an email when new matches arrive',
      description: "We'll email you when new stock matches these filters. No account needed.",
      emailPlaceholder: 'you@example.com',
      submitLabel: 'Notify me',
      successMessage: "Saved — we'll email you when new matches arrive.",
      errorMessage: "Sorry, we couldn't save that search. Please try again.",
      invalidEmailMessage: 'Please enter a valid email address.',
      rateLimitMessage: 'You have saved a few searches already — please try again later.',
      emailSubject: 'Your saved search is set up',
      emailIntro: "We'll email you when new matches arrive.",
    },
  },
  service: {
    enabled: true,
    // Booking a service is a light action but still capped per-IP to bound abuse
    // (and stubbed-email noise). Generous for a genuine shopper.
    rateLimit: { windowSeconds: 3600, maxRequests: 15 },
    // The services THIS dealer offers. Dealer-editable — the form dropdown and the
    // API allow-list both read this; nothing is hardcoded in the page/endpoint.
    serviceTypes: [
      'Logbook service',
      'Brakes',
      'Tyres',
      'Air-con regas',
      'General inspection',
    ],
    // Stubbed notification target — the dealer's service desk. Dealer-specific.
    notifyEmail: 'service@rebirthauto.example',
    copy: {
      navLabel: 'Book a service',
      eyebrow: 'Service department',
      heading: 'Book a service',
      subheading:
        'Send us a service request and our team will get back to you to confirm a time. ' +
        'Tell us about your car and what it needs — no appointment is locked in until we confirm.',
      submitLabel: 'Request a booking',
      loadingLabel: 'Sending your request…',
      hours: 'Service desk: Mon–Fri, 7:30am–5pm. We reply to requests within one business day.',
      successMessage:
        "Thanks — we've received your request. Our team will be in touch to confirm a time. " +
        'This is a request, not a confirmed appointment.',
      errorMessage: "Sorry, we couldn't send that request. Please try again.",
      invalidMessage: 'Please fill in your name, a valid email, your vehicle, and a service type.',
      rateLimitMessage: 'You have sent a few requests already — please try again later.',
      emailSubject: 'We received your service request',
      emailIntro:
        "Thanks for your service request — we've received it and our team will contact you to " +
        'confirm a time. Nothing is booked yet; this just starts the conversation.',
      dealerEmailSubject: 'New service booking request',
    },
  },
  finance: {
    enabled: true,
    // Indicative comparison rate seeding the calculator. NOT an offer of finance —
    // a real rate depends on the applicant + product. Dealer-tunable.
    defaultAprPct: 6.9,
    defaultTermMonths: 60,
    depositPct: 10,
    // Used when /finance is opened with no ?price= (direct nav / footer link).
    fallbackPrice: 45000,
    bounds: {
      // Align the top of the price slider with the dealer's inventory price cap.
      price: { min: 5000, max: 150000 },
      deposit: { min: 0, max: 60000 },
      // 1–7 years.
      termMonths: { min: 12, max: 84 },
      aprPct: { min: 3, max: 15 },
    },
    copy: {
      navLabel: 'Finance',
      eyebrow: 'Finance & repayments',
      heading: 'Work out the repayment, then the car',
      subheading:
        'Move the sliders for an indicative weekly or monthly figure. Open this from a car ' +
        "and the price is filled in for you.",
      disclaimer:
        'Indicative estimate only — not a quote, an approval, or an offer of finance. Figures ' +
        'are calculated from the values you enter and exclude fees and charges. Any finance is ' +
        'subject to application and approval.',
    },
  },
  offers: {
    enabled: true,
    // CONFIG AS DATA — the dealer's real current deals go here. DEFAULT [] so the
    // page shows an honest "no current offers" state rather than a fabricated deal
    // (determinism). Never invent an entry.
    items: [],
    copy: {
      navLabel: 'Offers',
      eyebrow: 'Offers & specials',
      heading: 'Current offers',
      subheading:
        'Live specials across the yard. When there is a deal on, you will find it here — ' +
        'folded together with the finance calculator so you can check the repayment.',
      emptyHeading: 'No current offers right now',
      emptyBody:
        "There are no live specials at the moment. New stock and deals land often — browse the " +
        'range, work out a repayment, or ask Rebi to keep an eye out for you.',
      disclaimer:
        'Offers are the dealership’s own current specials. Availability and terms may change — ' +
        'talk to us to confirm the details for your situation.',
    },
  },
  sell: {
    enabled: true,
    // Shopper-facing lead form; capped per-IP to bound abuse + stub noise.
    rateLimit: { windowSeconds: 3600, maxRequests: 15 },
    // Stubbed lead target — the dealer's buying desk. Dealer-specific.
    notifyEmail: 'buying@rebirthauto.example',
    copy: {
      navLabel: 'Sell your car',
      eyebrow: 'Sell outright',
      heading: 'Sell us your car — no purchase required',
      subheading:
        'Different to a trade-in: walk away with the cash. Tell us about your car and we will ' +
        'come back with an indicative offer, confirmed after a quick inspection.',
      submitLabel: 'Request an offer',
      loadingLabel: 'Sending your details…',
      successMessage:
        "Thanks — we've received your details and our buying team will be in touch with an " +
        'indicative offer. This is an enquiry, not a confirmed price.',
      errorMessage: "Sorry, we couldn't send that enquiry. Please try again.",
      invalidMessage: 'Please fill in your name, a valid email, and your car’s make, model, year and odometer.',
      rateLimitMessage: 'You have sent a few enquiries already — please try again later.',
      disclaimer:
        'Indicative only — any final offer is subject to a physical inspection of your vehicle. ' +
        'No obligation, and no purchase from us required.',
    },
  },
  testDrive: {
    enabled: true,
    // Shopper-facing booking request; capped per-IP to bound abuse + stub noise.
    rateLimit: { windowSeconds: 3600, maxRequests: 15 },
    // Stubbed request target — the dealer's sales desk. Dealer-specific.
    notifyEmail: 'sales@rebirthauto.example',
    copy: {
      navLabel: 'Book a test drive',
      eyebrow: 'Test drive',
      heading: 'Book a test drive',
      subheading:
        'Pick a car and a time that suits and we will have it ready. This sends a request — ' +
        'we confirm the time with you by phone.',
      submitLabel: 'Request this time',
      loadingLabel: 'Sending your request…',
      successMessage:
        "Thanks — we've received your request and our team will call to confirm a time. " +
        'Nothing is locked in until we confirm.',
      errorMessage: "Sorry, we couldn't send that request. Please try again.",
      invalidMessage: 'Please fill in your name, a way to contact you, and a preferred date.',
      rateLimitMessage: 'You have sent a few requests already — please try again later.',
    },
  },
  accounts: {
    // REAL Supabase auth. `enabled` is the single on/off seam for the whole
    // surface: off = /login, /signup, /account, /check-email, /reset-password all
    // redirect home and src/middleware.ts no-ops. Production launch with real
    // customer PII is still gated on the DECISIONS.md security review — see the
    // TODO_KEYS marker in src/pages/account.astro and TODO_KEYS.md.
    enabled: true,
    // Reserved per-IP cap for future account endpoints; the auth actions carry
    // their own Turnstile + Supabase rate limiting today.
    rateLimit: { windowSeconds: 3600, maxRequests: 20 },
    copy: {
      navLabel: 'My account',
      eyebrow: 'Customer account',
      heading: 'Your account',
      subheading:
        'Sign in to see your service history, saved searches, and the vehicles you are interested in.',
      serviceHistoryHeading: 'Service history',
      savedSearchesLabel: 'Browse inventory to save a search',
    },
  },
  capture: {
    // DEFAULT OFF — the listing-creation PWA is a SEPARATE dealer surface a dealer
    // opts into. While off, /capture redirects home and /api/capture/* return 404.
    // Even when enabled EVERY external is stubbed and the Sanity write is
    // owner-gated (a mock draft id, never a real write) — see TODO_KEYS.md.
    enabled: true,
    // Studio-style authoring volume; still capped per-IP to bound abuse + stub cost.
    rateLimit: { windowSeconds: 3600, maxRequests: 40 },
    allowedOrigins: [
      'http://localhost:4321', // `astro dev`
      'https://rebirth-listings-auto.alexharris0079.workers.dev', // prod origin
    ],
    maxImages: 6,
    maxTranscriptLength: 2000,
    // 0.72 → a strong-but-not-exact fuzzy match; below this the UI prompts
    // "create new?" rather than binding to an inventory make/model.
    referenceMatchThreshold: 0.72,
    copy: {
      appName: 'Rebirth Capture',
      heading: 'Create a listing',
      subheading:
        'Photograph the car, add a quick voice note, and/or enter a rego or VIN. ' +
        "We'll assemble a draft for you to review — nothing is published automatically.",
      lookupLabel: 'Look up VIN / rego',
      assembleLabel: 'Assemble draft',
      createDraftLabel: 'Create draft (review before publishing)',
      voiceUnsupported:
        'Voice capture is not supported in this browser — you can still type notes below.',
      createNewReferencePrompt:
        "We couldn't match that make/model to your existing inventory. Create it as new?",
    },
  },
  integrations: {
    carsales: {
      // DEFAULT OFF — a dealer opts into carsales syndication. While off, the
      // Studio "Upload to carsales" action is not registered and the endpoint
      // returns 404. Going live also needs a real CARSALES_API_KEY + account
      // (see TODO_KEYS.md); until then the upload is stubbed even when enabled.
      enabled: false,
      // Low-volume Studio action, still capped per-IP to bound abuse.
      rateLimit: { windowSeconds: 3600, maxRequests: 20 },
      actionLabel: 'Upload to carsales',
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
