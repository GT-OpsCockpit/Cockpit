export interface LocalTripInput {
  area?: string | null;
  countryCode?: string | null;
  pickupLocation?: string | null;
  dropoffLocation?: string | null;
}

export function isLocalTrip(trip: LocalTripInput): boolean;
