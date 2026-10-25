import type { NominatimAddress, NominatimResult } from './nominatim.util';

/** The subset of a Google Places API (New) `Place` the address search asks for. */
export interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: {
    longText?: string;
    shortText?: string;
    types?: string[];
  }[];
  types?: string[];
}

/** Fields requested from Google: only what the mapping below reads (keeps the billing tier low). */
export const GOOGLE_PLACE_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.addressComponents',
  'places.types',
].join(',');

// Google tags a plain street address, or an area, with only these types;
// anything else (a business, a landmark, an airport…) is a named place worth
// showing by its name.
const ADDRESS_ONLY_TYPES = new Set([
  'street_address',
  'route',
  'premise',
  'subpremise',
  'street_number',
  'intersection',
  'postal_code',
  'locality',
  'sublocality',
  'neighborhood',
  'administrative_area_level_1',
  'administrative_area_level_2',
  'country',
  'political',
]);

function component(
  place: GooglePlace,
  type: string,
): { longText?: string; shortText?: string } | undefined {
  return place.addressComponents?.find((c) => c.types?.includes(type));
}

/**
 * Adapts a Google place to the Nominatim result shape the rest of the geo
 * code already understands (short label, airport/station detection, postcode,
 * country…), so switching the search provider changes nothing downstream.
 * The full Google address and the place id ride along for storage.
 */
export function googlePlaceToResult(
  place: GooglePlace,
): NominatimResult | null {
  const lat = place.location?.latitude;
  const lon = place.location?.longitude;
  if (lat === undefined || lon === undefined) return null;

  const types = place.types ?? [];
  const name = place.displayName?.text?.trim() ?? '';
  const isAirport = types.includes('airport');
  const isTrainStation =
    types.includes('train_station') || types.includes('transit_station');
  const isNamedPlace =
    !!name && !types.every((t) => ADDRESS_ONLY_TYPES.has(t));

  const address: NominatimAddress = {};
  if (isAirport) address.aeroway = name;
  else if (isTrainStation) address.railway = name;
  else if (isNamedPlace) address.amenity = name;

  const route = component(place, 'route')?.longText;
  if (route) address.road = route;
  const streetNumber = component(place, 'street_number')?.longText;
  if (streetNumber) address.house_number = streetNumber;
  const city =
    component(place, 'locality')?.longText ??
    component(place, 'postal_town')?.longText ??
    component(place, 'administrative_area_level_2')?.longText;
  if (city) address.city = city;
  const country = component(place, 'country');
  if (country?.longText) address.country = country.longText;
  if (country?.shortText) address.country_code = country.shortText.toLowerCase();
  const postcode = component(place, 'postal_code')?.longText;
  if (postcode) address.postcode = postcode;

  return {
    lat: String(lat),
    lon: String(lon),
    display_name: place.formattedAddress ?? name,
    address,
    ...(isAirport ? { class: 'aeroway', type: 'aerodrome' } : {}),
    ...(isTrainStation ? { class: 'railway', type: 'station' } : {}),
    placeId: place.id ? `google:${place.id}` : undefined,
  };
}
