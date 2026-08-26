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
  invoiced: boolean;
}

interface InvoiceBody {
  ref: string;
  totalHT: string;
  totalTTC: string;
  vatRate: string;
}

const BASE_TRIP = {
  countryCode: 'FR',
  pickupAt: '2026-06-01T14:30:00.000Z',
  pickupLocation: 'Nice Airport',
  dropoffLocation: 'Cannes',
  service: 'TSF',
  passengerName: 'John Passenger',
};

describe('Invoices (e2e)', () => {
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

  async function createClient(): Promise<ClientBody> {
    const res = await request(server())
      .post('/api/clients')
      .set('Cookie', cookie)
      .send({
        clientType: 'INDIVIDUAL',
        contactFirstName: 'Jane',
        contactLastName: 'Doe',
        pocPhone: '0611111111',
      })
      .expect(201);
    return res.body as ClientBody;
  }

  async function createTrip(
    client: ClientBody,
    priceEur: number,
  ): Promise<TripBody> {
    const res = await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref, priceEur })
      .expect(201);
    return res.body as TripBody;
  }

  it('recomputes totalHT/totalTTC server-side from the trips, ignoring the caller, and marks trips invoiced', async () => {
    const client = await createClient();
    const t1 = await createTrip(client, 100);
    const t2 = await createTrip(client, 50.5);

    const res = await request(server())
      .post('/api/invoices')
      .set('Cookie', cookie)
      .send({ tripRefs: [t1.ref, t2.ref], clientRef: client.ref })
      .expect(201);
    const invoice = res.body as InvoiceBody;
    expect(invoice.ref).toBe('INV1');
    expect(Number(invoice.totalHT)).toBeCloseTo(150.5);
    expect(Number(invoice.vatRate)).toBeCloseTo(0.1);
    expect(Number(invoice.totalTTC)).toBeCloseTo(165.55);

    const listRes = await request(server())
      .get('/api/trips')
      .set('Cookie', cookie)
      .expect(200);
    const trips = listRes.body as TripBody[];
    expect(trips.find((t) => t.ref === t1.ref)?.invoiced).toBe(true);
    expect(trips.find((t) => t.ref === t2.ref)?.invoiced).toBe(true);
  });

  it('silently drops stale/already-invoiced trip refs, and 400s if nothing is left to invoice', async () => {
    const client = await createClient();
    const t1 = await createTrip(client, 100);

    await request(server())
      .post('/api/invoices')
      .set('Cookie', cookie)
      .send({ tripRefs: [t1.ref, 'NOT-A-REAL-TRIP'], clientRef: client.ref })
      .expect(201);

    // t1 is already invoiced; the stale ref never existed — nothing left.
    await request(server())
      .post('/api/invoices')
      .set('Cookie', cookie)
      .send({ tripRefs: [t1.ref, 'NOT-A-REAL-TRIP'], clientRef: client.ref })
      .expect(400);
  });

  it('requires an existing clientRef or eventRef', async () => {
    await request(server())
      .post('/api/invoices')
      .set('Cookie', cookie)
      .send({ tripRefs: ['R-CI1-26-1'], clientRef: 'NOPE' })
      .expect(400);
  });

  it('lists created invoices', async () => {
    const client = await createClient();
    const t1 = await createTrip(client, 100);
    await request(server())
      .post('/api/invoices')
      .set('Cookie', cookie)
      .send({ tripRefs: [t1.ref], clientRef: client.ref })
      .expect(201);

    const res = await request(server())
      .get('/api/invoices')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body as InvoiceBody[]).toHaveLength(1);
  });
});
