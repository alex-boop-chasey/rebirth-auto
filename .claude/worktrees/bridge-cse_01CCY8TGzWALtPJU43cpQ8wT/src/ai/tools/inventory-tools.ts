/**
 * Deterministic inventory tools for agentic search — the anti-hallucination
 * foundation.
 * ------------------------------------------------------------------
 * Two tool definitions (name + description + JSON-schema params) paired with
 * executors that run the EXISTING, shared inventory query helpers and return
 * ONLY real Sanity data:
 *
 *   • `search_inventory(params)` — wraps the same enum-locked filter contract the
 *     homepage and `/api/search` use (`AiFiltersSchema` → `toFilterState` →
 *     `buildListingsFilter`), then fetches matching listings via the shared Sanity
 *     client. It can only ever surface vehicles that are actually in stock.
 *   • `get_listing(slug)` — fetches ONE real listing by slug using the shared
 *     `LISTING_FIELDS` public projection.
 *
 * ── ANTI-HALLUCINATION GUARANTEE ────────────────────────────────────────────
 * These executors contain NO LLM call and NO free-text field. Every filter value
 * is validated by `AiFiltersSchema` (`z.enum` REJECTS anything outside the exact
 * `vehicleSpecs` codes — it never coerces), and the result rows come straight from
 * a GROQ fetch against real inventory. A tool result is therefore, by
 * construction, a subset of real stock — the model driving the loop can only
 * relay real vehicles, prices, and specs. It cannot invent a car.
 *
 * Only PUBLIC fields are ever queried/projected — `dealerNotes` (and other
 * staff-only fields) are excluded from `LISTING_FIELDS` and never reach here.
 *
 * These tools are USEFUL and TESTABLE on their own: no paid model is needed to
 * run either executor. The gated agentic LOOP (src/ai/agentic/search-agent.ts) is
 * a separate, default-OFF concern.
 */
import { z } from 'zod';
import { client } from '../../sanity/lib/client';
import { getDealerConfig } from '../../config/dealer';
import { LISTING_FIELDS, formatPrice, type Listing } from '../../lib/listing';
import { buildListingsFilter, type FilterState } from '../../lib/listings-query';
import {
  AiFiltersSchema,
  toFilterState,
  type AiFilters,
} from '../../lib/ai-search/schema';

// --- Shared tool shapes ------------------------------------------------------

/**
 * A provider-agnostic tool definition. Mirrors the OpenAI/OpenRouter
 * "function" tool shape (`{ type:'function', function:{ name, description,
 * parameters } }`) closely enough that the paid transport (TODO_KEYS) can map it
 * 1:1, but stays independent of any provider SDK. `parameters` is a JSON-schema
 * object describing the executor's input.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** One compact, real inventory row returned by `search_inventory`. */
export interface InventoryMatch {
  title: string;
  price: number;
  /** Human-formatted price using the dealer locale/currency (e.g. "$38,990"). */
  priceLabel: string;
  slug: string;
  year?: number;
  colour?: string;
  bodyType?: string;
  fuelType?: string;
  transmission?: string;
  odometer?: number;
}

export interface SearchInventoryResult {
  /** How the enum-locked filters were understood, echoed back for grounding. */
  appliedFilters: string;
  /** The matching rows shown (capped at `maxResults`). */
  matches: InventoryMatch[];
  /** Total number of active matches (may exceed `matches.length`). */
  total: number;
}

// --- search_inventory --------------------------------------------------------

/** Hard cap on rows a single search returns to the loop (bounds token cost). */
const DEFAULT_MAX_RESULTS = 8;

/**
 * JSON-schema params for `search_inventory`. Every dimension mirrors the existing
 * URL filter contract; the enum members are the SAME `vehicleSpecs` codes the
 * homepage filters and `/api/search` use (imported transitively via
 * `AiFiltersSchema`). No free-text field exists — a model cannot smuggle an
 * invented make/model through; it can only pick from these codes.
 */
export const searchInventoryTool: ToolDefinition = {
  name: 'search_inventory',
  description:
    "Search the dealership's REAL live inventory by structured filters (body type, " +
    'fuel type, transmission, drive type, colour, condition, seat count, price range, ' +
    'year range, max odometer). Returns only vehicles actually in stock — never ' +
    'invented. Use this to answer any "what do you have" / "show me a …" question.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      bodyType: { type: 'array', items: { type: 'string' }, description: 'e.g. suv, sedan, ute, hatchback, wagon, van, coupe, convertible' },
      colour: { type: 'array', items: { type: 'string' }, description: 'base colour family, e.g. white, black, red, blue' },
      transmission: { type: 'array', items: { type: 'string' }, description: 'auto | manual' },
      fuelType: { type: 'array', items: { type: 'string' }, description: 'petrol | diesel | hybrid | electric | lpg' },
      driveType: { type: 'array', items: { type: 'string' }, description: '2wd | awd | 4wd' },
      condition: { type: 'array', items: { type: 'string' }, description: 'new | used | demo' },
      seats: { type: 'array', items: { type: 'integer' }, description: 'seat counts, e.g. 5, 7' },
      priceMin: { type: 'integer', description: 'minimum price (whole dollars)' },
      priceMax: { type: 'integer', description: 'maximum price (whole dollars)' },
      yearMin: { type: 'integer', description: 'earliest build year' },
      yearMax: { type: 'integer', description: 'latest build year' },
      odoMax: { type: 'integer', description: 'maximum odometer (km)' },
    },
  },
};

/** One compact projection row from the search fetch (public fields only). */
interface SearchRow {
  title?: string;
  price?: number;
  currency?: string;
  slug?: { current?: string };
  year?: number;
  colour?: string;
  bodyType?: string;
  fuelType?: string;
  transmission?: string;
  odometer?: number;
}

function toMatch(r: SearchRow): InventoryMatch {
  const currency = r.currency ?? getDealerConfig().locale.currency;
  const match: InventoryMatch = {
    title: r.title ?? 'Vehicle',
    price: r.price ?? 0,
    priceLabel: formatPrice(r.price ?? 0, currency),
    slug: r.slug?.current ?? '',
  };
  if (typeof r.year === 'number') match.year = r.year;
  if (r.colour) match.colour = r.colour;
  if (r.bodyType) match.bodyType = r.bodyType;
  if (r.fuelType) match.fuelType = r.fuelType;
  if (r.transmission) match.transmission = r.transmission;
  if (typeof r.odometer === 'number') match.odometer = r.odometer;
  return match;
}

/**
 * Execute `search_inventory`. Deterministic: validate raw params through the
 * shared enum-locked `AiFiltersSchema` (rejecting any value outside the real
 * `vehicleSpecs` codes), convert to a `FilterState` via the page's own
 * `toFilterState`, build the shared active-scoped GROQ filter with
 * `buildListingsFilter`, then fetch. NO LLM, NO fabrication — the returned rows
 * are a subset of real active stock.
 *
 * `rawParams` is deliberately typed `unknown`: a tool-calling model's arguments
 * arrive as untrusted JSON. `AiFiltersSchema.parse` is the trust boundary. Throws
 * `ZodError` on malformed enum values — the caller (the loop) decides how to
 * surface that; the paid transport typically feeds a validation error back to the
 * model so it can retry with valid codes.
 */
export async function executeSearchInventory(
  rawParams: unknown,
  opts: { maxResults?: number } = {},
): Promise<SearchInventoryResult> {
  const filters: AiFilters = AiFiltersSchema.parse(rawParams ?? {});
  const state: FilterState = toFilterState(filters);
  const max = Math.max(1, opts.maxResults ?? DEFAULT_MAX_RESULTS);

  const { filter, params } = buildListingsFilter(state);
  // Public projection + active-scope, mirroring the grounding live-lookup shape.
  const scoped = `${filter} && status == "active"`;
  const projection = `{
    title, price, currency, slug,
    "year": vehicleSpecs.year,
    "colour": vehicleSpecs.colour,
    "bodyType": vehicleSpecs.bodyType,
    "fuelType": vehicleSpecs.fuelType,
    "transmission": vehicleSpecs.transmission,
    "odometer": vehicleSpecs.odometer
  }`;
  const query = `{
    "items": *[${scoped}] | order(price asc, _id asc) [0...${max}]${projection},
    "total": count(*[${scoped}])
  }`;

  const res = await client.fetch<{ items: SearchRow[]; total: number }>(query, params);
  const rows = res?.items ?? [];

  return {
    appliedFilters: describeFilters(state),
    matches: rows.map(toMatch),
    total: res?.total ?? 0,
  };
}

/** Compact human summary of the ACTIVE filter dimensions, for grounding context. */
function describeFilters(state: FilterState): string {
  const parts: string[] = [];
  if (state.bodyType.length) parts.push(`body: ${state.bodyType.join('/')}`);
  if (state.colour.length) parts.push(`colour: ${state.colour.join('/')}`);
  if (state.transmission.length) parts.push(`transmission: ${state.transmission.join('/')}`);
  if (state.fuelType.length) parts.push(`fuel: ${state.fuelType.join('/')}`);
  if (state.driveType.length) parts.push(`drive: ${state.driveType.join('/')}`);
  if (state.condition.length) parts.push(`condition: ${state.condition.join('/')}`);
  if (state.seats.length) parts.push(`seats: ${state.seats.join('/')}`);
  if (state.priceMin != null) parts.push(`priceMin: ${state.priceMin}`);
  if (state.priceMax != null) parts.push(`priceMax: ${state.priceMax}`);
  if (state.yearMin != null) parts.push(`yearMin: ${state.yearMin}`);
  if (state.yearMax != null) parts.push(`yearMax: ${state.yearMax}`);
  if (state.odoMax != null) parts.push(`odoMax: ${state.odoMax}`);
  return parts.length ? parts.join(', ') : 'no filters (all active stock)';
}

// --- get_listing -------------------------------------------------------------

/** JSON-schema params for `get_listing`. */
export const getListingTool: ToolDefinition = {
  name: 'get_listing',
  description:
    'Fetch the full public detail of ONE real listing by its slug (as returned in a ' +
    'search_inventory result). Returns null when no active/live listing has that ' +
    'slug — never a fabricated vehicle.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['slug'],
    properties: {
      slug: { type: 'string', description: 'the listing slug, e.g. "2021-toyota-rav4-cruiser"' },
    },
  },
};

const GetListingParams = z.object({ slug: z.string().min(1) });

/**
 * Execute `get_listing`. Fetches one real listing via the shared
 * `LISTING_FIELDS` public projection (the SAME projection the detail page uses),
 * returning `null` when nothing matches. Deterministic, no LLM, no fabrication.
 */
export async function executeGetListing(rawParams: unknown): Promise<Listing | null> {
  const { slug } = GetListingParams.parse(rawParams ?? {});
  const listing = await client.fetch<Listing | null>(
    `*[_type == "listing" && category == "automotive" && slug.current == $slug][0]{ ${LISTING_FIELDS} }`,
    { slug },
  );
  return listing ?? null;
}

// --- Registry ----------------------------------------------------------------

/**
 * The tool definitions the agentic loop advertises to the model, in a stable
 * order. Executors are looked up by name in `INVENTORY_TOOL_EXECUTORS`.
 */
export const INVENTORY_TOOLS: readonly ToolDefinition[] = [searchInventoryTool, getListingTool];

/**
 * Name → executor map. Each executor takes untrusted JSON args and returns real
 * data (or null). Kept parallel to `INVENTORY_TOOLS` so the loop can dispatch a
 * model-chosen tool call by name.
 */
export const INVENTORY_TOOL_EXECUTORS: Record<string, (rawParams: unknown) => Promise<unknown>> = {
  search_inventory: (raw) => executeSearchInventory(raw),
  get_listing: (raw) => executeGetListing(raw),
};
