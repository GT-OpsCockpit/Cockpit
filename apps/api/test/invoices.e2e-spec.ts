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
        pocPhone: '+33611111111',
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

    // period=all: BASE_TRIP's fixed pickupAt is unrelated to "is this trip
    // recent" — the default (period=upcoming) would drop it out of view
    // once that date is in the past, which isn't what this assertion cares
    // about (it's checking `invoiced`, not date-window visibility).
    const listRes = await request(server())
      .get('/api/trips?period=all')
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

  it('never double-invoices a trip under two concurrent requests for the same ref', async () => {
    const client = await createClient();
    const t1 = await createTrip(client, 100);

    const [a, b] = await Promise.all([
      request(server())
        .post('/api/invoices')
        .set('Cookie', cookie)
        .send({ tripRefs: [t1.ref], clientRef: client.ref }),
      request(server())
        .post('/api/invoices')
        .set('Cookie', cookie)
        .send({ tripRefs: [t1.ref], clientRef: client.ref }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 400]);

    const list = await request(server())
      .get('/api/invoices')
      .set('Cookie', cookie)
      .expect(200);
    const invoices = list.body as (InvoiceBody & {
      trips: { trip: TripBody }[];
    })[];
    expect(invoices).toHaveLength(1);
    expect(invoices[0].trips).toHaveLength(1);
  });

  it('requires an existing clientRef or eventRef', async () => {
    await request(server())
      .post('/api/invoices')
      .set('Cookie', cookie)
      .send({ tripRefs: ['R-CI1-26-1'], clientRef: 'NOPE' })
      .expect(400);
  });

  // The browser used to work the opening period out itself by scanning every
  // unbilled trip it had downloaded, which is why the Customer tab asked for
  // the whole history (period=all).
  describe('GET /api/invoices/default-period', () => {
    async function tripAt(
      client: ClientBody,
      pickupAt: string,
    ): Promise<TripBody> {
      const res = await request(server())
        .post('/api/trips')
        .set('Cookie', cookie)
        .send({ ...BASE_TRIP, clientRef: client.ref, pickupAt, priceEur: 100 })
        .expect(201);
      return res.body as TripBody;
    }

    const period = async () => {
      const res = await request(server())
        .get('/api/invoices/default-period')
        .set('Cookie', cookie)
        .expect(200);
      return res.body as { start: string; end: string };
    };

    function previousMonth(): { start: string; end: string } {
      const now = new Date();
      const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
      );
      const end = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0),
      );
      return {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      };
    }

    it('opens on last month when nothing older is waiting to be billed', async () => {
      expect(await period()).toEqual(previousMonth());
    });

    it('reaches back to the month of the oldest unbilled booking', async () => {
      const client = await createClient();
      await tripAt(client, '2024-11-20T10:00:00.000Z');
      expect(await period()).toEqual({
        start: '2024-11-01',
        end: previousMonth().end,
      });
    });

    // This tab is the only place an Events booking can be invoiced from, so
    // its opening period has to account for one — same as the legacy, which
    // read the full trip list here (invoicing.html:226).
    it('counts an Events-account booking, which this tab bills too', async () => {
      const eventClient = await request(server())
        .post('/api/clients')
        .set('Cookie', cookie)
        .send({
          clientType: 'EVENT',
          company: 'Grand Prix',
          eventCountry: 'MC',
          eventArea: 'Monaco',
          eventStartDate: '2024-11-18',
          eventEndDate: '2024-11-25',
          pocPhone: '+33612121212',
        })
        .expect(201);
      await tripAt(eventClient.body as ClientBody, '2024-11-20T10:00:00.000Z');

      expect(await period()).toEqual({
        start: '2024-11-01',
        end: previousMonth().end,
      });
    });

    it('ignores a booking once it has been invoiced — that backlog is cleared', async () => {
      const client = await createClient();
      const old = await tripAt(client, '2024-11-20T10:00:00.000Z');
      await request(server())
        .post('/api/invoices')
        .set('Cookie', cookie)
        .send({ tripRefs: [old.ref], clientRef: client.ref })
        .expect(201);

      expect(await period()).toEqual(previousMonth());
    });
  });

  it('unbilled=true keeps only the bookings still to be billed', async () => {
    const client = await createClient();
    const billed = await createTrip(client, 100);
    const pending = await createTrip(client, 50);
    await request(server())
      .post('/api/invoices')
      .set('Cookie', cookie)
      .send({ tripRefs: [billed.ref], clientRef: client.ref })
      .expect(201);

    const list = await request(server())
      .get('/api/trips?period=all&unbilled=true')
      .set('Cookie', cookie)
      .expect(200);
    const refs = (list.body as TripBody[]).map((t) => t.ref);
    expect(refs).toContain(pending.ref);
    expect(refs).not.toContain(billed.ref);
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

  // The "Category" column of an invoice PDF/Excel names the trip's vehicle
  // type. It used to be resolved client-side against GET /meta, which only
  // lists *active* types — so retiring a type silently blanked that column on
  // every invoice already issued with it. An invoice is immutable: it has to
  // carry the type it was billed with.
  it("carries each billed trip's vehicle type, including one retired since", async () => {
    const client = await createClient();
    const type = await request(server())
      .post('/api/vehicles')
      .set('Cookie', cookie)
      .send({ name: 'Retired Class', maxPax: 3 })
      .expect(201);
    const typeName = (type.body as { name: string }).name;

    const created = await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({
        ...BASE_TRIP,
        clientRef: client.ref,
        priceEur: 100,
        vehicleType: typeName,
      })
      .expect(201);
    const trip = created.body as TripBody;

    await request(server())
      .post('/api/invoices')
      .set('Cookie', cookie)
      .send({ clientRef: client.ref, tripRefs: [trip.ref] })
      .expect(201);

    await request(server())
      .patch(`/api/vehicles/${(type.body as { ref: string }).ref}/active`)
      .set('Cookie', cookie)
      .send({ active: false })
      .expect(200);

    const invoices = await request(server())
      .get('/api/invoices')
      .set('Cookie', cookie)
      .expect(200);

    const billed = (
      invoices.body as {
        trips: { trip: { vehicleType: { name: string } | null } }[];
      }[]
    )[0].trips[0].trip;
    expect(billed.vehicleType?.name).toBe('Retired Class');
  });
});
