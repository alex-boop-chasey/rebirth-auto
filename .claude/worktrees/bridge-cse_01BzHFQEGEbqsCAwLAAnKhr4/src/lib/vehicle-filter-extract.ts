/**
 * Deterministic vehicle-filter extraction (PORTABLE / client-safe).
 * ------------------------------------------------------------------
 * Turns a shopper's plain-English phrase into a canonical `FilterState` via
 * enum-code + synonym matching — NO LLM, NO network, NO Sanity. Its only imports
 * are `parseFilters` (which validates + drops unknown codes) and the dealer
 * config, both dependency-light, so this module bundles cleanly into the browser
 * (used client-side by the chat widget's "type it to Rebi" refine) AND runs
 * server-side (the chat live-lookup grounding + the `/api/search` pre-pass).
 *
 * The extracted state is produced by feeding synthetic URL params through the
 * SAME `parseFilters` the URL filter contract uses, so a chat lookup, a hero
 * search, and a `/?bodyType=suv&priceMax=40000` link all resolve to an identical
 * `FilterState`. There is no parallel filter type.
 */
import { parseFilters, type FilterState } from './listings-query';
import { getDealerConfig } from '../config/dealer';

// --- Synonym maps (buyer phrasing → canonical enum code) ----------------------
// Keys are matched as whole words (with an optional trailing plural "s").
const BODY_SYNONYMS: Record<string, string> = {
  sedan: 'sedan',
  hatch: 'hatchback',
  hatchback: 'hatchback',
  suv: 'suv',
  '4wd wagon': 'suv',
  ute: 'ute',
  pickup: 'ute',
  'pick-up': 'ute',
  wagon: 'wagon',
  estate: 'wagon',
  van: 'van',
  coupe: 'coupe',
  convertible: 'convertible',
  cabrio: 'convertible',
  cabriolet: 'convertible',
};
// Base colour families. Multi-select downstream (FilterState.colour), like
// bodyType — "red or white" yields both. "gray"/"grey" both map to grey.
const COLOUR_SYNONYMS: Record<string, string> = {
  white: 'white',
  ivory: 'white',
  cream: 'white',
  pearl: 'white',
  black: 'black',
  silver: 'silver',
  grey: 'grey',
  gray: 'grey',
  charcoal: 'grey',
  gunmetal: 'grey',
  graphite: 'grey',
  slate: 'grey',
  blue: 'blue',
  navy: 'blue',
  red: 'red',
  burgundy: 'red',
  maroon: 'red',
  crimson: 'red',
  green: 'green',
  gold: 'gold',
  champagne: 'gold',
  brown: 'brown',
  beige: 'brown',
  tan: 'brown',
  bronze: 'brown',
  orange: 'orange',
  yellow: 'yellow',
  purple: 'purple',
};
const TRANSMISSION_SYNONYMS: Record<string, string> = {
  auto: 'auto',
  automatic: 'auto',
  manual: 'manual',
  'stick shift': 'manual',
};
const FUEL_SYNONYMS: Record<string, string> = {
  petrol: 'petrol',
  unleaded: 'petrol',
  diesel: 'diesel',
  hybrid: 'hybrid',
  electric: 'electric',
  ev: 'electric',
  lpg: 'lpg',
  gas: 'lpg',
};
const DRIVE_SYNONYMS: Record<string, string> = {
  '2wd': '2wd',
  fwd: '2wd',
  rwd: '2wd',
  'two wheel drive': '2wd',
  awd: 'awd',
  'all wheel drive': 'awd',
  '4wd': '4wd',
  '4x4': '4wd',
  'four wheel drive': '4wd',
  'four-wheel drive': '4wd',
};
const CONDITION_SYNONYMS: Record<string, string> = {
  new: 'new',
  used: 'used',
  'second hand': 'used',
  'second-hand': 'used',
  'pre-owned': 'used',
  preowned: 'used',
  demo: 'demo',
  demonstrator: 'demo',
};
// --- AI-derived soft dimensions (aiAttributes) --------------------------------
// Deterministic synonym maps mirroring the fixed enum codes on the Sanity
// `aiAttributes` object. Multi-select downstream (FilterState), like fuelType.
const RUNNING_COST_SYNONYMS: Record<string, string> = {
  'cheap to run': 'low',
  economical: 'low',
  'cheap on fuel': 'low',
  'fuel efficient': 'low',
};
const USAGE_FIT_SYNONYMS: Record<string, string> = {
  // city / runabout
  'city car': 'city',
  city: 'city',
  runabout: 'city',
  commuter: 'city',
  commute: 'city',
  // first car
  'first car': 'first-car',
  'p-plate': 'first-car',
  'l-plate': 'first-car',
  learner: 'first-car',
  // towing
  tow: 'towing',
  towing: 'towing',
  caravan: 'towing',
  trailer: 'towing',
  // tradie
  tradie: 'tradie',
  'work truck': 'tradie',
  // highway
  highway: 'highway',
  touring: 'highway',
  'long trips': 'highway',
};
const SIZE_CLASS_SYNONYMS: Record<string, string> = {
  compact: 'compact',
  small: 'compact',
  large: 'large',
  big: 'large',
};

// Words we recognise as filter/qualifier vocabulary — excluded from the residual
// keyword so "diesel ute under 40k" yields no spurious title keyword.
const STOPWORDS = new Set([
  'do', 'you', 'have', 'has', 'got', 'any', 'the', 'a', 'an', 'is', 'are', 'im',
  'i', 'want', 'wanting', 'looking', 'look', 'for', 'some', 'me', 'show', 'whats',
  'what', 'whats', 'your', 'you', 'can', 'could', 'need', 'car', 'cars', 'vehicle',
  'vehicles', 'please', 'hi', 'hey', 'hello', 'there', 'with', 'and', 'or', 'that',
  'this', 'in', 'on', 'of', 'to', 'under', 'below', 'over', 'above', 'around',
  'about', 'less', 'more', 'than', 'up', 'max', 'min', 'budget', 'cheap', 'cheaper',
  'affordable', 'good', 'nice', 'best', 'great', 'family', 'newer', 'older', 'since',
  'from', 'before', 'after', 'between', 'model', 'models', 'seat', 'seats', 'seater',
  'km', 'kms', 'kilometre', 'kilometres', 'kilometer', 'kilometers', 'mile', 'miles',
  'mileage', 'low', 'high', 'price', 'priced', 'grand', 'k', 'something', 'anything',
  'stock', 'range', 'available', 'availability', 'inventory', 'lot', 'showroom',
  'yard', 'currently', 'now', 'right', 'today', 'listing', 'listings', 'sale',
]);

export interface Extraction {
  state: FilterState;
  keyword: string | null;
}

/** Parse a money/number token like "40k", "40,000", "35" (with `k` → *1000). */
function parseAmount(numeric: string, kSuffix: boolean): number {
  const n = Number(numeric.replace(/,/g, ''));
  if (!Number.isFinite(n)) return NaN;
  return kSuffix ? Math.round(n * 1000) : Math.round(n);
}

/** Collect canonical codes whose synonym appears as a whole word in `msg`. */
function matchCodes(msg: string, syn: Record<string, string>): string[] {
  const out = new Set<string>();
  for (const [word, code] of Object.entries(syn)) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // whole-word, optional trailing plural "s"
    const re = new RegExp(`(?:^|[^a-z0-9])${escaped}s?(?:$|[^a-z0-9])`, 'i');
    if (re.test(msg)) out.add(code);
  }
  return [...out];
}

/**
 * True when a filter state carries at least one concrete filter (any dimension,
 * range, or seat count — sort/page don't count). Shared so callers agree on what
 * "has filters" means (endpoint pre-pass, client refine detection).
 */
export function hasConcreteFilters(state: FilterState): boolean {
  return (
    state.bodyType.length > 0 ||
    state.colour.length > 0 ||
    state.transmission.length > 0 ||
    state.fuelType.length > 0 ||
    state.driveType.length > 0 ||
    state.condition.length > 0 ||
    state.runningCost.length > 0 ||
    state.usageFit.length > 0 ||
    state.sizeClass.length > 0 ||
    state.seats.length > 0 ||
    state.priceMin != null ||
    state.priceMax != null ||
    state.yearMin != null ||
    state.yearMax != null ||
    state.odoMax != null
  );
}

/**
 * Deterministically extract a filter state + optional title keyword from a
 * plain-English message. Returns `null` when nothing meaningful is found.
 */
export function extractFilters(message: string): Extraction | null {
  const cfg = getDealerConfig().chat.grounding.lookup;
  const msg = ` ${message.toLowerCase()} `;

  const body = matchCodes(msg, BODY_SYNONYMS);
  const colour = matchCodes(msg, COLOUR_SYNONYMS);
  const transmission = matchCodes(msg, TRANSMISSION_SYNONYMS);
  const fuelType = matchCodes(msg, FUEL_SYNONYMS);
  const driveType = matchCodes(msg, DRIVE_SYNONYMS);
  const condition = matchCodes(msg, CONDITION_SYNONYMS);
  const runningCost = matchCodes(msg, RUNNING_COST_SYNONYMS);
  const usageFit = matchCodes(msg, USAGE_FIT_SYNONYMS);
  const sizeClass = matchCodes(msg, SIZE_CLASS_SYNONYMS);

  const sp = new URLSearchParams();
  if (body.length) sp.set('bodyType', body.join(','));
  if (colour.length) sp.set('colour', colour.join(','));
  if (transmission.length) sp.set('transmission', transmission.join(','));
  if (fuelType.length) sp.set('fuelType', fuelType.join(','));
  if (driveType.length) sp.set('driveType', driveType.join(','));
  if (condition.length) sp.set('condition', condition.join(','));
  if (runningCost.length) sp.set('runningCost', runningCost.join(','));
  if (sizeClass.length) sp.set('sizeClass', sizeClass.join(','));

  // --- Odometer ---------------------------------------------------------------
  // "low kms" / "low mileage" with no figure → configured ceiling.
  if (/\blow\s+(?:k|km|kms|kilometre|kilometres|kilometer|kilometers|mile|miles|mileage)/i.test(msg)) {
    sp.set('odoMax', String(cfg.lowKmThreshold));
  }
  // "<num> km" (optionally with under/below and a k suffix) → odometer ceiling.
  const odo = msg.match(
    /(\d[\d,]*)\s*(k)?\s*(?:km|kms|kilometre|kilometres|kilometer|kilometers|mile|miles)\b/i,
  );
  if (odo) {
    const v = parseAmount(odo[1], !!odo[2]);
    if (Number.isFinite(v)) sp.set('odoMax', String(v));
  }

  // --- Price ------------------------------------------------------------------
  // Requires a `$` prefix or a `k`/`grand` suffix so bare years/counts aren't
  // mistaken for prices. Qualifier decides min vs max; default (budget) = max.
  const priceRe =
    /(under|below|less than|up to|max|budget|around|over|above|more than|at least|from|min)?\s*\$?\s*(\d[\d,]*)\s*(k|grand)\b|(under|below|less than|up to|max|budget|around|over|above|more than|at least|from|min)?\s*\$\s*(\d[\d,]*)/gi;
  let pm: RegExpExecArray | null;
  while ((pm = priceRe.exec(msg)) !== null) {
    const qualifier = (pm[1] ?? pm[4] ?? '').toLowerCase();
    const numeric = pm[2] ?? pm[5];
    const kSuffix = !!pm[3];
    if (!numeric) continue;
    const value = parseAmount(numeric, kSuffix);
    if (!Number.isFinite(value)) continue;
    const isMin = /^(over|above|more than|at least|from|min)$/.test(qualifier);
    if (isMin) sp.set('priceMin', String(value));
    else sp.set('priceMax', String(value));
  }

  // --- Year -------------------------------------------------------------------
  const nowYear = new Date().getFullYear();
  const yearMatch = msg.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    const y = Number(yearMatch[1]);
    if (y >= 2000 && y <= nowYear) {
      const before = msg.slice(0, yearMatch.index ?? 0);
      if (/(newer|since|from|after)\s*$/.test(before)) sp.set('yearMin', String(y));
      else if (/(older|before)\s*$/.test(before)) sp.set('yearMax', String(y));
      else {
        // Bare model year → exact match.
        sp.set('yearMin', String(y));
        sp.set('yearMax', String(y));
      }
    }
  }

  // --- Seats ------------------------------------------------------------------
  const seatMatch = msg.match(/\b(\d)\s*(?:seat|seats|seater)\b/i);
  if (seatMatch) {
    sp.set('seats', seatMatch[1]);
  } else if (/\bfamily\b/i.test(msg)) {
    sp.set('seats', cfg.familySeats.join(','));
  }

  // --- Usage fit --------------------------------------------------------------
  // Synonym hits PLUS the "family" special-case: "family" already drives a seats
  // path above; we add usageFit=family alongside (overlapping signals coexist,
  // matching how seats/family is treated), deduped and order-preserving.
  const usage = [...usageFit];
  if (/\bfamily\b/i.test(msg) && !usage.includes('family')) usage.push('family');
  if (usage.length) sp.set('usageFit', usage.join(','));

  // parseFilters validates + drops unknown codes, giving the canonical state.
  const state = parseFilters(sp);

  const hasFilter = hasConcreteFilters(state);

  // --- Residual keyword (make/model) ------------------------------------------
  // Only a fallback for bare make/model queries ("do you have a hilux?"). Never
  // layered on top of a structured filter, or a stray noun (e.g. "in stock")
  // would add a spurious `title match` clause that kills good structured matches.
  let keyword: string | null = null;
  if (cfg.keywordSearch && !hasFilter) {
    const residuals = message
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
    // Only trust residuals that weren't consumed as filter vocabulary.
    const known = new Set<string>([
      ...Object.keys(BODY_SYNONYMS),
      ...Object.keys(COLOUR_SYNONYMS),
      ...Object.keys(TRANSMISSION_SYNONYMS),
      ...Object.keys(FUEL_SYNONYMS),
      ...Object.keys(DRIVE_SYNONYMS),
      ...Object.keys(CONDITION_SYNONYMS),
      ...Object.keys(RUNNING_COST_SYNONYMS),
      ...Object.keys(USAGE_FIT_SYNONYMS),
      ...Object.keys(SIZE_CLASS_SYNONYMS),
    ].flatMap((w) => w.split(/[^a-z0-9]+/)));
    const candidates = residuals.filter((t) => !known.has(t) && !known.has(t.replace(/s$/, '')));
    if (candidates.length) keyword = candidates.slice(0, 2).join(' ');
  }

  if (!hasFilter && !keyword) return null;
  return { state, keyword };
}
