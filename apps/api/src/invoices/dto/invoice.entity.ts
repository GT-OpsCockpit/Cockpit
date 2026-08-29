import { ApiProperty } from '@nestjs/swagger';
import { ClientBaseEntity } from '../../clients/dto/client.entity';
import { TripBaseEntity } from '../../trips/dto/trip.entity';
import { VehicleTypeEntity } from '../../fleet/dto/vehicle-type.entity';
import type { Prisma } from '../../../generated/prisma/client';

/**
 * A billed trip: the lean record, plus the vehicle type the invoice's
 * "Category" column names. Carried on the invoice rather than looked up by the
 * reader, because an invoice is immutable and the type it was billed with may
 * since have been retired (GET /meta only lists active ones).
 */
export class InvoiceTripRecordEntity extends TripBaseEntity {
  vehicleType: VehicleTypeEntity | null;
}

/** Invoice <-> Trip join row, with the trip it links to. */
export class InvoiceTripEntity {
  invoiceId: string;
  tripId: string;
  trip: InvoiceTripRecordEntity;
}

export class InvoiceEntity {
  id: string;
  ref: string;
  clientId: string;
  client: ClientBaseEntity;
  isEvent: boolean;
  refPo: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;

  // Decimal fields serialize as a JSON string (Prisma's Decimal.toJSON());
  // the TS type keeps the real Decimal type, only the documented schema is
  // simplified to a string.
  @ApiProperty({ type: 'string' })
  totalHT: Prisma.Decimal;
  @ApiProperty({ type: 'string' })
  vatRate: Prisma.Decimal;
  @ApiProperty({ type: 'string' })
  totalTTC: Prisma.Decimal;

  createdAt: Date;
  trips: InvoiceTripEntity[];
}
