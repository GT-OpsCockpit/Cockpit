import { computeClientName } from '../clients/clients.service';
import { computeDriverName } from '../common/utils/driver-name';
import { TripStepEntity } from './dto/trip.entity';
import { PublicTripEntity } from './dto/public-trip.entity';

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
  driver: { firstName: string | null; lastName: string | null } | null;
  partner: { firstName: string | null; lastName: string | null } | null;
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
    clientName: computeClientName(trip.client),
    clientRef: trip.client.ref,
    driverName:
      trip.driver || trip.partner
        ? computeDriverName((trip.driver ?? trip.partner)!)
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
