import * as argon2 from 'argon2';
import type { PrismaClient } from '../generated/prisma/client';
import { Role, ClientType, Billing } from '../generated/prisma/enums';
import { COUNTRIES } from '../src/common/constants/countries';
import { DEFAULT_VEHICLE_TYPES } from '../src/common/constants/default-vehicle-types';
import { normalizePhone } from '../src/common/utils/normalize-phone';
import { letters } from '../src/common/utils/letters';

export interface AdminSeed {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export async function seedAdmin(prisma: PrismaClient, admin: AdminSeed) {
  const passwordHash = await argon2.hash(admin.password);
  // Normalized like every other write path (UsersService) so a capitalized
  // ADMIN_EMAIL in .env still matches the case-insensitive login lookup.
  const email = admin.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  // Never overwrite an existing admin — neither the password nor the ref,
  // which is assigned once and never moves (see the User model).
  if (existing) return;

  const seq = await nextRef(prisma, 'user:O');
  await prisma.user.create({
    data: {
      ref: `O-${String(seq).padStart(3, '0')}`,
      email,
      passwordHash,
      role: Role.ADMIN,
      firstName: admin.firstName,
      lastName: admin.lastName,
    },
  });
}

export async function seedCountries(prisma: PrismaClient) {
  await prisma.country.createMany({
    data: COUNTRIES.map((c) => ({
      code: c.code,
      name: c.name,
      dialCode: c.dial,
      currency: c.currency,
      defaultTimezone: c.tz,
    })),
    skipDuplicates: true,
  });
}

export async function seedVehicleTypes(prisma: PrismaClient) {
  for (const [index, type] of DEFAULT_VEHICLE_TYPES.entries()) {
    const ref = `V${index + 1}`;
    await prisma.vehicleType.upsert({
      where: { name: type.name },
      create: { ref, name: type.name, maxPax: type.maxPax },
      update: {},
    });
  }
  await prisma.refCounter.upsert({
    where: { scope: 'vehicleType' },
    create: { scope: 'vehicleType', lastValue: DEFAULT_VEHICLE_TYPES.length },
    update: { lastValue: DEFAULT_VEHICLE_TYPES.length },
  });
}

export async function seedBaseline(prisma: PrismaClient, admin: AdminSeed) {
  await seedAdmin(prisma, admin);
  await seedCountries(prisma);
  await seedVehicleTypes(prisma);
}

/**
 * Atomic increment, same statement as RefCounterService.next() — duplicated
 * here (not called via DI) because the seed script runs under `tsx`, whose
 * esbuild-based transform drops the `design:paramtypes` metadata Nest's
 * constructor injection relies on (Nest services fail to instantiate when
 * bootstrapped this way — see seed.ts comment).
 */
async function nextRef(prisma: PrismaClient, scope: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO "RefCounter" (scope, "lastValue")
    VALUES (${scope}, 1)
    ON CONFLICT (scope)
    DO UPDATE SET "lastValue" = "RefCounter"."lastValue" + 1
    RETURNING "lastValue"
  `;
  return rows[0].lastValue;
}

/** Same formula as DriversService's driverRefPrefix(). */
function driverRefPrefix(
  countryCode: string | undefined,
  area: string | undefined,
  company: string | null | undefined,
): string {
  if (!company?.trim()) return 'D-FR-INT';
  const countryPart = (countryCode ?? '').split('-')[0].toUpperCase() || 'XX';
  const areaPart = letters(area, 2) || 'XX';
  const companyPart = letters(company, 3) || 'XXX';
  return `D-${countryPart}-${areaPart}-${companyPart}`;
}

/**
 * Sample clients/drivers/fleet vehicles for local dev. The trip-creation
 * form never creates these on the fly (see LEGACY_FEATURES.md §9 — no
 * orphan refs), so an empty DB blocks testing /bookings end to end.
 * Mirrors ClientsService/DriversService/FleetVehiclesService's ref
 * generation exactly (see nextRef/driverRefPrefix above) so these fixtures
 * are indistinguishable from records created through the API.
 */
export async function seedFixtures(prisma: PrismaClient): Promise<void> {
  const individualEmail = 'marc.dubois@example.com';
  if (
    !(await prisma.client.findFirst({ where: { email: individualEmail } }))
  ) {
    const seq = await nextRef(prisma, 'client:individual');
    await prisma.client.create({
      data: {
        ref: `CI${seq}`,
        clientType: ClientType.INDIVIDUAL,
        contactFirstName: 'Marc',
        contactLastName: 'Dubois',
        countryCode: 'FR',
        email: individualEmail,
        billing: Billing.ACCOUNT,
        pocName: 'Marc Dubois',
        pocPhone: normalizePhone('+33612340000'),
      },
    });
  }

  const companyEmail = 'ops@atlas-capital.example';
  if (!(await prisma.client.findFirst({ where: { email: companyEmail } }))) {
    const seq = await nextRef(prisma, 'client:company');
    await prisma.client.create({
      data: {
        ref: `CC${seq}`,
        clientType: ClientType.COMPANY,
        company: 'Atlas Capital',
        countryCode: 'GB',
        email: companyEmail,
        billing: Billing.CARD,
        pocName: 'Sarah Lang',
        pocPhone: normalizePhone('+442071234000'),
      },
    });
  }

  const drivers: {
    firstName: string;
    lastName: string;
    phone: string;
    countryCode: string;
    area: string;
    company: string | null;
    email: string | null;
  }[] = [
    {
      firstName: 'Karim',
      lastName: 'Haddad',
      phone: '+33612345678',
      countryCode: 'FR',
      area: 'Local',
      company: null,
      email: null,
    },
    {
      firstName: 'Julien',
      lastName: 'Petit',
      phone: '+33698765432',
      countryCode: 'FR',
      area: 'Local',
      company: null,
      email: null,
    },
    {
      firstName: 'James',
      lastName: 'Whitfield',
      phone: '+447911123456',
      countryCode: 'GB',
      area: 'Central London',
      company: 'Uber Elite London',
      email: 'james.whitfield@uberelite.example',
    },
  ];
  // Dedup by phone, same guarantee as DriversService.create().
  for (const d of drivers) {
    const phone = normalizePhone(d.phone);
    // The seed authors its numbers in E.164 already; a null here means one of
    // the literals above is wrong, and a driver seeded without a phone would
    // silently drop out of the dedup.
    if (!phone) {
      throw new Error(
        `Seed driver ${d.firstName} ${d.lastName} has an invalid phone: ${d.phone}`,
      );
    }
    const existing = await prisma.driver.findUnique({ where: { phone } });
    if (existing) continue;
    const prefix = driverRefPrefix(d.countryCode, d.area, d.company);
    const seq = await nextRef(prisma, `driver:${prefix}`);
    await prisma.driver.create({
      data: {
        ref: `${prefix}-${String(seq).padStart(3, '0')}`,
        firstName: d.firstName,
        lastName: d.lastName,
        phone,
        company: d.company,
        email: d.email,
        countryCode: d.countryCode,
        area: d.area,
      },
    });
  }

  const fleetFixtures = [
    {
      category: 'Business',
      regNbr: 'AA-001-BC',
      make: 'Mercedes-Benz',
      model: 'E-Class',
      yearOfBuild: 2023,
      fourWD: false,
      nbPax: 3,
    },
    {
      category: 'Van',
      regNbr: 'AA-002-BC',
      make: 'Mercedes-Benz',
      model: 'V-Class',
      yearOfBuild: 2023,
      fourWD: false,
      nbPax: 6,
    },
  ];
  for (const fixture of fleetFixtures) {
    const existing = await prisma.fleetVehicle.findFirst({
      where: { regNbr: { equals: fixture.regNbr, mode: 'insensitive' } },
    });
    if (existing) continue;
    const category = await prisma.vehicleType.findUnique({
      where: { name: fixture.category },
    });
    if (!category) continue;
    const seq = await nextRef(prisma, 'fleetVehicle');
    await prisma.fleetVehicle.create({
      data: {
        ref: `F${seq}`,
        categoryId: category.id,
        regNbr: fixture.regNbr,
        make: fixture.make,
        model: fixture.model,
        yearOfBuild: fixture.yearOfBuild,
        fourWD: fixture.fourWD,
        nbPax: fixture.nbPax,
        isLocal: true,
      },
    });
  }
}
