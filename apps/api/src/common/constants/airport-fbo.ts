// Ported verbatim from the legacy suivi-chauffeur-twilio/server.js catalogues.
// Do not hand-edit values here without checking docs/LEGACY_FEATURES.md §6.
export interface AirportFbo {
  match: string[];
  name: string;
  fbo: string;
}

export const AIRPORT_FBO_DIRECTORY: AirportFbo[] = [
  {
    match: ['nice', 'nce', 'lfmn'],
    name: "Nice Côte d'Azur (NCE)",
    fbo: "Signature Flight Support Nice, Aéroport Nice Côte d'Azur, Terminal Aviation Générale, 06206 Nice",
  },
  {
    match: ['cannes', 'mandelieu', 'ceq', 'lfmd'],
    name: 'Cannes - Mandelieu (CEQ)',
    fbo: 'Cannes Aviation FBO, Aéroport Cannes-Mandelieu, 245 Avenue Francis Tonner, 06150 Cannes-la-Bocca',
  },
  {
    match: ['bourget', 'lbg', 'lfpb'],
    name: 'Paris - Le Bourget (LBG)',
    fbo: 'Signature Flight Support Le Bourget, Aéroport de Paris-Le Bourget, 93350 Le Bourget',
  },
  {
    match: ['geneva', 'genève', 'geneve', 'gva', 'lsgg'],
    name: 'Genève (GVA)',
    fbo: 'Jet Aviation Geneva Business Aviation Centre, Aéroport de Genève, 1215 Genève 15',
  },
];
