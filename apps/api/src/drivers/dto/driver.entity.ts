import { DriverUnavailKind } from '../../../generated/prisma/enums';

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
