# Task brief — Web search for Rebi (hardcoded URL allowlist), STUBBED, OFF BY DEFAULT

Give Rebi an optional supplementary-info capability: fetch content from a small hardcoded
ALLOWLIST of URLs and fold it in as CONTEXT-ONLY. Stubbed (no real fetch). Follow
`docs/briefs/_stub-convention.md` AND mirror the pattern just established in
`docs/briefs/grounding-sources.md` + `src/chatbot/grounding/manufacturer.ts` (READ BOTH — this
is a third grounding source in the exact same additive, fail-open, default-off, price-stripped,
external-reference style).

## Safety rule (identical to grounding-sources)
Default `enabled: false` in BOTH dealer configs → composed prompt + firewall byte-identical to
today. CONTEXT-ONLY, price-stripped, framed as external reference, own try/catch, fail-open
null. Firewall allow-list must not widen (the allow-list is built from the base prompt that
EXCLUDES these blocks — preserve that; do not add these to the facts source).

## Build
### 1. Config — `chat.grounding.webSearch` in BOTH dealer objects
- `{ enabled: false, allowlist: string[], maxItems: number }`. `allowlist` is a dealer-editable list of trusted domains/URLs (config as data — e.g. a manufacturer site, a govt safety-rating site). Provide 2-3 sensible placeholder entries.

### 2. Stub — `src/stubs/websearch.ts`
- `export interface WebSnippet { url: string; title: string; snippet: string; }`
- `export async function fetchAllowlisted(query: string, allowlist: string[]): Promise<WebSnippet[]>` — returns deterministic canned snippets for allowlisted URLs relevant to the query (no Math.random). ONLY ever returns snippets whose `url`'s domain is in the allowlist (enforce this in the stub too — never return a non-allowlisted URL). No prices. `// TODO_KEYS: Web search — real fetch (allowlisted) — a fetch()+extract step or a search API key`.
- `useStub = !env.WEBSEARCH_API_KEY || truthy(env.STUB_WEBSEARCH)`.

### 3. Grounding module — `src/chatbot/grounding/websearch.ts`
- `resolveWebSearch(userMessage, cfg, useStub)` mirroring `resolveManufacturer`: disabled→null; call the stub with the config allowlist; render a delimited `=== WEB REFERENCE (external allowlisted sources, not our inventory/stock/pricing) === … === END ===` block, price-stripped, capped at `maxItems`; fail-open null.
- Fold into `src/chatbot/grounding/index.ts` in its own try/catch like manufacturer/reviews; thread through `buildSystemPrompt` (add an optional `webSearch` context field placed with the other external-reference sections). Default-off ⇒ prompt unchanged.

## Scope guardrails — do NOT
- Do NOT enable by default. Do NOT fetch real URLs. Do NOT return non-allowlisted URLs. Do NOT add prices or numbered vehicle rows. Do NOT change verify.ts or the base-prompt facts source. Do NOT edit get-env.ts. No Math.random / module-top-level new Date(). Do NOT commit.

## Acceptance criteria (report each)
1. Config block in BOTH objects (enabled:false, allowlist).
2. Stub enforces allowlist-only URLs (how); sample output.
3. Grounding module mirrors manufacturer (quote block header); fail-open null; price-stripped.
4. Default-off-identical proof (same reasoning as grounding-sources).
5. Firewall safety (allow-list not widened — why).
6. astro check before N / after M (M ≤ N).

## Report format
Concise: files, allowlist-enforcement proof, block header, default-off proof, astro check before/after, anything not done.
