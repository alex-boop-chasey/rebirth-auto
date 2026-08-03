/**
 * Brand-hub helpers — the make list is derived from REAL inventory, never a
 * hardcoded brand list (determinism, DECISIONS.md). The distinct `make` values of
 * ACTIVE listings are the only source of truth for which brand pages exist.
 *
 * Deliberately self-contained: this does NOT touch the core filter contract
 * (`src/lib/listings-query.ts`). The `/brand/[slug]` page runs its own
 * make-filtered Sanity query with `LISTING_FIELDS`; nothing here adds a `make`
 * filter dimension to the shopper filter URL.
 */
import { client } from '../sanity/lib/client';
import { LISTING_FIELDS, type Listing } from './listing';

export interface BrandSummary {
  /** The real make string exactly as stored (e.g. "Isuzu Ute"). */
  make: string;
  /** URL-safe slug derived from the make (e.g. "isuzu-ute"). */
  slug: string;
  /** How many ACTIVE listings carry this make. */
  count: number;
}

/**
 * Deterministic make → URL slug. Lowercase, spaces/punctuation collapsed to a
 * single hyphen. Purely derived from the real make string — never invented.
 */
export function makeSlug(make: string): string {
  return make
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Distinct makes across ACTIVE listings, with a count each, sorted A→Z. The list
 * of brand pages is exactly this — no more, no less. Fetches only the `make`
 * field (cheap) and de-duplicates in JS so the result is stable regardless of the
 * Sanity API version's aggregation support.
 */
export async function fetchActiveMakes(): Promise<BrandSummary[]> {
  const makes = await client.fetch<(string | null)[]>(
    `*[_type == "listing" && status == "active" && defined(make)].make`,
  );

  const byMake = new Map<string, number>();
  for (const raw of makes) {
    const make = (raw ?? '').trim();
    if (!make) continue;
    byMake.set(make, (byMake.get(make) ?? 0) + 1);
  }

  return [...byMake.entries()]
    .map(([make, count]) => ({ make, slug: makeSlug(make), count }))
    .sort((a, b) => a.make.localeCompare(b.make));
}

/**
 * Resolve a slug back to its real make by matching against the ACTIVE-make list,
 * then fetch that make's real stock via `LISTING_FIELDS`. Returns `null` for a
 * slug that maps to no real make (the page then 404s — slugs only ever derive
 * from real inventory). The make match is exact (case-insensitive) against the
 * real stored value, so a query for a nonexistent brand returns nothing.
 */
export async function fetchBrandStock(
  slug: string,
): Promise<{ make: string; listings: Listing[] } | null> {
  const brands = await fetchActiveMakes();
  const match = brands.find((b) => b.slug === slug);
  if (!match) return null;

  const listings = await client.fetch<Listing[]>(
    `*[_type == "listing" && status == "active" && lower(make) == $make]
      | order(coalesce(listingDate, _createdAt) desc){ ${LISTING_FIELDS} }`,
    { make: match.make.toLowerCase() },
  );

  return { make: match.make, listings };
}
