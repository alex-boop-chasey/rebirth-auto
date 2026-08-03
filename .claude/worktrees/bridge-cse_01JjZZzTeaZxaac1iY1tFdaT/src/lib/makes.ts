/**
 * Worldwide car-make list — a dealer-AGNOSTIC fact about the world, shared by
 * every tenant, so it lives in `src/lib/` (NOT `src/config/dealer.ts`; config is
 * for dealer-specific values — see DECISION.md Decision 1). Used to populate the
 * Studio `make` dropdown on the listing form.
 *
 * The values are TITLE-CASED display strings that double as the stored value, so
 * a later data migration is a verbatim copy of the old `details[]` "Make" value.
 * Acronym brands (VW/BMW/MG/GWM/LDV/BYD) keep their capitalisation.
 *
 * Seeded from the brand set in `src/chatbot/grounding/verify.ts` (CAR_MAKES,
 * lower-cased), title-cased here, plus inventory brands missing from it (Jaecoo).
 * The two lists could be consolidated onto this one later — CAR_MAKES is the
 * firewall's lower-cased lexicon, this is the Studio's title-cased option list;
 * for now they are kept separate to avoid touching the off-limits chatbot code.
 */
export const CAR_MAKE_OPTIONS: readonly string[] = [
  'Alfa Romeo',
  'Aston Martin',
  'Audi',
  'Bentley',
  'BMW',
  'BYD',
  'Chery',
  'Chevrolet',
  'Citroen',
  'Cupra',
  'Daewoo',
  'Daihatsu',
  'Datsun',
  'Dodge',
  'Ferrari',
  'Fiat',
  'Ford',
  'Genesis',
  'Great Wall',
  'GWM',
  'Haval',
  'Holden',
  'Honda',
  'Hyundai',
  'Infiniti',
  'Isuzu',
  'Jaecoo',
  'Jaguar',
  'Jeep',
  'Kia',
  'Lamborghini',
  'Land Rover',
  'LDV',
  'Lexus',
  'Maserati',
  'Mazda',
  'Mercedes',
  'Mercedes-Benz',
  'MG',
  'Mini',
  'Mitsubishi',
  'Nissan',
  'Peugeot',
  'Polestar',
  'Porsche',
  'Proton',
  'Ram',
  'Range Rover',
  'Renault',
  'Rolls-Royce',
  'Saab',
  'Skoda',
  'Ssangyong',
  'Subaru',
  'Suzuki',
  'Tesla',
  'Toyota',
  'Volkswagen',
  'Volvo',
  'VW',
];
