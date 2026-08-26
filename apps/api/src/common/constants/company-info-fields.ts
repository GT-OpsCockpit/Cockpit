// Ported verbatim from the legacy suivi-chauffeur-twilio/server.js catalogues.
// Do not hand-edit values here without checking docs/LEGACY_FEATURES.md §6.
// Same 13 fields as the legacy COMPANY_INFO_FIELDS, renamed 'country' -> 'countryCode'
// to match the Prisma column name.
export const COMPANY_INFO_FIELDS = [
  'name',
  'legalName',
  'street1',
  'zipCode',
  'city',
  'countryCode',
  'vatNbr',
  'email',
  'website',
  'ownerSurname',
  'ownerName',
  'mobile',
  'ownerEmail',
] as const;
