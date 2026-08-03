// --- C3 "Rebi's Balance" — the reckoning engine (shared: SSR + client) -------
// Candidate 3 turns comparison into a tactile WEIGHTING INSTRUMENT: the shopper
// dials how much each thing matters (0..5) and the cars re-rank live. That means
// CONTINUOUS, hand-tuned weights — something the preset-only lens system can't
// express — so this module owns the weighted roll-up. But the dimension math it
// rolls up is the REAL, shared normalisation: it reuses `normDim` + `SCORE_DIMS`
// from compare-verdict.ts verbatim (the exact 0..100 scoring `scoreCars` uses),
// and mirrors that file's weighted-average formula and grounded reason phrasing.
// Every figure it prints is a real spec value — it never invents a number.
//
// Imported by BOTH src/pages/compare.astro (initial SSR render) and its client
// <script> (live re-ranking), so the server and the browser can never disagree
// about who wins. Does NOT touch compare-verdict.ts.
import {
  type CompareCar,
  type DimKey,
  type ScoreDim,
  SCORE_DIMS,
  normDim,
} from '../../lib/compare-verdict';
import { formatPrice } from '../../lib/listing';
import { dealerConfig } from '../../config/dealer';

export type Weights = Partial<Record<DimKey, number>>;
export const WEIGHT_MAX = 5;

// Per-DIMENSION identity — colour, icon and label. Distinct visual language from
// Candidates 1 & 2 (which colour per CAR): here each of Rebi's five priorities
// owns a hue, so a dial, its contribution segment and its value chip all read as
// the same thread across the whole instrument.
export interface DimMeta {
  key: DimKey;
  label: string;
  icon: string;
  color: string;
}
export const DIM_ORDER: DimKey[] = ['value', 'newer', 'lowkm', 'space', 'economy'];
export const DIM_META: Record<DimKey, DimMeta> = {
  value: { key: 'value', label: 'Price', icon: 'tag', color: '#059669' },
  newer: { key: 'newer', label: 'Age', icon: 'calendar', color: '#3b82f6' },
  lowkm: { key: 'lowkm', label: 'Kilometres', icon: 'gauge', color: '#8b5cf6' },
  space: { key: 'space', label: 'Seats', icon: 'car', color: '#f59e0b' },
  economy: { key: 'economy', label: 'Fuel economy', icon: 'droplet', color: '#14b8a6' },
};

const DIM_BY_KEY = new Map<DimKey, ScoreDim>(SCORE_DIMS.map((d) => [d.key, d]));

function fieldOf(c: CompareCar, dim: ScoreDim): number | null {
  const v = c[dim.field];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function fmtNum(n: number): string {
  return n.toLocaleString(dealerConfig.locale.locale);
}

// The real value of one dimension for one car, formatted for a value chip. Empty
// string when the car doesn't state it — shown honestly, never guessed.
export function displayVal(c: CompareCar, key: DimKey): string {
  const dim = DIM_BY_KEY.get(key);
  if (!dim) return '';
  const v = fieldOf(c, dim);
  if (v == null) return '';
  switch (key) {
    case 'value':
      return formatPrice(v, c.currency);
    case 'newer':
      return String(v);
    case 'lowkm':
      return `${fmtNum(v)} km`;
    case 'space':
      return `${v} seat${v === 1 ? '' : 's'}`;
    case 'economy':
      return `${v} L/100km`;
    default:
      return String(v);
  }
}

// Which dimensions are actually comparable across THIS set (≥2 cars carry the
// value). Non-comparable dims get a disabled dial + an honest note.
export function comparableDims(cars: CompareCar[]): Record<DimKey, boolean> {
  const out = {} as Record<DimKey, boolean>;
  for (const d of SCORE_DIMS) out[d.key] = Object.keys(normDim(cars, d)).length >= 2;
  return out;
}

// One weighted dimension's contribution to a car's overall (portions sum to the
// overall). `score` is the shared 0..100 normDim value; `weight` the dial setting.
export interface Segment {
  key: DimKey;
  color: string;
  value: number; // contribution to the 0..100 overall (Σ = overall)
  score: number; // raw normDim 0..100
  weight: number; // dial weight for this dim
}

export interface Standing {
  id: string;
  name: string;
  overall: number;
  segments: Segment[];
  rank: number;
}

export interface Reason {
  text: string;
  caveat?: boolean;
}

export interface Reckoning {
  standings: Standing[]; // sorted best→worst, rank assigned
  pickId: string;
  pickName: string;
  score: number;
  reasons: Reason[];
  weighing: { label: string; weight: number; color: string }[];
  comparable: Record<DimKey, boolean>;
  activeCount: number; // how many priorities are actually turned up + comparable
}

function strengthText(key: DimKey, gap: number, currency: string): string {
  switch (key) {
    case 'value':
      return `${formatPrice(gap, currency)} cheaper than the next`;
    case 'lowkm':
      return `${fmtNum(gap)} km less than the next`;
    case 'newer':
      return gap === 1 ? 'A year newer than the next' : `${gap} years newer than the next`;
    case 'space':
      return `${gap} more seat${gap === 1 ? '' : 's'} than the next`;
    case 'economy':
      return `${gap} L/100km better on fuel than the next`;
    default:
      return '';
  }
}

function caveatText(key: DimKey, rival: string, raw: number, currency: string): string {
  switch (key) {
    case 'value':
      return `${rival} is ${formatPrice(raw, currency)} cheaper`;
    case 'lowkm':
      return `${rival} has ${fmtNum(raw)} km less`;
    case 'newer':
      return `${rival} is ${raw === 1 ? 'a year' : `${raw} years`} newer`;
    case 'space':
      return `${rival} has ${raw} more seat${raw === 1 ? '' : 's'}`;
    case 'economy':
      return `${rival} uses ${raw} L/100km less fuel`;
    default:
      return '';
  }
}

// The whole reckoning for a given set of hand-tuned weights. Pure arithmetic over
// the shared normDim scores + the real spec values — deterministic, no clock, no
// randomness.
export function reckon(cars: CompareCar[], weights: Weights): Reckoning {
  const dimScore = {} as Record<DimKey, Record<string, number>>;
  const comparable = {} as Record<DimKey, boolean>;
  for (const d of SCORE_DIMS) {
    dimScore[d.key] = normDim(cars, d);
    comparable[d.key] = Object.keys(dimScore[d.key]).length >= 2;
  }
  const priceById = new Map(cars.map((c) => [c.id, c.price ?? Infinity]));

  const standings: Standing[] = cars.map((c) => {
    let s = 0;
    let wsum = 0;
    const segs: Segment[] = [];
    for (const key of DIM_ORDER) {
      const wt = weights[key] ?? 0;
      if (!wt) continue;
      const sc = dimScore[key][c.id];
      if (sc == null) continue; // car lacks this dim → drop it, never guess
      s += wt * sc;
      wsum += wt;
      segs.push({ key, color: DIM_META[key].color, value: 0, score: sc, weight: wt });
    }
    const overall = wsum ? Math.round(s / wsum) : 0;
    for (const seg of segs) seg.value = wsum ? (seg.weight * seg.score) / wsum : 0;
    return { id: c.id, name: c.name, overall, segments: segs, rank: 0 };
  });

  standings.sort(
    (a, b) =>
      b.overall - a.overall ||
      (priceById.get(a.id) as number) - (priceById.get(b.id) as number),
  );
  standings.forEach((s, i) => (s.rank = i + 1));

  const pick = standings[0];
  const pickCar = cars.find((c) => c.id === pick.id) as CompareCar;
  const others = cars.filter((c) => c.id !== pick.id);

  const weighing = DIM_ORDER.filter((k) => (weights[k] ?? 0) > 0 && comparable[k]).map((k) => ({
    label: DIM_META[k].label,
    weight: weights[k] as number,
    color: DIM_META[k].color,
  }));
  const activeCount = weighing.length;

  // Reasons — grounded, mirroring compare-verdict.ts. Strengths: weighted,
  // comparable dims the pick STRICTLY leads, richest (highest normScore) first.
  const strengths: { text: string; weight: number }[] = [];
  const caveats: { gapScore: number; text: string }[] = [];
  for (const key of DIM_ORDER) {
    if ((weights[key] ?? 0) <= 0) continue;
    const dim = DIM_BY_KEY.get(key);
    if (!dim) continue;
    const ps = dimScore[key][pick.id];
    const pv = fieldOf(pickCar, dim);
    if (ps == null || pv == null) continue;

    const rivalVals = others
      .map((r) => fieldOf(r, dim))
      .filter((v): v is number => v != null);
    if (rivalVals.length) {
      const leads = dim.dir < 0 ? rivalVals.every((v) => pv < v) : rivalVals.every((v) => pv > v);
      if (leads) {
        const next = dim.dir < 0 ? Math.min(...rivalVals) : Math.max(...rivalVals);
        const gap = Math.abs(next - pv);
        if (gap > 0) strengths.push({ text: strengthText(key, gap, pickCar.currency), weight: ps });
      }
    }
    for (const r of others) {
      const rs = dimScore[key][r.id];
      const rv = fieldOf(r, dim);
      if (rs == null || rv == null) continue;
      const gapScore = rs - ps;
      if (gapScore <= 0) continue;
      caveats.push({ gapScore, text: caveatText(key, r.name, Math.abs(rv - pv), r.currency) });
    }
  }

  const reasons: Reason[] = strengths
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map((x) => ({ text: x.text }));
  const caveat = caveats.sort((a, b) => b.gapScore - a.gapScore)[0];
  if (caveat) reasons.push({ text: caveat.text, caveat: true });
  if (activeCount === 0) {
    reasons.length = 0;
    reasons.push({ text: 'Turn up a dial — tell Rebi what matters and it calls the winner.' });
  } else if (reasons.length === 0) {
    reasons.push({ text: 'Best overall balance for these priorities' });
  }

  return {
    standings,
    pickId: pick.id,
    pickName: pick.name,
    score: pick.overall,
    reasons,
    weighing,
    comparable,
    activeCount,
  };
}
