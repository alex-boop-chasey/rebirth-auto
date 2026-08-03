/**
 * carsales.com.au listing upload — STUB.
 * ---------------------------------------------------------------------------
 * Behaviourally indistinguishable from a real carsales syndication call: the
 * SAME typed request → typed response contract the live integration will
 * implement, so going live is a config change (add CARSALES_API_KEY + a dealer
 * account), not a code change. See docs/briefs/_stub-convention.md.
 *
 * The result is fully DETERMINISTIC — no Math.random, no module-level
 * `new Date()`. The same listing id always yields the same carsales id + URL,
 * so the demo is stable and any re-run agrees. `mode: 'stub'` and the clearly
 * fake `.../details/stub/<id>` URL path make it unmistakable this is a mock:
 * it NEVER claims a real upload happened and never calls a paid API.
 */

export interface CarsalesListingInput {
  listingId: string;
  title: string;
  price: number;
  make?: string;
  model?: string;
  year?: number;
}

export interface CarsalesUploadResult {
  carsalesId: string;
  url: string;
  mode: 'stub' | 'live';
  message: string;
}

/** Options the caller threads in (kept for parity with the live signature). */
export interface CarsalesUploadOptions {
  /** Dealer account id the listing is syndicated under. Echoed for realism. */
  dealerAccountId?: string;
}

/**
 * Deterministic 32-bit rolling hash → unsigned int. Mirrors the hashing style
 * in src/stubs/redbook.ts / price-history.ts — cheap, stable, zero-dependency.
 * Not security; only used to mint a plausible-but-stable mock id.
 */
function stableHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0; // unsigned 32-bit
  }
  return hash;
}

/**
 * "Upload" a published listing to carsales.com.au and return its listing id +
 * URL. STUBBED: returns a deterministic, clearly-mock id/URL with
 * `mode: 'stub'`. Same `listingId` → same result every call.
 *
 * @param input the PUBLISHED listing's syndication payload.
 * @param opts  dealer-account/context options (parity with the live call).
 */
export async function uploadToCarsales(
  input: CarsalesListingInput,
  opts: CarsalesUploadOptions = {},
): Promise<CarsalesUploadResult> {
  // TODO_KEYS: carsales — CARSALES_API_KEY + dealer account — set in .dev.vars / wrangler secret
  // The live integration replaces everything below with an authenticated HTTP
  // call to the carsales syndication API (auth via CARSALES_API_KEY, under the
  // dealer's account), mapping its response onto CarsalesUploadResult with
  // mode: 'live' and the real listing URL it returns.

  // Base the mock id on the listingId (+ any dealer account) so it is stable
  // per listing and visibly namespaced as a stub.
  const seed = stableHash(`${input.listingId}|${opts.dealerAccountId ?? ''}`);
  const carsalesId = `RB-STUB-${seed.toString(36).toUpperCase().padStart(7, '0')}`;
  const url = `https://www.carsales.com.au/cars/details/stub/${carsalesId}`;

  return {
    carsalesId,
    url,
    mode: 'stub',
    message:
      'Demo upload only — no listing was sent to carsales.com.au. This is a ' +
      'stub result with a clearly fake id and URL for demonstration.',
  };
}
