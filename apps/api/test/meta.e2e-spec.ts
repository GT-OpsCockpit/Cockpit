import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';
import { resetDatabase, TEST_ADMIN } from './utils/reset-db';
import { loginAs } from './utils/auth';
import { PrismaService } from '../src/prisma/prisma.service';

interface AreaBody {
  countryCode: string;
  cities: string[];
  localAllowed: boolean;
}

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

  // /meta feeds the pickers a dispatcher creates FROM (the booking bar's
  // Vehicle field, the fleet form's Category) — a type deactivated on the
  // Vehicles page must stop being offered there. The Vehicles management
  // table has its own endpoint and still lists it.
  it('leaves out a deactivated vehicle type', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server)
      .patch('/api/vehicles/V12/active')
      .set('Cookie', cookie)
      .send({ active: false })
      .expect(200);

    const res = await request(server)
      .get('/api/meta')
      .set('Cookie', cookie)
      .expect(200);
    expect((res.body as MetaBody).vehicleTypes.map((v) => v.ref)).not.toContain(
      'V12',
    );

    const managed = await request(server)
      .get('/api/vehicles')
      .set('Cookie', cookie)
      .expect(200);
    expect((managed.body as { ref: string }[]).map((v) => v.ref)).toContain(
      'V12',
    );
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/api/meta')
      .expect(401);
  });
  // The Area field is constrained by the paired Country field — see
  // common/business/area-suggestions.ts and the audit's §8.5. Its rules are
  // unit-tested there; this only asserts the endpoint wires them up and
  // reads its country off the query string.
  describe('GET /meta/areas', () => {
    const areas = (countryCode?: string) =>
      request(app.getHttpServer() as Parameters<typeof request>[0])
        .get('/api/meta/areas')
        .query(countryCode === undefined ? {} : { countryCode })
        .set('Cookie', cookie)
        .expect(200);

    it('suggests the chosen country\'s cities, capped by zone, and only allows "Local" in France', async () => {
      const fr = await areas('FR');
      expect((fr.body as AreaBody).localAllowed).toBe(true);
      expect((fr.body as AreaBody).cities).toContain('Nice');
      expect((fr.body as AreaBody).cities.length).toBeLessThanOrEqual(25);

      const it_ = await areas('IT');
      expect((it_.body as AreaBody).localAllowed).toBe(false);
      expect((it_.body as AreaBody).cities).not.toContain('Nice');
      expect((it_.body as AreaBody).cities.length).toBeLessThanOrEqual(12);

      const ny = await areas('US-NY');
      expect((ny.body as AreaBody).localAllowed).toBe(false);
      expect((ny.body as AreaBody).cities.length).toBeLessThanOrEqual(3);
    });

    it('offers nothing at all until a country is chosen', async () => {
      const none = await areas();
      expect((none.body as AreaBody).cities).toEqual([]);
      expect((none.body as AreaBody).localAllowed).toBe(false);
    });

    it('requires authentication', async () => {
      await request(app.getHttpServer() as Parameters<typeof request>[0])
        .get('/api/meta/areas')
        .query({ countryCode: 'FR' })
        .expect(401);
    });
  });
});
