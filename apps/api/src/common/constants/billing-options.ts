// Ported verbatim from the legacy suivi-chauffeur-twilio/server.js catalogues.
// Do not hand-edit values here without checking docs/LEGACY_FEATURES.md §6.
export const BILLING_OPTIONS = [
  {
    value: 'account',
    label: 'Central',
  },
  {
    value: 'card',
    label: 'Card',
  },
  {
    value: 'cash',
    label: 'Cash',
  },
] as const;
