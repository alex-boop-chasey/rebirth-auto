// --- Compare verdict scoring (shared: SSR + client) --------------------------
// The deterministic brain behind the compare page's "Verdict Board". Both the
// server (initial, no-JS render) and the client (live re-weighting when the
// shopper taps a buyer lens) import THIS module, so the recommendation can never
// drift between the two. Pure arithmetic over REAL spec values — every reason it
// emits cites a real number; it never invents a figure.
//
// Winner-per-row highlighting stays in `listing.ts` (`isLowerBetter` + the page's
// `winners()` helper); this module owns only the weighted, lens-aware verdict.
import { formatPrice } from './listing';
import { dealerConfig } from '../config/dealer';

// A compared car reduced to the numeric dimensions we can score defensibly.
// Every numeric is nullable — a listing may not carry every value, and a missing
// value drops that dimension for that car rather than being guessed.
export interface CompareCar {
  id: string;
  name: string; // short display label, e.g. "Toyota RAV4" (falls back to title)
  currency: string;
  price: number | null;
  year: number | null;
  odometer: number | null;
  seats: number | null;
}

export type DimKey = 'value' | 'newer' | 'lowkm' | 'space';
export type DimField = 'price' | 'year' | 'odometer' | 'seats';

export interface ScoreDim {
  key: DimKey;
  field: DimField;
  dir: -1 | 1; // -1 = lower is better, +1 = higher is better
  short: string; // label used in the "weighing …" note + caveats
}

// Only dimensions backed by real, trustworthy data. There is deliberately NO
// fuel-economy dimension: the data model has no economy (L/100km) field, so an
// economy lens would have to fabricate figures — omitted for determinism.
export const SCORE_DIMS: ScoreDim[] = [
  { key: 'value', field: 'price', dir: -1, short: 'price' },
  { key: 'newer', field: 'year', dir: 1, short: 'age' },
  { key: 'lowkm', field: 'odometer', dir: -1, short: 'kilometres' },
  { key: 'space', field: 'seats', dir: 1, short: 'seats' },
];

export interface Lens {
  id: string;
  label: string;
  w: Partial<Record<DimKey, number>>;
}

// Buyer lenses — one tap reweights the whole board. Static config-as-data.
export const LENSES: Lens[] = [
  { id: 'balanced', label: 'Balanced', w: { value: 1, newer: 1, lowkm: 1, space: 1 } },
  { id: 'value', label: 'Best value', w: { value: 3, lowkm: 1 } },
  { id: 'nearly', label: 'Nearly new', w: { newer: 3, lowkm: 2 } },
  { id: 'lowkm', label: 'Low kms', w: { lowkm: 3, newer: 1 } },
  { id: 'family', label: 'Family space', w: { space: 3, lowkm: 1, value: 1 } },
];

function lensById(id: string): Lens {
  return LENSES.find((l) => l.id === id) ?? LENSES[0];
}

function fieldVal(c: CompareCar, field: DimField): number | null {
  const v = c[field];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function fmtNum(n: number): string {
  return n.toLocaleString(dealerConfig.locale.locale);
}

// Normalise one dimension to 0..100 (100 = best) across only the cars that carry
// a value. Fewer than two cars with data ⇒ not comparable ⇒ empty map (the
// dimension contributes nothing anywhere).
export function normDim(cars: CompareCar[], dim: ScoreDim): Record<string, number> {
  const out: Record<string, number> = {};
  const present = cars.filter((c) => fieldVal(c, dim.field) != null);
  if (present.length < 2) return out;
  const vals = present.map((c) => fieldVal(c, dim.field) as number);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min;
  present.forEach((c) => {
    if (span === 0) {
      out[c.id] = 100;
      return;
    }
    let t = ((fieldVal(c, dim.field) as number) - min) / span;
    if (dim.dir < 0) t = 1 - t;
    out[c.id] = Math.round(t * 100);
  });
  return out;
}

export interface ScoreResult {
  overall: Record<string, number>;
  dimScore: Record<DimKey, Record<string, number>>;
  pick: CompareCar;
  activeDims: ScoreDim[]; // weighted for this lens AND comparable across the set
}

export function scoreCars(cars: CompareCar[], lensId: string): ScoreResult {
  const w = lensById(lensId).w;
  const dimScore = {} as Record<DimKey, Record<string, number>>;
  SCORE_DIMS.forEach((d) => {
    dimScore[d.key] = normDim(cars, d);
  });

  const overall: Record<string, number> = {};
  cars.forEach((c) => {
    let s = 0;
    let wsum = 0;
    SCORE_DIMS.forEach((d) => {
      const wt = w[d.key] ?? 0;
      if (!wt) return;
      const sc = dimScore[d.key][c.id];
      if (sc == null) return; // this car lacks this dimension → drop it, don't guess
      s += wt * sc;
      wsum += wt;
    });
    overall[c.id] = wsum ? Math.round(s / wsum) : 0;
  });

  // Highest overall wins; ties broken by the cheaper car.
  const pick = [...cars].sort(
    (a, b) =>
      (overall[b.id] ?? 0) - (overall[a.id] ?? 0) ||
      (a.price ?? Infinity) - (b.price ?? Infinity),
  )[0];

  const activeDims = SCORE_DIMS.filter(
    (d) => (w[d.key] ?? 0) > 0 && Object.keys(dimScore[d.key]).length >= 2,
  );

  return { overall, dimScore, pick, activeDims };
}

export interface VerdictReason {
  text: string;
  caveat?: boolean;
}

export interface Verdict {
  pickId: string;
  pickName: string;
  score: number;
  reasons: VerdictReason[];
  weighing: string;
}

// A grounded strength phrase for a dimension the pick STRICTLY leads. Returns
// null when the pick doesn't lead (so we never overclaim) or the dim isn't
// comparable. `weight` = the pick's normalised score, used only to rank.
function dimStrength(
  cars: CompareCar[],
  dimScore: ScoreResult['dimScore'],
  pick: CompareCar,
  d: ScoreDim,
): { text: string; weight: number } | null {
  const withData = cars.filter((c) => dimScore[d.key][c.id] != null);
  if (withData.length < 2) return null;
  const pv = fieldVal(pick, d.field);
  if (pv == null) return null;
  const rivals = withData.filter((c) => c.id !== pick.id).map((c) => fieldVal(c, d.field) as number);
  const leads = d.dir < 0 ? rivals.every((v) => pv < v) : rivals.every((v) => pv > v);
  if (!leads) return null;
  const next = d.dir < 0 ? Math.min(...rivals) : Math.max(...rivals);
  const gap = Math.abs(next - pv);
  if (gap === 0) return null;

  let text = '';
  if (d.key === 'value') text = `${formatPrice(gap, pick.currency)} cheaper than the next`;
  else if (d.key === 'lowkm') text = `${fmtNum(gap)} km less than the next`;
  else if (d.key === 'newer') text = gap === 1 ? `A year newer than the next` : `${gap} years newer than the next`;
  else if (d.key === 'space') text = `${gap} more seat${gap === 1 ? '' : 's'} than the next`;
  return { text, weight: dimScore[d.key][pick.id] };
}

// The full client-side-computable verdict: up to two grounded strengths + one
// honest caveat (the dimension where a rival most beats the pick), plus the note
// of what the active lens weighs.
export function buildVerdict(cars: CompareCar[], lensId: string): Verdict {
  const { overall, dimScore, pick, activeDims } = scoreCars(cars, lensId);
  const w = lensById(lensId).w;
  const others = cars.filter((c) => c.id !== pick.id);

  // Strengths: weighted, comparable dims the pick leads, richest first.
  const strengths = SCORE_DIMS.filter((d) => (w[d.key] ?? 0) > 0)
    .map((d) => dimStrength(cars, dimScore, pick, d))
    .filter((x): x is { text: string; weight: number } => x != null)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map((x) => ({ text: x.text } as VerdictReason));

  // Caveat: the biggest normalised advantage any rival holds over the pick,
  // phrased with the real underlying number. Collect candidates, then pick the
  // richest (array form avoids closure-assignment narrowing pitfalls).
  const caveats: { gapScore: number; text: string }[] = [];
  SCORE_DIMS.forEach((d) => {
    const ps = dimScore[d.key][pick.id];
    if (ps == null) return;
    const pv = fieldVal(pick, d.field);
    if (pv == null) return;
    others.forEach((r) => {
      const rs = dimScore[d.key][r.id];
      const rv = fieldVal(r, d.field);
      if (rs == null || rv == null) return;
      const gapScore = rs - ps;
      if (gapScore <= 0) return;
      const raw = Math.abs(rv - pv);
      let phr = '';
      if (d.key === 'value') phr = `${r.name} is ${formatPrice(raw, r.currency)} cheaper`;
      else if (d.key === 'lowkm') phr = `${r.name} has ${fmtNum(raw)} km less`;
      else if (d.key === 'newer') phr = `${r.name} is ${raw === 1 ? 'a year' : `${raw} years`} newer`;
      else if (d.key === 'space') phr = `${r.name} has ${raw} more seat${raw === 1 ? '' : 's'}`;
      caveats.push({ gapScore, text: phr });
    });
  });
  const caveat = caveats.sort((a, b) => b.gapScore - a.gapScore)[0] ?? null;

  const reasons: VerdictReason[] = [...strengths];
  if (caveat) reasons.push({ text: caveat.text, caveat: true });
  if (reasons.length === 0) reasons.push({ text: 'Best overall balance for this lens' });

  const weighing = activeDims.map((d) => d.short).join(', ') || 'the available specs';

  return {
    pickId: pick.id,
    pickName: pick.name,
    score: overall[pick.id] ?? 0,
    reasons,
    weighing,
  };
}
