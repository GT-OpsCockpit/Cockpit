import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';
import { resetDatabase, TEST_ADMIN } from './utils/reset-db';
import { loginAs } from './utils/auth';
import { PrismaService } from '../src/prisma/prisma.service';

interface ClientBody {
  ref: string;
}

interface TripBody {
  ref: string;
  nameboardUrl: string | null;
}

describe('Trip nameboard upload (e2e)', () => {
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

  it('stores the uploaded file and serves it back publicly under /uploads/nameboards', async () => {
    const client = await request(server())
      .post('/api/clients')
      .set('Cookie', cookie)
      .send({
        clientType: 'INDIVIDUAL',
        contactFirstName: 'Jane',
        contactLastName: 'Doe',
        pocPhone: '+33611111111',
      })
      .expect(201);
    const trip = await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({
        countryCode: 'FR',
        pickupAt: '2026-06-01T14:30:00.000Z',
        pickupLocation: 'Nice Airport',
        dropoffLocation: 'Cannes',
        service: 'TSF',
        passengerName: 'John Passenger',
        clientRef: (client.body as ClientBody).ref,
      })
      .expect(201);

    const res = await request(server())
      .post(`/api/trips/${(trip.body as TripBody).ref}/nameboard`)
      .set('Cookie', cookie)
      .attach('file', Buffer.from('fake image bytes'), 'board.txt')
      .expect(201);
    const nameboardUrl = (res.body as TripBody).nameboardUrl;
    expect(nameboardUrl).toMatch(/^\/uploads\/.+\.txt$/);

    const served = await request(server()).get(nameboardUrl!).expect(200);
    expect(served.text).toBe('fake image bytes');
  });

  it('rejects when no file is attached', async () => {
    const client = await request(server())
      .post('/api/clients')
      .set('Cookie', cookie)
      .send({
        clientType: 'INDIVIDUAL',
        contactFirstName: 'Jane',
        contactLastName: 'Doe',
        pocPhone: '+33611111111',
      })
      .expect(201);
    const trip = await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({
        countryCode: 'FR',
        pickupAt: '2026-06-01T14:30:00.000Z',
        pickupLocation: 'Nice Airport',
        dropoffLocation: 'Cannes',
        service: 'TSF',
        passengerName: 'John Passenger',
        clientRef: (client.body as ClientBody).ref,
      })
      .expect(201);

    await request(server())
      .post(`/api/trips/${(trip.body as TripBody).ref}/nameboard`)
      .set('Cookie', cookie)
      .expect(400);
  });
});
