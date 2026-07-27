/**
 * Live inventory lookup grounding — specific turns only.
 * ------------------------------------------------------------------
 * A live PUBLIC GROQ query for the vehicles matching a DETERMINISTIC (no LLM)
 * extraction of the visitor's message. Renders a delimited, authoritative block
 * of ≤N one-liners + the exact total. Fail-open and KV short-TTL-cached.
 *
 * The extraction itself lives in the portable `~/lib/vehicle-filter-extract`
 * module (shared with the `/api/search` pre-pass and the widget's client-side
 * "type it to Rebi" refine) so there is ONE synonym vocabulary. It feeds
 * synthetic URL params through the SAME `parseFilters` the URL filter contract
 * uses, so a chat lookup and a `/?bodyType=suv&priceMax=40000` link resolve to an
 * identical `FilterState`.
 *
 * PUBLIC fields only — `dealerNotes` is never queried, projected, or rendered.
 */
import { client } from '../../sanity/lib/client';
import { getDealerConfig } from '../../config/dealer';
import { formatPrice } from '../../lib/listing';
import { buildListingsFilter } from '../../lib/listings-query';
import { extractFilters, type Extraction } from '../../lib/vehicle-filter-extract';
import { cachedText } from './cache';
import type { KVNamespaceLike } from '../core';

export { extractFilters, type Extraction };

// --- Live query + render ------------------------------------------------------

interface MatchRow {
  title?: string;
  price?: number;
  currency?: string;
  slug?: { current?: string };
  bodyType?: string;
  colour?: string;
  fuelType?: string;
  transmission?: string;
  year?: number;
  odometer?: number;
  fuelEconomy?: number;
}

function renderMatchLine(r: MatchRow, i: number): string {
  const parts: string[] = [];
  if (r.year) parts.push(String(r.year));
  if (r.colour) parts.push(r.colour);
  if (r.bodyType) parts.push(r.bodyType);
  if (r.fuelType) parts.push(r.fuelType);
  if (r.transmission) parts.push(r.transmission);
  if (typeof r.odometer === 'number') parts.push(`${r.odometer.toLocaleString('en-AU')} km`);
  if (typeof r.fuelEconomy === 'number') parts.push(`${r.fuelEconomy} L/100km`);
  const price = formatPrice(r.price ?? 0, r.currency ?? getDealerConfig().locale.currency);
  const spec = parts.length ? ` (${parts.join(', ')})` : '';
  return `${i + 1}. ${r.title ?? 'Vehicle'} — ${price}${spec}`;
}

function renderMatches(rows: MatchRow[], total: number, max: number): string {
  const header = '=== LIVE INVENTORY MATCHES (authoritative, fetched live) ===';
  const footer = '=== END LIVE INVENTORY MATCHES ===';
  if (total === 0 || rows.length === 0) {
    return [
      header,
      'No vehicles currently match that request. Tell the visitor plainly that nothing in stock matches right now, suggest broadening the search or checking /listings, and DO NOT invent alternatives, prices, or specs.',
      footer,
    ].join('\n');
  }
  const shown = rows.slice(0, max).map((r, i) => renderMatchLine(r, i));
  const note =
    total > rows.length
      ? `Showing ${rows.length} of ${total} matching vehicles.`
      : `${total} matching vehicle${total === 1 ? '' : 's'}.`;
  return [
    header,
    `${note} This list is the ONLY live stock matching the visitor's request. Do not quote any price or spec not shown here, and do not invent vehicles beyond this list. Point interested visitors to the listing on /listings or to the team.`,
    ...shown,
    footer,
  ].join('\n');
}

/**
 * Run the deterministic extraction + live query for the visitor's message.
 * Returns the rendered matches block, or `null` when nothing meaningful was
 * extracted (the overview carries the turn) or on any error (fail-open).
 * KV short-TTL-cached keyed by the normalized extraction.
 */
export async function getLiveMatches(kv: KVNamespaceLike | undefined, message: string): Promise<string | null> {
  const cfg = getDealerConfig().chat.grounding;
  if (!cfg.lookup.enabled) return null;

  let extraction: Extraction | null;
  try {
    extraction = extractFilters(message);
  } catch (err) {
    console.error('[grounding] Filter extraction failed', err);
    return null;
  }
  if (!extraction) return null;

  const { state, keyword } = extraction;
  const max = cfg.lookup.maxListings;

  try {
    return await cachedText(
      kv,
      `grounding:lookup:v1:${JSON.stringify({ state, keyword, max })}`,
      cfg.cacheTtlSeconds.lookup,
      async () => {
        const { filter, params } = buildListingsFilter(state);
        const kwClause = keyword ? ' && title match $kw' : '';
        const p: Record<string, unknown> = { ...params };
        if (keyword) p.kw = keyword.split(/\s+/).map((t) => `*${t}*`).join(' ');

        // Public projection only. Slice/count use the same active-scoped filter.
        const scoped = `${filter} && status == "active"${kwClause}`;
        const projection = `{
          title, price, currency, slug,
          "bodyType": vehicleSpecs.bodyType,
          "colour": vehicleSpecs.colour,
          "fuelType": vehicleSpecs.fuelType,
          "transmission": vehicleSpecs.transmission,
          "year": vehicleSpecs.year,
          "odometer": vehicleSpecs.odometer,
          "fuelEconomy": vehicleSpecs.fuelEconomy
        }`;
        const query = `{
          "items": *[${scoped}] | order(price asc) [0...${max}]${projection},
          "total": count(*[${scoped}])
        }`;

        const res = await client.fetch<{ items: MatchRow[]; total: number }>(query, p);
        return renderMatches(res?.items ?? [], res?.total ?? 0, max);
      },
    );
  } catch (err) {
    console.error('[grounding] Live lookup query failed', err);
    return null;
  }
}
