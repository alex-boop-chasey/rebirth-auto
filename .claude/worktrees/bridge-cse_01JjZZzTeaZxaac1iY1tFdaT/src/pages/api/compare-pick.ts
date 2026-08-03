/**
 * Compare-agent decision — Rebi picks ONE of the compared cars for a criterion.
 * ============================================================================
 * The compare page primes Rebi with a `compare` context (the `?ids=` set). When
 * the visitor answers the "what matters most?" question with a decision criterion
 * ("low running costs", "space", "cheapest"), Rebi must STAY the compare agent:
 * rank ONLY the compared cars against that criterion using their REAL specs and
 * open the winner's listing — never fall back to a generic inventory search.
 *
 * POST { refs: string[], criterion: string } → (HTTP 200)
 *   { matched:false }                                   — criterion maps to no
 *                                                          known lens (caller may
 *                                                          allow an explicit fresh
 *                                                          search, else grounds).
 *   { matched:true, rankable:false }                    — maps to a lens but the
 *                                                          compared cars don't carry
 *                                                          enough data to rank it
 *                                                          (→ grounded chat; never
 *                                                          a guess).
 *   { matched:true, rankable:true, dim, slug, name, announce }
 *                                                        — the winning compared car.
 *
 * Deterministic (NO LLM): a keyword map picks a scoring DIMENSION, then the SHARED
 * `normDim` + `SCORE_DIMS` from compare-verdict.ts rank the compared cars on it —
 * the exact primitives the /compare board uses, so the pick can never drift from
 * what the visitor saw. Public Sanity projection only (never `dealerNotes`).
 * Config-as-data: gating, refs cap and rate limit all come from dealerConfig.
 */
import type { APIRoute } from 'astro';
import { client } from '~/sanity/lib/client';
import { dealerConfig } from '~/config/dealer';
import { getChatEnv } from '~/chatbot/get-env';
import { checkRateLimit } from '~/lib/rate-limit';
import { formatPrice } from '~/lib/listing';
import {
  SCORE_DIMS,
  normDim,
  type CompareCar,
  type DimKey,
} from '~/lib/compare-verdict';

export const prerender = false; // dynamic route, not pre-rendered

const json = (body: unknown, status = 200, headers?: Record<string, string>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

// --- Criterion → scoring dimension (deterministic keyword map) ----------------
// Ordered: the FIRST rule whose pattern hits wins, so multi-word phrases that
// share a token with a later rule resolve correctly — e.g. "cheaper to run"
// matches `economy` before the bare "cheap" of `value`, and "low kms" matches
// `lowkm` before `value`. Every dim maps to a real SCORE_DIMS key; a miss returns
// null (→ { matched:false }, never a guess).
const CRITERION_RULES: { dim: DimKey; re: RegExp }[] = [
  {
    dim: 'economy',
    re: /(running[- ]?cost|cheap(?:er|est)?[- ]?to[- ]?run|cost(?:s)?[- ]?to[- ]?run|fuel[- ]?eco|fuel[- ]?economy|economical|\beconomy\b|fuel[- ]?efficien|\befficien\w*|fuel[- ]?consumption|\bthirst\w*|less[- ]?fuel|good[- ]?on[- ]?(?:fuel|gas|petrol|diesel)|l\/100)/i,
  },
  {
    dim: 'lowkm',
    re: /(low(?:est)?[- ]?(?:km|kms|kilometre|kilometres|kilometer|kilometers|mileage)|least[- ]?(?:km|kms|kilometre|kilometres|mile|miles)|fewer?[- ]?(?:km|kms|kilometre|kilometres)|low[- ]?mileage|\bodometer\b|hardly[- ]?driven|least[- ]?driven|driven[- ]?less)/i,
  },
  {
    dim: 'newer',
    re: /(\bnewer\b|\bnewest\b|\blatest\b|most[- ]?recent|more[- ]?recent|\byounger\b|later[- ]?model|recent[- ]?model|\bmodern\b|newest[- ]?model)/i,
  },
  {
    dim: 'space',
    re: /(\bspace\b|spacious|\broomy?\b|\bfamily\b|families|seat(?:s|ing)?|passenger|\bkids?\b|children|bigger|\bbig\b|larger|\blarge\b|more[- ]?room|boot[- ]?space)/i,
  },
  {
    dim: 'value',
    re: /(cheap(?:est|er)?|budget|\bvalue\b|afford\w*|inexpensive|low(?:est)?[- ]?price|best[- ]?(?:price|deal)|good[- ]?deal|save[- ]?money|less[- ]?money|\bprice\b|bang[- ]?for)/i,
  },
];

function criterionToDim(criterion: string): DimKey | null {
  const s = criterion.toLowerCase();
  for (const rule of CRITERION_RULES) {
    if (rule.re.test(s)) return rule.dim;
  }
  return null;
}

// A friendly lead-in per dimension for the announcement (config-free, universal
// vehicle language — not a dealer value).
const DIM_LEAD: Record<DimKey, string> = {
  economy: 'low running costs',
  value: 'value',
  newer: 'the newest of these',
  lowkm: 'the lowest kilometres',
  space: 'space and seating',
};

interface PickRow {
  _id?: string;
  slug?: string;
  title?: string;
  make?: string;
  model?: string;
  price?: number;
  currency?: string;
  year?: number;
  odometer?: number;
  seatCount?: number;
  fuelEconomy?: number;
}

// Public projection only — id, slug, identity + the five scoreable specs. No
// dealerNotes, no prose, no images. Mirrors the CompareCar shape /compare builds.
const PICK_PROJECTION = `{
  _id, "slug": slug.current, title, make, model, price, currency,
  "year": vehicleSpecs.year,
  "odometer": vehicleSpecs.odometer,
  "seatCount": vehicleSpecs.seatCount,
  "fuelEconomy": vehicleSpecs.fuelEconomy
}`;

const carName = (r: PickRow): string =>
  [r.make, r.model].filter(Boolean).join(' ') || r.title || 'this vehicle';

// A grounded, real-number clause about WHY the pick leads on this dimension.
function leadClause(dim: DimKey, r: PickRow): string {
  const locale = dealerConfig.locale.locale;
  if (dim === 'economy' && typeof r.fuelEconomy === 'number') return `at ${r.fuelEconomy} L/100km`;
  if (dim === 'value' && typeof r.price === 'number')
    return `at ${formatPrice(r.price, r.currency || dealerConfig.locale.currency)}`;
  if (dim === 'newer' && typeof r.year === 'number') return `a ${r.year} model`;
  if (dim === 'lowkm' && typeof r.odometer === 'number')
    return `with ${r.odometer.toLocaleString(locale)} km on the clock`;
  if (dim === 'space' && typeof r.seatCount === 'number')
    return `with ${r.seatCount} seats`;
  return '';
}

export const POST: APIRoute = async ({ request }) => {
  const ctxCfg = dealerConfig.chat.context;

  // Gated by the SAME config that lets `compare` context ground at all — a dealer
  // that disables context priming (or drops `compare` from allowedKinds) disables
  // this too, no separate flag to drift.
  if (!ctxCfg.enabled || !ctxCfg.allowedKinds.includes('compare')) {
    return json({ matched: false }, 200);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  const rawRefs = (body as { refs?: unknown })?.refs;
  const rawCriterion = (body as { criterion?: unknown })?.criterion;
  const criterion = typeof rawCriterion === 'string' ? rawCriterion.trim() : '';
  const refs = Array.isArray(rawRefs)
    ? [...new Set(rawRefs.filter((r): r is string => typeof r === 'string' && r.trim() !== ''))].slice(
        0,
        ctxCfg.maxRefs,
      )
    : [];
  if (!criterion) return json({ error: 'Missing "criterion".' }, 400);
  if (refs.length < 2) return json({ matched: false }, 200);

  // Map the criterion to a scoring dimension BEFORE any I/O — a miss short-circuits
  // (no fetch, no guess): the caller decides whether an explicit fresh search may
  // leave the compare role.
  const dim = criterionToDim(criterion);
  if (!dim) return json({ matched: false }, 200);

  // Per-IP rate limit (KV), DISTINCT `comparepick:` prefix so it never shares the
  // chat/search counters. Reuses the search rate-limit config (config-as-data) and
  // fails OPEN so a KV hiccup never blocks a real decision.
  const env = getChatEnv();
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.RATE_LIMIT_KV) {
    try {
      const rl = await checkRateLimit(
        env.RATE_LIMIT_KV,
        ip,
        dealerConfig.chat.search.rateLimit,
        'comparepick:',
      );
      if (!rl.allowed) {
        return json({ matched: false }, 429, { 'Retry-After': String(rl.retryAfterSeconds) });
      }
    } catch (err) {
      console.error('[compare-pick] rate limit check failed (allowing request)', err);
    }
  }

  let rows: PickRow[];
  try {
    rows = await client.fetch<PickRow[]>(
      `*[_type == "listing" && _id in $ids]${PICK_PROJECTION}`,
      { ids: refs },
    );
  } catch (err) {
    console.error('[compare-pick] fetch failed', err);
    // Matched a lens but couldn't load the cars → grounded chat, never a search.
    return json({ matched: true, rankable: false }, 200);
  }

  const byId = new Map((rows ?? []).map((r) => [r._id ?? '', r]));
  // Preserve the visitor's compare order; drop anything that didn't resolve.
  const ordered = refs.map((id) => byId.get(id)).filter((r): r is PickRow => Boolean(r));

  const cars: CompareCar[] = ordered.map((r) => ({
    id: r._id ?? '',
    name: carName(r),
    currency: r.currency || dealerConfig.locale.currency,
    price: typeof r.price === 'number' ? r.price : null,
    year: typeof r.year === 'number' ? r.year : null,
    odometer: typeof r.odometer === 'number' ? r.odometer : null,
    seats: typeof r.seatCount === 'number' ? r.seatCount : null,
    fuelEconomy: typeof r.fuelEconomy === 'number' ? r.fuelEconomy : null,
  }));

  // Rank on the single mapped dimension using the SHARED normaliser. `normDim`
  // returns a per-car 0..100 map ONLY for cars carrying the value, and an EMPTY
  // map when fewer than two do — so an un-scoreable criterion (e.g. only one car
  // states fuel economy) can never fabricate a winner.
  const dimDef = SCORE_DIMS.find((d) => d.key === dim);
  const scores = dimDef ? normDim(cars, dimDef) : {};
  const scored = cars.filter((c) => scores[c.id] != null);
  if (!dimDef || scored.length < 2) {
    return json({ matched: true, rankable: false }, 200);
  }

  // Highest score wins; ties broken by the cheaper car (mirrors scoreCars).
  const pick = [...scored].sort(
    (a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0) || (a.price ?? Infinity) - (b.price ?? Infinity),
  )[0];
  const pickRow = byId.get(pick.id);
  const slug = pickRow?.slug;
  if (!pickRow || !slug) {
    // No slug means no listing to open → grounded chat rather than a dead link.
    return json({ matched: true, rankable: false }, 200);
  }

  const clause = leadClause(dim, pickRow);
  const tail = clause ? ` — ${clause}. Opening it now.` : ' — opening it now.';
  const announce = `For ${DIM_LEAD[dim]}, the ${pick.name} is your best pick of these ${cars.length}${tail}`;

  return json({ matched: true, rankable: true, dim, slug, name: pick.name, announce }, 200);
};
