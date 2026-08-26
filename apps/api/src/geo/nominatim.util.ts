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
}

export interface NominatimResult {
  class?: string;
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
  extratags?: { iata?: string; icao?: string };
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

/** A result is an airport if its OSM class is "aeroway" (root or address tag). */
export function isAirportResult(r: NominatimResult | undefined): boolean {
  if (!r) return false;
  if (r.class === 'aeroway') return true;
  return !!r.address?.aeroway;
}

export function extractIata(r: NominatimResult): string | null {
  return r.extratags?.iata ?? r.extratags?.icao ?? null;
}
