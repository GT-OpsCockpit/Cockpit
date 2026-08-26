import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';
import { resetDatabase, TEST_ADMIN } from './utils/reset-db';
import { loginAs } from './utils/auth';
import { PrismaService } from '../src/prisma/prisma.service';
import { InMemoryWhatsAppProvider } from './utils/in-memory-whatsapp.provider';

interface TripBody {
  ref: string;
  driverId: string | null;
  dispatched: boolean;
  assignmentCancelled: boolean;
  tracking: boolean;
  steps: { step: string }[];
  instructions: string | null;
}

interface ClientBody {
  ref: string;
  pocPhone: string;
}

interface DriverBody {
  ref: string;
}

describe('Trips (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let whatsapp: InMemoryWhatsAppProvider;
  let cookie: string;

  beforeAll(async () => {
    ({ app, whatsapp } = await createTestApp());
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    whatsapp.clear();
    cookie = await loginAs(app, TEST_ADMIN.email, TEST_ADMIN.password);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  async function createClient(pocPhone = '0611111111'): Promise<ClientBody> {
    const res = await request(server())
      .post('/api/clients')
      .set('Cookie', cookie)
      .send({
        clientType: 'INDIVIDUAL',
        contactFirstName: 'Jane',
        contactLastName: 'Doe',
        pocPhone,
      })
      .expect(201);
    return res.body as ClientBody;
  }

  async function createDriver(phone = '0622222222'): Promise<DriverBody> {
    const res = await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ firstName: 'Bob', lastName: 'Driver', phone })
      .expect(201);
    return res.body as DriverBody;
  }

  const BASE_TRIP = {
    countryCode: 'FR',
    pickupAt: '2026-06-01T14:30:00.000Z',
    pickupLocation: 'Nice Airport',
    dropoffLocation: 'Cannes',
    service: 'TSF',
    passengerName: 'John Passenger',
  };

  it('creates a trip with an auto-generated R-{clientRef}-{YY}-{seq} ref', async () => {
    const client = await createClient();
    const res = await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref })
      .expect(201);
    const yy = String(new Date().getFullYear()).slice(-2);
    expect((res.body as TripBody).ref).toBe(`R-${client.ref}-${yy}-1`);
  });

  it('enforces service-specific rules: ASD needs hours 2-48, SPEC needs instructions, others need a dropoff', async () => {
    const client = await createClient();

    await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref, dropoffLocation: undefined })
      .expect(400);

    await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({
        ...BASE_TRIP,
        clientRef: client.ref,
        service: 'ASD',
        dropoffLocation: undefined,
        hours: 1,
      })
      .expect(400);
    await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({
        ...BASE_TRIP,
        clientRef: client.ref,
        service: 'ASD',
        dropoffLocation: undefined,
        hours: 4,
      })
      .expect(201);

    await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref, service: 'SPEC' })
      .expect(400);
    await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({
        ...BASE_TRIP,
        clientRef: client.ref,
        service: 'SPEC',
        instructions: 'Handle with care',
      })
      .expect(201);
  });

  it('requires an existing client and rejects a paxCount over the vehicle capacity', async () => {
    await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: 'NOPE' })
      .expect(400);

    const client = await createClient();
    await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({
        ...BASE_TRIP,
        clientRef: client.ref,
        vehicleType: 'Business',
        paxCount: 10,
      })
      .expect(400);
  });

  it('resolves the POC phone from the client account when the trip has none, and 400s when neither has one', async () => {
    const client = await createClient('');
    await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref })
      .expect(400);

    const res = await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref, pocPhone: '0699999999' })
      .expect(201);
    expect((res.body as unknown as { pocPhone: string }).pocPhone).toBe(
      '0699999999',
    );
  });

  it('never hands out the same ref to two concurrent creations racing on the same freed sequence', async () => {
    const client = await createClient();
    const t1 = await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref })
      .expect(201);
    const t2 = await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref })
      .expect(201);
    await request(server())
      .post(`/api/trips/${(t1.body as TripBody).ref}/cancel-assignment`)
      .set('Cookie', cookie)
      .send({})
      .expect(201);
    await request(server())
      .post(`/api/trips/${(t2.body as TripBody).ref}/cancel-assignment`)
      .set('Cookie', cookie)
      .send({})
      .expect(201);

    const [a, b] = await Promise.all([
      request(server())
        .post('/api/trips')
        .set('Cookie', cookie)
        .send({ ...BASE_TRIP, clientRef: client.ref }),
      request(server())
        .post('/api/trips')
        .set('Cookie', cookie)
        .send({ ...BASE_TRIP, clientRef: client.ref }),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect((a.body as TripBody).ref).not.toBe((b.body as TripBody).ref);
  });

  it('reuses the smallest freed sequence number after a free cancellation', async () => {
    const client = await createClient();
    const t1 = await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref })
      .expect(201);
    await request(server())
      .post(`/api/trips/${(t1.body as TripBody).ref}/cancel-assignment`)
      .set('Cookie', cookie)
      .send({})
      .expect(201);

    const t2 = await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref })
      .expect(201);
    expect((t2.body as TripBody).ref).toBe((t1.body as TripBody).ref);
  });

  it('runs the full pipeline from creation to dropped, sending a WhatsApp message to the POC at each real step', async () => {
    const client = await createClient();
    const driver = await createDriver();
    const created = await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref, driverRef: driver.ref })
      .expect(201);
    const ref = (created.body as TripBody).ref;

    await request(server())
      .post(`/api/trips/${ref}/dispatch-driver`)
      .set('Cookie', cookie)
      .expect(201);
    expect(whatsapp.sent).toHaveLength(1);
    expect(whatsapp.sent[0].phone).toBe('0622222222'); // to the driver, not the POC

    // Public driver page opening the link auto-stamps "received".
    const publicView = await request(server())
      .get(`/api/trips/${ref}?viewer=driver`)
      .expect(200);
    expect((publicView.body as TripBody).steps.map((s) => s.step)).toEqual(
      expect.arrayContaining(['TRANSMITTED', 'RECEIVED']),
    );

    for (let i = 0; i < 5; i++) {
      await request(server())
        .post(`/api/trips/${ref}/advance-step`)
        .set('Cookie', cookie)
        .expect(201);
    }
    // 1 (dispatch-driver, to driver) + 5 (real steps, to POC).
    expect(whatsapp.sent).toHaveLength(6);
    expect(
      whatsapp.sent.slice(1).every((m) => m.phone === client.pocPhone),
    ).toBe(true);

    await request(server())
      .post(`/api/trips/${ref}/advance-step`)
      .set('Cookie', cookie)
      .expect(400);
  });

  it('the public /notify endpoint records the step it is given directly, without enforcing pipeline order', async () => {
    const client = await createClient();
    const created = await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref })
      .expect(201);
    const ref = (created.body as TripBody).ref;

    await request(server())
      .post(`/api/trips/${ref}/notify`)
      .send({ step: 'DROPPED' })
      .expect(201);
    expect(whatsapp.sent).toHaveLength(1);
    const trip = await request(server()).get(`/api/trips/${ref}`).expect(200);
    expect((trip.body as TripBody).steps.map((s) => s.step)).toEqual([
      'DROPPED',
    ]);
  });

  it('skips the WhatsApp send (but still records the step) when tracking is disabled', async () => {
    const client = await createClient();
    const created = await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref, tracking: false })
      .expect(201);
    const ref = (created.body as TripBody).ref;

    const res = await request(server())
      .post(`/api/trips/${ref}/notify`)
      .send({ step: 'ACCEPTED' })
      .expect(201);
    expect((res.body as { skipped: boolean }).skipped).toBe(true);
    expect(whatsapp.sent).toHaveLength(0);
  });

  it('surfaces a 500 when the WhatsApp provider fails during advance-step', async () => {
    const client = await createClient();
    const driver = await createDriver();
    const created = await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref, driverRef: driver.ref })
      .expect(201);
    const ref = (created.body as TripBody).ref;

    // advance to "accepted" territory: transmitted, received, then a real step that fails.
    await request(server())
      .post(`/api/trips/${ref}/advance-step`)
      .set('Cookie', cookie)
      .expect(201); // transmitted
    await request(server())
      .post(`/api/trips/${ref}/advance-step`)
      .set('Cookie', cookie)
      .expect(201); // received
    whatsapp.failNext = true;
    await request(server())
      .post(`/api/trips/${ref}/advance-step`)
      .set('Cookie', cookie)
      .expect(500); // accepted: fails
  });

  it('reassigning the driver resets steps/dispatched/assignmentCancelled', async () => {
    const client = await createClient();
    const driverA = await createDriver('0622222222');
    const driverB = await createDriver('0633333333');
    const created = await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref, driverRef: driverA.ref })
      .expect(201);
    const ref = (created.body as TripBody).ref;

    await request(server())
      .post(`/api/trips/${ref}/dispatch-driver`)
      .set('Cookie', cookie)
      .expect(201);
    await request(server())
      .post(`/api/trips/${ref}/advance-step`)
      .set('Cookie', cookie)
      .expect(201); // received

    const putRes = await request(server())
      .put(`/api/trips/${ref}`)
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref, driverRef: driverB.ref })
      .expect(200);
    const updated = (putRes.body as { trip: TripBody }).trip;
    expect(updated.steps).toEqual([]);
    expect(updated.dispatched).toBe(false);
  });

  it('cancel-assignment: Free (or no fee) deletes the trip and frees its ref; a paid fee keeps it as a stopped booking', async () => {
    const client = await createClient();
    const driver = await createDriver();

    const freeTrip = await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref, driverRef: driver.ref })
      .expect(201);
    const freeRes = await request(server())
      .post(`/api/trips/${(freeTrip.body as TripBody).ref}/cancel-assignment`)
      .set('Cookie', cookie)
      .send({ cancellationFee: 'FREE' })
      .expect(201);
    expect((freeRes.body as { deleted: boolean }).deleted).toBe(true);
    await request(server())
      .get(`/api/trips/${(freeTrip.body as TripBody).ref}`)
      .expect(404);

    const paidTrip = await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref, driverRef: driver.ref })
      .expect(201);
    const paidRes = await request(server())
      .post(`/api/trips/${(paidTrip.body as TripBody).ref}/cancel-assignment`)
      .set('Cookie', cookie)
      .send({ cancellationFee: 'FIFTY' })
      .expect(201);
    const paidBody = paidRes.body as { trip: TripBody };
    expect(paidBody.trip.assignmentCancelled).toBe(true);
    expect(paidBody.trip.driverId).toBeNull();

    // Blocked from advancing while cancelled.
    await request(server())
      .post(`/api/trips/${(paidTrip.body as TripBody).ref}/advance-step`)
      .set('Cookie', cookie)
      .expect(400);
  });

  it('locks a company-only sub-contract at "Sent" and blocks advance-step', async () => {
    const client = await createClient();
    const created = await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref, subContractor: true })
      .expect(201);
    const trip = created.body as TripBody & { subContractor: boolean };
    expect(trip.dispatched).toBe(true);
    expect(trip.steps.map((s) => s.step)).toEqual(['TRANSMITTED']);

    await request(server())
      .post(`/api/trips/${trip.ref}/advance-step`)
      .set('Cookie', cookie)
      .expect(400);
  });

  it('rejects an unresolvable driverRef/partnerRef instead of silently dropping it', async () => {
    const client = await createClient();
    await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref, driverRef: 'NOPE' })
      .expect(400);
    await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({
        ...BASE_TRIP,
        clientRef: client.ref,
        subContractor: true,
        partnerRef: 'NOPE',
      })
      .expect(400);
  });

  it('does not reset dispatched on a PUT that edits an unrelated field without reassigning', async () => {
    const client = await createClient();
    const driver = await createDriver();
    const created = await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref, driverRef: driver.ref })
      .expect(201);
    const ref = (created.body as TripBody).ref;
    await request(server())
      .post(`/api/trips/${ref}/dispatch-driver`)
      .set('Cookie', cookie)
      .expect(201);

    const putRes = await request(server())
      .put(`/api/trips/${ref}`)
      .set('Cookie', cookie)
      .send({
        ...BASE_TRIP,
        clientRef: client.ref,
        driverRef: driver.ref,
        pickupLocation: 'Nice Airport — Terminal 2',
      })
      .expect(200);
    expect((putRes.body as { trip: TripBody }).trip.dispatched).toBe(true);
  });

  it('clears a stale cancellationFee once the trip is reassigned', async () => {
    const client = await createClient();
    const driverA = await createDriver('0622222222');
    const driverB = await createDriver('0633333333');
    const created = await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref, driverRef: driverA.ref })
      .expect(201);
    const ref = (created.body as TripBody).ref;
    await request(server())
      .post(`/api/trips/${ref}/cancel-assignment`)
      .set('Cookie', cookie)
      .send({ cancellationFee: 'FIFTY' })
      .expect(201);

    const putRes = await request(server())
      .put(`/api/trips/${ref}`)
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref, driverRef: driverB.ref })
      .expect(200);
    const updated = (
      putRes.body as { trip: TripBody & { cancellationFee: string | null } }
    ).trip;
    expect(updated.cancellationFee).toBeNull();
    expect(updated.assignmentCancelled).toBe(false);
  });

  it('blocks the public /notify endpoint once the trip is cancelled', async () => {
    const client = await createClient();
    const driver = await createDriver();
    const created = await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref, driverRef: driver.ref })
      .expect(201);
    const ref = (created.body as TripBody).ref;
    await request(server())
      .post(`/api/trips/${ref}/cancel-assignment`)
      .set('Cookie', cookie)
      .send({ cancellationFee: 'FIFTY' })
      .expect(201);

    await request(server())
      .post(`/api/trips/${ref}/notify`)
      .send({ step: 'DROPPED' })
      .expect(400);
  });

  it('sends the partner name (not "null") on a sub-contracted, partner-assigned trip', async () => {
    const client = await createClient();
    const partner = await createDriver('0644444444');
    const created = await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({
        ...BASE_TRIP,
        clientRef: client.ref,
        subContractor: true,
        partnerRef: partner.ref,
      })
      .expect(201);
    const ref = (created.body as TripBody).ref;

    await request(server())
      .post(`/api/trips/${ref}/advance-step`)
      .set('Cookie', cookie)
      .expect(201); // transmitted (not locked: a partner is already assigned)
    await request(server())
      .post(`/api/trips/${ref}/advance-step`)
      .set('Cookie', cookie)
      .expect(201); // received
    await request(server())
      .post(`/api/trips/${ref}/advance-step`)
      .set('Cookie', cookie)
      .expect(201); // accepted: real WhatsApp send to the POC

    const lastMessage = whatsapp.sent[whatsapp.sent.length - 1];
    expect(lastMessage.body).not.toContain('null');
    expect(lastMessage.body).toContain('Bob Driver');
  });

  it('auto-stamps RECEIVED (and TRANSMITTED if missing) when a partner opens the public tracking link', async () => {
    const client = await createClient();
    const partner = await createDriver('0655555555');
    const created = await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({
        ...BASE_TRIP,
        clientRef: client.ref,
        subContractor: true,
        partnerRef: partner.ref,
      })
      .expect(201);
    const ref = (created.body as TripBody).ref;

    const publicView = await request(server())
      .get(`/api/trips/${ref}?viewer=driver`)
      .expect(200);
    expect((publicView.body as TripBody).steps.map((s) => s.step)).toEqual(
      expect.arrayContaining(['TRANSMITTED', 'RECEIVED']),
    );
  });
});
