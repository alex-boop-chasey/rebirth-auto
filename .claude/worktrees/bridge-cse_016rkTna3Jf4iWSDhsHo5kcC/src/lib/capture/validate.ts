/**
 * Draft validation — checks the assembled draft against the listing schema's
 * required shape BEFORE the create-draft call, returning field-level issues for
 * the review UI. Errors surface in the REVIEW SCREEN, never inside Sanity Studio
 * (the whole point is to catch problems before anything reaches Sanity).
 *
 * The required/enum rules mirror src/sanity/schemaTypes/listing.ts:
 *   - `title` required (non-empty)
 *   - `price` required, number ≥ 0
 *   - `status` fixed to 'draft' here; `category` fixed to 'automotive'
 *   - vehicleSpecs enum sub-fields must use valid lowercase codes
 *   - VIN, when present, should be 17 chars (WARNING, not error — matches the
 *     schema's `.warning()`; imported data is dirty)
 *
 * Enum code sets are kept local (and asserted against the schema) so a bad
 * extraction can only ever be REJECTED here, never silently written.
 */
import type { DraftDocInput, ValidationIssue, ValidationResult } from './types';

const BODY_TYPES = new Set([
  'sedan', 'hatchback', 'suv', 'ute', 'wagon', 'van', 'coupe', 'convertible',
]);
const TRANSMISSIONS = new Set(['auto', 'manual']);
const FUEL_TYPES = new Set(['petrol', 'diesel', 'hybrid', 'electric', 'lpg']);
const DRIVE_TYPES = new Set(['2wd', 'awd', '4wd']);
const CONDITIONS = new Set(['new', 'used', 'demo']);

function enumIssue(
  field: string,
  value: string | undefined,
  allowed: Set<string>,
): ValidationIssue | null {
  if (value == null) return null;
  if (allowed.has(value)) return null;
  return {
    field,
    severity: 'error',
    message: `"${value}" is not a valid ${field} — must be one of: ${[...allowed].join(', ')}.`,
  };
}

/**
 * Validate an assembled draft doc. Returns `{ valid, issues }`; `valid` is false
 * when any `error`-severity issue is present (warnings do not block).
 */
export function validateDraft(doc: DraftDocInput): ValidationResult {
  const issues: ValidationIssue[] = [];

  // --- Required top-level fields (mirror listing.ts validation) ---------------
  if (!doc.title || !doc.title.trim()) {
    issues.push({ field: 'title', severity: 'error', message: 'A title is required.' });
  }
  if (typeof doc.price !== 'number' || !Number.isFinite(doc.price)) {
    issues.push({ field: 'price', severity: 'error', message: 'A price is required.' });
  } else if (doc.price < 0) {
    issues.push({ field: 'price', severity: 'error', message: 'Price must be zero or more.' });
  }

  // --- Locked fields ----------------------------------------------------------
  if (doc.category !== 'automotive') {
    issues.push({ field: 'category', severity: 'error', message: 'Category must be "automotive".' });
  }
  if (doc.status !== 'draft') {
    issues.push({ field: 'status', severity: 'error', message: 'Capture only ever creates drafts.' });
  }

  // --- Enum sub-fields (only checked when present) ----------------------------
  const vs = doc.vehicleSpecs ?? {};
  for (const issue of [
    enumIssue('bodyType', vs.bodyType, BODY_TYPES),
    enumIssue('transmission', vs.transmission, TRANSMISSIONS),
    enumIssue('fuelType', vs.fuelType, FUEL_TYPES),
    enumIssue('driveType', vs.driveType, DRIVE_TYPES),
    enumIssue('condition', vs.condition, CONDITIONS),
  ]) {
    if (issue) issues.push(issue);
  }

  // --- Numeric sanity ---------------------------------------------------------
  if (vs.year != null && (!Number.isInteger(vs.year) || vs.year < 1900)) {
    issues.push({ field: 'year', severity: 'error', message: 'Year must be a whole number ≥ 1900.' });
  }
  if (vs.odometer != null && (!Number.isFinite(vs.odometer) || vs.odometer < 0)) {
    issues.push({ field: 'odometer', severity: 'error', message: 'Odometer must be zero or more.' });
  }
  if (vs.seatCount != null && (!Number.isInteger(vs.seatCount) || vs.seatCount < 1 || vs.seatCount > 20)) {
    issues.push({ field: 'seatCount', severity: 'error', message: 'Seats must be between 1 and 20.' });
  }

  // --- VIN: warning only (schema uses .warning(), imported data is dirty) ------
  if (doc.vin && doc.vin.replace(/\s/g, '').length !== 17) {
    issues.push({ field: 'vin', severity: 'warning', message: 'A VIN is usually 17 characters.' });
  }

  const valid = !issues.some((i) => i.severity === 'error');
  return { valid, issues };
}
