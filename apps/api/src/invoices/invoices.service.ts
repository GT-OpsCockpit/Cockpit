import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RefCounterService } from '../common/ref-counter/ref-counter.service';
import { EnvironmentVariables } from '../config/env.validation';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceEntity } from './dto/invoice.entity';
import { InvoicingPeriodEntity } from './dto/invoicing-period.entity';
import { invoicingDefaultPeriod } from './invoicing-period';
import { DateTime } from 'luxon';
import { billedAmount } from '@cockpit/shared';
import { requireAdminPassword } from '../common/auth/admin-password';
import type { AuthenticatedUser } from '../common/guards/session-auth.guard';
import { OkResponseEntity } from '../common/dto/ok-response.entity';

const round2 = (n: number) => Math.round(n * 100) / 100;

// The vehicle type comes along with each billed trip: an invoice is immutable,
// so the "Category" column has to name the type it was billed with. Resolving
// it client-side against GET /meta blanked the column for any type retired
// since (GET /meta lists active types only).
const INVOICE_INCLUDE = {
  client: true,
  trips: { include: { trip: { include: { vehicleType: true } } } },
} as const;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refCounter: RefCounterService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /**
   * The period the Customer tab opens on. The browser used to work this out
   * itself, which is why that tab downloaded every trip ever recorded — it
   * only ever needed the oldest unbilled one.
   */
  async defaultPeriod(): Promise<InvoicingPeriodEntity> {
    // Every account type, Events included — the tab bills those too
    // (customerListQuery asks for `category=all`), and the legacy counted them
    // here as well (invoicing.html:226 read the full trip list).
    const oldest = await this.prisma.trip.findFirst({
      where: { invoiced: false },
      orderBy: { pickupAt: 'asc' },
      select: { pickupAt: true },
    });
    return invoicingDefaultPeriod(oldest?.pickupAt ?? null, DateTime.now());
  }

  list(): Promise<InvoiceEntity[]> {
    return this.prisma.invoice.findMany({
      include: INVOICE_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(dto: CreateInvoiceDto): Promise<InvoiceEntity> {
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
    const candidateIds = trips.filter((t) => !t.invoiced).map((t) => t.id);
    if (candidateIds.length === 0) {
      throw new BadRequestException(
        'None of the selected trips can be invoiced (already invoiced, or no longer exist).',
      );
    }

    // vatRate is a real, persisted field (not a hard-coded literal) so a
    // future per-country/per-client rate doesn't require a schema change —
    // v1 still always applies the single configured default (10%).
    const vatRate =
      this.config.get('DEFAULT_VAT_RATE_PERCENT', { infer: true }) / 100;

    const seq = await this.refCounter.next('invoice');
    const ref = `INV${seq}`;

    // Interactive transaction: `RETURNING id` reports exactly the rows THIS
    // UPDATE flipped from false to true — unlike re-reading with a plain
    // findMany afterwards (which, under READ COMMITTED, would also show
    // trips a concurrent, already-committed request just claimed, wrongly
    // treating them as "claimed by us" too and double-billing them). The
    // `invoiced: false` guard is re-checked under the row lock at write
    // time, so a concurrent invoice creation racing on the same trip can
    // only ever claim it once.
    const invoice = await this.prisma.$transaction(async (tx) => {
      const claimedRows = await tx.$queryRaw<{ id: string }[]>`
        UPDATE "Trip" SET invoiced = true
        WHERE id = ANY(${candidateIds}) AND invoiced = false
        RETURNING id
      `;
      const claimedIds = claimedRows.map((r) => r.id);
      if (claimedIds.length === 0) {
        throw new BadRequestException(
          'None of the selected trips can be invoiced (already invoiced by a concurrent request).',
        );
      }
      const claimed = await tx.trip.findMany({
        where: { id: { in: claimedIds } },
      });
      const totalHT = round2(
        claimed.reduce(
          (sum, t) =>
            sum +
            (billedAmount({
              rate: t.priceEur ? Number(t.priceEur) : null,
              hours: t.hours,
              service: t.service,
            }) ?? 0),
          0,
        ),
      );
      const totalTTC = round2(totalHT * (1 + vatRate));
      return tx.invoice.create({
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
          trips: { create: claimed.map((t) => ({ tripId: t.id })) },
        },
      });
    });

    return this.prisma.invoice.findUniqueOrThrow({
      where: { ref: invoice.ref },
      include: INVOICE_INCLUDE,
    });
  }

  /**
   * Takes an invoice back so it can be corrected: its trips go back to the
   * to-invoice list and the invoice is removed. Behind the admin's password.
   * The invoice number is not reused — the counter keeps going.
   */
  async correct(
    ref: string,
    password: string,
    user: AuthenticatedUser,
  ): Promise<OkResponseEntity> {
    await requireAdminPassword(this.prisma, user.id, password);

    const invoice = await this.prisma.invoice.findUnique({
      where: { ref },
      include: { trips: { select: { tripId: true } } },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${ref} not found.`);

    await this.prisma.$transaction([
      this.prisma.trip.updateMany({
        where: { id: { in: invoice.trips.map((t) => t.tripId) } },
        data: { invoiced: false },
      }),
      this.prisma.invoiceTrip.deleteMany({ where: { invoiceId: invoice.id } }),
      this.prisma.invoice.delete({ where: { id: invoice.id } }),
    ]);
    return { ok: true };
  }
}
