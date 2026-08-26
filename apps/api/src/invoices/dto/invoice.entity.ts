import { ApiProperty } from '@nestjs/swagger';
import { ClientBaseEntity } from '../../clients/dto/client.entity';
import { TripBaseEntity } from '../../trips/dto/trip.entity';
import type { Prisma } from '../../../generated/prisma/client';

/** Invoice <-> Trip join row, with the (relation-free) trip it links to. */
export class InvoiceTripEntity {
  invoiceId: string;
  tripId: string;
  trip: TripBaseEntity;
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
