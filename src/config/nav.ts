/**
 * Site navigation model — CONFIG AS DATA for the shared shell.
 *
 * Holds the Smart-Hubs top-nav model (3 hubs, each a mega-menu of drill-in
 * items) and the inline-contextual full-directory footer columns. This is
 * product-level information architecture, NOT dealer-specific data: there are no
 * dealer literals here (name/logo/contact/colours live in `~/config/dealer` and
 * are read by the components). A tenant swap that only changes dealer identity
 * needs no edit here; reshaping the IA itself is a deliberate edit to this file.
 *
 * Hrefs are wired to what works TODAY:
 *  - Browse-hub links resolve to the inventory grid, which IS the home page `/`
 *    (it owns the grid + filter contract — see `LISTINGS_PATH` in
 *    `~/lib/listings-query`). They are filter URLs that `/` SSR-filters through
 *    `parseFilters` (e.g. `/?condition=used`). The old `/listings` base is a 301
 *    that preserves the query string, so any stale link still resolves.
 *  - `/listings/<slug>` (vehicle detail) is unaffected and still the card target.
 *  - `/trade-in` and `/service` are live routes.
 *  - `/finance /offers /sell /test-drive /parts /fleet` (+ `/about /contact
 *    /careers`) are built in later remodel waves — they 404 until then, and are
 *    linked anyway so the directory is complete the moment each page lands.
 *
 * Icons are referenced by NAME (a stable string key); the SVG rendering for each
 * key lives in the presentation layer (SiteNav), keeping this file pure data.
 */

/** A single drill-in destination inside a hub's mega-menu. */
export interface NavHubItem {
  /** Human label shown in the mega-menu. */
  label: string;
  /** Destination href (see the module note for what resolves today). */
  href: string;
  /** Icon key resolved to an SVG by the component. */
  icon: string;
  /** One-line description shown under the label. */
  blurb: string;
}

/** A top-nav hub: a trigger that opens a mega-menu panel of its items. */
export interface NavHub {
  /** Stable key (used for the active-state highlight + DOM ids). */
  key: string;
  /** Trigger label. */
  label: string;
  /** Lead-panel tagline describing the hub. */
  tagline: string;
  /**
   * Optional hub landing page. Present only for hubs that have a real landing
   * today (Browse → the inventory grid). Absent hubs render no "open the hub"
   * link, so we never point at a route that does not exist.
   */
  href?: string;
  /** The drill-in items shown in the mega-menu grid. */
  items: NavHubItem[];
}

/**
 * The three Smart Hubs. Content only — the components read the dealer name from
 * `~/config/dealer` and render the chrome. Blurbs deliberately state no counts
 * ("305 cars", "12 brands") so nothing is fabricated (determinism constraint).
 */
export const navHubs: NavHub[] = [
  {
    key: 'browse',
    label: 'Browse',
    tagline: 'Every car, one place — New, Demo, Used, EV and by brand are filters, not pages.',
    href: '/',
    items: [
      { label: 'All inventory', href: '/', icon: 'grid', blurb: 'Filter by condition, body, fuel and price.' },
      { label: 'New & Demo', href: '/?condition=new,demo', icon: 'car', blurb: 'Latest stock and near-new demos.' },
      { label: 'Used', href: '/?condition=used', icon: 'gauge', blurb: 'Inspected pre-owned with history.' },
      { label: 'Electric & hybrid', href: '/?fuelType=electric,hybrid', icon: 'plug', blurb: 'EVs and hybrids — range and running-cost help.' },
      { label: 'Shop by brand', href: '/brand', icon: 'tag', blurb: 'Jump straight to a brand you know.' },
    ],
  },
  {
    key: 'buy-own',
    label: 'Buy & Own',
    tagline: 'From price to plates — finance, offers, trade-in, selling and test drives, together.',
    items: [
      { label: 'Finance & repayments', href: '/finance', icon: 'calc', blurb: 'Work out weekly repayments, then pre-approve.' },
      { label: 'Offers & specials', href: '/offers', icon: 'tag', blurb: 'Current drive-away deals across the yard.' },
      { label: 'Trade-in valuation', href: '/trade-in', icon: 'swap', blurb: 'Value your current car against a new one.' },
      { label: 'Sell your car', href: '/sell', icon: 'dollar', blurb: 'Outright sale — a cash offer, no purchase needed.' },
      { label: 'Book a test drive', href: '/test-drive', icon: 'key', blurb: 'Pick a car and a time that suits you.' },
    ],
  },
  {
    key: 'service-parts',
    label: 'Service & Parts',
    tagline: 'Owning it well — book a service, order genuine parts, or run a fleet.',
    items: [
      { label: 'Book a service', href: '/service', icon: 'wrench', blurb: 'Log-book and fixed-price servicing.' },
      { label: 'Genuine parts', href: '/parts', icon: 'gear', blurb: 'Genuine parts and accessories, fitted right.' },
      { label: 'Fleet & business', href: '/fleet', icon: 'briefcase', blurb: 'ABN buyers, bulk and novated solutions.' },
    ],
  },
];

/** The primary "Browse inventory" call-to-action shared by nav + drawer. */
export const primaryCta = { label: 'Browse inventory', href: '/' } as const;

/** One directory column of the full-directory footer. */
export interface FooterColumn {
  /** Column heading. */
  heading: string;
  /** Links in display order. */
  links: { label: string; href: string }[];
}

/**
 * The inline-contextual full-directory footer — every page grouped into four
 * columns (Shop / Buy & own / Service & parts / Dealership). Because the top nav
 * is a lean set of hubs, the footer carries the complete site map so any page is
 * one click away. Same href rules as the hubs (see the module note).
 */
export const footerColumns: FooterColumn[] = [
  {
    heading: 'Shop',
    links: [
      { label: 'Browse all stock', href: '/' },
      { label: 'New & Demo', href: '/?condition=new,demo' },
      { label: 'Used', href: '/?condition=used' },
      { label: 'Electric & hybrid', href: '/?fuelType=electric,hybrid' },
      { label: 'Offers & specials', href: '/offers' },
      { label: 'Shop by brand', href: '/brand' },
    ],
  },
  {
    heading: 'Buy & own',
    links: [
      { label: 'Finance & repayments', href: '/finance' },
      { label: 'Book a test drive', href: '/test-drive' },
      { label: 'Trade-in valuation', href: '/trade-in' },
      { label: 'Sell your car', href: '/sell' },
    ],
  },
  {
    heading: 'Service & parts',
    links: [
      { label: 'Book a service', href: '/service' },
      { label: 'Genuine parts', href: '/parts' },
      { label: 'Fleet & business', href: '/fleet' },
    ],
  },
  {
    heading: 'Dealership',
    links: [
      { label: 'About us', href: '/about' },
      { label: 'Contact & hours', href: '/contact' },
      { label: 'Careers', href: '/careers' },
      { label: 'My account', href: '/account' },
    ],
  },
];
