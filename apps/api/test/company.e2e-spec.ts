import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';
import { resetDatabase, TEST_ADMIN } from './utils/reset-db';
import { loginAs } from './utils/auth';
import { PrismaService } from '../src/prisma/prisma.service';

const FULL_PAYLOAD = {
  name: 'Cockpit VTC',
  legalName: 'Cockpit VTC SAS',
  street1: '1 Rue de la Paix',
  zipCode: '75002',
  city: 'Paris',
  countryCode: 'FR',
  vatNbr: 'FR12345678901',
  email: 'contact@cockpit.test',
  website: 'https://cockpit.test',
  ownerSurname: 'Doe',
  ownerName: 'John',
  mobile: '0600000000',
  ownerEmail: 'owner@cockpit.test',
};

describe('Company (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminCookie: string;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    adminCookie = await loginAs(app, TEST_ADMIN.email, TEST_ADMIN.password);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  it('starts unsaved and rejects a PUT missing any of the 13 required fields', async () => {
    const getRes = await request(server())
      .get('/api/company-info')
      .set('Cookie', adminCookie)
      .expect(200);
    expect((getRes.body as { saved: boolean }).saved).toBe(false);

    await request(server())
      .put('/api/company-info')
      .set('Cookie', adminCookie)
      .send({ ...FULL_PAYLOAD, name: undefined })
      .expect(400);
  });

  it('saves once all fields are provided, then locks further edits server-side', async () => {
    const putRes = await request(server())
      .put('/api/company-info')
      .set('Cookie', adminCookie)
      .send(FULL_PAYLOAD)
      .expect(200);
    expect((putRes.body as { saved: boolean }).saved).toBe(true);

    await request(server())
      .put('/api/company-info')
      .set('Cookie', adminCookie)
      .send({ ...FULL_PAYLOAD, city: 'Lyon' })
      .expect(409);

    const getRes = await request(server())
      .get('/api/company-info')
      .set('Cookie', adminCookie)
      .expect(200);
    expect((getRes.body as { city: string }).city).toBe('Paris');
  });

  it('forbids a non-admin dispatcher from reading or writing company info', async () => {
    await request(server())
      .post('/api/users')
      .set('Cookie', adminCookie)
      .send({
        email: 'dispatcher@cockpit.test',
        password: 'dispatcher-pw',
        role: 'DISPATCHER',
        firstName: 'Dana',
        lastName: 'Dispatch',
      })
      .expect(201);
    const dispatcherCookie = await loginAs(
      app,
      'dispatcher@cockpit.test',
      'dispatcher-pw',
    );

    await request(server())
      .get('/api/company-info')
      .set('Cookie', dispatcherCookie)
      .expect(403);
  });
});
