/**
 * Public surface of the AI provider abstraction layer.
 *
 * Import AI functionality from `~/ai` (this barrel) — never reach into
 * `./providers/` from outside this folder; that path is internal to the layer.
 */

// Types (shapes)
export type {
  Capability,
  AIMessage,
  AIContentPart,
  AITextPart,
  AIImagePart,
  AIRequest,
  AIResponse,
  AIStreamChunk,
  FinishReason,
  TokenUsage,
  ProviderErrorKind,
} from './types';

// Error classes
export {
  AIError,
  AllModelsExhaustedError,
  StreamInterruptedError,
  StructuredParseError,
  ProviderError,
} from './types';

// Tier configuration (read-only) and its type
export { TIERS, MODEL_CAPABILITIES, getModelCapabilities } from './tiers';
export type { TierConfig } from './tiers';

// Runtime configuration seam
export { configureAI, getAIConfig, resetAIConfig } from './config';
export type { AIConfig } from './config';

// The three public functions
export { generate, generateObject, generateStream } from './client';

// Deterministic inventory tools (anti-hallucination foundation for agentic
// search). Real, testable executors that return ONLY live stock — no LLM.
export {
  INVENTORY_TOOLS,
  INVENTORY_TOOL_EXECUTORS,
  searchInventoryTool,
  getListingTool,
  executeSearchInventory,
  executeGetListing,
} from './tools/inventory-tools';
export type {
  ToolDefinition,
  InventoryMatch,
  SearchInventoryResult,
} from './tools/inventory-tools';

// Agentic inventory search — GATED OFF by default (ai.agenticSearch.enabled).
// Not wired into the live chatbot; see src/ai/agentic/search-agent.ts.
export { runAgenticSearch } from './agentic/search-agent';
export type { AgenticSearchResult, RunAgenticSearchOptions } from './agentic/search-agent';
