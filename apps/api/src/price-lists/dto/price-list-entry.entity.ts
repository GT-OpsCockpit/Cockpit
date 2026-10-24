import type { Prisma } from '../../../generated/prisma/client';
import { VehicleTypeEntity } from '../../fleet/dto/vehicle-type.entity';

export class PriceListEntryEntity {
  id: string;
  priceListId: string;
  pickupLocation: string | null;
  pickupPostalCodes: string[];
  pickupCountryCode: string | null;
  dropoffLocation: string | null;
  dropoffPostalCodes: string[];
  dropoffCountryCode: string | null;
  bidirectional: boolean;
  vehicleTypeId: string | null;
  vehicleType: VehicleTypeEntity | null;
  priceEur: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
}
