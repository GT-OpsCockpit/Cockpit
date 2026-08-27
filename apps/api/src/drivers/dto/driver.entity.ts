import { DriverUnavailKind } from '../../../generated/prisma/enums';
import { ClientBaseEntity } from '../../clients/dto/client.entity';
import { FleetVehicleBaseEntity } from '../../fleet/dto/fleet-vehicle.entity';

export class DriverUnavailabilityEntity {
  id: string;
  driverId: string;
  type: DriverUnavailKind;
  date: Date | null;
  startDate: Date | null;
  endDate: Date | null;
}

/** Raw Driver record fields (no derived/computed properties). */
export class DriverBaseEntity {
  id: string;
  ref: string;
  countryCode: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  company: string | null;
  email: string | null;
  area: string;
  eventsOnly: boolean;
  eventCountry: string | null;
  eventArea: string | null;
  eventClientId: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** A Driver record, plus the derived display `name` computeDriverName() adds on every read. */
export class DriverEntity extends DriverBaseEntity {
  name: string;
  // The linked Event Client (eventsOnly=true only) — lets the edit form seed
  // its Event picker by ref/name without a second lookup, same purpose as
  // TripEntity nesting client/driver/partner instead of just their refs.
  eventClient: ClientBaseEntity | null;
  // Lets the drivers table show current unavailability at a glance without a
  // per-row follow-up request — same include as eventClient above.
  unavailability: DriverUnavailabilityEntity | null;
  // The External vehicle reserved for this partner chauffeur, if any (see
  // FleetVehicle.driverId) — lets the Partners table render the "unlink"
  // padlock (legacy common.js:3538 linkedVehicleLine/unlinkVehicleFromDriver)
  // without a second lookup, same purpose as eventClient above.
  fleetReserved: FleetVehicleBaseEntity | null;
}

/**
 * Driver record with its unavailability window, as returned by
 * setUnavailability() — note this one comes straight from a plain
 * `findUnique`, so (unlike every other drivers endpoint) it has no derived
 * `name` field.
 */
export class DriverWithUnavailabilityEntity extends DriverBaseEntity {
  unavailability: DriverUnavailabilityEntity | null;
}
