import { TripStepEntity } from './trip.entity';

/**
 * Redacted projection served over the unauthenticated ref links
 * (/driver/:ref, /track/:ref) — unlike TripEntity, this one is reachable
 * without a session, so it never carries price/VAT/billing or the full
 * client/driver records, only what the legacy's own public pages exposed
 * (see chauffeur.html/dashboard.html). `pocName`/`pocPhone`/`instructions`
 * are only populated for the driver view (see toPublicTrip in
 * public-trip.mapper.ts) — null for the track view, same as legacy.
 */
export class PublicTripEntity {
  ref: string;
  tracking: boolean;
  assignmentCancelled: boolean;
  clientName: string;
  clientRef: string;
  driverName: string | null;
  passengerName: string;
  paxCount: number | null;
  pocName: string | null;
  pocPhone: string | null;
  pickupAt: Date;
  timezone: string | null;
  pickupLocation: string;
  dropoffLocation: string | null;
  vehicleTypeName: string | null;
  instructions: string | null;
  steps: TripStepEntity[];
}

/** Public counterpart to TripActionResponseEntity — returned by the public notify() endpoint. */
export class PublicTripActionResponseEntity {
  ok: boolean;
  trip: PublicTripEntity;
  skipped?: boolean;
}
