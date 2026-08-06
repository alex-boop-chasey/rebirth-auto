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
import { resolveVisitor, withCookie } from '~/chatbot/visitor';
import { recordJourneyEvent } from '~/chatbot/journey';
import { extractFilters, hasConcreteFilters } from '~/lib/vehicle-filter-extract';
import {
  ExtractionSchema,
  normalizeCurrentFilters,
  activeFilterSummary,
  toSearchResponse,
  fallbackResponse,
  emptyFilterState,
  type SearchResponse,
} from '~/lib/ai-search/schema';
import { SYSTEM_PROMPT } from '~/lib/ai-search/prompt';
import { planSearch, planToSearchResponse, type SearchPlan } from '~/ai/search/query-planner';

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

// Deterministic extraction can't handle negation or a new/used contradiction —
// defer those to the LLM planner even when concrete filters were matched.
function needsPlanner(query: string): boolean {
  const q = query.toLowerCase();
  const negation = /\b(no|not|non|without|isn'?t|aren'?t|doesn'?t|don'?t|except|excluding|nor)\b/.test(q);
  const contradiction = /\bnew\b/.test(q) && /\b(used|second[-\s]?hand|pre-?owned)\b/.test(q);
  return negation || contradiction;
}

export const POST: APIRoute = async ({ request }) => {
  const cfg = dealerConfig.chat.search;

  // Feature flag — a dealer can disable AI search without a deploy.
  if (!cfg.enabled) return json({ error: 'AI search is disabled.' }, 503);

  const env = getChatEnv();

  // Continuity journey: resolve the opaque visitor id (fail-open → {id:null}).
  // `setCookie`, when a fresh id is minted, rides on every outgoing Response via
  // `withVid` so the id sticks across pages (listing/compare beacons reuse it).
  const { id: visitorId, setCookie } = resolveVisitor(request, dealerConfig.chat.journey);
  const withVid = (r: Response) => withCookie(r, setCookie);
  // Record a `search` event AFTER the user-visible result is computed. Best-effort
  // and fully fail-open (recordJourneyEvent swallows all errors). ref = the
  // canonical serialized filters; label = the human chips phrase (price-free-ish).
  const captureSearch = async (state: FilterState): Promise<void> => {
    try {
      const ref = activeFilterSummary(state);
      const label = activeChips(state)
        .map((c) => `${c.label.toLowerCase()} ${c.value}`)
        .join(', ');
      await recordJourneyEvent(env.CHAT_DB, visitorId, 'search', ref, label || null);
    } catch {
      /* fail-open — a journey hiccup never affects search */
    }
  };

  // Validate BEFORE spending a rate-limit slot or an AI call.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withVid(json({ error: 'Invalid JSON body.' }, 400));
  }
  const rawQuery = (body as { query?: unknown })?.query;
  const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';
  if (!query) return withVid(json({ error: 'Missing "query" (a non-empty string).' }, 400));
  if (query.length > cfg.maxQueryLength) {
    return withVid(json({ error: `Query too long (max ${cfg.maxQueryLength}).` }, 400));
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
        return withVid(
          json({ error: 'Search limit reached — please try again later.' }, 429, {
            'Retry-After': String(rl.retryAfterSeconds),
          }),
        );
      }
    } catch (err) {
      console.error('[ai-search] rate limit check failed (allowing request)', err);
    }
  }

  // --- Stage 1: deterministic pre-pass (regex-first, free, no LLM) ------------
  // REGEX-FIRST: run the deterministic matcher BEFORE any LLM. On a fresh search,
  // if it finds concrete filters AND the query isn't one the extractor can't be
  // trusted on (negation / new-vs-used contradiction → needsPlanner), answer from
  // it and SKIP every LLM call — the fast path. A refine always skips this (see
  // `refine` above) so carry-forward/removal work. Tricky queries fall through to
  // the planner below even when concrete filters matched.
  try {
    const pre = refine ? null : extractFilters(query);
    if (pre && hasConcreteFilters(pre.state) && !needsPlanner(query)) {
      const { interpretation, matchReasons } = describeState(pre.state);
      const resp: SearchResponse = {
        interpretation,
        confidence: 'high',
        clarifyingQuestion: null,
        filters: pre.state,
        matchReasons,
      };
      await captureSearch(pre.state);
      return withVid(json(resp, 200));
    }
  } catch (err) {
    console.error('[ai-search] deterministic pre-pass failed (falling through to LLM)', err);
  }

  // --- Stage 0: LLM query planner (fallback interpreter) ----------------------
  // Reached only when the regex-first fast path missed (no concrete filters, or a
  // negation/contradiction the extractor can't be trusted on). Config-as-data
  // kill-switch + a live-key gate + fresh-search-only guard (a refine keeps the
  // existing carry-forward path; the planner does no carry-forward/removal). When
  // the planner is disabled or there's no key, this block is skipped ENTIRELY and
  // the code falls through to the Stage-2 chain below.
  if (cfg.planner.enabled && env.OPENROUTER_API_KEY && !refine) {
    let plan: SearchPlan | null = null;
    try {
      plan = await planSearch(query, current);
    } catch (err) {
      console.error('[ai-search] planner threw (returning graceful fallback)', err);
      plan = null;
    }
    if (plan && plan.kind === 'search') {
      const resp = planToSearchResponse(plan);
      await captureSearch(resp.filters);
      return withVid(json(resp, 200));
    }
    if (plan && plan.kind !== 'search') {
      // not_vehicle | gibberish → low-confidence redirect. confidence:'low' means
      // the island does NOT apply filters and routes the shopper to normal chat.
      const resp: SearchResponse = {
        interpretation: plan.interpretation,
        confidence: 'low',
        clarifyingQuestion: null,
        filters: emptyFilterState(),
        matchReasons: [],
        inferences: [],
        keyword: null,
      };
      return withVid(json(resp, 200));
    }
    // plan === null (planner failed/timed out) → return a graceful low-confidence
    // fallback DIRECTLY. Do NOT fall through to the Stage-2 generateObject: that
    // would fire a second same-tier LLM call right after the planner already ran
    // (the "double-LLM trap"). The regex fast path above already had its chance,
    // and on a needsPlanner query its result is deliberately not trusted.
    return withVid(json(fallbackResponse(), 200));
  }

  // --- Stage 2: structured LLM extraction (soft concepts / ambiguity) ---------
  // Reachable ONLY for a refine (carry-forward/removal interpreter) or when the
  // planner is disabled / has no key — never as a second call right after the
  // planner returned null on a fresh search.
  if (!env.OPENROUTER_API_KEY) {
    return withVid(
      json(
        fallbackResponse('AI search is temporarily unavailable — please use the filters.'),
        200,
      ),
    );
  }
  // Match /api/chat's configureAI call BYTE-FOR-BYTE (incl. streamAttemptTimeoutMs)
  // so the two are idempotent-compatible: in the common flow a visitor searches
  // then chats in the same isolate, and configureAI throws if re-called with a
  // *different* config. (Unused for this non-streaming generateObject call.)
  try {
    configureAI({
      openrouterApiKey: env.OPENROUTER_API_KEY,
      referer: APP_URL,
      appTitle: APP_TITLE,
      attemptTimeoutMs: REQUEST_TIMEOUT_MS,
      streamAttemptTimeoutMs: REQUEST_TIMEOUT_MS,
    });
  } catch (err) {
    console.error('[search] configureAI mismatch, using existing isolate config', err);
  }

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
    const resp = toSearchResponse(content);
    await captureSearch(resp.filters);
    return withVid(json(resp, 200));
  } catch (err) {
    // Model failure / unparseable / exhaustion → graceful 200 fallback.
    console.error('[ai-search] extraction failed', err);
    return withVid(json(fallbackResponse(), 200));
  }
};
