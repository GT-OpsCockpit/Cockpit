// Ported verbatim from the legacy suivi-chauffeur-twilio/server.js catalogues.
// Do not hand-edit values here without checking docs/LEGACY_FEATURES.md §6.
export const DEFAULT_VEHICLE_TYPES: { name: string; maxPax: number }[] = [
  {
    name: 'Business',
    maxPax: 3,
  },
  {
    name: 'E-Business',
    maxPax: 3,
  },
  {
    name: 'Van',
    maxPax: 7,
  },
  {
    name: 'E-Van',
    maxPax: 7,
  },
  {
    name: 'First',
    maxPax: 3,
  },
  {
    name: 'Luxe',
    maxPax: 3,
  },
  {
    name: 'Excep.',
    maxPax: 3,
  },
  {
    name: 'SUV',
    maxPax: 3,
  },
  {
    name: 'Sprinter',
    maxPax: 15,
  },
  {
    name: 'Coach 35',
    maxPax: 35,
  },
  {
    name: 'Coach 50',
    maxPax: 50,
  },
  {
    name: 'Lugg.',
    maxPax: 1,
  },
];
