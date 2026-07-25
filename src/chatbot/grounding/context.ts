/**
 * Conversation-focus grounding — the primed "Ask about this car" subject.
 * ------------------------------------------------------------------
 * Resolves the specific vehicle(s) a conversation was primed from into a
 * delimited, authoritative CONVERSATION FOCUS block, mirroring lookup.ts /
 * overview.ts: PUBLIC Sanity client, an EXPLICIT public projection (never
 * `dealerNotes`), `cachedText`, and fail-open (`null` on any error or miss).
 *
 * Deterministic (NO LLM call) — just a Sanity fetch by `_id`. Notes:
 *   - Resolves by `_id` via the token-free public client, so drafts (which live
 *     under a `drafts.` id the public client can't see) never surface.
 *   - Does NOT scope to `status == "active"`: a SOLD listing still resolves, so
 *     Rebi can honestly tell the visitor it's no longer available.
 */
import { client } from '../../sanity/lib/client';
import { getDealerConfig } from '../../config/dealer';
import { formatPrice } from '../../lib/listing';
import { parseFilters, buildListingsFilter, activeChips } from '../../lib/listings-query';
import { cachedText } from './cache';
import type { KVNamespaceLike } from '../core';
import type { ConversationContext } from '../context';

interface FocusRow {
  _id?: string;
  title?: string;
  price?: number;
  currency?: string;
  status?: string;
  bodyType?: string;
  fuelType?: string;
  transmission?: string;
  driveType?: string;
  year?: number;
  odometer?: number;
  condition?: string;
  seatCount?: number;
}

// Public projection only — no dealerNotes, no images, no prose. Mirrors the
// shape lookup.ts renders, plus `status` so a sold vehicle reads honestly.
const FOCUS_PROJECTION = `{
  _id, title, price, currency, status,
  "bodyType": vehicleSpecs.bodyType,
  "fuelType": vehicleSpecs.fuelType,
  "transmission": vehicleSpecs.transmission,
  "driveType": vehicleSpecs.driveType,
  "year": vehicleSpecs.year,
  "odometer": vehicleSpecs.odometer,
  "condition": vehicleSpecs.condition,
  "seatCount": vehicleSpecs.seatCount
}`;

function renderFocusLine(r: FocusRow, i: number): string {
  const parts: string[] = [];
  if (r.year) parts.push(String(r.year));
  if (r.bodyType) parts.push(r.bodyType);
  if (r.fuelType) parts.push(r.fuelType);
  if (r.transmission) parts.push(r.transmission);
  if (r.driveType) parts.push(r.driveType);
  if (typeof r.seatCount === 'number') parts.push(`${r.seatCount} seats`);
  if (typeof r.odometer === 'number') parts.push(`${r.odometer.toLocaleString('en-AU')} km`);
  if (r.condition) parts.push(r.condition);
  const price = formatPrice(r.price ?? 0, r.currency ?? getDealerConfig().locale.currency);
  const spec = parts.length ? ` (${parts.join(', ')})` : '';
  const status = r.status && r.status !== 'active' ? ` — status: ${r.status.toUpperCase()}` : '';
  return `${i + 1}. ${r.title ?? 'Vehicle'} — ${price}${spec}${status}`;
}

/** Render the delimited focus block, or `''` when nothing resolved (→ omit). */
function renderFocus(rows: FocusRow[], kind: ConversationContext['kind']): string {
  if (!rows.length) return '';
  const soldOrGone = rows.some((r) => r.status && r.status !== 'active');
  const isCompare = kind === 'compare';
  const header = isCompare
    ? '=== CONVERSATION FOCUS (the vehicles the visitor is comparing — authoritative, fetched live) ==='
    : '=== CONVERSATION FOCUS (the vehicle the visitor is looking at — authoritative, fetched live) ===';
  const footer = '=== END CONVERSATION FOCUS ===';
  const framing = isCompare
    ? 'The visitor is COMPARING these vehicles — help them weigh the trade-offs (price, running costs, space, features) and decide between them. The details below are fetched live from our stock system: ground every claim in this data, never invent a difference not supported by it, and never quote a price, spec, or availability that is not shown here.'
    : 'The visitor opened this chat from a specific vehicle. Treat it as the subject of the conversation unless they clearly move on to something else. The details below are fetched live from our stock system: never quote a price, spec, or availability that is not shown here, and never invent details.';
  const lines = rows.map((r, i) => renderFocusLine(r, i));
  const soldNote = soldOrGone
    ? 'One or more of these vehicles is no longer active (e.g. SOLD). If the visitor asks about it, tell them honestly it is no longer available and offer to help find something similar or connect them with our team.'
    : '';
  return [header, framing, ...lines, soldNote, footer].filter(Boolean).join('\n');
}

/**
 * Render the "RESULTS CURRENTLY ON SCREEN" focus block for a `search` context —
 * the live matches for the filter state the visitor is looking at. `''` when the
 * filter parses to nothing meaningful (→ omit; Rebi just chats). The exact total
 * grounds Rebi honestly (including "nothing matches" and the dealer-subset
 * body-type case, where a code the dealer doesn't stock reads 0).
 */
function renderSearchFocus(rows: FocusRow[], total: number, summary: string, max: number): string {
  const header =
    '=== RESULTS CURRENTLY ON SCREEN (the vehicles the visitor is looking at — authoritative, fetched live) ===';
  const footer = '=== END RESULTS CURRENTLY ON SCREEN ===';
  const filterLine = summary
    ? `The visitor is searching for: ${summary}.`
    : 'The visitor is browsing the full inventory.';
  if (total === 0 || rows.length === 0) {
    return [
      header,
      filterLine,
      'No vehicles currently match that search. Tell the visitor plainly that nothing in stock matches right now, and offer to broaden the search or connect them with our team. DO NOT invent alternatives, prices, or specs.',
      footer,
    ].join('\n');
  }
  const shown = rows.slice(0, max).map((r, i) => renderFocusLine(r, i));
  const note =
    total > shown.length
      ? `There are ${total} vehicles matching this search. Listed below are ${shown.length} of them (lowest-priced first) as a representative sample — the ONLY listings you may quote prices or specs from. Do NOT claim there are only ${shown.length}; the true total is ${total}, and the rest are on /listings.`
      : `There ${total === 1 ? 'is' : 'are'} ${total} matching vehicle${total === 1 ? '' : 's'}, all listed below.`;
  return [
    header,
    `${filterLine} ${note} Treat these results as the subject of the conversation. Never quote a price or spec not shown here, never invent vehicles beyond this list, and help the visitor weigh options or narrow down. Point interested visitors to the listing on /listings or to the team.`,
    ...shown,
    footer,
  ].join('\n');
}

/**
 * Resolve a conversation context to its live CONVERSATION FOCUS block, or `null`
 * when priming is disabled, the kind isn't allowed, nothing resolves, or any
 * error occurs (fail-open — the focus is simply omitted). KV TTL-cached keyed by
 * the kind + refs.
 */
export async function resolveFocus(
  kv: KVNamespaceLike | undefined,
  context: ConversationContext,
): Promise<string | null> {
  const cfg = getDealerConfig().chat.context;
  if (!cfg.enabled) return null;
  if (!cfg.allowedKinds.includes(context.kind)) return null;

  const refs = context.refs.slice(0, cfg.maxRefs);
  if (!refs.length) return null;

  // `search` carries ONE ref: a serialized filter query string describing the
  // grid on screen. Parse it back through the URL contract's `parseFilters`,
  // query the exact same set + count, and render the on-screen results.
  if (context.kind === 'search') {
    const ref = refs[0];
    const max = getDealerConfig().chat.grounding.lookup.maxListings;
    try {
      const text = await cachedText(
        kv,
        `grounding:focus:v1:search:${ref}`,
        cfg.cacheTtlSeconds,
        async () => {
          const state = parseFilters(new URLSearchParams(ref));
          const summary = activeChips(state)
            .map((c) => `${c.label.toLowerCase()} ${c.value}`)
            .join(', ');
          const { filter, params } = buildListingsFilter(state);
          // Mirror the homepage grid query (no extra status scoping) so the total
          // matches exactly what the visitor sees. Public projection — no dealerNotes.
          const query = `{
            "items": *[${filter}] | order(price asc) [0...${max}]${FOCUS_PROJECTION},
            "total": count(*[${filter}])
          }`;
          const res = await client.fetch<{ items: FocusRow[]; total: number }>(query, params);
          return renderSearchFocus(res?.items ?? [], res?.total ?? 0, summary, max);
        },
      );
      return text || null;
    } catch (err) {
      console.error('[grounding] Search focus resolution failed (omitting focus)', err);
      return null;
    }
  }

  // `listing` (one id) and `compare` (several ids) both resolve their refs by
  // `_id` through the same fetch — the only difference is the framing in
  // `renderFocus`.
  if (context.kind !== 'listing' && context.kind !== 'compare') return null;

  try {
    const text = await cachedText(
      kv,
      `grounding:focus:v1:${context.kind}:${refs.join(',')}`,
      cfg.cacheTtlSeconds,
      async () => {
        const query = `*[_type == "listing" && _id in $ids]${FOCUS_PROJECTION}`;
        const rows = await client.fetch<FocusRow[]>(query, { ids: refs });
        return renderFocus(rows ?? [], context.kind);
      },
    );
    return text || null;
  } catch (err) {
    console.error('[grounding] Focus resolution failed (omitting focus)', err);
    return null;
  }
}
