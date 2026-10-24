import type { Prisma } from '../../../generated/prisma/client';
import { VehicleTypeEntity } from '../../fleet/dto/vehicle-type.entity';

export class PassengerRouteEntity {
  id: string;
  passengerId: string;
  pickupLocation: string;
  dropoffLocation: string | null;
  vehicleTypeId: string | null;
  vehicleType: VehicleTypeEntity | null;
  priceEur: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
}
