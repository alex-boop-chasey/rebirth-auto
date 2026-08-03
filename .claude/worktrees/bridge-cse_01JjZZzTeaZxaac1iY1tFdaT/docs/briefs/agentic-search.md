# Task brief — Agentic search foundation (deterministic tools + gated loop scaffold)

Lay the foundation for "Rebi as an agent with tools" — anti-hallucination by construction. The
TOOLS are real and deterministic; the model-driven agentic LOOP needs a paid tool-calling model,
so it's gated OFF and marked as the drop-in. Follow `docs/briefs/_stub-convention.md`.

## Context
- All AI goes through `src/ai/` (Decision 3). Read `src/ai/index.ts`, `src/ai/tiers.ts`,
  `src/ai/types.ts`, `src/ai/client.ts` to see the current capability-tier surface (structured/
  writing/chat). It is enum-locked structured output today — NO tool-calling loop yet.
- Inventory queries already exist: `src/lib/listings-query.ts` (filter serialization + GROQ) and
  `src/lib/listing.ts` (LISTING_FIELDS, single-listing fetch). REUSE these — the tools wrap them.

## Build
### 1. Deterministic tools — `src/ai/tools/inventory-tools.ts`
- Define two tool definitions (name, description, JSON-schema params) + executors:
  - `search_inventory(params)` — params mirror the existing filter dimensions (make, bodyType,
    priceMax, fuelType, colour, etc.); executor runs the EXISTING listings query and returns a
    compact list of real matches (title, price, key specs, slug). Deterministic, no LLM, no
    fabrication — it can only return real inventory.
  - `get_listing(slug)` — returns one real listing's public fields (LISTING_FIELDS projection).
- These executors are the anti-hallucination guarantee: the agent can only ever surface real data.
  They are USEFUL and TESTABLE on their own (no paid model needed to run them).

### 2. Gated agentic loop scaffold — `src/ai/agentic/search-agent.ts`
- A documented scaffold: `runAgenticSearch(userMessage, opts)` that WOULD drive a tool-calling loop
  (model picks tools → execute → feed results back → final grounded answer). Since the provider
  layer has no tool-calling transport yet AND it needs a capable paid model, gate the whole thing:
  `if (!cfg.enabled) return null;` (default off) and leave the model-loop body as a clearly-marked
  `// TODO_KEYS: Agentic search — paid tool-calling model + provider tool-call transport in src/ai/ —
  //  enable via config + OpenRouter credit`. Where a naive fallback is trivial, you MAY implement a
  single-shot deterministic path (run search_inventory from a structured extraction and format the
  result) so the scaffold returns SOMETHING real when enabled — but do NOT build a full multi-turn
  tool loop (that's the paid drop-in). Keep it honest about what's stubbed.
- Add an `agentic` capability tier to `tiers.ts` pointing at a tool-calling-capable model
  (anthropic/claude-haiku-4-5 supports tools) — but this tier is only used when the feature is
  enabled; adding the tier entry must not change any existing tier.
- Config: `ai.agenticSearch { enabled: false }` in BOTH dealer objects.

## Scope guardrails — do NOT
- Do NOT enable by default. Do NOT wire this into the live chatbot path (the existing grounded chat
  is the crown jewel — leave it untouched). Do NOT build a full provider tool-call transport (that's
  the paid drop-in). Do NOT let any tool fabricate — tools return only real query results. Do NOT
  change existing tiers. Do NOT edit get-env.ts. No Math.random / module-top-level new Date(). Do NOT commit.

## Acceptance criteria (report each)
1. Tools: definitions + executors reuse the existing query helpers; prove they can only return real data.
2. Agentic scaffold: gated off; what's functional vs the paid drop-in (quote the TODO_KEYS marker).
3. `agentic` tier added without changing existing tiers; `ai.agenticSearch` config in BOTH objects (enabled:false).
4. Existing chatbot path untouched (confirm).
5. astro check before N / after M (M ≤ N).

## Report format
Concise: files, tool anti-hallucination proof, what's functional vs drop-in, confirm chatbot untouched, astro check before/after, anything not done.
