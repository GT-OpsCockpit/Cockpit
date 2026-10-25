import { googlePlaceToResult, GooglePlace } from './google-places.util';
import {
  extractPlaceId,
  isAirportResult,
  isTrainStationResult,
  simplifyAddress,
} from './nominatim.util';

const maserati: GooglePlace = {
  id: 'ChIJmaserati',
  displayName: { text: 'Maserati Cannes' },
  formattedAddress: '440 Av. du Campon, 06110 Le Cannet, France',
  location: { latitude: 43.5698, longitude: 7.0123 },
  types: ['car_dealer', 'store', 'point_of_interest', 'establishment'],
  addressComponents: [
    { longText: '440', shortText: '440', types: ['street_number'] },
    { longText: 'Avenue du Campon', shortText: 'Av. du Campon', types: ['route'] },
    { longText: 'Le Cannet', shortText: 'Le Cannet', types: ['locality', 'political'] },
    { longText: 'France', shortText: 'FR', types: ['country', 'political'] },
    { longText: '06110', shortText: '06110', types: ['postal_code'] },
  ],
};

describe('googlePlaceToResult', () => {
  it('shows a business by its name, with city and country, and keeps the full address and id', () => {
    const r = googlePlaceToResult(maserati)!;
    expect(simplifyAddress(r)).toBe('Maserati Cannes, Le Cannet, France');
    expect(r.display_name).toBe('440 Av. du Campon, 06110 Le Cannet, France');
    expect(r.address?.postcode).toBe('06110');
    expect(r.address?.country_code).toBe('fr');
    expect(r.lat).toBe('43.5698');
    expect(extractPlaceId(r)).toBe('google:ChIJmaserati');
  });

  it('shows a plain street address as "number street, city, country"', () => {
    const r = googlePlaceToResult({
      ...maserati,
      displayName: { text: '440 Avenue du Campon' },
      types: ['street_address'],
    })!;
    expect(simplifyAddress(r)).toBe('440 Avenue du Campon, Le Cannet, France');
  });

  it('flags airports and train stations like the OpenStreetMap results', () => {
    const airport = googlePlaceToResult({
      ...maserati,
      displayName: { text: "Nice Côte d'Azur Airport" },
      types: ['airport', 'point_of_interest', 'establishment'],
    })!;
    expect(isAirportResult(airport)).toBe(true);
    expect(isTrainStationResult(airport)).toBe(false);

    const station = googlePlaceToResult({
      ...maserati,
      displayName: { text: 'Gare de Cannes' },
      types: ['train_station', 'transit_station', 'point_of_interest'],
    })!;
    expect(isTrainStationResult(station)).toBe(true);
    expect(isAirportResult(station)).toBe(false);
  });

  it('drops a place without coordinates', () => {
    expect(googlePlaceToResult({ ...maserati, location: undefined })).toBeNull();
  });
});
