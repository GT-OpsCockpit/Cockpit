import { PrismaService } from '../../src/prisma/prisma.service';
import { seedBaseline } from '../../prisma/seed-data';

export const TEST_ADMIN = {
  email: process.env.ADMIN_EMAIL!,
  password: process.env.ADMIN_PASSWORD!,
  firstName: process.env.ADMIN_FIRST_NAME ?? 'Admin',
  lastName: process.env.ADMIN_LAST_NAME ?? 'Test',
};

/** Wipes every table and reseeds the baseline (admin user, countries, vehicle types). */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `;
  if (tables.length > 0) {
    const names = tables.map((t) => `"${t.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} CASCADE`);
  }
  await seedBaseline(prisma, TEST_ADMIN);
}
