import type { Template } from 'sanity';

/**
 * Automotive listing vocabulary — the ordered legacy spec labels that used to be
 * scaffolded into every new listing's `details[]`. The standard specs now have
 * their own typed fields on the document, so the new-listing template NO LONGER
 * seeds `details` (that array is an escape hatch for genuine one-offs).
 *
 * This list is KEPT (exported) as the canonical label → field reference for the
 * upcoming data migration that copies existing `details[]` rows into the new
 * typed fields. It is intentionally unused by the template itself now.
 */
export const AUTOMOTIVE_SPEC_LABELS: ReadonlyArray<{
  label: string;
  valueType: 'text' | 'number' | 'boolean' | 'date';
  unit?: string;
}> = [
  { label: 'Make', valueType: 'text' },
  { label: 'Model', valueType: 'text' },
  { label: 'Badge', valueType: 'text' },
  { label: 'Series', valueType: 'text' },
  { label: 'Model Year', valueType: 'number' },
  { label: 'Colour', valueType: 'text' },
  { label: 'Odometer', valueType: 'number', unit: 'km' },
  { label: 'Body', valueType: 'text' },
  { label: 'Engine', valueType: 'text' },
  { label: 'Fuel Type', valueType: 'text' },
  { label: 'Transmission', valueType: 'text' },
  { label: 'Drive Type', valueType: 'text' },
  { label: 'Doors', valueType: 'number' },
  { label: 'Seats', valueType: 'number' },
  { label: 'Trim', valueType: 'text' },
  { label: 'VIN', valueType: 'text' },
  { label: 'Registration Plate', valueType: 'text' },
  { label: 'Registration Expiry', valueType: 'date' },
  { label: 'Build Date', valueType: 'date' },
  { label: 'Compliance Date', valueType: 'date' },
  // Stock Number is text, not number, so leading zeros survive.
  { label: 'Stock Number', valueType: 'text' },
];

export const automotiveListingTemplate: Template = {
  id: 'listing-automotive',
  title: 'Listing (Automotive)',
  schemaType: 'listing',
  value: {
    category: 'automotive',
    status: 'active',
    currency: 'AUD',
  },
};
