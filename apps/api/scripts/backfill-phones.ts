import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { toE164, toIso2 } from '@cockpit/shared';
import { PrismaClient } from '../generated/prisma/client';

/**
 * One-off data migration: every stored phone number becomes E.164.
 *
 * Until now `normalizePhone` kept digits only and dropped the leading `+`, so
 * two incompatible formats share the same columns — a national number
 * ("0612345678") and a country code with its plus stripped ("33612345678") —
 * and `whatsapp:+0612345678` was undialable for every number of the first kind.
 *
 * This is not expressed as a Prisma migration: the schema does not change
 * (E.164 fits the existing TEXT columns), and parsing needs libphonenumber,
 * which plain SQL cannot call.
 *
 *   pnpm --filter @cockpit/api backfill:phones -- --dry-run
 *   pnpm --filter @cockpit/api backfill:phones
 *   pnpm --filter @cockpit/api backfill:phones -- --merge-duplicates
 *
 * Everything runs in one transaction: the unique index on Driver.phone is
 * dropped, the rows are rewritten, and the index is recreated. Two drivers
 * whose numbers were stored in different formats can normalize to the same
 * E.164 value, which is why the index has to come off first — and why a
 * collision aborts the whole run rather than quietly merging two people.
 */

const DRY_RUN = process.argv.includes('--dry-run');
const MERGE_DUPLICATES = process.argv.includes('--merge-duplicates');
const REPORT_PATH = 'backfill-phones-report.json';

/**
 * Country used when a row carries no usable one of its own. `Client.pocPhone`,
 * `Trip.pocPhone`, `User.phone` and `CompanyInfo.mobile` have no per-row
 * country at all — a POC's number is routinely in a different country from the
 * booking — so their national numbers can only be read under an assumption,
 * and every row converted this way is listed in the report.
 */
const FALLBACK_COUNTRY = process.env.BACKFILL_PHONE_COUNTRY ?? 'FR';

interface Converted {
  table: string;
  id: string;
  column: string;
  before: string;
  after: string;
  /** How the value was read: as an international number, or under a guess. */
  via: 'international' | 'plus-restored' | `assumed:${string}`;
}

interface Skipped {
  table: string;
  id: string;
  column: string;
  value: string;
  reason: string;
}

/**
 * Reads one legacy value into E.164, reporting which reading worked.
 *
 * The order matters. A value that already starts with `+` is authoritative.
 * Otherwise the digits-only convention is ambiguous, and the two readings are
 * tried in the order that cannot lose information: prepending `+` (recovering
 * a number that was stored with its country code) is checked before applying
 * the country hint, because a hint-based reading of "33612345678" would give
 * a wrong French number rather than the Swiss/French one actually meant.
 */
function convert(
  value: string,
  countryHint: string | null,
): { e164: string; via: Converted['via'] } | { reason: string } {
  const trimmed = value.trim();
  if (!trimmed) return { reason: 'empty' };

  if (trimmed.startsWith('+')) {
    const e164 = toE164(trimmed);
    return e164 ? { e164, via: 'international' } : { reason: 'invalid-international' };
  }

  const restored = toE164(`+${trimmed}`);
  if (restored) return { e164: restored, via: 'plus-restored' };

  const hint = countryHint ?? FALLBACK_COUNTRY;
  const national = toE164(trimmed, hint);
  if (national) return { e164: national, via: `assumed:${hint}` };

  return { reason: 'unparsable' };
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const converted: Converted[] = [];
  const skipped: Skipped[] = [];
  const blanked: { table: string; id: string; column: string }[] = [];
  const merged: { phone: string; kept: string; cleared: string[] }[] = [];
  /**
   * What each driver's number *will* be, oldest driver first. Collisions are
   * detected from this rather than by re-reading the table, because a --dry-run
   * writes nothing — reading back would compare the untouched legacy values and
   * report no collision at all, which is the one thing a dry run exists to find.
   */
  const plannedDriverPhones: { ref: string; phone: string }[] = [];

  try {
    await prisma.$transaction(
      async (tx) => {
        // NULL never equals NULL on a unique index, so the phone-less rows are
        // safe either way — it is the newly-identical numbers that need room.
        await tx.$executeRawUnsafe('DROP INDEX IF EXISTS "Driver_phone_key"');

        // Each entry: the rows to read, and the country to read them under.
        // Driver is the only table whose own countryCode describes the person
        // holding the number rather than the account or the booking.
        const users = await tx.user.findMany({ select: { id: true, phone: true } });
        const clients = await tx.client.findMany({
          select: { id: true, ref: true, pocPhone: true },
        });
        const drivers = await tx.driver.findMany({
          select: {
            id: true,
            ref: true,
            phone: true,
            countryCode: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        });
        const trips = await tx.trip.findMany({
          select: { id: true, ref: true, pocPhone: true },
        });
        const companies = await tx.companyInfo.findMany({
          select: { id: true, mobile: true },
        });

        async function apply(
          table: string,
          id: string,
          column: string,
          raw: string | null,
          countryHint: string | null,
          write: (next: string | null) => Promise<unknown>,
          plan?: (next: string | null) => void,
        ) {
          // '' is how Client.pocPhone recorded "no number"; Driver.phone used
          // NULL for the same thing. Settle on NULL, which is what SQL means
          // by unknown and what the unique index needs.
          if (raw === null) {
            plan?.(null);
            return;
          }
          if (!raw.trim()) {
            blanked.push({ table, id, column });
            plan?.(null);
            if (!DRY_RUN) await write(null);
            return;
          }
          const result = convert(raw, countryHint);
          if ('reason' in result) {
            // Left exactly as found — a number we cannot read is still the only
            // record of how to reach that person.
            skipped.push({ table, id, column, value: raw, reason: result.reason });
            plan?.(raw);
            return;
          }
          plan?.(result.e164);
          if (result.e164 === raw) return;
          converted.push({ table, id, column, before: raw, after: result.e164, via: result.via });
          if (!DRY_RUN) await write(result.e164);
        }

        for (const user of users) {
          await apply('User', user.id, 'phone', user.phone, null, (phone) =>
            tx.user.update({ where: { id: user.id }, data: { phone } }),
          );
        }
        for (const client of clients) {
          await apply('Client', client.ref, 'pocPhone', client.pocPhone, null, (pocPhone) =>
            tx.client.update({ where: { id: client.id }, data: { pocPhone } }),
          );
        }
        for (const driver of drivers) {
          await apply(
            'Driver',
            driver.ref,
            'phone',
            driver.phone,
            toIso2(driver.countryCode),
            (phone) => tx.driver.update({ where: { id: driver.id }, data: { phone } }),
            (phone) => {
              if (phone) plannedDriverPhones.push({ ref: driver.ref, phone });
            },
          );
        }
        for (const trip of trips) {
          await apply('Trip', trip.ref, 'pocPhone', trip.pocPhone, null, (pocPhone) =>
            tx.trip.update({ where: { id: trip.id }, data: { pocPhone } }),
          );
        }
        for (const company of companies) {
          await apply(
            'CompanyInfo',
            String(company.id),
            'mobile',
            company.mobile,
            null,
            (mobile) =>
              tx.companyInfo.update({ where: { id: company.id }, data: { mobile } }),
          );
        }

        const collisions = findDriverCollisions(plannedDriverPhones);
        if (collisions.length) {
          reportCollisions(collisions);
          if (!MERGE_DUPLICATES) {
            throw new Error(
              `${collisions.length} phone number(s) now match more than one driver. ` +
                'Nothing was written. Resolve them by hand, or re-run with ' +
                '--merge-duplicates to keep the oldest driver on each number and ' +
                'clear the phone on the others.',
            );
          }
          for (const { phone, refs } of collisions) {
            // Oldest driver keeps the number: it is the one the trips, the refs
            // and the dedup-on-create path have been pointing at the longest.
            const [kept, ...cleared] = refs;
            merged.push({ phone, kept, cleared });
            for (const ref of cleared) {
              if (!DRY_RUN) {
                await tx.driver.update({ where: { ref }, data: { phone: null } });
              }
            }
          }
        }

        await tx.$executeRawUnsafe(
          'CREATE UNIQUE INDEX "Driver_phone_key" ON "Driver"("phone")',
        );

        if (DRY_RUN) {
          throw new DryRun();
        }
      },
      { timeout: 120_000 },
    );
  } catch (error) {
    if (!(error instanceof DryRun)) {
      writeReport(converted, skipped, blanked, merged);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }

  writeReport(converted, skipped, blanked, merged);
  console.log(
    `${DRY_RUN ? '[dry run] ' : ''}converted ${converted.length}, ` +
      `blanked ${blanked.length}, left as-is ${skipped.length}, ` +
      `duplicate drivers cleared ${merged.reduce((n, m) => n + m.cleared.length, 0)}. ` +
      `Details in ${REPORT_PATH}.`,
  );
}

/** Thrown to roll a --dry-run transaction back once it has done its reading. */
class DryRun extends Error {}

/** Numbers that more than one driver would end up holding. Input is oldest-first. */
function findDriverCollisions(
  planned: { ref: string; phone: string }[],
): { phone: string; refs: string[] }[] {
  const byPhone = new Map<string, string[]>();
  for (const { ref, phone } of planned) {
    const refs = byPhone.get(phone) ?? [];
    refs.push(ref);
    byPhone.set(phone, refs);
  }
  return [...byPhone.entries()]
    .filter(([, refs]) => refs.length > 1)
    .map(([phone, refs]) => ({ phone, refs }));
}

function reportCollisions(collisions: { phone: string; refs: string[] }[]) {
  console.error('Drivers now sharing a phone number:');
  for (const { phone, refs } of collisions) {
    console.error(`  ${phone} -> ${refs.join(', ')}`);
  }
}

function writeReport(
  converted: Converted[],
  skipped: Skipped[],
  blanked: { table: string; id: string; column: string }[],
  merged: { phone: string; kept: string; cleared: string[] }[],
) {
  writeFileSync(
    REPORT_PATH,
    JSON.stringify(
      {
        dryRun: DRY_RUN,
        fallbackCountry: FALLBACK_COUNTRY,
        counts: {
          converted: converted.length,
          blanked: blanked.length,
          skipped: skipped.length,
          assumedCountry: converted.filter((c) => c.via.startsWith('assumed:')).length,
          driversCleared: merged.reduce((n, m) => n + m.cleared.length, 0),
        },
        converted,
        blanked,
        skipped,
        merged,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
