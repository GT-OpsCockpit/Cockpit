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

  async function createTrip(): Promise<string> {
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
    return (trip.body as TripBody).ref;
  }

  it('stores the uploaded file and serves it back publicly under /uploads/nameboards', async () => {
    const ref = await createTrip();

    const res = await request(server())
      .post(`/api/trips/${ref}/nameboard`)
      .set('Cookie', cookie)
      .attach('file', Buffer.from('fake image bytes'), 'board.txt')
      .expect(201);
    const nameboardUrl = (res.body as TripBody).nameboardUrl;
    expect(nameboardUrl).toMatch(/^\/uploads\/nameboards\/.+\.txt$/);

    const served = await request(server()).get(nameboardUrl!).expect(200);
    expect(served.text).toBe('fake image bytes');
    // The upload's own mimetype is stored alongside the object and replayed on
    // read, rather than re-guessed from the extension.
    expect(served.headers['content-type']).toContain('text/plain');
  });

  it('deletes the previous file when a nameboard is replaced', async () => {
    const ref = await createTrip();

    const first = await request(server())
      .post(`/api/trips/${ref}/nameboard`)
      .set('Cookie', cookie)
      .attach('file', Buffer.from('first board'), 'first.txt')
      .expect(201);
    const firstUrl = (first.body as TripBody).nameboardUrl!;

    const second = await request(server())
      .post(`/api/trips/${ref}/nameboard`)
      .set('Cookie', cookie)
      .attach('file', Buffer.from('second board'), 'second.txt')
      .expect(201);
    const secondUrl = (second.body as TripBody).nameboardUrl!;
    expect(secondUrl).not.toBe(firstUrl);

    const served = await request(server()).get(secondUrl).expect(200);
    expect(served.text).toBe('second board');
    // The replaced object is gone, not orphaned in the bucket forever.
    await request(server()).get(firstUrl).expect(404);
  });

  it('returns 404 for a nameboard that does not exist', async () => {
    await request(server())
      .get('/uploads/nameboards/does-not-exist.png')
      .expect(404);
  });

  it('rejects when no file is attached', async () => {
    const ref = await createTrip();

    await request(server())
      .post(`/api/trips/${ref}/nameboard`)
      .set('Cookie', cookie)
      .expect(400);
  });
});
