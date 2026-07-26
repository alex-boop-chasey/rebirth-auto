/**
 * Grounding orchestrator — assembles the live-grounded system prompt.
 * ------------------------------------------------------------------
 * Gathers the (deterministic, fail-open) grounding blocks — business facts,
 * inventory overview, and the per-turn live lookup — and hands them to the pure
 * `buildSystemPrompt(ctx)` builder. All Sanity/KV specifics live in the sibling
 * modules so `core.ts` stays close to portable and only needs this one call.
 *
 * NO LLM call happens here — extraction is keyword/enum matching. Every source
 * degrades independently: business facts fall back to the static knowledge, and
 * a failed inventory fetch flips `available` to false so the prompt shows a
 * degraded sentinel instead of stale/invented stock. Returns `null` only when
 * grounding is disabled by config, so the caller uses the plain static prompt.
 */
import { buildSystemPrompt } from '../system-prompt';
import { getDealerConfig } from '../../config/dealer';
import { getBusinessFacts } from './business-facts';
import { getInventoryOverview } from './overview';
import { getLiveMatches } from './lookup';
import { resolveFocus } from './context';
import { resolveJourney } from './journey';
import { CAR_MAKES, extractPriceValues, findKnownMakes, type GroundingFacts } from './verify';
import type { KVNamespaceLike } from '../core';
import type { ConversationContext } from '../context';
import type { D1Like } from '../state';

export type { GroundingFacts } from './verify';

export interface GroundedPrompt {
  /** The fully-composed, live-grounded system prompt string. */
  prompt: string;
  /**
   * The anti-hallucination allow-list, derived from the EXACT prompt above (so
   * it captures every price/brand the model was actually shown — from the
   * overview, live matches, and primed focus alike — and nothing else). Built by
   * re-reading the composed PUBLIC prompt, so it can never expose `dealerNotes`
   * (which is never in the prompt).
   */
  facts: GroundingFacts;
}

/** Build the firewall allow-list from the composed public prompt + whether a specific-vehicle block ran. */
function buildFacts(prompt: string, hasInventory: boolean): GroundingFacts {
  return {
    allowedPrices: new Set(extractPriceValues(prompt)),
    stockedMakes: new Set(findKnownMakes(prompt, CAR_MAKES)),
    knownMakes: CAR_MAKES,
    hasInventory,
  };
}

export async function buildGroundedSystemPrompt(
  kv: KVNamespaceLike | undefined,
  userMessage: string,
  context?: ConversationContext | null,
  opts?: { db?: D1Like; visitorId?: string | null },
): Promise<GroundedPrompt | null> {
  const cfg = getDealerConfig().chat;

  // Continuity journey — resolved INDEPENDENTLY of inventory grounding and focus,
  // in its own try/catch so a journey hiccup can never affect grounding. It is
  // CONTEXT ONLY (no prices/specs), folded before the inventory/focus blocks.
  let journey: string | null = null;
  try {
    if (cfg.journey.enabled && opts?.db && opts?.visitorId) {
      journey = await resolveJourney(opts.db, opts.visitorId, cfg.journey);
    }
  } catch (err) {
    console.error('[grounding] Journey fold failed (omitting journey)', err);
  }

  // Conversation focus is resolved INDEPENDENTLY of inventory grounding: a chat
  // primed from a listing should still be grounded on that vehicle even if the
  // dealer has broad inventory grounding turned off. Fail-open (null on miss).
  let focus: string | null = null;
  if (cfg.context.enabled && context) {
    focus = await resolveFocus(kv, context);
  }

  // Inventory grounding off: fall through to the static prompt, UNLESS a focus
  // OR a journey was resolved — then produce a focus/journey-only prompt (today's
  // static base + the primed vehicle and/or the continuity trail). Returning null
  // here would suppress priming (the bug the critic flagged) and would also drop
  // continuity when inventory grounding is off, so we key on focus OR journey.
  if (!cfg.grounding.enabled) {
    if (!focus && !journey) return null;
    const prompt = buildSystemPrompt({ focus, journey });
    // A resolved focus is a specific-vehicle block → inventory-bearing; a
    // journey alone carries no prices/specs, so it is NOT inventory-bearing.
    return { prompt, facts: buildFacts(prompt, focus !== null) };
  }

  const g = cfg.grounding;

  // Business facts always resolve to a usable string (doc → render, else static).
  const businessFacts = await getBusinessFacts(kv);

  // Inventory: the overview is the always-on backstop; its success defines
  // whether we have live inventory at all. The lookup is best-effort on top.
  let overview: string | null = null;
  let matches: string | null = null;

  if (g.overview.enabled) {
    overview = await getInventoryOverview(kv);
  }
  if (g.lookup.enabled) {
    matches = await getLiveMatches(kv, userMessage);
  }

  // "available" = we have at least one live inventory signal to trust. If both
  // came back null (fetch errors), the prompt shows the degraded sentinel.
  const available = overview !== null || matches !== null;

  const prompt = buildSystemPrompt({ businessFacts, overview, matches, available, focus, journey });

  // Inventory-bearing (→ the streaming path BUFFERS the whole reply before any of
  // it reaches the browser). True when either:
  //   - a conversation FOCUS is present (a primed listing/compare/search context —
  //     this is exactly the owner's failing case: a low/zero-match search where a
  //     free model is most tempted to INVENT a car, so we must never flash it), OR
  //   - the live-matches block actually LISTS vehicles (numbered rows) the model
  //     could mis-quote.
  // A stray keyword lookup that found nothing, or the overview alone (roll-up
  // counts), is NOT inventory-bearing — those turns keep streaming live and are
  // scrubbed at `done`.
  const listsVehicles = (s: string | null): boolean => !!s && /(^|\n)\s*\d+\.\s/.test(s);
  const hasInventory = focus !== null || listsVehicles(matches);

  return { prompt, facts: buildFacts(prompt, hasInventory) };
}
