import { ApiProperty } from '@nestjs/swagger';
import {
  Service,
  Billing,
  CancellationFee,
  TripStepKind,
} from '../../../generated/prisma/enums';
import { ClientBaseEntity } from '../../clients/dto/client.entity';
import { DriverBaseEntity } from '../../drivers/dto/driver.entity';
import { VehicleTypeEntity } from '../../fleet/dto/vehicle-type.entity';
import type { Prisma } from '../../../generated/prisma/client';

export class TripStepEntity {
  id: string;
  tripId: string;
  step: TripStepKind;
  occurredAt: Date;
}

/** FleetVehicle as embedded on a Trip — only its `category` relation is included, unlike the fleet-vehicles module's own endpoints. */
export class TripFleetVehicleEntity {
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
  eventsOnly: boolean;
  eventCountry: string | null;
  eventArea: string | null;
  eventClientId: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Raw Trip record fields (no relations). */
export class TripBaseEntity {
  id: string;
  ref: string;
  countryCode: string | null;
  area: string | null;
  timezone: string | null;
  pickupAt: Date;
  pickupLocation: string;
  dropoffLocation: string | null;
  service: Service;
  hours: number | null;
  instructions: string | null;
  clientId: string;
  passengerName: string;
  pocName: string | null;
  pocPhone: string | null;
  pocEmail: string | null;
  tracking: boolean;
  paxCount: number | null;
  vehicleTypeId: string | null;
  fleetVehicleId: string | null;

  // Decimal fields serialize as a JSON string (Prisma's Decimal.toJSON());
  // the TS type keeps the real Decimal type, only the documented schema is
  // simplified to a nullable string.
  @ApiProperty({ type: 'string', nullable: true })
  priceEur: Prisma.Decimal | null;
  @ApiProperty({ type: 'string', nullable: true })
  partnerRateEur: Prisma.Decimal | null;

  driverId: string | null;
  billing: Billing | null;
  flightNumber: string | null;
  bufferTime: number | null;
  fboAddress: string | null;
  tailNbr: string | null;
  nameboardUrl: string | null;
  pickupIata: string | null;
  dropoffIata: string | null;
  subContractor: boolean;
  partnerId: string | null;
  dispatched: boolean;
  invoiced: boolean;
  assignmentCancelled: boolean;
  assignmentCancelledAt: Date | null;
  cancellationFee: CancellationFee | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A Trip with the relations every trips-module endpoint includes (client/driver/partner/vehicleType/fleetVehicle/steps). */
export class TripEntity extends TripBaseEntity {
  client: ClientBaseEntity;
  driver: DriverBaseEntity | null;
  partner: DriverBaseEntity | null;
  vehicleType: VehicleTypeEntity | null;
  fleetVehicle: TripFleetVehicleEntity | null;
  steps: TripStepEntity[];
}

export class UpdateTripResponseEntity {
  ok: boolean;
  trip: TripEntity;
  notifyWarning: string | null;
}

/** cancelAssignment() either deletes the trip outright (free cancellation) or keeps it with the assignment cleared. */
export class CancelAssignmentResponseEntity {
  ok: boolean;
  deleted?: boolean;
  trip?: TripEntity;
}

/** Shared response shape for advanceStep()/notify() — `skipped` is only present when tracking is off. */
export class TripActionResponseEntity {
  ok: boolean;
  trip: TripEntity;
  skipped?: boolean;
}
