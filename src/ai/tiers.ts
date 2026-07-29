/**
 * Capability → model mapping. The single place model ids for AI features live.
 *
 * Callers pass a `Capability`; the layer resolves it here to an ordered list of
 * concrete OpenRouter model ids. The first entry is the primary; the rest are
 * fallbacks tried in order. `defaultTemperature`/`defaultMaxTokens` supply the
 * per-tier request defaults, overridable per call via `AIRequest`.
 */

import type { Capability } from './types';

/** Configuration for a single capability tier. */
export interface TierConfig {
  /** Ordered model ids: primary first, then fallbacks. */
  models: readonly string[];
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

/**
 * The tier table. `as const satisfies Record<Capability, TierConfig>` keeps the
 * model-id strings literal-typed while still enforcing that every `Capability`
 * has exactly one entry (exhaustiveness) and each entry is a valid `TierConfig`.
 */
export const TIERS = {
  // High-volume buyer-facing chat. DEMO FLIP APPLIED: Rebi's reply brain now runs
  // on Haiku (primary), with the two free models retained as fallbacks tried in
  // order — Haiku → gpt-oss-20b:free → gemma-4-26b:free (gemma is a different
  // lab/architecture, so failures stay uncorrelated with the primary). The
  // grounding firewall (src/chatbot/grounding/verify.ts) still backstops every
  // reply; everything around it (LLM refine, grounding, concept map) is
  // model-agnostic. See the standing memory note (phase3-demo-swap-structured-model).
  'chat-cheap': {
    models: [
      'anthropic/claude-haiku-4-5', // demo flip: Haiku primary (free fallbacks below remain intact)
      'openai/gpt-oss-20b:free',
      'google/gemma-4-26b-a4b-it:free',
    ],
    defaultTemperature: 0.7,
    defaultMaxTokens: 1024,
  },
  // TODO: reserved for future higher-reasoning chat — placeholder model only.
  'chat-quality': {
    models: ['anthropic/claude-haiku-4-5'],
  },
  // Long-form generation (Sanity descriptions).
  // Order matches `structured` — Haiku restored as primary per Decision 3; the free gemma model stays as fallback.
  writing: {
    models: [
      'anthropic/claude-haiku-4-5',     // primary (intended model, restored)
      'google/gemma-4-26b-a4b-it:free', // fallback, free
    ],
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
  },
  // Anything needing reliable JSON output. Haiku is the primary: it is
  // better-calibrated on unambiguous single-attribute queries (e.g. "Petrol",
  // where gemma tends to over-ask for clarification). gemma-4-26b:free is kept in
  // the array as a free fallback for when the paid tier is unavailable.
  structured: {
    models: ['anthropic/claude-haiku-4-5', 'google/gemma-4-26b-a4b-it:free'],
    defaultTemperature: 0,
    defaultMaxTokens: 2048,
  },
  // Agentic inventory search (tool-calling loop). Points at a tool-capable PAID
  // model — Haiku supports function/tool calling; the free models above do NOT,
  // so this tier deliberately lists ONLY Haiku (no free fallback). This tier is
  // consumed ONLY when `ai.agenticSearch.enabled` is true (default OFF), so
  // adding it changes nothing today — no existing tier entry is touched, and the
  // live chatbot never resolves this capability. See src/ai/agentic/search-agent.ts.
  agentic: {
    models: ['anthropic/claude-haiku-4-5'],
    defaultTemperature: 0,
    defaultMaxTokens: 1024,
  },
} as const satisfies Record<Capability, TierConfig>;

// Per-model capability metadata, keyed by OpenRouter model id. Kept as a parallel
// map (NOT folded into TierConfig.models) so the tier table's shape and client.ts's
// fallback loop are unchanged. Decision 3's provider layer stays purely additive.
export const MODEL_CAPABILITIES = {
  'google/gemma-4-26b-a4b-it:free': { supportsVision: true },
  'anthropic/claude-haiku-4-5': { supportsVision: true },
  'openai/gpt-oss-20b:free': { supportsVision: false },
} as const satisfies Record<string, { supportsVision: boolean }>;

/**
 * Resolve a model id's capability flags. Unknown ids default to text-only
 * (`supportsVision: false`) until a `MODEL_CAPABILITIES` entry proves otherwise.
 */
export function getModelCapabilities(modelId: string): { supportsVision: boolean } {
  return MODEL_CAPABILITIES[modelId as keyof typeof MODEL_CAPABILITIES] ?? { supportsVision: false };
}
