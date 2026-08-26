import {
  simplifyAddress,
  isAirportResult,
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

  it('is false otherwise', () => {
    expect(isAirportResult(result({ address: { road: 'x' } }))).toBe(false);
    expect(isAirportResult(undefined)).toBe(false);
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
