import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Single source of monotonic sequence numbers for every reference format in
 * the app (clients, drivers, fleet, vehicle types, invoices, access...).
 * Replaces the legacy's half-dozen ad hoc in-memory counters (reset to zero
 * on every restart) with one atomic, persisted mechanism.
 */
@Injectable()
export class RefCounterService {
  constructor(private readonly prisma: PrismaService) {}

  /** Atomically increments and returns the next value for `scope`. */
  async next(scope: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ lastValue: number }[]>`
      INSERT INTO "RefCounter" (scope, "lastValue")
      VALUES (${scope}, 1)
      ON CONFLICT (scope)
      DO UPDATE SET "lastValue" = "RefCounter"."lastValue" + 1
      RETURNING "lastValue"
    `;
    return rows[0].lastValue;
  }
}
