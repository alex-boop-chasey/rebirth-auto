// Type-only import: `urlFor` is referenced solely in a type position below
// (`Parameters<typeof urlFor>`), so importing it as a value would needlessly
// construct the Sanity client at module load — which also breaks importing this
// module (and the filter logic built on it) outside Astro/Vite, e.g. in tests.
import type { urlFor } from '../sanity/lib/image';
import { dealerConfig } from '../config/dealer';

// --- Types -------------------------------------------------------------------

export interface ListingDetail {
  _key: string;
  label: string;
  value: string;
  valueType: 'text' | 'number' | 'boolean' | 'date';
  valueNumber?: number;
  unit?: string;
  valueBoolean?: boolean;
  valueDate?: string;
}

// Typed, first-class automotive filter dimensions. Populated alongside (not
// instead of) `details[]`; the search + filter feature queries these by their
// lowercase enum codes. All optional — a listing may not know every value.
export interface VehicleSpecs {
  bodyType?: 'sedan' | 'hatchback' | 'suv' | 'ute' | 'wagon' | 'van' | 'coupe' | 'convertible';
  // Base colour family — the filterable colour dimension (the manufacturer paint
  // name lives in the top-level `colour` field for display).
  colour?:
    | 'white' | 'black' | 'silver' | 'grey' | 'blue' | 'red' | 'green'
    | 'gold' | 'brown' | 'orange' | 'yellow' | 'purple' | 'other';
  transmission?: 'auto' | 'manual';
  fuelType?: 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'lpg';
  driveType?: '2wd' | 'awd' | '4wd';
  seatCount?: number;
  year?: number;
  odometer?: number;
  /** Combined-cycle fuel consumption in L/100km. Optional — stated only when a
   *  listing actually carries it; never estimated or defaulted. */
  fuelEconomy?: number;
  condition?: 'new' | 'used' | 'demo';
}

// One real price-change record. Populated by dealers / a future POS feed and
// projected via LISTING_FIELDS. When present, the "Just Reduced" badge + the
// detail-page history render from THIS honest data (see getPriceDrop). The demo
// synthesizer (src/stubs/price-history.ts) only ever fills this in for empty
// listings behind the STUB_PRICE_HISTORY flag — never in production.
export interface PriceHistoryEntry {
  price: number;
  /** ISO date (YYYY-MM-DD) this price took effect. */
  date: string;
  note?: string;
}

// The result of comparing the two most recent price points. `null` when there is
// no real drop to show.
export interface PriceDrop {
  /** The earlier (higher) price. */
  previous: number;
  /** The current (most recent) price. */
  current: number;
  /** True when current < previous AND the change is within the badge window. */
  dropped: boolean;
  /** Whole days since the most recent price change (relative to the passed nowMs). */
  daysAgo: number;
}

export interface Listing {
  _id: string;
  title: string;
  slug: { current: string };
  description?: unknown[];
  price: number;
  currency: string;
  status: 'active' | 'sold' | 'pending' | 'draft';
  images?: Parameters<typeof urlFor>[0][];
  category: string;
  details?: ListingDetail[];
  vehicleSpecs?: VehicleSpecs;
  listingDate?: string;
  // First-class, shopper-facing identity/spec fields (promoted out of details[]).
  // All optional — a listing may not carry every value. Staff-only fields
  // (registrationPlate, stockNumber, dealerNotes) are deliberately NOT here: they
  // never reach the public site, so they stay out of the shared projection.
  make?: string;
  model?: string;
  badge?: string;
  series?: string;
  /** Manufacturer paint name (display only), e.g. "Snowflake White Pearl". The
   *  filterable base colour lives in `vehicleSpecs.colour`. */
  colour?: string;
  engine?: string;
  doors?: number;
  trim?: string;
  vin?: string;
  registrationExpiry?: string;
  buildDate?: string;
  complianceDate?: string;
  /** Real, dealer/POS-populated price-change log (most recent last). Optional —
   *  most listings won't carry one. Never synthesized here; see getPriceDrop. */
  priceHistory?: PriceHistoryEntry[];
}

// --- Shared GROQ projection --------------------------------------------------
// The full field set every listing query needs. Kept in one place so the
// projection can't drift between index.astro, [slug].astro and compare.astro.
// Staff-only fields (registrationPlate, stockNumber, dealerNotes) are excluded
// on purpose — they must never reach the public site.
export const LISTING_FIELDS = `_id, title, slug, description, price, currency, status, images, category,
  make, model, badge, series, colour, engine, doors, trim,
  vin, registrationExpiry, buildDate, complianceDate,
  details[]{ _key, label, value, valueType, valueNumber, unit, valueBoolean, valueDate },
  vehicleSpecs{ bodyType, colour, transmission, fuelType, driveType, seatCount, year, odometer, fuelEconomy, condition }, listingDate,
  priceHistory[]{ price, date, note }`;

// Broad colour families for the Studio `colourBase` dropdown. A universal vehicle
// attribute (not dealer-specific), so it lives here rather than in dealer config.
// `value` is the lowercase stored code; `title` is the display label.
export const BASE_COLOUR_OPTIONS = [
  { title: 'White', value: 'white' },
  { title: 'Black', value: 'black' },
  { title: 'Silver', value: 'silver' },
  { title: 'Grey', value: 'grey' },
  { title: 'Blue', value: 'blue' },
  { title: 'Red', value: 'red' },
  { title: 'Green', value: 'green' },
  { title: 'Gold', value: 'gold' },
  { title: 'Brown', value: 'brown' },
  { title: 'Orange', value: 'orange' },
  { title: 'Yellow', value: 'yellow' },
  { title: 'Purple', value: 'purple' },
  { title: 'Other', value: 'other' },
] as const;

// --- Formatting helpers ------------------------------------------------------

export function formatPrice(price: number, currency: string): string {
  // No/zero price = "price on application" — show a human label instead of "$0".
  if (!price || price <= 0) return 'Contact agent';
  // Locale and default currency are dealer/region-specific — resolved from the
  // central dealer config (DECISION.md Decision 1), not hardcoded. A per-listing
  // currency still wins when present.
  return new Intl.NumberFormat(dealerConfig.locale.locale, {
    style: 'currency',
    currency: currency || dealerConfig.locale.currency,
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// --- Price-drop derivation (honest data only) --------------------------------
// Given a listing and a request-time clock (`nowMs`, passed IN — never a
// module-level `new Date()`), derive a price DROP from the listing's REAL
// `priceHistory`. This helper contains NO stub/demo logic: if `priceHistory` is
// empty or absent it returns null. The demo synthesizer (src/stubs/price-history.ts)
// feeds its output in via `listing.priceHistory` on a cloned listing, gated at the
// data layer behind STUB_PRICE_HISTORY — this function can't tell the difference
// and doesn't need to; it just reports what the history says.
//
// `dropped` is true only when the latest price is genuinely lower than the prior
// one AND that change landed within `withinDays` (the "Just Reduced" window).
export function getPriceDrop(
  listing: Pick<Listing, 'priceHistory'>,
  opts: { nowMs: number; withinDays: number },
): PriceDrop | null {
  const history = listing.priceHistory;
  if (!Array.isArray(history) || history.length < 2) return null;

  // Order-independent: sort a copy ascending by date so "previous" and "current"
  // are the two most recent points regardless of stored order.
  const sorted = history
    .filter((h) => h && Number.isFinite(h.price) && typeof h.date === 'string' && h.date.trim() !== '')
    .slice()
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  if (sorted.length < 2) return null;

  const current = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];

  const currentMs = Date.parse(current.date);
  if (!Number.isFinite(currentMs)) return null;

  const daysAgo = Math.floor((opts.nowMs - currentMs) / 86_400_000);
  const dropped =
    current.price < previous.price && daysAgo >= 0 && daysAgo <= opts.withinDays;

  return { previous: previous.price, current: current.price, dropped, daysAgo };
}

export function categoryLabel(category: string): string {
  return (category ?? '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export const statusConfig = {
  active: { label: 'Active', badge: 'bg-emerald-500' },
  pending: { label: 'Pending', badge: 'bg-amber-500' },
  sold: { label: 'Sold', badge: 'bg-red-600' },
  draft: { label: 'Draft', badge: 'bg-slate-400' },
} as const;

export function detailDisplay(d: ListingDetail): string {
  if (d.valueType === 'boolean') return d.valueBoolean ? 'Yes' : 'No';
  if (d.valueType === 'number' && d.valueNumber != null) {
    // With a unit, format the raw number nicely (e.g. "142,000 km"); without a
    // unit, prefer the human-readable value so plain figures like years stay
    // separator-free (e.g. "2019", not "2,019").
    if (d.unit) return `${d.valueNumber.toLocaleString('en-AU')} ${d.unit}`;
    return d.value ?? d.valueNumber.toString();
  }
  return d.value ?? '';
}

// --- Spec-row assembly (typed fields, with details[] fallback) ---------------
// The single source of truth for the shopper-facing spec grid. Prefers the new
// first-class typed fields and FALLS BACK to the matching `details[]` row when a
// typed field is empty — so nothing goes blank before the data migration runs.
// Returns the existing `ListingDetail` shape so the render loops + detailDisplay/
// detailIconName/isLowerBetter keep working unchanged.

// Enum code → display title. Minimal map (the schema's `options.list` titles);
// unknown codes fall back to a title-cased version.
const ENUM_TITLES = {
  bodyType: {
    sedan: 'Sedan', hatchback: 'Hatchback', suv: 'SUV', ute: 'Ute',
    wagon: 'Wagon', van: 'Van', coupe: 'Coupe', convertible: 'Convertible',
  } as Record<string, string>,
  transmission: { auto: 'Automatic', manual: 'Manual' } as Record<string, string>,
  fuelType: {
    petrol: 'Petrol', diesel: 'Diesel', hybrid: 'Hybrid', electric: 'Electric', lpg: 'LPG',
  } as Record<string, string>,
  driveType: { '2wd': '2WD', awd: 'AWD', '4wd': '4WD' } as Record<string, string>,
};

function enumTitle(map: Record<string, string>, code?: string): string | undefined {
  if (!code) return undefined;
  return map[code] ?? code.charAt(0).toUpperCase() + code.slice(1);
}

// The 21 legacy `details[]` labels that are now promoted to typed fields (plus a
// couple of spelling variants). Any details row whose label is one of these is
// skipped when appending "genuine one-offs", to avoid duplicating a typed row.
const STANDARD_DETAIL_LABELS = new Set(
  [
    'make', 'model', 'badge', 'series', 'model year', 'year', 'colour', 'color',
    'odometer', 'body', 'engine', 'fuel type', 'fuel', 'transmission',
    'drive type', 'drive', 'doors', 'seats', 'trim', 'vin',
    'registration plate', 'registration expiry', 'build date', 'compliance date',
    'stock number',
  ].map((l) => l.toLowerCase()),
);

function findDetail(details: ListingDetail[], ...labels: string[]): ListingDetail | undefined {
  const want = labels.map((l) => l.toLowerCase());
  return details.find((d) => want.includes((d.label ?? '').toLowerCase()));
}

function textRow(key: string, label: string, value?: string): ListingDetail | null {
  const v = (value ?? '').toString().trim();
  if (!v) return null;
  return { _key: key, label, value: v, valueType: 'text' };
}

function numberRow(key: string, label: string, n?: number, unit?: string): ListingDetail | null {
  if (n == null || !Number.isFinite(n)) return null;
  return { _key: key, label, value: String(n), valueType: 'number', valueNumber: n, ...(unit ? { unit } : {}) };
}

function dateRow(key: string, label: string, iso?: string): ListingDetail | null {
  const v = (iso ?? '').toString().trim();
  if (!v) return null;
  return { _key: key, label, value: formatDate(v), valueType: 'date', valueDate: v };
}

// Use the typed row when present; otherwise fall back to a matching details[] row
// (only when that row actually renders a value). Returns null when neither has a value.
function rowOrFallback(
  typed: ListingDetail | null,
  details: ListingDetail[],
  ...fallbackLabels: string[]
): ListingDetail | null {
  if (typed) return typed;
  const d = findDetail(details, ...fallbackLabels);
  if (d && detailDisplay(d).trim() !== '') return { ...d };
  return null;
}

export function buildSpecRows(listing: Listing): ListingDetail[] {
  const details = listing.details ?? [];
  const vs = listing.vehicleSpecs ?? {};

  const rows: (ListingDetail | null)[] = [
    rowOrFallback(textRow('spec-make', 'Make', listing.make), details, 'Make'),
    rowOrFallback(textRow('spec-model', 'Model', listing.model), details, 'Model'),
    rowOrFallback(textRow('spec-badge', 'Badge', listing.badge), details, 'Badge'),
    rowOrFallback(textRow('spec-series', 'Series', listing.series), details, 'Series'),
    rowOrFallback(numberRow('spec-year', 'Year', vs.year), details, 'Model Year', 'Year'),
    rowOrFallback(textRow('spec-body', 'Body', enumTitle(ENUM_TITLES.bodyType, vs.bodyType)), details, 'Body'),
    rowOrFallback(numberRow('spec-odometer', 'Odometer', vs.odometer, 'km'), details, 'Odometer'),
    rowOrFallback(textRow('spec-transmission', 'Transmission', enumTitle(ENUM_TITLES.transmission, vs.transmission)), details, 'Transmission'),
    rowOrFallback(textRow('spec-fuel', 'Fuel', enumTitle(ENUM_TITLES.fuelType, vs.fuelType)), details, 'Fuel Type', 'Fuel'),
    numberRow('spec-fuel-economy', 'Fuel economy', vs.fuelEconomy, 'L/100km'),
    rowOrFallback(textRow('spec-drive', 'Drive', enumTitle(ENUM_TITLES.driveType, vs.driveType)), details, 'Drive Type', 'Drive'),
    rowOrFallback(numberRow('spec-seats', 'Seats', vs.seatCount), details, 'Seats'),
    rowOrFallback(numberRow('spec-doors', 'Doors', listing.doors), details, 'Doors'),
    rowOrFallback(textRow('spec-colour', 'Colour', listing.colour), details, 'Colour', 'Color'),
    rowOrFallback(textRow('spec-engine', 'Engine', listing.engine), details, 'Engine'),
    rowOrFallback(textRow('spec-vin', 'VIN', listing.vin), details, 'VIN'),
    rowOrFallback(dateRow('spec-build', 'Build date', listing.buildDate), details, 'Build Date'),
    rowOrFallback(dateRow('spec-compliance', 'Compliance date', listing.complianceDate), details, 'Compliance Date'),
    rowOrFallback(dateRow('spec-rego-expiry', 'Registration expiry', listing.registrationExpiry), details, 'Registration Expiry'),
  ];

  const out = rows.filter((r): r is ListingDetail => r !== null);

  // Append genuine one-offs: any details[] row that isn't one of the promoted
  // standard labels and actually renders a value.
  for (const d of details) {
    if (STANDARD_DETAIL_LABELS.has((d.label ?? '').toLowerCase())) continue;
    if (detailDisplay(d).trim() === '') continue;
    out.push(d);
  }

  return out;
}

// --- Inline SVG icon system (no external libraries) --------------------------
// All icons share a 16x16 viewBox, currentColor stroke, no fill.
export const icons: Record<string, string> = {
  gauge:
    '<circle cx="8" cy="9" r="5.5"/><path d="M8 9l2.6-2.2"/><path d="M8 3.5v1"/><path d="M3.2 9h1"/><path d="M11.8 9h1"/>',
  calendar:
    '<rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6.5h11"/><path d="M5.5 2v3"/><path d="M10.5 2v3"/>',
  cog:
    '<circle cx="8" cy="8" r="2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4"/>',
  droplet: '<path d="M8 2C8 2 3.5 7 3.5 10a4.5 4.5 0 0 0 9 0C12.5 7 8 2 8 2z"/>',
  badge:
    '<path d="M8 1.8l1.7 1.2 2 .1.6 1.9 1.6 1.2-.7 1.9.7 1.9-1.6 1.2-.6 1.9-2 .1L8 14.2l-1.7-1.2-2-.1-.6-1.9L2.1 9.8l.7-1.9-.7-1.9 1.6-1.2.6-1.9 2-.1z"/><path d="M5.8 8l1.6 1.6L10.4 6.6"/>',
  bed:
    '<path d="M2 4v8"/><path d="M2 8.5h12v3.5"/><path d="M2 8.5V6a1.5 1.5 0 0 1 1.5-1.5H14"/><path d="M5 8.5V7a.5.5 0 0 1 .5-.5H8"/>',
  bath:
    '<path d="M2.5 8.5h11"/><path d="M3 8.5v2A2 2 0 0 0 5 12.5h6a2 2 0 0 0 2-2v-2"/><path d="M4 8.5V4a1.5 1.5 0 0 1 2.6-1"/><path d="M5.5 4.2h1.6"/><path d="M4.5 12.5l-.6 1.3M11.5 12.5l.6 1.3"/>',
  ruler:
    '<rect x="2" y="6" width="12" height="4" rx="1" transform="rotate(-45 8 8)"/><path d="M6.6 5.2l.9.9M8.5 3.3l.9.9M4.8 7l.9.9"/>',
  home:
    '<path d="M2.5 7.5L8 3l5.5 4.5"/><path d="M4 6.8v6h8v-6"/><path d="M6.8 12.8V9.5h2.4v3.3"/>',
  waves:
    '<path d="M2 6c1.2 0 1.2 1 2.4 1S5.6 6 6.8 6 8 7 9.2 7s1.2-1 2.4-1 1.2 1 2.4 1"/><path d="M2 9.5c1.2 0 1.2 1 2.4 1s1.2-1 2.4-1S8 10.5 9.2 10.5s1.2-1 2.4-1 1.2 1 2.4 1"/>',
  tag:
    '<path d="M2.5 8.3V3.5A1 1 0 0 1 3.5 2.5h4.8a1 1 0 0 1 .7.3l4.4 4.4a1 1 0 0 1 0 1.4l-4.8 4.8a1 1 0 0 1-1.4 0L2.8 9a1 1 0 0 1-.3-.7z"/><circle cx="5.5" cy="5.5" r=".8"/>',
  car:
    '<path d="M2.5 10.5h11"/><path d="M3 10.5V8l1.4-3.2a1 1 0 0 1 .9-.6h5.4a1 1 0 0 1 .9.6L13 8v2.5"/><path d="M3 8h10"/><circle cx="5" cy="10.8" r="1.2"/><circle cx="11" cy="10.8" r="1.2"/>',
  building:
    '<rect x="3" y="2.5" width="10" height="11" rx="1"/><path d="M5.5 5h1.5M9 5h1.5M5.5 7.5h1.5M9 7.5h1.5M5.5 10h1.5M9 10h1.5"/><path d="M6.8 13.5v-1.5h2.4v1.5"/>',
  check: '<path d="M3 8.2l3 3 7-7"/>',
  cross: '<path d="M4 4l8 8M12 4l-8 8"/>',
  filter: '<path d="M2.5 3.5h11L9 8.4v4.1l-2 1V8.4z"/>',
  arrow: '<path d="M3 8h9"/><path d="M8.5 4.5L12 8l-3.5 3.5"/>',
  arrowLeft: '<path d="M13 8H4"/><path d="M7.5 4.5L4 8l3.5 3.5"/>',
  heart:
    '<path d="M8 13.3l-.9-.8C4 9.6 2 7.8 2 5.6 2 3.9 3.3 2.6 5 2.6c1 0 1.9.5 2.5 1.2l.5.6.5-.6C9.1 3.1 10 2.6 11 2.6c1.7 0 3 1.3 3 3 0 2.2-2 4-5.1 6.9l-.9.8z"/>',
  image:
    '<rect x="2.5" y="3" width="11" height="10" rx="1.5"/><circle cx="6" cy="6.5" r="1.2"/><path d="M3 11.5l3-2.5 2.5 2 2-1.5 2.5 2.5"/>',
  sparkle:
    '<path d="M6.5 3.8Q6.9 8.6 9.7 9Q6.9 9.4 6.5 14.2Q6.1 9.4 3.3 9Q6.1 8.6 6.5 3.8Z"/><path d="M11.7 2.6Q11.9 3.9 13 4.1Q11.9 4.3 11.7 5.6Q11.5 4.3 10.4 4.1Q11.5 3.9 11.7 2.6Z"/>',
};

export function iconSvg(name: string, cls = 'h-3.5 w-3.5'): string {
  const body = icons[name] ?? icons.tag;
  return `<svg class="${cls}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export function detailIconName(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('odometer') || l.includes('mileage')) return 'gauge';
  if (l.includes('year') || l.includes('available') || l.includes('date') || l.includes('built')) return 'calendar';
  if (l.includes('transmission') || l.includes('gearbox')) return 'cog';
  if (l.includes('fuel')) return 'droplet';
  if (l.includes('registered') || l.includes('rego')) return 'badge';
  if (l.includes('bedroom')) return 'bed';
  if (l.includes('bathroom')) return 'bath';
  if (l.includes('land') || l.includes('size') || l.includes('area')) return 'ruler';
  if (l.includes('property') || l.includes('type')) return 'home';
  if (l.includes('pool')) return 'waves';
  return 'tag';
}

// Automotive-only dataset — every listing is a vehicle. The parameter is kept
// for call-site stability but no longer branches on category.
export function categoryIconName(_category?: string): string {
  return 'car';
}

// --- Comparison winner heuristic (hardcoded for the demo) --------------------
// For a numeric comparison row, is a lower value the "winner"? Odometer, price
// and kilometres favour lower; everything else (bedrooms, land size, …) defaults
// to higher-is-better.
export function isLowerBetter(label: string): boolean {
  const l = (label ?? '').toLowerCase();
  return ['odometer', 'price', 'kilometre', 'mileage', 'economy'].some((k) => l.includes(k));
}
