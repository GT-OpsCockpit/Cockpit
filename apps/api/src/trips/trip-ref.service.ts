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
      // Atomic claim-and-delete: two concurrent generate() calls for the
      // same client+year must never both grab the same freed seq (which a
      // separate findFirst-then-delete would allow, and the loser's delete
      // would then crash with a P2025 "record not found"). FOR UPDATE SKIP
      // LOCKED lets each transaction claim a distinct row (or none) without
      // blocking or erroring on a row another transaction already took.
      const claimed = await tx.$queryRaw<{ seq: number }[]>`
        DELETE FROM "ReleasedTripSeq"
        WHERE ctid = (
          SELECT ctid FROM "ReleasedTripSeq"
          WHERE key = ${key}
          ORDER BY seq ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING seq
      `;

      let seq: number;
      if (claimed.length > 0) {
        seq = claimed[0].seq;
      } else {
        // TODO: this hand-rolls the exact same atomic upsert SQL as
        // RefCounterService.next(), because that service only ever operates
        // on `this.prisma` and can't be composed inside this method's own
        // transaction. Give RefCounterService.next() an optional
        // Prisma.TransactionClient parameter so this can call into it
        // instead of duplicating the query — the next counter-inside-a-
        // transaction use case will otherwise triplicate it.
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
