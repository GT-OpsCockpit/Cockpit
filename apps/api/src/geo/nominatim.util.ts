export interface NominatimAddress {
  aeroway?: string;
  amenity?: string;
  building?: string;
  shop?: string;
  tourism?: string;
  office?: string;
  leisure?: string;
  man_made?: string;
  railway?: string;
  road?: string;
  house_number?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  country?: string;
  country_code?: string;
  postcode?: string;
}

export interface NominatimResult {
  class?: string;
  /**
   * Nominatim's finer-grained tag under `class` — e.g. "station"/"halt" for
   * a `railway`-class result, "aerodrome" for an `aeroway`-class one. Some
   * results carry the identifying detail here even when `class` itself
   * landed on something less specific (a building, an amenity), so
   * isAirportResult/isTrainStationResult check both.
   */
  type?: string;
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
  extratags?: { iata?: string; icao?: string; railway?: string; aeroway?: string };
}

/** Short, readable label (place, city, country) instead of Nominatim's full multi-segment display_name. */
export function simplifyAddress(r: {
  display_name: string;
  address?: NominatimAddress;
}): string {
  const addr = r.address ?? {};
  const parts: string[] = [];
  const poiName =
    addr.aeroway ??
    addr.amenity ??
    addr.building ??
    addr.shop ??
    addr.tourism ??
    addr.office ??
    addr.leisure ??
    addr.man_made ??
    addr.railway ??
    null;
  if (poiName) {
    parts.push(poiName);
  } else if (addr.road) {
    parts.push(
      addr.house_number ? `${addr.house_number} ${addr.road}` : addr.road,
    );
  } else if (r.display_name) {
    parts.push(r.display_name.split(',')[0].trim());
  }
  const city =
    addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? addr.county;
  if (city && !parts.includes(city)) parts.push(city);
  if (addr.country) parts.push(addr.country);
  const label = parts.filter(Boolean).join(', ');
  return label || r.display_name;
}

/**
 * A result is an airport if OSM tags it "aeroway" — at the root class, in
 * the address breakdown (a POI's address names the airport it's inside),
 * in extratags (some results surface the raw OSM tag there instead), or via
 * a `type` that names an airport-ish feature. Nominatim doesn't use one
 * fixed value here — plain "aerodrome" for some results, but also
 * "international_airport", "airport", "heliport", etc for others (mirrors
 * the raw OSM tag, which varies by how the place was mapped) — so this
 * matches on the word rather than a short exact list, the same way
 * isTrainStationResult matches "station" below. None of this is French- or
 * country-specific: it's the same OSM vocabulary worldwide, which is the
 * point — a pickup from JFK, Dubai or Kansai should be recognised exactly
 * as reliably as one from Nice.
 */
const AIRPORT_TYPE_PATTERN = /aerodrome|airport|heliport/i;
const TRAIN_TYPE_PATTERN = /station|halt/i;

export function isAirportResult(r: NominatimResult | undefined): boolean {
  if (!r) return false;
  if (r.class === 'aeroway' || (r.type && AIRPORT_TYPE_PATTERN.test(r.type))) return true;
  return !!r.address?.aeroway || !!r.extratags?.aeroway;
}

/**
 * Same broadened pattern as isAirportResult, for OSM's "railway" tag —
 * covers train stations (and, harmlessly, other railway features like a
 * tram stop; there being no ambiguity in practice for anything a pickup
 * address search would actually surface). Matches `type` values like
 * "station", "halt", or "train_station" (seen on results OSM tagged less
 * specifically at the class level, e.g. St Pancras International Station
 * comes back with `class: "building", type: "train_station"`).
 */
export function isTrainStationResult(r: NominatimResult | undefined): boolean {
  if (!r) return false;
  if (r.class === 'railway' || (r.type && TRAIN_TYPE_PATTERN.test(r.type))) return true;
  return !!r.address?.railway || !!r.extratags?.railway;
}

export function extractIata(r: NominatimResult): string | null {
  return r.extratags?.iata ?? r.extratags?.icao ?? null;
}
