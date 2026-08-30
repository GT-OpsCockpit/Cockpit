import { clientDisplayName, driverLabel } from '@cockpit/shared';
import { TripStepEntity } from './dto/trip.entity';
import { PublicTripEntity } from './dto/public-trip.entity';

interface DriverForDisplay {
  ref: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
}

export interface TripForPublicView {
  ref: string;
  tracking: boolean;
  assignmentCancelled: boolean;
  passengerName: string;
  paxCount: number | null;
  pocName: string | null;
  pocPhone: string | null;
  pickupAt: Date;
  timezone: string | null;
  pickupLocation: string;
  dropoffLocation: string | null;
  instructions: string | null;
  vehicleType: { name: string } | null;
  client: {
    ref: string;
    company: string | null;
    contactFirstName: string | null;
    contactLastName: string | null;
  };
  // `ref` and `company` are what driverLabel falls back on: a partner may be
  // a company with nobody named on it.
  driver: DriverForDisplay | null;
  partner: DriverForDisplay | null;
  steps: TripStepEntity[];
}

export function toPublicTrip(
  trip: TripForPublicView,
  viewerIsDriver: boolean,
): PublicTripEntity {
  return {
    ref: trip.ref,
    tracking: trip.tracking,
    assignmentCancelled: trip.assignmentCancelled,
    clientName: clientDisplayName(trip.client),
    clientRef: trip.client.ref,
    // driverLabel, not driverDisplayName: a partner company with nobody named
    // on file has no first/last name, and the passenger page then read
    // "Driver — To be confirmed" on a booking that was very much assigned.
    driverName:
      trip.driver || trip.partner
        ? driverLabel((trip.driver ?? trip.partner)!)
        : null,
    passengerName: trip.passengerName,
    paxCount: trip.paxCount,
    pocName: viewerIsDriver ? trip.pocName : null,
    pocPhone: viewerIsDriver ? trip.pocPhone : null,
    instructions: viewerIsDriver ? trip.instructions : null,
    pickupAt: trip.pickupAt,
    timezone: trip.timezone,
    pickupLocation: trip.pickupLocation,
    dropoffLocation: trip.dropoffLocation,
    vehicleTypeName: trip.vehicleType?.name ?? null,
    steps: trip.steps,
  };
}
