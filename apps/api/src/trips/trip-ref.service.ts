import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Generates/frees `R-{clientRef}-{YY}-{seq}` trip refs. Mirrors the legacy's
 * generateBookingRef/releaseBookingRef: the smallest freed seq for a given
 * client+year is reused before minting a new one, so the sequence never
 * grows unbounded just because trips get cancelled/reassigned.
 */
@Injectable()
export class TripRefService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(clientRef: string): Promise<string> {
    const yy = String(new Date().getFullYear()).slice(-2);
    const key = `${clientRef}:${yy}`;

    return this.prisma.$transaction(async (tx) => {
      const released = await tx.releasedTripSeq.findFirst({
        where: { key },
        orderBy: { seq: 'asc' },
      });

      let seq: number;
      if (released) {
        await tx.releasedTripSeq.delete({
          where: { key_seq: { key, seq: released.seq } },
        });
        seq = released.seq;
      } else {
        const rows = await tx.$queryRaw<{ lastValue: number }[]>`
          INSERT INTO "RefCounter" (scope, "lastValue")
          VALUES (${`trip:${key}`}, 1)
          ON CONFLICT (scope)
          DO UPDATE SET "lastValue" = "RefCounter"."lastValue" + 1
          RETURNING "lastValue"
        `;
        seq = rows[0].lastValue;
      }
      return `R-${clientRef}-${yy}-${seq}`;
    });
  }

  async release(ref: string): Promise<void> {
    const match = /^R-(.+)-(\d{2})-(\d+)$/.exec(ref);
    if (!match) return;
    const key = `${match[1]}:${match[2]}`;
    const seq = Number(match[3]);
    await this.prisma.releasedTripSeq.upsert({
      where: { key_seq: { key, seq } },
      create: { key, seq },
      update: {},
    });
  }
}
