// Dummy demo data for the "Inline Contextual" IA concept (Contest 2).
// Static contest mockup — not wired to Sanity/config. Placeholder brands +
// fictional stock; no real contact details are stated as fact. AU spelling.

export interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  variant: string;
  price: number;
  odo: number; // km
  fuel: string;
  trans: string;
  body: string;
  drive: string;
  seats: number;
  condition: 'New' | 'Demo' | 'Used';
  hue: string; // placeholder image gradient tint
  aiLine: string; // Rebi one-line summary
  badge?: string;
}

const g = (a: string, b: string) => `linear-gradient(135deg, ${a}, ${b})`;

export const vehicles: Vehicle[] = [
  { id:'ry-01', year:2024, make:'Subaru', model:'Outback', variant:'AWD Touring', price:52990, odo:12, fuel:'Petrol', trans:'CVT Auto', body:'Wagon', drive:'AWD', seats:5, condition:'Demo', hue:g('#3C5A78','#7C93AC'), aiLine:'All-weather tourer — full-time AWD and 213mm clearance suit gravel and highway alike.', badge:'Low km' },
  { id:'ry-02', year:2025, make:'Isuzu', model:'D-MAX', variant:'X-Terrain 4x4', price:67490, odo:0, fuel:'Diesel', trans:'6-sp Auto', body:'Ute', drive:'4x4', seats:5, condition:'New', hue:g('#5A3F2E','#9A7B62'), aiLine:'3,500kg braked tow and a fixed-price service plan — a genuine work-and-tow pick.', badge:'Tow 3.5t' },
  { id:'ry-03', year:2023, make:'Hyundai', model:'Tucson', variant:'Elite N Line', price:41990, odo:28450, fuel:'Petrol', trans:'8-sp Auto', body:'SUV', drive:'FWD', seats:5, condition:'Used', hue:g('#4A4E5A','#868C9C'), aiLine:'One-owner, full service history. Roomy family SUV with a 5-star ANCAP rating.' },
  { id:'ry-04', year:2025, make:'Kia', model:'EV5', variant:'Earth AWD', price:58990, odo:15, fuel:'Electric', trans:'Single-speed', body:'SUV', drive:'AWD', seats:5, condition:'New', hue:g('#2E5E57','#5FA79A'), aiLine:'555km WLTP range and V2L power. Rebi rates this a top EV value.', badge:'EV · 555km' },
  { id:'ry-05', year:2022, make:'Honda', model:'CR-V', variant:'VTi L7', price:39990, odo:41200, fuel:'Petrol', trans:'CVT Auto', body:'SUV', drive:'FWD', seats:7, condition:'Used', hue:g('#3F4A55','#7E8A97'), aiLine:'Seven seats under $40k with balance of factory warranty — sensible family value.', badge:'7 seats' },
  { id:'ry-06', year:2025, make:'Chery', model:'Tiggo 7 Pro', variant:'Ultimate', price:37990, odo:9, fuel:'Hybrid', trans:'DHT Auto', body:'SUV', drive:'FWD', seats:5, condition:'Demo', hue:g('#4B3A52','#8C7396'), aiLine:'Frugal hybrid with a big feature list — panoramic roof and 5.6L/100km combined.', badge:'Hybrid' },
  { id:'ry-07', year:2024, make:'Nissan', model:'Navara', variant:'PRO-4X 4x4', price:61990, odo:6800, fuel:'Diesel', trans:'7-sp Auto', body:'Ute', drive:'4x4', seats:5, condition:'Demo', hue:g('#2F3A44','#69757F'), aiLine:'Off-road-focused PRO-4X spec with locking rear diff — near-new at a demo saving.' },
  { id:'ry-08', year:2025, make:'Kia', model:'EV9', variant:'GT-Line AWD', price:97990, odo:12, fuel:'Electric', trans:'Single-speed', body:'SUV', drive:'AWD', seats:7, condition:'New', hue:g('#37474F','#7B8A92'), aiLine:'Seven-seat electric flagship — ~500km range and rapid charging.', badge:'EV · 7 seats' },
];

export interface Brand { slug: string; name: string; blurb: string; }
export const brands: Brand[] = [
  { slug:'kia', name:'Kia', blurb:'7-year warranty, a full EV line-up and Australia’s value benchmark.' },
  { slug:'isuzu', name:'Isuzu Ute', blurb:'D-MAX and MU-X — the tow-and-tough workhorses.' },
  { slug:'hyundai', name:'Hyundai', blurb:'Family SUVs, hybrids and the IONIQ EV range.' },
  { slug:'subaru', name:'Subaru', blurb:'Symmetrical AWD for every road and none.' },
  { slug:'chery', name:'Chery', blurb:'Feature-packed value with strong hybrids.' },
  { slug:'honda', name:'Honda', blurb:'Refined, reliable, resale-proof.' },
];

export interface Offer { title: string; sub: string; brand: string; tag: string; }
export const offers: Offer[] = [
  { title:'Kia EV5 Air', sub:'$54,990 drive-away + free wallbox', brand:'Kia', tag:'EV' },
  { title:'Isuzu D-MAX SX', sub:'$52,990 drive-away, ABN buyers', brand:'Isuzu Ute', tag:'Ute' },
  { title:'Hyundai Tucson', sub:'2.99% p.a. comparison finance*', brand:'Hyundai', tag:'Finance' },
  { title:'Chery Tiggo 7 Hybrid', sub:'$37,990 drive-away + 7yr warranty', brand:'Chery', tag:'Hybrid' },
];

export const fmt = (n: number) => '$' + n.toLocaleString('en-AU');
export const fmtKm = (n: number) => (n === 0 ? 'Delivery km' : n.toLocaleString('en-AU') + ' km');

// tiny inline icon set (stroke, 1.7) — returns SVG string
export const icon = (name: string, size = 16): string => {
  const s = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"`;
  const p: Record<string, string> = {
    spark: `<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" fill="currentColor" stroke="none"/>`,
    gauge: `<path d="M12 14l3-3"/><circle cx="12" cy="13" r="8"/>`,
    fuel: `<path d="M4 20V6a2 2 0 012-2h6a2 2 0 012 2v14"/><path d="M3 20h12"/><path d="M14 9h2.5a1.5 1.5 0 011.5 1.5V16a2 2 0 004 0V9l-3-3"/>`,
    gear: `<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>`,
    drive: `<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/>`,
    heart: `<path d="M12 20s-7-4.4-7-9a4 4 0 017-2.6A4 4 0 0119 11c0 4.6-7 9-7 9z"/>`,
    bolt: `<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>`,
    check: `<path d="M20 6L9 17l-5-5"/>`,
    arrow: `<path d="M5 12h14M13 6l6 6-6 6"/>`,
    pin: `<path d="M12 21s7-5.4 7-11a7 7 0 10-14 0c0 5.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>`,
    phone: `<path d="M4 5a2 2 0 012-2h2l2 5-2 1a11 11 0 005 5l1-2 5 2v2a2 2 0 01-2 2A15 15 0 014 5z"/>`,
    clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
    send: `<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>`,
    calc: `<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h.01M8 15h2M12 15h2M16 15h.01M8 19h6"/>`,
    car: `<path d="M5 11l1.5-4A2 2 0 018.4 6h7.2a2 2 0 011.9 1.3L19 11"/><path d="M4 11h16v5H4z"/><circle cx="7.5" cy="16" r="1.5"/><circle cx="16.5" cy="16" r="1.5"/>`,
    shield: `<path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z"/>`,
    star: `<path d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9 6.7 19l1-5.8L3.5 9.2l5.9-.9z"/>`,
    chat: `<path d="M4 5h16v11H9l-4 3v-3H4z"/>`,
    filter: `<path d="M3 5h18l-7 8v6l-4-2v-4z"/>`,
    leaf: `<path d="M11 20A7 7 0 014 13c0-5 5-9 15-10 1 10-3 16-8 17z"/><path d="M9 14c2-3 5-4 8-5"/>`,
    plug: `<path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 01-10 0z"/><path d="M12 16v6"/>`,
    tag: `<path d="M3 12l9-9 8 8-9 9-8-8z"/><circle cx="8" cy="8" r="1.3"/>`,
    users: `<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0"/><path d="M16 5.5a3 3 0 010 5.5M21 20a6 6 0 00-4-5.6"/>`,
    doc: `<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>`,
    map: `<path d="M9 3l6 2 5-2v16l-5 2-6-2-5 2V5z"/><path d="M9 3v16M15 5v16"/>`,
    mail: `<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>`,
    wrench: `<path d="M14 7a4 4 0 01-5 5l-6 6 2 2 6-6a4 4 0 005-5l-2 2-2-2 2-2z"/>`,
    truck: `<path d="M3 6h11v9H3z"/><path d="M14 9h4l3 3v3h-7z"/><circle cx="7" cy="17" r="1.6"/><circle cx="17" cy="17" r="1.6"/>`,
    range: `<circle cx="12" cy="12" r="9"/><path d="M12 12l4-2"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>`,
    play: `<circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4z"/>`,
    briefcase: `<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 13h18"/>`,
    seat: `<path d="M6 4h4a3 3 0 013 3v6H6z"/><path d="M6 13l-2 7M13 13h3a2 2 0 012 2v5"/>`,
    compass: `<circle cx="12" cy="12" r="9"/><path d="M15 9l-2 5-4 1 2-5z" fill="currentColor" stroke="none"/>`,
  };
  return `<svg ${s}>${p[name] ?? ''}</svg>`;
};

export const BASE = '/concepts2/inline-contextual';
