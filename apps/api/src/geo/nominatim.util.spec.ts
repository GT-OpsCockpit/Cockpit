import {
  simplifyAddress,
  isAirportResult,
  isTrainStationResult,
  extractIata,
  NominatimResult,
} from './nominatim.util';

function result(partial: Partial<NominatimResult>): NominatimResult {
  return { lat: '0', lon: '0', display_name: '', ...partial };
}

describe('simplifyAddress', () => {
  it('prefers a POI name over the raw road', () => {
    expect(
      simplifyAddress({
        display_name: 'Nice Airport, Nice, France',
        address: { aeroway: 'Nice Airport', city: 'Nice', country: 'France' },
      }),
    ).toBe('Nice Airport, Nice, France');
  });

  it('falls back to house number + road, then city, then country', () => {
    expect(
      simplifyAddress({
        display_name: '1 Rue de la Paix, ...',
        address: {
          house_number: '1',
          road: 'Rue de la Paix',
          city: 'Paris',
          country: 'France',
        },
      }),
    ).toBe('1 Rue de la Paix, Paris, France');
  });

  it('falls back to the first segment of display_name with no address parts', () => {
    expect(simplifyAddress({ display_name: 'Somewhere, Nowhere' })).toBe(
      'Somewhere',
    );
  });
});

describe('isAirportResult', () => {
  it('detects aeroway at the root class', () => {
    expect(isAirportResult(result({ class: 'aeroway' }))).toBe(true);
  });

  it('detects aeroway in the address tag', () => {
    expect(isAirportResult(result({ address: { aeroway: 'terminal' } }))).toBe(
      true,
    );
  });

  // Nominatim doesn't always land an airport's `class` on "aeroway" — some
  // results carry the airport-ness in `type` or `extratags` instead, with
  // `class` on something less specific (a general "place", a building).
  it('detects type: aerodrome even when class lands on something else', () => {
    expect(isAirportResult(result({ class: 'place', type: 'aerodrome' }))).toBe(
      true,
    );
  });

  it('detects aeroway surfaced only in extratags', () => {
    expect(
      isAirportResult(result({ extratags: { aeroway: 'aerodrome' } })),
    ).toBe(true);
  });

  it('detects other airport-ish type values, not just "aerodrome"', () => {
    expect(
      isAirportResult(result({ class: 'building', type: 'international_airport' })),
    ).toBe(true);
    expect(isAirportResult(result({ class: 'amenity', type: 'heliport' }))).toBe(true);
  });

  it('is false otherwise', () => {
    expect(isAirportResult(result({ address: { road: 'x' } }))).toBe(false);
    expect(isAirportResult(undefined)).toBe(false);
  });
});

describe('isTrainStationResult', () => {
  it('detects railway at the root class', () => {
    expect(isTrainStationResult(result({ class: 'railway' }))).toBe(true);
  });

  it('detects railway in the address tag', () => {
    expect(
      isTrainStationResult(result({ address: { railway: 'station' } })),
    ).toBe(true);
  });

  // Same reasoning as the aerodrome case above — a station result whose
  // `class` isn't "railway" but whose `type` still says what it is.
  it('detects type: station or halt even when class lands on something else', () => {
    expect(isTrainStationResult(result({ class: 'building', type: 'station' }))).toBe(
      true,
    );
    expect(isTrainStationResult(result({ class: 'building', type: 'halt' }))).toBe(
      true,
    );
  });

  it('detects railway surfaced only in extratags', () => {
    expect(
      isTrainStationResult(result({ extratags: { railway: 'station' } })),
    ).toBe(true);
  });

  // The real-world case that slipped through the exact-match version: St
  // Pancras International Station comes back from Nominatim as
  // `class: "building", type: "train_station"` — not "station" or "halt".
  it('detects "train_station" and other station-ish type values', () => {
    expect(
      isTrainStationResult(result({ class: 'building', type: 'train_station' })),
    ).toBe(true);
    expect(
      isTrainStationResult(result({ class: 'building', type: 'subway_station' })),
    ).toBe(true);
  });

  it('is false otherwise', () => {
    expect(isTrainStationResult(result({ address: { road: 'x' } }))).toBe(
      false,
    );
    expect(isTrainStationResult(undefined)).toBe(false);
  });
});

describe('extractIata', () => {
  it('prefers iata over icao', () => {
    expect(
      extractIata(result({ extratags: { iata: 'NCE', icao: 'LFMN' } })),
    ).toBe('NCE');
  });

  it('falls back to icao, then null', () => {
    expect(extractIata(result({ extratags: { icao: 'LFMN' } }))).toBe('LFMN');
    expect(extractIata(result({}))).toBeNull();
  });
});
