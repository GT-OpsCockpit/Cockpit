import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RefCounterService } from '../common/ref-counter/ref-counter.service';
import { EnvironmentVariables } from '../config/env.validation';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refCounter: RefCounterService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  list() {
    return this.prisma.invoice.findMany({
      include: { client: true, trips: { include: { trip: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(dto: CreateInvoiceDto) {
    const isEvent = !!dto.eventRef;
    const accountRef = isEvent ? dto.eventRef : dto.clientRef;
    const client = accountRef
      ? await this.prisma.client.findUnique({ where: { ref: accountRef } })
      : null;
    if (!client) {
      throw new BadRequestException(
        'clientRef or eventRef is required and must match an existing account.',
      );
    }

    const trips = await this.prisma.trip.findMany({
      where: { ref: { in: dto.tripRefs } },
    });
    // Silently ignores stale refs (already deleted/cancelled) and trips
    // already invoiced elsewhere — matches the legacy's filtering.
    const included = trips.filter((t) => !t.invoiced);
    if (included.length === 0) {
      throw new BadRequestException(
        'None of the selected trips can be invoiced (already invoiced, or no longer exist).',
      );
    }

    const totalHT = round2(
      included.reduce(
        (sum, t) => sum + (t.priceEur ? Number(t.priceEur) : 0),
        0,
      ),
    );
    // vatRate is a real, persisted field (not a hard-coded literal) so a
    // future per-country/per-client rate doesn't require a schema change —
    // v1 still always applies the single configured default (10%).
    const vatRate =
      this.config.get('DEFAULT_VAT_RATE_PERCENT', { infer: true }) / 100;
    const totalTTC = round2(totalHT * (1 + vatRate));

    const seq = await this.refCounter.next('invoice');
    const ref = `INV${seq}`;

    await this.prisma.$transaction([
      this.prisma.invoice.create({
        data: {
          ref,
          clientId: client.id,
          isEvent,
          refPo: client.refPoOther,
          periodStart: dto.periodStart ? new Date(dto.periodStart) : null,
          periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : null,
          totalHT,
          vatRate,
          totalTTC,
          trips: { create: included.map((t) => ({ tripId: t.id })) },
        },
      }),
      this.prisma.trip.updateMany({
        where: { id: { in: included.map((t) => t.id) } },
        data: { invoiced: true },
      }),
    ]);

    return this.prisma.invoice.findUniqueOrThrow({
      where: { ref },
      include: { client: true, trips: { include: { trip: true } } },
    });
  }
}
