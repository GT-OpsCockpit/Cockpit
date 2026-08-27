import { FleetUnavailKind } from '../../../generated/prisma/enums';
import { VehicleTypeEntity } from './vehicle-type.entity';
import { DriverBaseEntity } from '../../drivers/dto/driver.entity';
import { ClientBaseEntity } from '../../clients/dto/client.entity';

export class FleetUnavailabilityEntity {
  id: string;
  fleetVehicleId: string;
  type: FleetUnavailKind;
  startDate: Date;
  endDate: Date;
}

/** Raw FleetVehicle record fields (no relations) — used by DriverEntity.fleetReserved to show a partner's reserved vehicle without pulling in the full entity (and its own `driver` field back). */
export class FleetVehicleBaseEntity {
  id: string;
  ref: string;
  categoryId: string;
  regNbr: string;
  make: string;
  model: string;
  yearOfBuild: number;
  fourWD: boolean;
  nbPax: number;
  color: string;
  acronym: string | null;
  isLocal: boolean;
  countryCode: string | null;
  area: string | null;
  partnerCompany: string | null;
  driverId: string | null;
  eventsOnly: boolean;
  eventCountry: string | null;
  eventArea: string | null;
  eventClientId: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** A FleetVehicle with its category/driver/unavailability relations — the shape every fleet-vehicles endpoint returns. */
export class FleetVehicleEntity extends FleetVehicleBaseEntity {
  category: VehicleTypeEntity;
  driver: DriverBaseEntity | null;
  // Lets the edit form seed its Event picker by ref/name without a second
  // lookup — same purpose as DriverEntity.eventClient.
  eventClient: ClientBaseEntity | null;
  unavailability: FleetUnavailabilityEntity | null;
}
