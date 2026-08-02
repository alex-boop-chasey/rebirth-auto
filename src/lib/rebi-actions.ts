/**
 * Deterministic Rebi action-button derivation (server-side, NO LLM).
 * ------------------------------------------------------------------
 * Turns the visitor's latest message (+ any filter state grounding already
 * resolved) into a small, bounded set of best-guess navigation buttons the chat
 * widget renders as `RebiAction[]`. Pure and deterministic — no `Math.random`,
 * no `Date.now`, no network, no Sanity.
 *
 * Two sources, in this order:
 *   1. ONE "See all …" filter link, when a concrete `FilterState` is resolved for
 *      the turn — either the primed search grid (passed in) or a deterministic
 *      `extractFilters` over the message. The URL is ALWAYS built through
 *      `hrefFor` (the shared filter-URL contract) — never hand-assembled.
 *   2. Fixed destinations from a small keyword map, each looked up in the
 *      canonical `navHubs`/`footerColumns` (config-as-data — no literals here) and
 *      gated by the matching `dealerConfig.<feature>.enabled` flag, so a disabled
 *      feature never produces a button.
 *
 * Bounded to ≤5, de-duplicated by href, filter-link first. Ambiguous / no hit →
 * omit (never guess).
 */
import { hrefFor, type FilterState } from './listings-query';
import { extractFilters, hasConcreteFilters } from './vehicle-filter-extract';
import { navHubs, footerColumns } from '../config/nav';
import type { DealerConfig } from '../config/dealer';

export interface RebiAction {
  /** Button label, e.g. "See all 7-seaters", "Finance & repayments". */
  label: string;
  /** A real, resolved destination href. */
  href: string;
  /** Optional icon key (a `navHubs` icon name); absent when the nav entry has none. */
  icon?: string;
}

export interface DeriveRebiActionsInput {
  /** The visitor's latest message text. */
  message: string;
  /**
   * The filter state grounding already resolved for this turn (a primed search
   * grid), or `null`. When `null`, a message-derived state is used instead.
   */
  filterState: FilterState | null;
  /** Live dealer config — feature flags gate every fixed destination. */
  dealerConfig: DealerConfig;
}

/** A keyword-triggered fixed destination, gated by a dealer feature flag. */
interface FixedDestination {
  /** Whole-word triggers (matched case-insensitively). */
  keywords: string[];
  /** The canonical destination href — must exist in `navHubs`/`footerColumns`. */
  href: string;
  /** Feature flag that must be enabled for this destination to be offered. */
  enabled: (c: DealerConfig) => boolean;
}

// Keyword → canonical destination. Each href is verified against the nav config
// at emit time (label + icon come from there). "drive" alone is intentionally
// NOT a test-drive trigger — it collides with drivetrain talk (all-wheel-drive).
const FIXED_DESTINATIONS: FixedDestination[] = [
  {
    keywords: ['repayment', 'repayments', 'finance', 'financing', 'afford', 'affordable', 'loan', 'loans'],
    href: '/finance',
    enabled: (c) => c.finance.enabled,
  },
  {
    keywords: ['test drive', 'test-drive', 'testdrive'],
    href: '/test-drive',
    enabled: (c) => c.testDrive.enabled,
  },
  {
    keywords: ['ev', 'evs', 'electric', 'hybrid', 'hybrids', 'charge', 'charging'],
    href: '/listings?fuelType=electric,hybrid',
    enabled: (c) => c.electric.enabled,
  },
  {
    keywords: ['service', 'servicing'],
    href: '/service',
    enabled: (c) => c.service.enabled,
  },
  {
    keywords: ['parts', 'part', 'tyre', 'tyres', 'tire', 'tires', 'battery', 'batteries'],
    href: '/parts',
    enabled: (c) => c.parts.enabled,
  },
  {
    keywords: ['sell', 'selling'],
    href: '/sell',
    enabled: (c) => c.sell.enabled,
  },
  {
    keywords: ['trade', 'trade-in', 'tradein', 'valuation', 'valuations'],
    href: '/trade-in',
    enabled: (c) => c.tradeIn.enabled,
  },
  {
    keywords: ['contact', 'call', 'talk', 'team', 'speak'],
    href: '/contact',
    enabled: (c) => c.contact.enabled,
  },
];

/** Whole-word (boundary) test for a keyword or phrase in an already-lowercased message. */
function mentions(lowerMessage: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(lowerMessage);
}

/** Resolve an href to its canonical nav label + icon (config-as-data), or null. */
function resolveNavDestination(href: string): { label: string; icon?: string } | null {
  for (const hub of navHubs) {
    if (hub.href === href) return { label: hub.label };
    for (const item of hub.items) {
      if (item.href === href) return { label: item.label, icon: item.icon };
    }
  }
  for (const col of footerColumns) {
    for (const link of col.links) {
      if (link.href === href) return { label: link.label };
    }
  }
  return null;
}

function titleCase(code: string): string {
  return code.charAt(0).toUpperCase() + code.slice(1);
}

/** Plural body-type label, e.g. suv → "SUVs", sedan → "Sedans". */
function pluralBody(code: string): string {
  if (code === 'suv') return 'SUVs';
  return `${titleCase(code)}s`;
}

/** A "See all …" label from the dominant facet of a filter state (fixed priority). */
function labelForState(s: FilterState): string {
  if (s.seats.length === 1) return `See all ${s.seats[0]}-seaters`;
  const hasElectric = s.fuelType.includes('electric');
  const hasHybrid = s.fuelType.includes('hybrid');
  if (hasElectric && hasHybrid) return 'See all electric & hybrid cars';
  if (hasElectric) return 'See all electric cars';
  if (hasHybrid) return 'See all hybrids';
  if (s.fuelType.length === 1) return `See all ${s.fuelType[0]} cars`;
  if (s.bodyType.length === 1) return `See all ${pluralBody(s.bodyType[0])}`;
  if (s.condition.length === 1) return `See all ${s.condition[0]} cars`;
  if (s.driveType.length === 1) return `See all ${s.driveType[0].toUpperCase()} cars`;
  return 'See all matching cars';
}

/**
 * Derive best-guess navigation buttons for a chat turn. Deterministic, bounded to
 * ≤5, filter-link first, de-duplicated by href. Ambiguous / no signal → `[]`.
 */
export function deriveRebiActions(input: DeriveRebiActionsInput): RebiAction[] {
  const { message, dealerConfig } = input;
  const lower = message.toLowerCase();
  const out: RebiAction[] = [];
  const seenHref = new Set<string>();

  // 1. Filter link — the resolved grid state, else a message-derived one.
  let state: FilterState | null =
    input.filterState && hasConcreteFilters(input.filterState) ? input.filterState : null;
  if (!state) {
    const extracted = extractFilters(message);
    if (extracted && hasConcreteFilters(extracted.state)) state = extracted.state;
  }
  if (state) {
    const href = hrefFor(state);
    out.push({ label: labelForState(state), href, icon: 'grid' });
    seenHref.add(href);
  }

  // 2. Fixed destinations — keyword hit + feature enabled + resolves in nav.
  for (const dest of FIXED_DESTINATIONS) {
    if (out.length >= 5) break;
    if (!dest.enabled(dealerConfig)) continue;
    if (seenHref.has(dest.href)) continue;
    if (!dest.keywords.some((k) => mentions(lower, k))) continue;
    const nav = resolveNavDestination(dest.href);
    if (!nav) {
      // Config drift — the destination no longer resolves. Omit (never guess).
      console.warn('[rebi-actions] WARN skipped destination — not in nav config', dest.href);
      continue;
    }
    out.push({ label: nav.label, href: dest.href, ...(nav.icon ? { icon: nav.icon } : {}) });
    seenHref.add(dest.href);
  }

  return out.slice(0, 5);
}
