import * as argon2 from 'argon2';
import type { PrismaClient } from '../generated/prisma/client';
import { Role } from '../generated/prisma/enums';
import { COUNTRIES } from '../src/common/constants/countries';
import { DEFAULT_VEHICLE_TYPES } from '../src/common/constants/default-vehicle-types';

export interface AdminSeed {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export async function seedAdmin(prisma: PrismaClient, admin: AdminSeed) {
  const passwordHash = await argon2.hash(admin.password);
  await prisma.user.upsert({
    where: { email: admin.email },
    create: {
      email: admin.email,
      passwordHash,
      role: Role.ADMIN,
      firstName: admin.firstName,
      lastName: admin.lastName,
    },
    // Never overwrite an existing admin's password on re-seed.
    update: {},
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
