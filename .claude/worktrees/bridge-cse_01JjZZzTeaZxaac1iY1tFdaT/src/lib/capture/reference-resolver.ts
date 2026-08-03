/**
 * Make/model reference resolver — GROQ fuzzy lookup against REAL inventory.
 *
 * `resolve-never-invent`: an extracted/looked-up make+model is only accepted when
 * a REAL listing in the dealer's inventory is a confident fuzzy match (score ≥
 * the dealer-configured threshold). Below the threshold — or on ANY error — the
 * resolver returns `promptCreateNew: true` so the review UI asks the dealer
 * "create new?" rather than binding to (or fabricating) a reference. It NEVER
 * invents a make/model and NEVER silently defaults one.
 *
 * Fail-open: a Sanity/network error does not throw — it degrades to the
 * "prompt create new" signal, so the capture flow is never blocked by a lookup
 * hiccup (mirrors the fail-open discipline used across this codebase).
 *
 * Read-only: uses a token-authed @sanity/client purely to READ inventory (same
 * construction as src/lib/generate-description/sanity-draft.ts). No write path.
 */
import { createClient } from '@sanity/client';
import type { ReferenceMatch, ReferenceResolution } from './types';

/** Distinct make/model pairs present in real listings (the match corpus). */
interface InventoryRef {
  make?: string;
  model?: string;
  title?: string;
  listingId: string;
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Levenshtein edit distance (small strings — make/model). */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** 0–1 similarity (1 = identical) via normalised edit distance. */
function similarity(a: string, b: string): number {
  const na = normalise(a);
  const nb = normalise(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  const maxLen = Math.max(na.length, nb.length);
  return 1 - editDistance(na, nb) / maxLen;
}

/**
 * Score a query make/model against one inventory ref. Make is weighted more
 * heavily than model (a wrong make is a wrong car); when the query omits a part,
 * only the supplied part scores.
 */
function scoreRef(query: { make?: string; model?: string }, ref: InventoryRef): number {
  const parts: number[] = [];
  if (query.make) parts.push(similarity(query.make, ref.make ?? '') * 1.0);
  if (query.model) parts.push(similarity(query.model, ref.model ?? '') * 0.9);
  if (!parts.length) return 0;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

/**
 * Resolve a make/model against real inventory.
 *
 * @param query   the make/model to resolve (either may be absent).
 * @param token   Sanity READ token (from the Worker env; never client-side).
 * @param threshold minimum score (0–1) to count as a confident match.
 */
export async function resolveReference(
  query: { make?: string; model?: string },
  token: string | undefined,
  threshold: number,
): Promise<ReferenceResolution> {
  const make = query.make?.trim();
  const model = query.model?.trim();

  if (!make && !model) {
    return { query, status: 'no-query', matches: [], promptCreateNew: false };
  }

  // Fail-open: without a read token we can't confirm a match, so we PROMPT rather
  // than invent one.
  if (!token) {
    return { query: { make, model }, status: 'prompt-create-new', matches: [], promptCreateNew: true };
  }

  let refs: InventoryRef[] = [];
  try {
    const client = createClient({
      projectId: import.meta.env.PUBLIC_SANITY_PROJECT_ID,
      dataset: import.meta.env.PUBLIC_SANITY_DATASET,
      apiVersion: import.meta.env.PUBLIC_SANITY_API_VERSION ?? '2024-01-01',
      useCdn: false,
      token,
    });
    // Pull distinct make/model refs from real listings. A broad projection (not a
    // make== filter) so a fuzzy/misspelled make can still find its true neighbour.
    const query$ = `*[_type == "listing" && defined(make)]{ "listingId": _id, make, model, title }`;
    refs = await client.fetch<InventoryRef[]>(query$);
  } catch (err) {
    // Fail-open: degrade to the "create new?" prompt, never block the flow.
    console.error('[capture/reference-resolver] inventory lookup failed (prompting create-new)', err);
    return { query: { make, model }, status: 'prompt-create-new', matches: [], promptCreateNew: true };
  }

  const scored: ReferenceMatch[] = refs
    .map((r) => ({
      listingId: r.listingId,
      make: r.make,
      model: r.model,
      title: r.title,
      score: scoreRef({ make, model }, r),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const best = scored[0];
  if (best && best.score >= threshold && best.make) {
    return {
      query: { make, model },
      status: 'matched',
      matches: scored,
      resolved: { make: best.make, model: best.model ?? model ?? '', listingId: best.listingId },
      promptCreateNew: false,
    };
  }

  // No confident match → PROMPT. We still return the near-misses for a "did you
  // mean…" affordance, but we NEVER auto-bind or invent a reference.
  return { query: { make, model }, status: 'prompt-create-new', matches: scored, promptCreateNew: true };
}
