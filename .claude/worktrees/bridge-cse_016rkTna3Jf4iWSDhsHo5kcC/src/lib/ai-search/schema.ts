/**
 * AI-search extraction schema + FilterState converter.
 * ------------------------------------------------------------------
 * The contract for the `/api/search` LLM fallback. The model emits an
 * enum-constrained `Extraction` (it can never invent a filter value — `z.enum`
 * REJECTS anything outside the exact `vehicleSpecs` codes, never coerces);
 * deterministic code then converts its filters into a `FilterState` by writing
 * them into a `URLSearchParams` and running the page's OWN `parseFilters`, so the
 * result is by construction byte-identical to a hard SSR load of the equivalent
 * URL. There is NO parallel AI-side filter type.
 *
 * Enum code sets import from `listings-query.ts` (which mirrors the Sanity
 * `vehicleSpecs` schema) — never duplicated here, so the prompt/schema can't
 * drift from the URL contract.
 */
import { z } from 'zod';
import {
  BODY_TYPE_CODES,
  COLOUR_CODES,
  TRANSMISSION_CODES,
  FUEL_TYPE_CODES,
  DRIVE_TYPE_CODES,
  CONDITION_CODES,
  SORT_KEYS,
  parseFilters,
  serializeFilters,
  type FilterState,
} from '../listings-query';

export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

// What the LLM is allowed to emit. Enum arrays constrained to EXACT vehicleSpecs
// codes (z.enum rejects anything else — no coercion). Unknown keys are stripped
// (Zod default), so a chatty model doesn't fail validation over an extra field —
// only bad ENUM VALUES are rejected.
export const AiFiltersSchema = z.object({
  bodyType: z.array(z.enum(BODY_TYPE_CODES)).default([]),
  colour: z.array(z.enum(COLOUR_CODES)).default([]),
  transmission: z.array(z.enum(TRANSMISSION_CODES)).default([]),
  fuelType: z.array(z.enum(FUEL_TYPE_CODES)).default([]),
  driveType: z.array(z.enum(DRIVE_TYPE_CODES)).default([]),
  condition: z.array(z.enum(CONDITION_CODES)).default([]),
  seats: z.array(z.number().int().positive()).default([]),
  priceMin: z.number().int().nonnegative().nullable().default(null),
  priceMax: z.number().int().nonnegative().nullable().default(null),
  yearMin: z.number().int().nullable().default(null),
  yearMax: z.number().int().nullable().default(null),
  odoMax: z.number().int().nonnegative().nullable().default(null),
  sort: z.enum(SORT_KEYS).nullable().default(null),
});
export type AiFilters = z.infer<typeof AiFiltersSchema>;

export const ExtractionSchema = z.object({
  interpretation: z.string().min(1).max(400),
  confidence: z.enum(CONFIDENCE_LEVELS),
  clarifyingQuestion: z.string().min(1).max(300).nullable(),
  filters: AiFiltersSchema,
  matchReasons: z.array(z.string().min(1).max(60)).max(5).default([]),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

export interface SearchResponse {
  interpretation: string;
  confidence: Confidence;
  /** non-null → the UI asks it before applying; null → apply now. */
  clarifyingQuestion: string | null;
  /** ready to serialize into the URL. */
  filters: FilterState;
  matchReasons: string[];
}

export function emptyFilterState(): FilterState {
  return parseFilters(new URLSearchParams());
}

// Convert enum-validated filters into a FilterState by writing them into
// URLSearchParams and running the page's OWN parseFilters — so the result is BY
// CONSTRUCTION byte-identical to a hard SSR load of the equivalent URL.
export function toFilterState(f: AiFilters): FilterState {
  const sp = new URLSearchParams();
  const setMulti = (key: string, arr: readonly (string | number)[]) => {
    if (arr.length) sp.set(key, arr.join(','));
  };
  setMulti('bodyType', f.bodyType);
  setMulti('colour', f.colour);
  setMulti('transmission', f.transmission);
  setMulti('fuelType', f.fuelType);
  setMulti('driveType', f.driveType);
  setMulti('condition', f.condition);
  setMulti('seats', f.seats);
  if (f.priceMin != null) sp.set('priceMin', String(f.priceMin));
  if (f.priceMax != null) sp.set('priceMax', String(f.priceMax));
  if (f.yearMin != null) sp.set('yearMin', String(f.yearMin));
  if (f.yearMax != null) sp.set('yearMax', String(f.yearMax));
  if (f.odoMax != null) sp.set('odoMax', String(f.odoMax));
  if (f.sort) sp.set('sort', f.sort);
  return parseFilters(sp);
}

// Enforces the invariant that LOW confidence always carries a clarifying question.
export function toSearchResponse(ex: Extraction): SearchResponse {
  const clarifyingQuestion =
    ex.confidence === 'low' && !ex.clarifyingQuestion
      ? "Could you tell me a bit more about what you're after — a budget, body type, or fuel type?"
      : ex.clarifyingQuestion;
  return {
    interpretation: ex.interpretation,
    confidence: ex.confidence,
    clarifyingQuestion,
    filters: toFilterState(ex.filters),
    matchReasons: ex.matchReasons,
  };
}

// Graceful "couldn't understand" — returned with HTTP 200 whenever the model
// fails, output can't be parsed/validated, or the AI layer is unavailable. Never
// a 500.
export function fallbackResponse(interpretation?: string): SearchResponse {
  return {
    interpretation:
      interpretation ??
      'I couldn’t understand that clearly — try rephrasing, e.g. "hybrid SUV under $40k".',
    confidence: 'low',
    clarifyingQuestion:
      "Could you rephrase what you're looking for — for example a budget, body type, or fuel type?",
    filters: emptyFilterState(),
    matchReasons: [],
  };
}

// Leniently coerce an untrusted client-provided "current filters" object into a
// FilterState for refinement context. Anything unrecognized is dropped by
// parseFilters — garbage in, valid out.
export function normalizeCurrentFilters(raw: unknown): FilterState {
  if (!raw || typeof raw !== 'object') return emptyFilterState();
  const r = raw as Record<string, unknown>;
  const sp = new URLSearchParams();
  for (const k of ['bodyType', 'colour', 'transmission', 'fuelType', 'driveType', 'condition', 'seats']) {
    const v = r[k];
    if (Array.isArray(v)) {
      if (v.length) sp.set(k, v.map(String).join(','));
    } else if (typeof v === 'string' && v.trim() !== '') sp.set(k, v);
  }
  for (const k of ['priceMin', 'priceMax', 'yearMin', 'yearMax', 'odoMax']) {
    const v = r[k];
    if (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) sp.set(k, String(v));
  }
  if (typeof r.sort === 'string') sp.set('sort', r.sort);
  return parseFilters(sp);
}

/** Compact summary of a FilterState's ACTIVE dimensions, for the LLM's context
 *  (the shopper's current filters when refining). Uses the canonical serialized
 *  query string so it matches the URL contract exactly; '' when nothing active. */
export function activeFilterSummary(state: FilterState): string {
  return serializeFilters({ ...state, page: 1 });
}
