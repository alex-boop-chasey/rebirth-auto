/**
 * OEM factory-spec VIN/rego lookup — STUB.
 * ---------------------------------------------------------------------------
 * Behaviourally indistinguishable from a real NEVDIS/OEM decode: same typed
 * request (a VIN or rego string) → typed response (a factory spec, or null when
 * unknown) the live integration will implement, so going live is a config change
 * (add NEVDIS_API_KEY), not a code change. See docs/briefs/_stub-convention.md.
 *
 * A real NEVDIS/OEM VIN decode costs ~AU$0.65/lookup and also returns
 * written-off / stolen status — surfaced here as typed fields so the review UI
 * and the live path share one shape. The stub is fully DETERMINISTIC (no
 * Math.random, no module-level `new Date()`): a known demo VIN/rego always
 * returns the same spec; anything else returns null (unknown → the dealer fills
 * it in / relies on the photo + voice path — never invented).
 *
 * Activation is decided by the CALLER (the endpoint), per the stub convention:
 *   useStub = !env.NEVDIS_API_KEY || truthy(env.STUB_VIN)
 * so it auto-stubs until a real key is added.
 */

/** Factory spec returned by an OEM/NEVDIS decode. Hard specs only — no price,
 *  no condition, no odometer (those are per-vehicle, not factory facts). */
export interface OemSpec {
  vin?: string;
  make: string;
  model: string;
  badge?: string;
  series?: string;
  year: number;
  /** vehicleSpecs enum codes (lowercase) — ready to merge straight into a draft. */
  bodyType?: string;
  fuelType?: string;
  transmission?: string;
  driveType?: string;
  seatCount?: number;
  engine?: string;
  doors?: number;
  /** PPSR/NEVDIS status flags a real decode returns. `false` in the stub demo
   *  data; the live decode fills these from the register. Surfaced so a
   *  written-off/stolen car is flagged loudly in review before any listing. */
  status: {
    writtenOff: boolean;
    stolen: boolean;
    /** Free-text note when a flag is set (empty in the clean demo data). */
    note: string;
  };
  /** Marks this as demo data so nothing here is ever mistaken for a real decode. */
  source: 'stub';
}

/**
 * A tiny book of demo VINs/regos → factory specs. Keyed by an UPPERCASED,
 * whitespace-stripped lookup key so "1hg-cm82" and "1HGCM82 " both resolve.
 * Real BMG-flavoured vehicles so the demo reads true without being real records.
 */
const DEMO_BOOK: Record<string, Omit<OemSpec, 'source'>> = {
  // Demo VIN → Toyota RAV4 GXL
  JTMRWRFVXND123456: {
    vin: 'JTMRWRFVXND123456',
    make: 'Toyota',
    model: 'RAV4',
    badge: 'GXL',
    series: 'MXAA52R',
    year: 2021,
    bodyType: 'suv',
    fuelType: 'petrol',
    transmission: 'auto',
    driveType: 'awd',
    seatCount: 5,
    engine: '2.0L 4cyl petrol',
    doors: 5,
    status: { writtenOff: false, stolen: false, note: '' },
  },
  // Demo VIN → Ford Ranger Wildtrak
  MPBUMFF10NX654321: {
    vin: 'MPBUMFF10NX654321',
    make: 'Ford',
    model: 'Ranger',
    badge: 'Wildtrak',
    series: 'PY',
    year: 2023,
    bodyType: 'ute',
    fuelType: 'diesel',
    transmission: 'auto',
    driveType: '4wd',
    seatCount: 5,
    engine: '2.0L bi-turbo diesel',
    doors: 4,
    status: { writtenOff: false, stolen: false, note: '' },
  },
  // Demo rego → Mazda CX-5 (shows rego-keyed lookup works too)
  '123ABC': {
    make: 'Mazda',
    model: 'CX-5',
    badge: 'Touring',
    series: 'KF',
    year: 2019,
    bodyType: 'suv',
    fuelType: 'petrol',
    transmission: 'auto',
    driveType: 'awd',
    seatCount: 5,
    engine: '2.5L 4cyl petrol',
    doors: 5,
    status: { writtenOff: false, stolen: false, note: '' },
  },
};

/** Normalise a VIN/rego to the book's key form: uppercase, strip non-alphanumerics. */
function normaliseKey(vinOrRego: string): string {
  return vinOrRego.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Look up an OEM factory spec by VIN or rego. Returns the spec for a known demo
 * key, or `null` for anything unknown (never a guessed/defaulted spec).
 *
 * @param vinOrRego a VIN (17 chars) or a rego/plate string.
 */
export async function getOemSpec(vinOrRego: string): Promise<OemSpec | null> {
  // TODO_KEYS: VIN lookup — NEVDIS_API_KEY (NEVDIS/OEM VIN decode, ~AU$0.65/lookup) — set in .dev.vars / wrangler secret
  // The live integration replaces the book below with an authenticated HTTP call
  // to the NEVDIS/OEM decode API (auth via NEVDIS_API_KEY), mapping its factory
  // spec + PPSR written-off/stolen status onto OemSpec and setting source:'live'.
  const key = normaliseKey(vinOrRego);
  if (!key) return null;
  const hit = DEMO_BOOK[key];
  if (!hit) return null;
  return { ...hit, source: 'stub' };
}
