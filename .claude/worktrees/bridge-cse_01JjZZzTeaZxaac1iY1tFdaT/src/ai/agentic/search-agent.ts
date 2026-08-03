/**
 * Agentic inventory search — GATED-OFF scaffold ("Rebi as an agent with tools").
 * ------------------------------------------------------------------
 * The intended shape: give a tool-calling model the deterministic inventory
 * tools (src/ai/tools/inventory-tools.ts) and let it drive a loop — pick a tool →
 * execute it against REAL stock → feed the real result back → repeat → produce a
 * final answer grounded ENTIRELY in tool output. Because the tools can only ever
 * return real inventory, the agent is anti-hallucinating by construction.
 *
 * Two things are missing to run the real loop, so the whole feature is gated OFF
 * by default (`ai.agenticSearch.enabled: false` in dealer config):
 *   1. A PROVIDER TOOL-CALL TRANSPORT. `src/ai/` today exposes text + enum-locked
 *      structured output only (`generate` / `generateObject` / `generateStream`);
 *      there is no `tools` param, no `tool_calls` parsing, no multi-turn tool
 *      message threading. Building that is the paid drop-in.
 *   2. A CAPABLE PAID MODEL WITH CREDIT. The `agentic` tier points at
 *      `anthropic/claude-haiku-4-5` (tool-capable), but OpenRouter has no credit
 *      for it right now (see tiers.ts notes) — the free models don't do tools.
 *
 * What IS functional here (no paid model, no new transport): a single-shot
 * DETERMINISTIC path. It reuses the existing no-LLM filter extractor
 * (`~/lib/vehicle-filter-extract`) to turn the message into filters, runs the
 * real `search_inventory` executor ONCE, and formats the real matches into a
 * grounded answer. That is NOT the agent — it's a one-hop fallback so the scaffold
 * returns SOMETHING real when the flag is flipped, without pretending the
 * multi-turn tool loop exists.
 *
 * This module is NOT wired into the live chatbot. The grounded chat pipeline
 * (src/chatbot/**) is untouched; enabling this flag changes nothing there.
 */
import { getDealerConfig } from '../../config/dealer';
import { extractFilters } from '../../lib/vehicle-filter-extract';
import type { FilterState } from '../../lib/listings-query';
import {
  executeSearchInventory,
  INVENTORY_TOOLS,
  type InventoryMatch,
  type SearchInventoryResult,
} from '../tools/inventory-tools';

export interface RunAgenticSearchOptions {
  /** Cap on rows the single-shot search surfaces. Defaults to the executor's cap. */
  maxResults?: number;
}

export interface AgenticSearchResult {
  /** A grounded, natural-language answer built ONLY from real tool output. */
  answer: string;
  /** The real matches the answer is grounded in. */
  matches: InventoryMatch[];
  /** Total active matches (may exceed `matches.length`). */
  total: number;
  /** How the filters were understood (echoed from the search executor). */
  appliedFilters: string;
  /**
   * Which path produced this result:
   *  - `single-shot`  — the deterministic one-hop fallback (functional today).
   *  - `tool-loop`    — the real multi-turn agent (paid drop-in; not built yet).
   */
  mode: 'single-shot' | 'tool-loop';
}

/**
 * Run agentic inventory search for a visitor message.
 *
 * Returns `null` when the feature is disabled (the default) — callers treat null
 * as "feature off, fall back to normal behaviour". When enabled, runs the
 * single-shot deterministic path and returns a grounded result. The real
 * multi-turn tool loop is the paid drop-in below.
 */
export async function runAgenticSearch(
  userMessage: string,
  opts: RunAgenticSearchOptions = {},
): Promise<AgenticSearchResult | null> {
  const cfg = getDealerConfig().ai.agenticSearch;
  // Gate: default OFF. Nothing below runs — no model call, no tool call — until a
  // dealer explicitly flips ai.agenticSearch.enabled AND the drop-in lands.
  if (!cfg.enabled) return null;

  // TODO_KEYS: Agentic search — paid tool-calling model + provider tool-call transport in src/ai/ —
  //  enable via config + OpenRouter credit.
  //
  // The real agent replaces the single-shot block below with a bounded loop:
  //   1. Call the AI layer with `capability: 'agentic'`, the system prompt, the
  //      conversation, and `INVENTORY_TOOLS` advertised as tool/function defs.
  //   2. While the model emits tool_calls: dispatch each by name through
  //      `INVENTORY_TOOL_EXECUTORS`, append the REAL results as tool messages,
  //      and re-invoke — capped at N iterations to bound cost/latency.
  //   3. When the model returns a final text answer, return it as
  //      `{ ..., mode: 'tool-loop' }`.
  // Requires: a `tools` field + `tool_calls` parsing + tool-role message threading
  // in src/ai/ (none exists today — the layer is text + enum-structured only), and
  // OpenRouter credit for the tool-capable `agentic` tier model. `INVENTORY_TOOLS`
  // is already the exact list the loop would advertise; it is referenced here so
  // the wiring point is explicit.
  void INVENTORY_TOOLS;

  // --- Functional single-shot fallback (deterministic, no LLM) ----------------
  return singleShotSearch(userMessage, opts);
}

/**
 * The one-hop deterministic path. Deterministic extraction → ONE real
 * `search_inventory` call → grounded formatting. No LLM, no fabrication; returns
 * a "nothing matched" answer rather than inventing alternatives.
 */
async function singleShotSearch(
  userMessage: string,
  opts: RunAgenticSearchOptions,
): Promise<AgenticSearchResult> {
  const extraction = extractFilters(userMessage);
  const state: FilterState | null = extraction?.state ?? null;

  const result: SearchInventoryResult = await executeSearchInventory(
    state ? filterStateToParams(state) : {},
    opts.maxResults != null ? { maxResults: opts.maxResults } : {},
  );

  return {
    answer: formatAnswer(result),
    matches: result.matches,
    total: result.total,
    appliedFilters: result.appliedFilters,
    mode: 'single-shot',
  };
}

/**
 * Project a `FilterState` onto the raw-params shape `executeSearchInventory`
 * validates (`AiFiltersSchema`). Field names line up 1:1 with the URL filter
 * contract, so this is a plain pick — the executor re-validates every value.
 */
function filterStateToParams(state: FilterState): Record<string, unknown> {
  return {
    bodyType: state.bodyType,
    colour: state.colour,
    transmission: state.transmission,
    fuelType: state.fuelType,
    driveType: state.driveType,
    condition: state.condition,
    seats: state.seats,
    priceMin: state.priceMin ?? null,
    priceMax: state.priceMax ?? null,
    yearMin: state.yearMin ?? null,
    yearMax: state.yearMax ?? null,
    odoMax: state.odoMax ?? null,
  };
}

/** Grounded natural-language answer built ONLY from the real search result. */
function formatAnswer(result: SearchInventoryResult): string {
  if (result.total === 0 || result.matches.length === 0) {
    return `Nothing in stock currently matches that (${result.appliedFilters}). Try broadening the search — I won't invent vehicles that aren't here.`;
  }
  const lines = result.matches.map((m, i) => {
    const specs: string[] = [];
    if (m.year) specs.push(String(m.year));
    if (m.colour) specs.push(m.colour);
    if (m.bodyType) specs.push(m.bodyType);
    if (m.fuelType) specs.push(m.fuelType);
    if (m.transmission) specs.push(m.transmission);
    if (typeof m.odometer === 'number') specs.push(`${m.odometer.toLocaleString('en-AU')} km`);
    const spec = specs.length ? ` (${specs.join(', ')})` : '';
    return `${i + 1}. ${m.title} — ${m.priceLabel}${spec}`;
  });
  const shownNote =
    result.total > result.matches.length
      ? `Showing ${result.matches.length} of ${result.total} matches`
      : `${result.total} match${result.total === 1 ? '' : 'es'}`;
  return [`${shownNote} for ${result.appliedFilters}:`, ...lines].join('\n');
}
