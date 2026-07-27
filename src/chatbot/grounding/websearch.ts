/**
 * Allowlisted web-reference grounding — OPTIONAL, additive, CONTEXT ONLY.
 * ------------------------------------------------------------------
 * Mirrors resolveManufacturer (manufacturer.ts): fail-open (`null` on disabled /
 * no relevant allowlisted snippet / any error), deterministic (a stubbed
 * allowlisted lookup, NO LLM, NO real HTTP), and it renders a PRICE-FREE,
 * clearly-delimited block explicitly framed as EXTERNAL REFERENCE — background
 * from a dealer-configured, hardcoded ALLOWLIST of trusted sites, NOT our
 * inventory, stock, availability, or pricing. Live inventory / focus keep
 * last-word authority. The visitor's message is untrusted input: it is only used
 * as a query into the allowlisted stub, and everything rendered is defensively
 * stripped of any price-looking token.
 *
 * ALLOWLIST SAFETY: the stub (src/stubs/websearch.ts) guarantees it only ever
 * returns URLs whose domain is in `cfg.allowlist`; this module passes that same
 * config allowlist straight through, so no non-allowlisted URL can appear.
 *
 * DEFAULT OFF: gated on `cfg.enabled` (false in dealer config), so with the
 * default config this block never resolves and the composed prompt is identical
 * to today. Only when a dealer opts in does the reference appear.
 */
import { fetchAllowlisted } from '../../stubs/websearch';

/** The subset of dealer config this module reads (declared locally, like JourneyConfig). */
export interface WebSearchGroundingConfig {
  enabled: boolean;
  /** Dealer-editable allowlist of trusted domains/URLs — the ONLY sources that can appear. */
  allowlist: readonly string[];
  /** Hard cap on the number of reference snippets rendered into the block. */
  maxItems: number;
}

/** Strip any price-looking token so the block can never carry a price (mirrors journey.ts). */
function stripPrices(text: string): string {
  return text.replace(/\$\s?\d[\d,]*(?:\.\d+)?/g, '').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Resolve a WEB REFERENCE block from the dealer's allowlisted sources relevant to
 * the visitor's message, or `null` when disabled / nothing relevant / on any
 * failure (fail-open). `useStub` selects the stub data source (the live feed is
 * gated by the caller via env — WEBSEARCH_API_KEY / STUB_WEBSEARCH); today only
 * the stub exists, so a real fetch is never made here.
 */
export async function resolveWebSearch(
  userMessage: string,
  cfg: WebSearchGroundingConfig,
  useStub: boolean,
): Promise<string | null> {
  if (!cfg.enabled) return null;
  try {
    // Stub is the only data source today; `useStub` is threaded for parity with
    // the stub convention (real feed added behind WEBSEARCH_API_KEY later).
    void useStub;

    // The stub enforces the allowlist itself; we pass the SAME config allowlist so
    // only allowlisted-domain URLs can ever come back.
    const snippets = await fetchAllowlisted(userMessage, cfg.allowlist);
    const items = snippets.slice(0, Math.max(0, cfg.maxItems));
    if (!items.length) return null;

    const lines = [
      '=== WEB REFERENCE (external allowlisted sources, not our inventory/stock/pricing) ===',
      'Background from external allowlisted sources (NOT our stock, availability, or pricing):',
    ];
    for (const s of items) {
      // Defensive stripping on every field, though none should carry a price.
      const title = stripPrices(s.title);
      const url = stripPrices(s.url);
      const snippet = stripPrices(s.snippet);
      lines.push(`- ${title} (${url}): ${snippet}`);
    }
    lines.push(
      'This is external background only — it is NOT a statement that we have any vehicle, and it carries no price, stock, or availability. The live inventory above is the only source of what we actually have.',
      '=== END WEB REFERENCE ===',
    );
    return lines.join('\n');
  } catch (err) {
    console.error('[grounding] Web search resolution failed (omitting web search)', err);
    return null;
  }
}
