import { DateTime } from 'luxon';
import { TripMessageContext } from '../common/constants/messages';
import { computeDriverName } from '../common/utils/driver-name';

export interface TripForMessage {
  ref: string;
  pocName: string | null;
  passengerName: string;
  pickupLocation: string;
  dropoffLocation: string | null;
  pickupAt: Date;
  timezone: string | null;
  vehicleType: { name: string } | null;
  driver: { firstName: string | null; lastName: string | null } | null;
  partner: { firstName: string | null; lastName: string | null } | null;
}

// Every message template says "(local time)", and the legacy meant it: it
// stored the pickup as the wall-clock date/time at the pickup location.
// pickupAt here is a real instant, so it has to be read back in the trip's
// own timezone — reading it in UTC (or in the server's zone) would announce
// a pickup hours off from the one the dispatcher typed. Falls back to UTC
// only when no timezone was resolved for the trip at all.
export function buildTripMessageContext(
  trip: TripForMessage,
): TripMessageContext {
  const localPickup = DateTime.fromJSDate(trip.pickupAt).setZone(
    trip.timezone ?? 'utc',
  );
  const pickupDate = localPickup.toFormat('yyyy-MM-dd');
  const pickupTime = localPickup.toFormat('HH:mm');
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
