/**
 * Shared types for the dealer listing-creation PWA ("capture") pipeline.
 *
 * The pipeline turns three optional inputs (a VIN/rego, photos, a voice
 * transcript) into a single reviewable DRAFT listing. Every value it produces
 * carries its PROVENANCE (which source it came from) and a CONFIDENCE — the two
 * things the review UI needs to (a) show the dealer where a value came from and
 * (b) flag anything low-confidence for a human check. Nothing here is ever
 * silently invented: a field is present only when a source actually supplied it.
 */

/** Where a value came from. `derived` = computed from other confirmed fields
 *  (e.g. the title string), never a guess. */
export type FieldSource = 'oem' | 'vision' | 'voice' | 'manual' | 'derived';

/** Coarse confidence bucket. `low` always sets `needsReview`. */
export type FieldConfidence = 'high' | 'medium' | 'low';

/** A single assembled value with its provenance + confidence. */
export interface TrackedField {
  /** The value. Kept as a string|number union — the display/validation layer
   *  narrows per field (enums are strings, year/odometer/doors/price are numbers). */
  value: string | number;
  source: FieldSource;
  confidence: FieldConfidence;
  /** True when the dealer should eyeball this before publishing (low confidence,
   *  or a soft/ambiguous extraction). The review UI highlights these. */
  needsReview: boolean;
}

/**
 * The flat set of fields the pipeline tracks. `vehicleSpecs` sub-fields are
 * FLATTENED here (bodyType/transmission/…); `buildDraftDoc` maps them back into
 * the nested `vehicleSpecs` object the Sanity listing schema expects.
 */
export type CaptureFieldKey =
  // top-level identity/spec fields (mirror src/lib/listing.ts Listing)
  | 'make'
  | 'model'
  | 'badge'
  | 'series'
  | 'colour'
  | 'engine'
  | 'trim'
  | 'doors'
  | 'price'
  | 'vin'
  // flattened vehicleSpecs.*
  | 'bodyType'
  | 'transmission'
  | 'fuelType'
  | 'driveType'
  | 'seatCount'
  | 'year'
  | 'odometer'
  | 'condition';

export type TrackedFieldMap = Partial<Record<CaptureFieldKey, TrackedField>>;

/** One inventory candidate the reference resolver considered. */
export interface ReferenceMatch {
  listingId: string;
  make?: string;
  model?: string;
  title?: string;
  /** 0–1 fuzzy score (higher = closer). */
  score: number;
}

/**
 * Result of resolving make/model against REAL inventory. `resolve-never-invent`:
 * a make/model is only ever `matched` when a real listing clears the confidence
 * threshold; otherwise the UI is told to PROMPT the dealer ("create new?") — the
 * pipeline never fabricates a reference.
 */
export interface ReferenceResolution {
  /** What we searched for (echoed back for the UI). */
  query: { make?: string; model?: string };
  status: 'matched' | 'prompt-create-new' | 'no-query';
  /** Top candidates considered (for the "did you mean…" affordance). */
  matches: ReferenceMatch[];
  /** Populated ONLY when status === 'matched'. */
  resolved?: { make: string; model: string; listingId: string };
  /** True → the UI must show the "create new?" prompt. Never auto-resolved. */
  promptCreateNew: boolean;
}

/** The raw inputs the pipeline assembles from (all optional). */
export interface CaptureInputs {
  vinOrRego?: string;
  /** Opaque image references (data URLs or asset ids the client holds). */
  imageRefs?: string[];
  /** Plain-text voice transcript (Web Speech runs client-side; server gets text). */
  transcript?: string;
}

/** The assembled candidate the review UI renders. */
export interface AssembledCandidate {
  /** Derived title, e.g. "2021 Toyota RAV4 GXL" — only from confirmed fields. */
  title: TrackedField | null;
  fields: TrackedFieldMap;
  /** Free-text dealer notes parsed from the voice transcript (human-only bits). */
  dealerNotes: TrackedField | null;
  reference: ReferenceResolution;
  /** Field keys flagged for dealer review (low confidence). */
  reviewFlags: CaptureFieldKey[];
}

/**
 * The Sanity-listing-shaped draft the writer stub would create. Deliberately a
 * PLAIN doc (no provenance) — provenance stays in `AssembledCandidate`; this is
 * exactly what a real `client.create()` would receive (minus the write itself).
 */
export interface DraftDocInput {
  _type: 'listing';
  status: 'draft';
  category: 'automotive';
  title?: string;
  make?: string;
  model?: string;
  badge?: string;
  series?: string;
  colour?: string;
  engine?: string;
  trim?: string;
  doors?: number;
  price?: number;
  vin?: string;
  currency: string;
  vehicleSpecs?: {
    bodyType?: string;
    transmission?: string;
    fuelType?: string;
    driveType?: string;
    seatCount?: number;
    year?: number;
    odometer?: number;
    condition?: string;
  };
  dealerNotes?: string;
}

/** A single validation problem surfaced in the review UI (never in Studio). */
export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}
