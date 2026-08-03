// Dummy demo data for the "Regional Trust" concept mockups.
// Clearly a demo — no real business identity, no real phone/address as fact.

export const dealer = {
  name: 'Riverbend Motor Co.',
  tagline: 'Family-owned since 1978',
  region: 'Wide Bay, Queensland',
  established: 1978,
  phonePlaceholder: '(07) 0000 0000',
  addressPlaceholder: '00 Riverbank Drive, Demo QLD 0000',
  emailPlaceholder: 'hello@demo-dealer.example',
};

export const brands = [
  'Toyota', 'Mazda', 'Hyundai', 'Isuzu Ute', 'Kia',
  'Subaru', 'Ford', 'Nissan', 'Honda', 'GWM', 'MG', 'Quality Used',
];

export type Vehicle = {
  id: string;
  year: number;
  make: string;
  model: string;
  variant: string;
  price: number;
  odo: number;
  fuel: string;
  trans: string;
  body: string;
  drive: string;
  condition: 'New' | 'Demo' | 'Used';
  badge?: string;
  aiSummary: string;
  tag: string; // gradient class
};

export const vehicles: Vehicle[] = [
  {
    id: 'rav4-cruiser',
    year: 2024, make: 'Toyota', model: 'RAV4', variant: 'Cruiser Hybrid AWD',
    price: 52990, odo: 12480, fuel: 'Hybrid', trans: 'Auto', body: 'SUV', drive: 'AWD',
    condition: 'Demo', badge: 'Local favourite',
    aiSummary: 'A tidy low-km hybrid — the pick for families doing school runs through the week and the coast on weekends. Sips fuel around town.',
    tag: 'g-sage',
  },
  {
    id: 'dmax-ls',
    year: 2023, make: 'Isuzu Ute', model: 'D-MAX', variant: 'LS-U Crew Cab 4x4',
    price: 58490, odo: 34120, fuel: 'Diesel', trans: 'Auto', body: 'Ute', drive: '4x4',
    condition: 'Used', badge: 'Tow-ready',
    aiSummary: 'Proper work-and-play ute. Tows 3.5t, well looked after, and the tray liner is already sorted. Popular with the farming crowd out west.',
    tag: 'g-clay',
  },
  {
    id: 'cx5-gt',
    year: 2025, make: 'Mazda', model: 'CX-5', variant: 'GT SP AWD',
    price: 49990, odo: 0, fuel: 'Petrol', trans: 'Auto', body: 'SUV', drive: 'AWD',
    condition: 'New', badge: 'Brand new',
    aiSummary: 'Fresh in and beautifully finished. If you want new-car peace of mind without stepping up to luxury pricing, this is the sweet spot.',
    tag: 'g-navy',
  },
  {
    id: 'ioniq5',
    year: 2024, make: 'Hyundai', model: 'IONIQ 5', variant: 'Dynamiq RWD',
    price: 62990, odo: 8900, fuel: 'Electric', trans: 'Auto', body: 'SUV', drive: 'RWD',
    condition: 'Demo', badge: 'EV',
    aiSummary: 'Ultra-fast charging and a genuinely roomy cabin. Great first EV — we\'ll walk you through home charging and what the running costs really look like.',
    tag: 'g-teal',
  },
  {
    id: 'forester',
    year: 2022, make: 'Subaru', model: 'Forester', variant: '2.5i-S AWD',
    price: 41990, odo: 41230, fuel: 'Petrol', trans: 'CVT', body: 'SUV', drive: 'AWD',
    condition: 'Used', badge: 'One owner',
    aiSummary: 'Symmetrical AWD that shrugs off wet-season roads. One local owner, full logbook history, and a big boot for the dog and the camping gear.',
    tag: 'g-sage',
  },
  {
    id: 'ranger-xlt',
    year: 2023, make: 'Ford', model: 'Ranger', variant: 'XLT Bi-Turbo 4x4',
    price: 61490, odo: 28770, fuel: 'Diesel', trans: 'Auto', body: 'Ute', drive: '4x4',
    condition: 'Used', badge: 'Popular',
    aiSummary: 'The ute everyone\'s after. Grunty bi-turbo, big screen, and it\'s been serviced on time. Move quick — these don\'t sit on the lot long.',
    tag: 'g-clay',
  },
  {
    id: 'kona',
    year: 2025, make: 'Hyundai', model: 'Kona', variant: 'Elite N Line',
    price: 38990, odo: 15, fuel: 'Petrol', trans: 'Auto', body: 'SUV', drive: 'FWD',
    condition: 'Demo', badge: 'Demo saving',
    aiSummary: 'A near-new demo at a real saving. Small enough for town, roomy enough for a young family. Great first new-ish car.',
    tag: 'g-navy',
  },
  {
    id: 'triton',
    year: 2021, make: 'Nissan', model: 'Navara', variant: 'ST-X 4x4',
    price: 44990, odo: 62400, fuel: 'Diesel', trans: 'Auto', body: 'Ute', drive: '4x4',
    condition: 'Used', badge: 'Value',
    aiSummary: 'Honest, no-nonsense workhorse at a friendly price. Higher kays but every service is stamped. Ideal second ute or a starter tradie rig.',
    tag: 'g-teal',
  },
];

export const reviews = [
  { name: 'Margaret & Kevin T.', town: 'Bargara', stars: 5,
    text: 'Third car we\'ve bought from the family here. No pressure, straight answers, and they sorted the rego transfer without us lifting a finger.' },
  { name: 'Dylan R.', town: 'Bundaberg', stars: 5,
    text: 'Rebi answered my finance questions at 11pm on a Sunday, then the team picked it up first thing Monday. Felt looked-after the whole way through.' },
  { name: 'Priya S.', town: 'Childers', stars: 5,
    text: 'They found me a hybrid that actually suited my drive to work instead of just selling me the most expensive one. That\'s why we keep coming back.' },
];

export const money = (n: number) =>
  '$' + n.toLocaleString('en-AU');
