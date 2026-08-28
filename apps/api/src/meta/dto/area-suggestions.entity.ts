/** What the Area field may offer for one country — see areaSuggestions. */
export class AreaSuggestionsEntity {
  /** Echoes back the country the suggestions were computed for ('' if none). */
  countryCode: string;

  /** Major cities of that country, capped by zone (US state 3 / FR 25 / rest of Europe 12 / elsewhere 5). */
  cities: string[];

  /** Whether "Local" is a valid Area here — France only. */
  localAllowed: boolean;
}
