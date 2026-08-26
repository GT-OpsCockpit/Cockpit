import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';
import { resetDatabase, TEST_ADMIN } from './utils/reset-db';
import { loginAs } from './utils/auth';
import { PrismaService } from '../src/prisma/prisma.service';

interface MetaBody {
  countries: unknown[];
  vehicleTypes: { ref: string }[];
  fleetMakes: string[];
  fleetMinYear: number;
  fleetMaxYear: number;
  fleetDefaultColor: string;
}

describe('Meta (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    cookie = await loginAs(app, TEST_ADMIN.email, TEST_ADMIN.password);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the full dropdown catalogue, with vehicle types sorted numerically by ref', async () => {
    const res = await request(
      app.getHttpServer() as Parameters<typeof request>[0],
    )
      .get('/api/meta')
      .set('Cookie', cookie)
      .expect(200);

    const body = res.body as MetaBody;
    expect(body.countries.length).toBeGreaterThan(100);
    expect(body.vehicleTypes.map((v) => v.ref)).toEqual([
      'V1',
      'V2',
      'V3',
      'V4',
      'V5',
      'V6',
      'V7',
      'V8',
      'V9',
      'V10',
      'V11',
      'V12',
    ]);
    expect(body.fleetMakes).toContain('Mercedes-Benz');
    expect(body.fleetDefaultColor).toBe('Metallic Black');
    expect(body.fleetMaxYear - body.fleetMinYear).toBe(10);
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/api/meta')
      .expect(401);
  });
});
