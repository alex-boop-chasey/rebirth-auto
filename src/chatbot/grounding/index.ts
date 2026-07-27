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
import { resolveManufacturer } from './manufacturer';
import { resolveReviews } from './reviews';
import { CAR_MAKES, extractPriceValues, findKnownMakes, type GroundingFacts } from './verify';
import type { KVNamespaceLike } from '../core';
import type { ConversationContext } from '../context';
import type { D1Like } from '../state';

export type { GroundingFacts } from './verify';

/** A string/boolean env value is "truthy" unless it's empty / "false" / "0". */
function truthy(v: unknown): boolean {
  if (typeof v === 'string') return v !== '' && v.toLowerCase() !== 'false' && v !== '0';
  return !!v;
}

/**
 * Stub-activation resolver for an OPTIONAL grounding source (stub convention):
 * `useStub = !env.<API_KEY> || truthy(env.STUB_<SERVICE>)` — auto-stubs until a
 * real credential is added. Reads the Worker env lazily and fail-safe: any read
 * error (e.g. non-Worker context) falls back to the stub. NEVER edits get-env.ts.
 */
async function useStubFor(apiKeyName: string, stubFlagName: string): Promise<boolean> {
  try {
    const { env } = await import('cloudflare:workers');
    const e = env as unknown as Record<string, unknown>;
    return !e[apiKeyName] || truthy(e[stubFlagName]);
  } catch {
    return true;
  }
}

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

  // Manufacturer reference — OPTIONAL, default-off, resolved INDEPENDENTLY in its
  // own try/catch so it can never affect the live path. CONTEXT ONLY (external
  // model background, no prices/stock), folded AFTER inventory/focus. Contributes
  // nothing unless the dealer flips `grounding.manufacturer.enabled`.
  let manufacturer: string | null = null;
  try {
    if (cfg.grounding.manufacturer.enabled) {
      const useStub = await useStubFor('MANUFACTURER_API_KEY', 'STUB_MANUFACTURER');
      manufacturer = await resolveManufacturer(userMessage, cfg.grounding.manufacturer, useStub);
    }
  } catch (err) {
    console.error('[grounding] Manufacturer fold failed (omitting manufacturer)', err);
  }

  // Independent review reference — OPTIONAL, default-off, resolved INDEPENDENTLY
  // in its own try/catch. CONTEXT ONLY (external review sentiment, no
  // prices/stock), folded AFTER inventory/focus. Contributes nothing unless the
  // dealer flips `grounding.reviews.enabled`.
  let reviews: string | null = null;
  try {
    if (cfg.grounding.reviews.enabled) {
      const useStub = await useStubFor('REVIEWS_API_KEY', 'STUB_REVIEWS');
      reviews = await resolveReviews(userMessage, cfg.grounding.reviews, useStub);
    }
  } catch (err) {
    console.error('[grounding] Reviews fold failed (omitting reviews)', err);
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
    if (!focus && !journey && !manufacturer && !reviews) return null;
    // Base carries the inventory-bearing/continuity blocks; the OPTIONAL external
    // references are added to the DISPLAY prompt but EXCLUDED from the firewall
    // allow-list (see buildFacts call) so they can never widen it.
    const base = { focus, journey };
    const prompt = buildSystemPrompt({ ...base, manufacturer, reviews });
    // A resolved focus is a specific-vehicle block → inventory-bearing; a journey
    // or external reference alone carries no prices/specs, so NOT inventory-bearing.
    return { prompt, facts: buildFacts(buildSystemPrompt(base), focus !== null) };
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

  // Base = the inventory/focus/journey grounding the firewall allow-list is
  // derived from. The OPTIONAL external references are added to the DISPLAY prompt
  // only; the allow-list is built from `base` WITHOUT them (see buildFacts below).
  const base = { businessFacts, overview, matches, available, focus, journey };
  const prompt = buildSystemPrompt({ ...base, manufacturer, reviews });

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

  // Firewall allow-list from `base` (no external references) so a manufacturer or
  // review reference can NEVER add a price or a make to the allow-list. When both
  // optional flags are off, `base` === the composed prompt, so this is identical
  // to today.
  return { prompt, facts: buildFacts(buildSystemPrompt(base), hasInventory) };
}
