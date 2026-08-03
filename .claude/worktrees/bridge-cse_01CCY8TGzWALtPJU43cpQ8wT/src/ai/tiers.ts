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
  // Every tier runs on free OpenRouter models per the owner's standing directive
  // (free-tier throughout the build, per DECISIONS.md Decision 3). Primary is
  // `openai/gpt-oss-20b:free`; fallback is `nvidia/nemotron-3-super-120b-a12b:free`,
  // a different lab/architecture so failures stay uncorrelated.
  //
  // High-volume buyer-facing chat. The grounding firewall
  // (src/chatbot/grounding/verify.ts) backstops every reply; everything around it
  // (LLM refine, grounding, concept map) is model-agnostic.
  'chat-cheap': {
    models: ['openai/gpt-oss-20b:free', 'nvidia/nemotron-3-super-120b-a12b:free'],
    defaultTemperature: 0.7,
    defaultMaxTokens: 1024,
  },
  // Reserved for future higher-reasoning chat. Same free model list.
  'chat-quality': {
    models: ['openai/gpt-oss-20b:free', 'nvidia/nemotron-3-super-120b-a12b:free'],
  },
  // Long-form generation (Sanity descriptions). Same free model list.
  writing: {
    models: ['openai/gpt-oss-20b:free', 'nvidia/nemotron-3-super-120b-a12b:free'],
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
  },
  // Anything needing reliable JSON output. Same free model list.
  structured: {
    models: ['openai/gpt-oss-20b:free', 'nvidia/nemotron-3-super-120b-a12b:free'],
    defaultTemperature: 0,
    defaultMaxTokens: 2048,
  },
  // Agentic inventory search (tool-calling loop). Needs tool-calling; free-model
  // tool-calling support is UNVERIFIED. This tier is gated OFF
  // (`ai.agenticSearch.enabled` default false), so it has no live impact today —
  // the live chatbot never resolves this capability. Verify tool-calling before
  // enabling it. See src/ai/agentic/search-agent.ts.
  agentic: {
    models: ['openai/gpt-oss-20b:free', 'nvidia/nemotron-3-super-120b-a12b:free'],
    defaultTemperature: 0,
    defaultMaxTokens: 1024,
  },
} as const satisfies Record<Capability, TierConfig>;

// Per-model capability metadata, keyed by OpenRouter model id. Kept as a parallel
// map (NOT folded into TierConfig.models) so the tier table's shape and client.ts's
// fallback loop are unchanged. Decision 3's provider layer stays purely additive.
export const MODEL_CAPABILITIES = {
  'openai/gpt-oss-20b:free': { supportsVision: false },
  'nvidia/nemotron-3-super-120b-a12b:free': { supportsVision: false },
} as const satisfies Record<string, { supportsVision: boolean }>;

/**
 * Resolve a model id's capability flags. Unknown ids default to text-only
 * (`supportsVision: false`) until a `MODEL_CAPABILITIES` entry proves otherwise.
 */
export function getModelCapabilities(modelId: string): { supportsVision: boolean } {
  return MODEL_CAPABILITIES[modelId as keyof typeof MODEL_CAPABILITIES] ?? { supportsVision: false };
}
