import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';
import { resetDatabase, TEST_ADMIN } from './utils/reset-db';
import { loginAs } from './utils/auth';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Geo (e2e, network-independent routes only)', () => {
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

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  it('fbo-lookup matches a known airport keyword and reports not-found otherwise', async () => {
    const found = await request(server())
      .get('/api/fbo-lookup?q=Nice+Airport')
      .set('Cookie', cookie)
      .expect(200);
    expect((found.body as { found: boolean }).found).toBe(true);

    const notFound = await request(server())
      .get('/api/fbo-lookup?q=Nowhere')
      .set('Cookie', cookie)
      .expect(200);
    expect((notFound.body as { found: boolean }).found).toBe(false);
  });

  it('flight-check degrades gracefully with no FlightStats credentials configured', async () => {
    const res = await request(server())
      .post('/api/flight-check')
      .set('Cookie', cookie)
      .send({
        flightNumber: 'AF1234',
        pickupDate: '2026-01-01',
        pickupTime: '10:00',
      })
      .expect(201);
    expect(res.body).toEqual(
      expect.objectContaining({ configured: false, match: null }),
    );
  });

  it('flight-check rejects a malformed flight number', async () => {
    await request(server())
      .post('/api/flight-check')
      .set('Cookie', cookie)
      .send({
        flightNumber: '1234',
        pickupDate: '2026-01-01',
        pickupTime: '10:00',
      })
      .expect(400);
  });

  it('geocode-search returns empty results below the 2-char threshold, without calling out to Nominatim', async () => {
    const res = await request(server())
      .get('/api/geocode-search?q=a')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body).toEqual({ results: [] });
  });

  it('fx-rate passes EUR through at 1 without any network/db lookup', async () => {
    const res = await request(server())
      .get('/api/fx-rate?currency=EUR')
      .set('Cookie', cookie)
      .expect(200);
    expect((res.body as { eurPerUnit: number }).eurPerUnit).toBe(1);
  });

  it('poc-search aggregates client POCs and filters by the query', async () => {
    await request(server())
      .post('/api/clients')
      .set('Cookie', cookie)
      .send({
        clientType: 'INDIVIDUAL',
        contactFirstName: 'Jane',
        contactLastName: 'Doe',
        pocPhone: '+33611111111',
      })
      .expect(201);

    const res = await request(server())
      .get('/api/poc-search?q=jane')
      .set('Cookie', cookie)
      .expect(200);
    expect((res.body as { results: { name: string }[] }).results).toEqual([
      { name: 'Jane Doe', phone: '+33611111111' },
    ]);

    const none = await request(server())
      .get('/api/poc-search?q=zzz')
      .set('Cookie', cookie)
      .expect(200);
    expect((none.body as { results: unknown[] }).results).toEqual([]);
  });
});
