import { ApiProperty } from '@nestjs/swagger';
import type { Prisma } from '../../../generated/prisma/client';
import { VehicleTypeEntity } from '../../fleet/dto/vehicle-type.entity';

export class PassengerRouteEntity {
  id: string;
  passengerId: string;
  pickupLocation: string;
  dropoffLocation: string | null;
  vehicleTypeId: string | null;
  vehicleType: VehicleTypeEntity | null;
  // Serialised as a string (Decimal); the schema says so, the TS type keeps Decimal.
  @ApiProperty({ type: 'string' })
  priceEur: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
}
