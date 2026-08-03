/**
 * Experience Mode — deterministic matcher (Candidate A)
 * ------------------------------------------------------------------
 * The BRAIN of Experience Mode's "boom" reveal, kept as a pure, framework-free,
 * DOM-free module so it is trivially testable and — critically — DETERMINISTIC.
 *
 * The concept: instead of the shopper translating a fuzzy human desire into a
 * grid of filter checkboxes, Rebi asks a few of the RIGHT questions and curates.
 * This module owns two things:
 *   1. The guided question flow (`QUESTIONS`) — copy + the answer→preference map.
 *   2. `curate()` — scores real vehicles against the shopper's answers and ranks
 *      them, attaching human-readable "why this one" reasons that are derived
 *      ONLY from a vehicle's real specs. Nothing is invented; a car that lacks a
 *      spec simply earns no reason from it (determinism, per AGENTS.md).
 *
 * No `Math.random()`, no module-level clock, no side effects. Ties break on a
 * stable key (price asc, then id) so the same answers always yield the same order.
 */

// The slimmed vehicle payload the page hands the client (mapped from the shared
// LISTING_FIELDS projection). Every spec is optional — real listings have gaps.
export interface ExperienceVehicle {
  id: string;
  title: string;
  make: string | null;
  model: string | null;
  price: number | null;
  currency: string;
  /** Pre-formatted display price (built server-side via formatPrice). */
  priceLabel: string;
  image: string | null;
  specs: {
    bodyType?: string;
    transmission?: string;
    fuelType?: string;
    driveType?: string;
    seatCount?: number;
    year?: number;
    odometer?: number;
    condition?: string;
  };
}

// A single tappable answer. `weights` is the answer's soft preference signal,
// scored against each vehicle's specs. This is the ONLY place buyer intent is
// translated into machine terms — the feature's analogue of dealer.ts `concepts`.
export interface AnswerOption {
  id: string;
  label: string;
  sub: string;
  /** Emoji-free inline glyph key (drawn by the engine). */
  glyph: string;
  weights: Preference;
}

export interface Question {
  id: 'who' | 'priority' | 'budget';
  /** Rebi's spoken prompt for this beat. */
  rebi: string;
  options: AnswerOption[];
}

// A preference signal. Each field nudges the score; absent fields are neutral.
interface Preference {
  bodyTypes?: Partial<Record<string, number>>;
  fuelTypes?: Partial<Record<string, number>>;
  driveTypes?: Partial<Record<string, number>>;
  transmission?: Partial<Record<string, number>>;
  /** Reward more seats (per seat over 5). */
  seatsAtLeast?: { seats: number; weight: number };
  /** Reward low odometer under the ceiling. */
  lowKmUnder?: { km: number; weight: number };
  /** Reward newer years at/above the floor. */
  newerFrom?: { year: number; weight: number };
  /** Soft budget band. Out-of-band vehicles are penalised, never excluded. */
  budget?: { min?: number; max?: number; weight: number };
  /** Reward brand-new / demo stock. */
  freshCondition?: number;
}

// ---- The guided flow (three beats of "boom"): who → what matters → budget ----
export const QUESTIONS: Question[] = [
  {
    id: 'who',
    rebi: "Let's start with the driver. Who's this car really for?",
    options: [
      {
        id: 'first-car',
        label: 'A first car',
        sub: 'New or young driver',
        glyph: 'spark',
        weights: {
          bodyTypes: { hatchback: 3, sedan: 1 },
          transmission: { auto: 2 },
          budget: { max: 22000, weight: 2 },
        },
      },
      {
        id: 'family',
        label: 'The family',
        sub: 'Space, seats, school run',
        glyph: 'people',
        weights: {
          bodyTypes: { suv: 3, wagon: 2, van: 2 },
          seatsAtLeast: { seats: 5, weight: 1.5 },
        },
      },
      {
        id: 'work-tow',
        label: 'Work & towing',
        sub: 'Loads, trailers, the tough stuff',
        glyph: 'tools',
        weights: {
          bodyTypes: { ute: 3, suv: 1 },
          fuelTypes: { diesel: 2 },
          driveTypes: { '4wd': 2, awd: 1 },
        },
      },
      {
        id: 'adventure',
        label: 'Weekend adventures',
        sub: 'Camping, beach, back roads',
        glyph: 'mountain',
        weights: {
          bodyTypes: { suv: 3, ute: 2 },
          driveTypes: { '4wd': 2.5, awd: 2 },
        },
      },
      {
        id: 'just-me',
        label: 'Just me',
        sub: 'Keep it simple and easy',
        glyph: 'person',
        weights: {
          bodyTypes: { hatchback: 2, sedan: 1.5, suv: 1 },
          transmission: { auto: 1 },
        },
      },
    ],
  },
  {
    id: 'priority',
    rebi: 'Good choice. Now — what matters most once you own it?',
    options: [
      {
        id: 'economical',
        label: 'Cheap to run',
        sub: 'Kind on fuel and the wallet',
        glyph: 'leaf',
        weights: {
          bodyTypes: { hatchback: 2, sedan: 1 },
          fuelTypes: { hybrid: 2, electric: 1.5 },
          budget: { max: 30000, weight: 1 },
        },
      },
      {
        id: 'space',
        label: 'Space & comfort',
        sub: 'Room for people and gear',
        glyph: 'people',
        weights: {
          bodyTypes: { suv: 2, wagon: 2, van: 1.5 },
          seatsAtLeast: { seats: 5, weight: 1.5 },
        },
      },
      {
        id: 'capable',
        label: 'Capability',
        sub: 'Go anywhere, tow anything',
        glyph: 'mountain',
        weights: {
          driveTypes: { '4wd': 2.5, awd: 1.5 },
          bodyTypes: { ute: 2, suv: 1.5 },
          fuelTypes: { diesel: 1 },
        },
      },
      {
        id: 'low-kms',
        label: 'Barely driven',
        sub: 'Low kilometres, plenty of life left',
        glyph: 'gauge',
        weights: {
          lowKmUnder: { km: 40000, weight: 3 },
        },
      },
      {
        id: 'newest',
        label: 'The latest',
        sub: 'Newest models, freshest tech',
        glyph: 'spark',
        weights: {
          newerFrom: { year: 2023, weight: 2 },
          freshCondition: 2,
        },
      },
    ],
  },
  {
    id: 'budget',
    rebi: "Last one. How's the budget feeling?",
    options: [
      {
        id: 'under-20',
        label: 'Under $20k',
        sub: 'Keep it tidy',
        glyph: 'coin',
        weights: { budget: { max: 20000, weight: 3 } },
      },
      {
        id: 'mid',
        label: '$20k – $40k',
        sub: 'The sweet spot',
        glyph: 'coin',
        weights: { budget: { min: 18000, max: 42000, weight: 2.5 } },
      },
      {
        id: 'premium',
        label: '$40k and up',
        sub: 'Room to move',
        glyph: 'coin',
        weights: { budget: { min: 38000, weight: 2 } },
      },
      {
        id: 'flexible',
        label: 'Show me the range',
        sub: "I'm flexible",
        glyph: 'sparkles',
        weights: {},
      },
    ],
  },
];

export interface RankedVehicle {
  vehicle: ExperienceVehicle;
  score: number;
  reasons: string[];
}

export type Answers = Partial<Record<Question['id'], AnswerOption>>;

// Combine the chosen options' preferences into one signal, then score + explain.
export function curate(
  vehicles: ExperienceVehicle[],
  answers: Answers,
  topN = 3,
): RankedVehicle[] {
  const prefs = Object.values(answers)
    .filter((o): o is AnswerOption => !!o)
    .map((o) => o.weights);

  const ranked = vehicles.map((vehicle) => scoreOne(vehicle, prefs));

  // Deterministic order: score desc, then price asc (nulls last), then id.
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const pa = a.vehicle.price ?? Number.POSITIVE_INFINITY;
    const pb = b.vehicle.price ?? Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    return a.vehicle.id.localeCompare(b.vehicle.id);
  });

  return ranked.slice(0, topN);
}

function scoreOne(vehicle: ExperienceVehicle, prefs: Preference[]): RankedVehicle {
  const s = vehicle.specs ?? {};
  let score = 0;
  const reasonSet = new Set<string>();

  for (const p of prefs) {
    if (p.bodyTypes && s.bodyType && p.bodyTypes[s.bodyType]) {
      score += p.bodyTypes[s.bodyType]!;
    }
    if (p.fuelTypes && s.fuelType && p.fuelTypes[s.fuelType]) {
      score += p.fuelTypes[s.fuelType]!;
      if (s.fuelType === 'hybrid') reasonSet.add('Hybrid — easy on fuel');
      if (s.fuelType === 'electric') reasonSet.add('Fully electric');
      if (s.fuelType === 'diesel') reasonSet.add('Diesel torque for the hard yards');
    }
    if (p.driveTypes && s.driveType && p.driveTypes[s.driveType]) {
      score += p.driveTypes[s.driveType]!;
      if (s.driveType === '4wd') reasonSet.add('4WD — ready for the rough stuff');
      if (s.driveType === 'awd') reasonSet.add('All-wheel drive for extra grip');
    }
    if (p.transmission && s.transmission && p.transmission[s.transmission]) {
      score += p.transmission[s.transmission]!;
      if (s.transmission === 'auto') reasonSet.add('Automatic — relaxed to drive');
    }
    if (p.seatsAtLeast && typeof s.seatCount === 'number' && s.seatCount >= p.seatsAtLeast.seats) {
      score += p.seatsAtLeast.weight * (1 + (s.seatCount - p.seatsAtLeast.seats));
      if (s.seatCount >= 7) reasonSet.add(`Seats ${s.seatCount} — room for everyone`);
      else if (s.seatCount >= 5) reasonSet.add(`Seats ${s.seatCount} in comfort`);
    }
    if (p.lowKmUnder && typeof s.odometer === 'number' && s.odometer < p.lowKmUnder.km) {
      // Reward scales as the odo drops toward zero.
      score += p.lowKmUnder.weight * (1 - s.odometer / p.lowKmUnder.km);
      reasonSet.add(`Only ${formatKm(s.odometer)} on the clock`);
    }
    if (p.newerFrom && typeof s.year === 'number' && s.year >= p.newerFrom.year) {
      score += p.newerFrom.weight;
      reasonSet.add(`${s.year} — one of the newest in the yard`);
    }
    if (p.freshCondition && (s.condition === 'new' || s.condition === 'demo')) {
      score += p.freshCondition;
      reasonSet.add(s.condition === 'new' ? 'Brand new' : 'Ex-demo, barely run in');
    }
    if (p.budget && typeof vehicle.price === 'number') {
      const { min, max, weight } = p.budget;
      const inBand = (min == null || vehicle.price >= min) && (max == null || vehicle.price <= max);
      if (inBand) {
        score += weight;
        if (max != null) reasonSet.add(`Comfortably within budget`);
      } else {
        // Soft penalty proportional to how far out — never excluded.
        const over = max != null && vehicle.price > max ? (vehicle.price - max) / max : 0;
        const under = min != null && vehicle.price < min ? (min - vehicle.price) / min : 0;
        score -= weight * Math.min(1, over + under);
      }
    }
  }

  // Cap the visible reasons to the two strongest-signal ones (keeps cards clean).
  const reasons = [...reasonSet].slice(0, 2);
  return { vehicle, score, reasons };
}

function formatKm(km: number): string {
  return `${km.toLocaleString('en-AU')} km`;
}
