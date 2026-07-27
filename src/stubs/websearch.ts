/**
 * Allowlisted web-reference search — STUB.
 * ---------------------------------------------------------------------------
 * Behaviourally indistinguishable from a real allowlisted fetch/search step:
 * the SAME typed request → typed response contract the live integration will
 * implement, so going live is a config change (add WEBSEARCH_API_KEY, or wire a
 * real fetch()+extract behind it), not a code change. See
 * docs/briefs/_stub-convention.md.
 *
 * Fully DETERMINISTIC — no Math.random, no `new Date()`, NO real network I/O.
 * The same query + allowlist always yields the same snippets, so the demo is
 * stable and SSR-safe. Deliberately carries NO prices, NO stock, NO availability
 * — this is external background from trusted sites, never a claim about our
 * inventory.
 *
 * HARD SAFETY INVARIANT: this function ONLY ever returns snippets whose URL
 * domain is present in the passed `allowlist`. Every candidate is filtered
 * through {@link inAllowlist} before it can be returned, so a non-allowlisted
 * URL is impossible to emit even if the canned table grows.
 */

export interface WebSnippet {
  url: string;
  title: string;
  snippet: string;
}

/** A canned reference plus the query keywords that make it relevant. */
interface CannedSnippet extends WebSnippet {
  /** Lower-case substrings; the snippet is relevant if any appears in the query. */
  keywords: string[];
}

// A small, deterministic table of external reference snippets, each anchored to a
// specific trusted domain (a manufacturer site + AU government / safety sources).
// A snippet is only ever RETURNED when its domain is in the caller's allowlist
// (see fetchAllowlisted), so this table can grow without ever leaking a
// non-allowlisted URL. NO prices anywhere — general background only. The live
// integration replaces this table with a real allowlisted fetch()+extract.
const CANNED: readonly CannedSnippet[] = [
  {
    url: 'https://www.ancap.com.au/safety-ratings',
    title: 'ANCAP Safety Ratings',
    snippet:
      'ANCAP publishes independent crash-safety star ratings for new vehicles sold in ' +
      'Australia, covering adult and child occupant protection, vulnerable road-user ' +
      'protection, and safety-assist systems.',
    keywords: ['safety', 'ancap', 'crash', 'star rating', 'safe', 'safer', 'airbag'],
  },
  {
    url: 'https://www.greenvehicleguide.gov.au/',
    title: 'Green Vehicle Guide (Australian Government)',
    snippet:
      'The Australian Government Green Vehicle Guide rates new vehicles on fuel ' +
      'consumption, CO2 emissions, and air-pollution performance to help buyers compare ' +
      'environmental impact and running efficiency.',
    keywords: ['fuel', 'economy', 'economical', 'emissions', 'green', 'environment', 'efficient', 'efficiency', 'co2', 'consumption'],
  },
  {
    url: 'https://www.mazda.com.au/models/cx-5/',
    title: 'Mazda CX-5 — Overview',
    snippet:
      'The Mazda CX-5 is a mid-size SUV offering a refined interior, a choice of petrol ' +
      'and diesel drivetrains, available all-wheel drive, and i-Activsense driver-assist ' +
      'safety technology across the range.',
    keywords: ['mazda', 'cx-5', 'cx5', 'suv'],
  },
];

/**
 * Normalise an allowlist entry (a bare domain OR a full URL) to a lower-case
 * host with any leading `www.` stripped, or `null` when it can't be parsed.
 * Used for BOTH the allowlist entries and each candidate snippet's URL so the
 * membership test compares like with like.
 */
function domainOf(entry: string): string | null {
  try {
    const s = entry.trim();
    if (!s) return null;
    const withProto = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
    return new URL(withProto).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** True only when `url`'s domain is one of the allowlisted domains. */
function inAllowlist(url: string, allowed: ReadonlySet<string>): boolean {
  const d = domainOf(url);
  return d !== null && allowed.has(d);
}

/**
 * Fetch external reference snippets for `query`, restricted to URLs whose domain
 * is in `allowlist`. Deterministic canned data — NO real network call, NO prices.
 *
 * @param query     free text (typically the visitor's message); a snippet is
 *                  included when one of its keywords appears in the query.
 * @param allowlist trusted domains/URLs the dealer configured. ONLY snippets on
 *                  these domains can ever be returned (enforced here).
 * @returns {@link WebSnippet}[] — possibly empty; NEVER a non-allowlisted URL.
 */
export async function fetchAllowlisted(
  query: string,
  allowlist: readonly string[],
): Promise<WebSnippet[]> {
  // TODO_KEYS: Web search — real fetch (allowlisted) — a fetch()+extract step or a search API key
  // The live integration replaces the canned table below with a real
  // fetch()+extract (or a search API keyed by WEBSEARCH_API_KEY) that is STILL
  // constrained to the allowlist by the SAME inAllowlist() gate, and still
  // returns NO price/stock/availability fields.
  const allowed = new Set<string>();
  for (const entry of allowlist) {
    const d = domainOf(entry);
    if (d) allowed.add(d);
  }
  if (allowed.size === 0) return [];

  const q = query.toLowerCase();
  const out: WebSnippet[] = [];
  for (const c of CANNED) {
    // Safety gate FIRST: a snippet off the allowlist can never be returned.
    if (!inAllowlist(c.url, allowed)) continue;
    // Relevance: include only when the query touches one of its keywords.
    if (!c.keywords.some((k) => q.includes(k))) continue;
    out.push({ url: c.url, title: c.title, snippet: c.snippet });
  }
  return out;
}
