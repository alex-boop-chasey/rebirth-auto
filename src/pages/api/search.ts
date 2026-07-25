/**
 * AI natural-language search — Rebi-fronted homepage search entry point.
 *
 * POST { query: string, filters?: FilterState-ish } → SearchResponse (HTTP 200),
 * or a graceful low-confidence fallback (still HTTP 200) on any AI failure.
 *
 * Discipline (mirrors the chatbot + description routes): feature flag → cheap
 * body validation → per-IP KV rate limit (fail OPEN, DISTINCT `search:` prefix so
 * it never shares the chat `rl:` counter) → deterministic PRE-PASS → structured
 * LLM only on a pre-pass miss → graceful 200. All AI routes through src/ai/;
 * dealer-scoped values come from dealerConfig (nothing hardcoded).
 *
 * Extraction is two-stage (cheaper + faster): the deterministic
 * `extractFilters()` runs FIRST; if it yields concrete filters we answer from it
 * and SKIP the LLM. Only ambiguous/soft queries ("family car", "economical") fall
 * through to the structured tier.
 */
import type { APIRoute } from 'astro';
import { configureAI, generateObject } from '~/ai';
import { APP_URL, APP_TITLE, REQUEST_TIMEOUT_MS } from '~/chatbot/config';
import { getChatEnv } from '~/chatbot/get-env';
import { dealerConfig } from '~/config/dealer';
import { checkRateLimit } from '~/lib/rate-limit';
import { activeChips, type FilterState } from '~/lib/listings-query';
import { extractFilters, hasConcreteFilters } from '~/lib/vehicle-filter-extract';
import {
  ExtractionSchema,
  normalizeCurrentFilters,
  activeFilterSummary,
  toSearchResponse,
  fallbackResponse,
  type SearchResponse,
} from '~/lib/ai-search/schema';
import { SYSTEM_PROMPT } from '~/lib/ai-search/prompt';

export const prerender = false; // dynamic route, not pre-rendered

const json = (body: unknown, status = 200, headers?: Record<string, string>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

/** Human-readable interpretation + match reasons for a deterministic pre-pass hit. */
function describeState(state: FilterState): { interpretation: string; matchReasons: string[] } {
  const chips = activeChips(state);
  const matchReasons = chips.map((c) => c.value).slice(0, 5);
  const phrase = chips.map((c) => `${c.label.toLowerCase()} ${c.value}`).join(', ');
  return {
    interpretation: phrase ? `Showing vehicles matching ${phrase}.` : 'Showing all vehicles.',
    matchReasons,
  };
}

export const POST: APIRoute = async ({ request }) => {
  const cfg = dealerConfig.chat.search;

  // Feature flag — a dealer can disable AI search without a deploy.
  if (!cfg.enabled) return json({ error: 'AI search is disabled.' }, 503);

  const env = getChatEnv();

  // Validate BEFORE spending a rate-limit slot or an AI call.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  const rawQuery = (body as { query?: unknown })?.query;
  const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';
  if (!query) return json({ error: 'Missing "query" (a non-empty string).' }, 400);
  if (query.length > cfg.maxQueryLength) {
    return json({ error: `Query too long (max ${cfg.maxQueryLength}).` }, 400);
  }

  const current = normalizeCurrentFilters((body as { filters?: unknown })?.filters);

  // Refine mode (the in-chat "type it to Rebi" refine). A refine is always a
  // MODIFICATION of the grid already on screen, so it must carry the current
  // filters forward and can REMOVE one ("actually not diesel") — both of which
  // the deterministic pre-pass cannot do (it ignores `current` and can't parse
  // negation). So a refine SKIPS the pre-pass and goes straight to the enum-locked
  // interpreter, which owns carry-forward + removal + the soft-concept map. Opt-in
  // and additive: the hero SearchDock sends no flag, so its fast pre-pass path for
  // fresh searches is byte-identical to before.
  const refine = (body as { refine?: unknown })?.refine === true;

  // Per-IP rate limit (KV). DISTINCT `search:` prefix so search does NOT share the
  // chat `rl:` 10/hr counter. Guard when unbound; fail OPEN so a KV hiccup never
  // blocks a real visitor.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.RATE_LIMIT_KV) {
    try {
      const rl = await checkRateLimit(env.RATE_LIMIT_KV, ip, cfg.rateLimit, 'search:');
      if (!rl.allowed) {
        return json({ error: 'Search limit reached — please try again later.' }, 429, {
          'Retry-After': String(rl.retryAfterSeconds),
        });
      }
    } catch (err) {
      console.error('[ai-search] rate limit check failed (allowing request)', err);
    }
  }

  // --- Stage 1: deterministic pre-pass (free, no LLM) -------------------------
  // If the enum/synonym matcher finds concrete filters, answer from them and skip
  // the model entirely. Only soft/ambiguous queries fall through to Stage 2. A
  // refine always skips this (see `refine` above) so carry-forward/removal work.
  try {
    const pre = refine ? null : extractFilters(query);
    if (pre && hasConcreteFilters(pre.state)) {
      const { interpretation, matchReasons } = describeState(pre.state);
      const resp: SearchResponse = {
        interpretation,
        confidence: 'high',
        clarifyingQuestion: null,
        filters: pre.state,
        matchReasons,
      };
      return json(resp, 200);
    }
  } catch (err) {
    console.error('[ai-search] deterministic pre-pass failed (falling through to LLM)', err);
  }

  // --- Stage 2: structured LLM extraction (soft concepts / ambiguity) ---------
  if (!env.OPENROUTER_API_KEY) {
    return json(
      fallbackResponse('AI search is temporarily unavailable — please use the filters.'),
      200,
    );
  }
  // Match /api/chat's configureAI call BYTE-FOR-BYTE (incl. streamAttemptTimeoutMs)
  // so the two are idempotent-compatible: in the common flow a visitor searches
  // then chats in the same isolate, and configureAI throws if re-called with a
  // *different* config. (Unused for this non-streaming generateObject call.)
  configureAI({
    openrouterApiKey: env.OPENROUTER_API_KEY,
    referer: APP_URL,
    appTitle: APP_TITLE,
    attemptTimeoutMs: REQUEST_TIMEOUT_MS,
    streamAttemptTimeoutMs: REQUEST_TIMEOUT_MS,
  });

  try {
    const { content } = await generateObject({
      capability: 'structured',
      schema: ExtractionSchema,
      schemaName: 'CarSearchExtraction',
      maxTokens: 1024, // small payload → trim cost/latency (per-request override)
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Current filters (canonical query string, may be empty): ${activeFilterSummary(current)}\n\n<user_query>\n${query}\n</user_query>`,
        },
      ],
    });
    return json(toSearchResponse(content), 200);
  } catch (err) {
    // Model failure / unparseable / exhaustion → graceful 200 fallback.
    console.error('[ai-search] extraction failed', err);
    return json(fallbackResponse(), 200);
  }
};
