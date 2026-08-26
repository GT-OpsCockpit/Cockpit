import { FleetUnavailKind } from '../../../generated/prisma/enums';
import { VehicleTypeEntity } from './vehicle-type.entity';
import { DriverBaseEntity } from '../../drivers/dto/driver.entity';

export class FleetUnavailabilityEntity {
  id: string;
  fleetVehicleId: string;
  type: FleetUnavailKind;
  startDate: Date;
  endDate: Date;
}

/** A FleetVehicle with its category/driver/unavailability relations — the shape every fleet-vehicles endpoint returns. */
export class FleetVehicleEntity {
  id: string;
  ref: string;
  categoryId: string;
  category: VehicleTypeEntity;
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
  driver: DriverBaseEntity | null;
  eventsOnly: boolean;
  eventCountry: string | null;
  eventArea: string | null;
  eventClientId: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  unavailability: FleetUnavailabilityEntity | null;
}
