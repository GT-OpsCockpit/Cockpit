import { TripMessageContext } from '../common/constants/messages';
import { computeDriverName } from '../common/utils/driver-name';

export interface TripForMessage {
  ref: string;
  pocName: string | null;
  passengerName: string;
  pickupLocation: string;
  dropoffLocation: string | null;
  pickupAt: Date;
  vehicleType: { name: string } | null;
  driver: { firstName: string | null; lastName: string | null } | null;
  partner: { firstName: string | null; lastName: string | null } | null;
}

// pickupAt is stored as a naive "local wall-clock at the pickup location"
// value (like the legacy's separate pickupDate/pickupTime strings, no real
// UTC conversion) — read back with the UTC getters to recover those exact
// digits rather than the host's local time zone.
export function buildTripMessageContext(
  trip: TripForMessage,
): TripMessageContext {
  const pickupDate = trip.pickupAt.toISOString().slice(0, 10);
  const pickupTime = trip.pickupAt.toISOString().slice(11, 16);
  return {
    ref: trip.ref,
    pocName: trip.pocName,
    driverName:
      trip.driver || trip.partner
        ? computeDriverName((trip.driver ?? trip.partner)!)
        : null,
    passengerName: trip.passengerName,
    pickupLocation: trip.pickupLocation,
    dropoffLocation: trip.dropoffLocation,
    pickupDate,
    pickupTime,
    vehicleType: trip.vehicleType?.name ?? null,
  };
}
