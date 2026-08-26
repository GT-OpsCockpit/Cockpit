// Ported verbatim from the legacy suivi-chauffeur-twilio/server.js catalogues.
// Do not hand-edit values here without checking docs/LEGACY_FEATURES.md §6.
// Trip vehicle-type name -> compatible fleet vehicle-type names.
export const VEHICLE_COMPATIBILITY: Record<string, string[]> = {
  Business: ['Business'],
  First: ['First', 'Luxe', 'Excep.'],
  Luxe: ['Luxe', 'Excep.'],
  'Excep.': ['Excep.'],
  SUV: ['SUV'],
  'E-Business': ['E-Business'],
  Van: ['Van'],
  'E-Van': ['E-Van'],
  Sprinter: ['Sprinter'],
  'Coach 35': ['Coach 35', 'Coach 50'],
  'Coach 50': ['Coach 50'],
  'Lugg.': ['Lugg.', 'Van'],
};

export function compatibleFleetCategories(vehicleTypeName: string): string[] {
  return VEHICLE_COMPATIBILITY[vehicleTypeName] ?? [vehicleTypeName];
}
