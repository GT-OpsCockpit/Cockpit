import { MAJOR_CITIES } from '../constants/major-cities';

/**
 * Europe minus France, which has its own (larger) cap below.
 * Ported verbatim from EUROPE_COUNTRY_CODES (common.js:807).
 */
const EUROPE_COUNTRY_CODES = new Set([
  'AL',
  'AD',
  'AT',
  'BY',
  'BE',
  'BA',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'DE',
  'GR',
  'HU',
  'IS',
  'IE',
  'IT',
  'XK',
  'LV',
  'LI',
  'LT',
  'LU',
  'MT',
  'MD',
  'MC',
  'ME',
  'NL',
  'MK',
  'NO',
  'PL',
  'PT',
  'RO',
  'SM',
  'RS',
  'SK',
  'SI',
  'ES',
  'SE',
  'CH',
  'UA',
  'GB',
  'VA',
]);

/**
 * How many major cities are suggested, by zone: a US state (a full code like
 * "US-NY") → 3, France → 25, the rest of Europe → 12, Asia / Africa / the
 * rest of the world → 5. Ported from areaCityLimit (common.js:817).
 */
export function areaCityLimit(countryCode: string): number {
  if (countryCode.startsWith('US-')) return 3;
  const baseCode = countryCode.split('-')[0];
  if (baseCode === 'FR') return 25;
  if (EUROPE_COUNTRY_CODES.has(baseCode)) return 12;
  return 5;
}

/**
 * "Local" — a driver or trip based on site rather than in a named city — is
 * only a valid Area in France (common.js:832, initAreaCombo). Everywhere
 * else, and as long as no country is chosen, an actual city is required.
 */
export function isLocalAreaAllowed(countryCode: string): boolean {
  return countryCode.split('-')[0] === 'FR';
}

/**
 * The Area field's suggestions for a given country: its major cities, capped
 * by zone. US cities are tied to the exact regional code (US-NY…), every
 * other country to its base code.
 *
 * These are suggestions, not a closed list — the Area field stays free-form,
 * exactly as in the legacy, so a city that isn't catalogued can still be
 * typed in. What the caller must NOT do is offer "Local" outside France; see
 * isLocalAreaAllowed.
 */
export function areaSuggestions(countryCode: string): string[] {
  if (!countryCode) return [];
  const matchCode = countryCode.startsWith('US-')
    ? countryCode
    : countryCode.split('-')[0];
  return MAJOR_CITIES.filter((city) => city.country === matchCode)
    .map((city) => city.name)
    .slice(0, areaCityLimit(countryCode));
}
