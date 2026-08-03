/**
 * taste.ts — the deterministic "reaction → taste" engine behind Candidate B
 * ("The After-Hours Walk").
 *
 * This is the honest, testable core of the experience. It contains NO LLM call
 * and NO Sanity/network work: it is a pure function library over the slim vehicle
 * payload the SSR page hands the island. Everything Rebi "learns" is a transparent
 * weighted tally over feature tokens; everything Rebi "says" is templated strictly
 * from a vehicle's REAL specs (a spec that isn't present never gets narrated).
 *
 * Divergence note (vs Candidate A's matcher.ts): A scores the WHOLE lot ONCE
 * against three up-front answers and freezes a ranked list. This engine holds a
 * LIVE preference vector that is nudged by each in-tour reaction and re-ranks the
 * remaining, unseen queue after every step — a feedback loop, not a one-shot.
 */

// The slim, display-ready vehicle the SSR page maps real inventory into. Prices
// are pre-formatted server-side (dealer locale/currency) so the island does no
// formatting work and carries no dealer literals.
export interface TourVehicle {
  id: string;
  slug: string | null;
  title: string;
  make: string | null;
  model: string | null;
  year: number | null;
  price: number | null;
  priceLabel: string;
  image: string | null;
  bodyType: string | null;
  fuelType: string | null;
  driveType: string | null;
  transmission: string | null;
  seatCount: number | null;
  odometer: number | null;
  condition: string | null;
}

// A shopper's reaction to the car currently on the canvas. `love` and `pass` move
// the preference vector; `more` is curiosity (a soft positive) and also expands
// the narration in the UI. All three advance the tour.
export type Reaction = 'love' | 'pass' | 'more';

// A feature token is a coarse, human-meaningful bucket a car belongs to. The
// preference vector is a tally over these — deliberately legible so the "why Rebi
// showed you this" story is auditable, never a black box.
export type Token = string;

// Dealer-tunable thresholds are passed IN (read from dealerConfig at the SSR seam,
// never hardcoded here) so this module stays dealer-agnostic.
export interface TasteBands {
  /** Ascending price-band breakpoints (whole dollars). */
  priceBands: readonly number[];
  /** Odometer ceiling (km) that counts as "low kms". */
  lowKmThreshold: number;
  /** A car this many model-years old or newer counts as "near-new". */
  nearNewWithinYears: number;
  /** Seat count at/above which a car reads as "room for everyone". */
  familySeats: number;
  /** The current calendar year (passed in — never a module-level clock read). */
  currentYear: number;
}

// --- Tokenisation ------------------------------------------------------------

function priceBandToken(price: number | null, bands: readonly number[]): Token | null {
  if (price == null || !Number.isFinite(price)) return null;
  // Band index: 0 = under first breakpoint, n = over the last.
  let i = 0;
  for (const b of bands) {
    if (price < b) break;
    i++;
  }
  return `price:${i}`;
}

/** The coarse feature buckets a vehicle belongs to — only ones its real data
 *  supports. A car missing a spec simply contributes no token for it. */
export function tokensFor(v: TourVehicle, bands: TasteBands): Token[] {
  const t: Token[] = [];
  if (v.bodyType) t.push(`body:${v.bodyType}`);
  if (v.fuelType) t.push(`fuel:${v.fuelType}`);
  if (v.driveType) t.push(`drive:${v.driveType}`);
  if (v.transmission) t.push(`trans:${v.transmission}`);
  const price = priceBandToken(v.price, bands.priceBands);
  if (price) t.push(price);
  if (v.seatCount != null) t.push(v.seatCount >= bands.familySeats ? 'seats:family' : 'seats:standard');
  if (v.year != null) {
    t.push(v.year >= bands.currentYear - bands.nearNewWithinYears ? 'era:near-new' : 'era:established');
  }
  if (v.odometer != null) t.push(v.odometer <= bands.lowKmThreshold ? 'km:low' : 'km:worked');
  return t;
}

// --- Preference vector -------------------------------------------------------

export type Prefs = Record<Token, number>;

const REACTION_WEIGHT: Record<Reaction, number> = {
  love: 2, // pull hard toward everything this car is
  more: 1, // curiosity — a soft lean-in
  pass: -1, // gently push away from this car's buckets
};

/** Apply a reaction to the preference vector, returning a NEW vector (pure). */
export function applyReaction(prefs: Prefs, v: TourVehicle, r: Reaction, bands: TasteBands): Prefs {
  const next: Prefs = { ...prefs };
  const w = REACTION_WEIGHT[r];
  for (const tok of tokensFor(v, bands)) next[tok] = (next[tok] ?? 0) + w;
  return next;
}

/** A car's affinity to the current taste = sum of its tokens' weights. */
export function scoreVehicle(v: TourVehicle, prefs: Prefs, bands: TasteBands): number {
  let s = 0;
  for (const tok of tokensFor(v, bands)) s += prefs[tok] ?? 0;
  return s;
}

/**
 * Pick the next car to walk the shopper to: the highest-scoring car that hasn't
 * been seen yet. Deterministic — ties break by the vehicles' original order, so
 * the same taste always produces the same walk. Returns null when the lot is
 * exhausted.
 */
export function pickNext(
  vehicles: TourVehicle[],
  seen: ReadonlySet<string>,
  prefs: Prefs,
  bands: TasteBands,
): TourVehicle | null {
  let best: TourVehicle | null = null;
  let bestScore = -Infinity;
  let bestIdx = Infinity;
  vehicles.forEach((v, idx) => {
    if (seen.has(v.id)) return;
    const s = scoreVehicle(v, prefs, bands);
    if (s > bestScore || (s === bestScore && idx < bestIdx)) {
      best = v;
      bestScore = s;
      bestIdx = idx;
    }
  });
  return best;
}

// --- Honest, spec-derived narration -----------------------------------------

/** Rebi's headline for a car — real make/model/year only. */
export function vehicleHeadline(v: TourVehicle): string {
  const bits = [v.year ? String(v.year) : null, v.make, v.model].filter(Boolean);
  return bits.length ? bits.join(' ') : v.title;
}

const BODY_WORD: Record<string, string> = {
  sedan: 'sedan', hatchback: 'hatch', suv: 'SUV', ute: 'ute',
  wagon: 'wagon', van: 'van', coupe: 'coupe', convertible: 'convertible',
};
const FUEL_WORD: Record<string, string> = {
  petrol: 'petrol', diesel: 'diesel', hybrid: 'hybrid', electric: 'electric', lpg: 'LPG',
};
const DRIVE_WORD: Record<string, string> = { '2wd': '2WD', awd: 'AWD', '4wd': '4WD' };

/** One short, spec-true "story" line Rebi speaks over the car. Built only from
 *  fields the car actually carries — never invented. */
export function narrationFor(v: TourVehicle, bands: TasteBands): string {
  const shape = v.bodyType ? BODY_WORD[v.bodyType] ?? v.bodyType : null;
  const fuel = v.fuelType ? FUEL_WORD[v.fuelType] ?? v.fuelType : null;
  const drive = v.driveType ? DRIVE_WORD[v.driveType] ?? v.driveType : null;

  // Lead clause: describe what it IS from whatever specs exist.
  const desc = [drive, fuel, shape].filter(Boolean).join(' ');
  const lead = desc ? `A ${desc}.` : `Here's the ${vehicleHeadline(v)}.`;

  // A single honest highlight, chosen by what's most notable and present.
  const highlights: string[] = [];
  if (v.driveType === '4wd' || v.driveType === 'awd') highlights.push('ready for the rough stuff');
  if (v.fuelType === 'diesel') highlights.push('the torque for towing');
  if (v.fuelType === 'hybrid' || v.fuelType === 'electric') highlights.push('easy on running costs');
  if (v.seatCount != null && v.seatCount >= bands.familySeats) highlights.push(`${v.seatCount} seats — room for everyone`);
  if (v.odometer != null && v.odometer <= bands.lowKmThreshold) {
    highlights.push(`only ${v.odometer.toLocaleString('en-AU')} km`);
  }
  if (v.year != null && v.year >= bands.currentYear - bands.nearNewWithinYears) highlights.push('near-new');
  if (v.condition === 'demo') highlights.push('a demo — barely run in');

  const tail = highlights.length ? ` And ${highlights[0]}.` : '';
  return lead + tail;
}

/** The extra facts "Tell me more" reveals — again, only real specs. */
export function moreFactsFor(v: TourVehicle): string[] {
  const facts: string[] = [];
  if (v.transmission) facts.push(v.transmission === 'auto' ? 'Automatic' : 'Manual');
  if (v.odometer != null) facts.push(`${v.odometer.toLocaleString('en-AU')} km on the clock`);
  if (v.seatCount != null) facts.push(`${v.seatCount} seats`);
  if (v.fuelType) facts.push(`${FUEL_WORD[v.fuelType] ?? v.fuelType} engine`);
  if (v.driveType) facts.push(`${DRIVE_WORD[v.driveType] ?? v.driveType} drivetrain`);
  if (v.condition) facts.push(v.condition.charAt(0).toUpperCase() + v.condition.slice(1));
  return facts;
}

// --- The taste read (payoff summary) ----------------------------------------

// Token → a human phrase for the "here's your taste" read. Only tokens that can
// appear are mapped; anything unmapped is skipped rather than guessed.
const TOKEN_PHRASE: Record<string, string> = {
  'body:suv': 'roomy SUVs',
  'body:ute': 'hard-working utes',
  'body:hatchback': 'nimble hatches',
  'body:sedan': 'classic sedans',
  'body:wagon': 'practical wagons',
  'body:van': 'load-lugging vans',
  'body:coupe': 'sharp coupes',
  'body:convertible': 'open-top convertibles',
  'fuel:diesel': 'diesel grunt',
  'fuel:hybrid': 'hybrid efficiency',
  'fuel:electric': 'going electric',
  'fuel:petrol': 'straightforward petrol',
  'drive:4wd': 'proper 4WD',
  'drive:awd': 'all-wheel-drive surefootedness',
  'seats:family': 'room for the whole family',
  'km:low': 'low-kilometre examples',
  'era:near-new': 'near-new stock',
  'trans:auto': 'easy automatics',
  'trans:manual': 'a manual gearbox',
};

/** Turn the winning preference tokens into a short, human "your taste" read.
 *  Only positive-weighted, mapped tokens are used; returns a friendly default
 *  when nothing rose above zero (e.g. the shopper only ever passed). */
export function tasteRead(prefs: Prefs): string {
  const ranked = Object.entries(prefs)
    .filter(([tok, w]) => w > 0 && TOKEN_PHRASE[tok])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tok]) => TOKEN_PHRASE[tok]);
  if (ranked.length === 0) return "You're keeping your options open — no rush.";
  const top = ranked.slice(0, 3);
  if (top.length === 1) return `You're drawn to ${top[0]}.`;
  const last = top.pop()!;
  return `You're drawn to ${top.join(', ')} and ${last}.`;
}
