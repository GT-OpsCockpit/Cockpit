// Ported verbatim from the legacy suivi-chauffeur-twilio/server.js catalogues.
// Do not hand-edit values here without checking docs/LEGACY_FEATURES.md §6.
export const FLEET_MAKES: string[] = [
  'Audi',
  'Bentley',
  'BMW',
  'Mercedes-Benz',
  'Porsche',
  'Rolls Royce',
  'Tesla',
  'VW',
];

export const FLEET_COLORS: { value: string; hex: string }[] = [
  {
    value: 'Metallic Black',
    hex: '#1c1c1e',
  },
  {
    value: 'Obsidian Black',
    hex: '#0d0d10',
  },
  {
    value: 'Metallic Grey',
    hex: '#a7a9ac',
  },
  {
    value: 'Nardo Grey',
    hex: '#75766b',
  },
  {
    value: 'Metallic Anthracite',
    hex: '#34363a',
  },
  {
    value: 'White',
    hex: '#ffffff',
  },
  {
    value: 'Midnight Blue',
    hex: '#0b1a33',
  },
];

export const FLEET_COLOR_VALUES: string[] = FLEET_COLORS.map((c) => c.value);

export const FLEET_DEFAULT_COLOR = 'Metallic Black';

export const FLEET_MODELS_BY_MAKE: Record<string, string[]> = {
  'Mercedes-Benz': [
    'E-Class',
    'EQE',
    'EQS',
    'S-Class',
    'EQV',
    'V-Class',
    'VLE',
    'Maybach',
    'GLE',
    'GLS',
    'GLS Maybach',
    'Luggage Van',
    'Sprinter',
    'Coach 35',
    'Coach 50',
  ],
  Audi: ['A-6', 'A-8', 'Q-7'],
  BMW: ['5 Serie', 'i5', '7 Serie', 'i7', 'X5', 'X7'],
  VW: ['Multivan'],
  Tesla: ['Model 3', 'Model Y', 'Model S', 'Model X'],
  Bentley: ['Bentayga', 'Flying Spur'],
  Porsche: ['Cayenne', 'Panamera'],
  'Rolls Royce': ['Cullinan', 'Phantom', 'Ghost', 'Spectre'],
};

// Trip category name -> allowed { make: [models] } for a Fleet vehicle in that category.
export const CATEGORY_MODELS: Record<string, Record<string, string[]>> = {
  Business: {
    'Mercedes-Benz': ['E-Class', 'EQE', 'EQS'],
    Audi: ['A-6'],
    BMW: ['5 Serie', 'i5'],
  },
  'E-Business': {
    Tesla: ['Model 3', 'Model S', 'Model Y', 'Model X'],
    'Mercedes-Benz': ['EQE', 'EQS'],
    BMW: ['i5'],
  },
  Van: {
    'Mercedes-Benz': ['V-Class', 'VLE', 'EQV'],
    VW: ['Multivan'],
  },
  'E-Van': {
    'Mercedes-Benz': ['EQV', 'VLE'],
  },
  First: {
    'Mercedes-Benz': ['S-Class'],
    BMW: ['7 Serie', 'i7'],
    Audi: ['A-8'],
  },
  Luxe: {
    'Mercedes-Benz': ['Maybach'],
  },
  'Excep.': {
    Bentley: ['Flying Spur'],
    Porsche: ['Panamera'],
    'Rolls Royce': ['Phantom', 'Ghost', 'Spectre'],
  },
  SUV: {
    'Mercedes-Benz': ['GLE', 'GLS', 'GLS Maybach'],
    BMW: ['X5', 'X7'],
    Audi: ['Q-7'],
    Bentley: ['Bentayga'],
    'Rolls Royce': ['Cullinan'],
    Porsche: ['Cayenne'],
  },
  Sprinter: {
    'Mercedes-Benz': ['Sprinter'],
  },
  'Coach 35': {
    'Mercedes-Benz': ['Coach 35'],
  },
  'Coach 50': {
    'Mercedes-Benz': ['Coach 50'],
  },
  'Lugg.': {
    'Mercedes-Benz': ['Luggage Van', 'V-Class', 'EQV'],
  },
};

/** Recomputed on every call, matching the legacy's "recalculated at server startup" 10-year sliding window. */
export function getFleetYearWindow(): { min: number; max: number } {
  const max = new Date().getFullYear();
  return { min: max - 10, max };
}
