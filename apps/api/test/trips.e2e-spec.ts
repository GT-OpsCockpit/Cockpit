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

  it('the public /notify response never leaks price or the raw client record either', async () => {
    const client = await createClient();
    const created = await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({ ...BASE_TRIP, clientRef: client.ref, priceEur: 250 })
      .expect(201);
    const ref = (created.body as TripBody).ref;

    const res = await request(server())
      .post(`/api/trips/${ref}/notify`)
      .send({ step: 'ACCEPTED' })
      .expect(201);
    const trip = (res.body as { trip: { priceEur?: string; client?: unknown } })
      .trip;
    expect(trip.priceEur).toBeUndefined();
    expect(trip.client).toBeUndefined();
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

  it('resets dispatched on a PUT that edits any field, even without reassigning', async () => {
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
    // The driver was told a pickup point that no longer holds — the Send
    // button has to re-arm so they get the new one (server.js:2470).
    expect((putRes.body as { trip: TripBody }).trip.dispatched).toBe(false);
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

  describe('GET /api/trips/:ref — public projection (used by /driver and /track)', () => {
    interface PublicTripBody {
      ref: string;
      clientName: string;
      pocName: string | null;
      pocPhone: string | null;
      instructions: string | null;
      priceEur?: string;
      partnerRateEur?: string;
      client?: unknown;
      driver?: unknown;
    }

    async function createTrackedTrip() {
      const client = await createClient('0699999999');
      const driver = await createDriver();
      const created = await request(server())
        .post('/api/trips')
        .set('Cookie', cookie)
        .send({
          ...BASE_TRIP,
          service: 'SPEC',
          instructions: 'Handle with care',
          clientRef: client.ref,
          driverRef: driver.ref,
          priceEur: 250,
          partnerRateEur: 100,
        })
        .expect(201);
      return (created.body as TripBody).ref;
    }

    it('never leaks price, partner rate, or the raw client/driver records — track or driver view', async () => {
      const ref = await createTrackedTrip();

      for (const url of [
        `/api/trips/${ref}`,
        `/api/trips/${ref}?viewer=driver`,
      ]) {
        const res = await request(server()).get(url).expect(200);
        const body = res.body as PublicTripBody;
        expect(body.priceEur).toBeUndefined();
        expect(body.partnerRateEur).toBeUndefined();
        expect(body.client).toBeUndefined();
        expect(body.driver).toBeUndefined();
      }
    });

    it('withholds the POC contact and instructions on the track view, but includes them on the driver view', async () => {
      const ref = await createTrackedTrip();

      const trackView = (
        await request(server()).get(`/api/trips/${ref}`).expect(200)
      ).body as PublicTripBody;
      expect(trackView.pocName).toBeNull();
      expect(trackView.pocPhone).toBeNull();
      expect(trackView.instructions).toBeNull();

      const driverView = (
        await request(server())
          .get(`/api/trips/${ref}?viewer=driver`)
          .expect(200)
      ).body as PublicTripBody;
      expect(driverView.pocPhone).toBe('0699999999');
      expect(driverView.instructions).toBe('Handle with care');
    });

    // Regression test for a real race hit manually against the dev stack:
    // React StrictMode's double effect-invoke fires two near-simultaneous
    // GET ?viewer=driver requests on first mount; both see RECEIVED absent
    // and race to insert it, and @@unique([tripId, step]) on TripStep threw
    // P2002 for the loser (a bare 500) before skipDuplicates was added to
    // the createMany in getPublic().
    it('two concurrent opens of the driver link both succeed and stamp RECEIVED exactly once', async () => {
      const client = await createClient();
      const driver = await createDriver();
      const created = await request(server())
        .post('/api/trips')
        .set('Cookie', cookie)
        .send({ ...BASE_TRIP, clientRef: client.ref, driverRef: driver.ref })
        .expect(201);
      const ref = (created.body as TripBody).ref;

      const [first, second] = await Promise.all([
        request(server()).get(`/api/trips/${ref}?viewer=driver`),
        request(server()).get(`/api/trips/${ref}?viewer=driver`),
      ]);
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);

      const finalSteps = (
        await request(server())
          .get(`/api/trips/${ref}?viewer=driver`)
          .expect(200)
      ).body as TripBody;
      expect(
        finalSteps.steps.filter((s) => s.step === 'RECEIVED'),
      ).toHaveLength(1);
      expect(
        finalSteps.steps.filter((s) => s.step === 'TRANSMITTED'),
      ).toHaveLength(1);
    });
  });

  describe('GET /api/trips — server-side date-window filtering', () => {
    // Single source of truth for "what's on the Bookings board" moved from
    // apps/web's trip-status.ts (isPastDay/periodMatches/baseVisibility,
    // recomputed client-side against a full unfiltered fetch) into
    // TripsService.list() — see docs/handoff for the 2026-08-27 session.
    function isoOffsetDays(days: number): string {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString();
    }

    it('defaults to period=upcoming: hides a past-pickup trip, keeps a future one', async () => {
      const client = await createClient();
      const past = await request(server())
        .post('/api/trips')
        .set('Cookie', cookie)
        .send({
          ...BASE_TRIP,
          clientRef: client.ref,
          pickupAt: isoOffsetDays(-2),
        })
        .expect(201);
      const future = await request(server())
        .post('/api/trips')
        .set('Cookie', cookie)
        .send({
          ...BASE_TRIP,
          clientRef: client.ref,
          pickupAt: isoOffsetDays(2),
        })
        .expect(201);

      const list = await request(server())
        .get('/api/trips')
        .set('Cookie', cookie)
        .expect(200);
      const refs = (list.body as TripBody[]).map((t) => t.ref);
      expect(refs).toContain((future.body as TripBody).ref);
      expect(refs).not.toContain((past.body as TripBody).ref);
    });

    async function seedPastPair() {
      const client = await createClient();
      const driver = await createDriver();
      const pastAssigned = await request(server())
        .post('/api/trips')
        .set('Cookie', cookie)
        .send({
          ...BASE_TRIP,
          clientRef: client.ref,
          pickupAt: isoOffsetDays(-2),
          driverRef: driver.ref,
        })
        .expect(201);
      const pastUnassigned = await request(server())
        .post('/api/trips')
        .set('Cookie', cookie)
        .send({
          ...BASE_TRIP,
          clientRef: client.ref,
          pickupAt: isoOffsetDays(-2),
        })
        .expect(201);
      return {
        assignedRef: (pastAssigned.body as TripBody).ref,
        unassignedRef: (pastUnassigned.body as TripBody).ref,
      };
    }

    it('board=true hides a past+assigned trip, but keeps a past+unassigned one (needs-attention backlog)', async () => {
      const { assignedRef, unassignedRef } = await seedPastPair();

      const list = await request(server())
        .get('/api/trips?period=all&board=true')
        .set('Cookie', cookie)
        .expect(200);
      const refs = (list.body as TripBody[]).map((t) => t.ref);
      expect(refs).not.toContain(assignedRef);
      expect(refs).toContain(unassignedRef);
    });

    it('period=all without board returns past assigned trips — Invoicing bills completed months', async () => {
      const { assignedRef, unassignedRef } = await seedPastPair();

      const list = await request(server())
        .get('/api/trips?period=all')
        .set('Cookie', cookie)
        .expect(200);
      const refs = (list.body as TripBody[]).map((t) => t.ref);
      expect(refs).toContain(assignedRef);
      expect(refs).toContain(unassignedRef);
    });

    it('the default category (daily) excludes Events-client trips, regardless of period', async () => {
      const eventClient = await request(server())
        .post('/api/clients')
        .set('Cookie', cookie)
        .send({
          clientType: 'EVENT',
          company: 'Grand Prix',
          eventCountry: 'MC',
          eventArea: 'Monaco',
          eventStartDate: isoOffsetDays(1),
          eventEndDate: isoOffsetDays(3),
          pocPhone: '0611111111',
        })
        .expect(201);
      const trip = await request(server())
        .post('/api/trips')
        .set('Cookie', cookie)
        .send({
          ...BASE_TRIP,
          clientRef: (eventClient.body as ClientBody).ref,
          pickupAt: isoOffsetDays(1),
        })
        .expect(201);

      const list = await request(server())
        .get('/api/trips?period=all')
        .set('Cookie', cookie)
        .expect(200);
      const refs = (list.body as TripBody[]).map((t) => t.ref);
      expect(refs).not.toContain((trip.body as TripBody).ref);
    });

    it('rejects an invalid period value', async () => {
      await request(server())
        .get('/api/trips?period=nonsense')
        .set('Cookie', cookie)
        .expect(400);
    });
  });

  describe('GET /api/trips?category=… — Planning Gantt Daily/Event/All toggle', () => {
    function isoOffsetDays(days: number): string {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString();
    }

    async function createEventClient(): Promise<ClientBody> {
      const res = await request(server())
        .post('/api/clients')
        .set('Cookie', cookie)
        .send({
          clientType: 'EVENT',
          company: 'Grand Prix',
          eventCountry: 'MC',
          eventArea: 'Monaco',
          eventStartDate: isoOffsetDays(1),
          eventEndDate: isoOffsetDays(3),
          pocPhone: '0611111111',
        })
        .expect(201);
      return res.body as ClientBody;
    }

    it('category=event returns only Events-client trips; category=all returns both', async () => {
      const client = await createClient();
      const eventClient = await createEventClient();
      const dailyTrip = await request(server())
        .post('/api/trips')
        .set('Cookie', cookie)
        .send({
          ...BASE_TRIP,
          clientRef: client.ref,
          pickupAt: isoOffsetDays(1),
        })
        .expect(201);
      const eventTrip = await request(server())
        .post('/api/trips')
        .set('Cookie', cookie)
        .send({
          ...BASE_TRIP,
          clientRef: eventClient.ref,
          pickupAt: isoOffsetDays(1),
        })
        .expect(201);

      const eventOnly = await request(server())
        .get('/api/trips?period=all&category=event')
        .set('Cookie', cookie)
        .expect(200);
      const eventRefs = (eventOnly.body as TripBody[]).map((t) => t.ref);
      expect(eventRefs).toContain((eventTrip.body as TripBody).ref);
      expect(eventRefs).not.toContain((dailyTrip.body as TripBody).ref);

      const all = await request(server())
        .get('/api/trips?period=all&category=all')
        .set('Cookie', cookie)
        .expect(200);
      const allRefs = (all.body as TripBody[]).map((t) => t.ref);
      expect(allRefs).toContain((eventTrip.body as TripBody).ref);
      expect(allRefs).toContain((dailyTrip.body as TripBody).ref);
    });

    it('rejects an invalid category value', async () => {
      await request(server())
        .get('/api/trips?category=nonsense')
        .set('Cookie', cookie)
        .expect(400);
    });
  });

  describe('PATCH /api/trips/:ref/assign — Planning Gantt drag&drop', () => {
    interface FullTripBody extends TripBody {
      fleetVehicleId: string | null;
      vehicleType: { name: string } | null;
    }

    // Make/Model must be a valid combination for the given Category (see
    // CATEGORY_MODELS, apps/api/src/common/constants/fleet.ts).
    const MAKE_MODEL_BY_CATEGORY: Record<
      string,
      { make: string; model: string }
    > = {
      Business: { make: 'Mercedes-Benz', model: 'E-Class' },
      SUV: { make: 'Mercedes-Benz', model: 'GLE' },
    };

    async function createFleetVehicle(
      category: string,
      regNbr: string,
    ): Promise<{ ref: string; regNbr: string }> {
      const res = await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send({
          category,
          regNbr,
          ...MAKE_MODEL_BY_CATEGORY[category],
          yearOfBuild: new Date().getFullYear() - 1,
          fourWD: false,
          nbPax: 3,
        })
        .expect(201);
      return res.body as { ref: string; regNbr: string };
    }

    it('reassigning the driver via /assign resets steps/dispatched/assignmentCancelled, same as the full PUT', async () => {
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

      const res = await request(server())
        .patch(`/api/trips/${ref}/assign`)
        .set('Cookie', cookie)
        .send({ driverRef: driverB.ref })
        .expect(200);
      const updated = (res.body as { trip: TripBody }).trip;
      expect(updated.driverId).not.toBeNull();
      expect(updated.steps).toEqual([]);
      expect(updated.dispatched).toBe(false);
    });

    it('an empty driverRef unassigns the driver', async () => {
      const client = await createClient();
      const driver = await createDriver();
      const created = await request(server())
        .post('/api/trips')
        .set('Cookie', cookie)
        .send({ ...BASE_TRIP, clientRef: client.ref, driverRef: driver.ref })
        .expect(201);

      const res = await request(server())
        .patch(`/api/trips/${(created.body as TripBody).ref}/assign`)
        .set('Cookie', cookie)
        .send({ driverRef: '' })
        .expect(200);
      expect((res.body as { trip: TripBody }).trip.driverId).toBeNull();
    });

    it('reassigning the fleet vehicle alone resets dispatched but keeps the steps (unlike a driver reassignment)', async () => {
      const client = await createClient();
      const driver = await createDriver();
      const vehicle = await createFleetVehicle('Business', 'AB-123-CD');
      const created = await request(server())
        .post('/api/trips')
        .set('Cookie', cookie)
        .send({
          ...BASE_TRIP,
          clientRef: client.ref,
          driverRef: driver.ref,
          vehicleType: 'Business',
          fleetRegNbr: vehicle.regNbr,
        })
        .expect(201);
      const ref = (created.body as TripBody).ref;
      await request(server())
        .post(`/api/trips/${ref}/dispatch-driver`)
        .set('Cookie', cookie)
        .expect(201);

      const vehicle2 = await createFleetVehicle('Business', 'EF-456-GH');
      const res = await request(server())
        .patch(`/api/trips/${ref}/assign`)
        .set('Cookie', cookie)
        .send({ fleetRegNbr: vehicle2.regNbr })
        .expect(200);
      const updated = res.body as { trip: FullTripBody };
      expect(updated.trip.fleetVehicleId).not.toBeNull();
      // Re-armed: the driver was told which car to take, and it changed.
      expect(updated.trip.dispatched).toBe(false);
      // ...but the pipeline itself doesn't restart — only a change of
      // assignee wipes the recorded progress.
      expect(updated.trip.steps.length).toBeGreaterThan(0);
    });

    it("rejects a fleet vehicle whose category is incompatible with the trip's vehicleType", async () => {
      const client = await createClient();
      const vehicle = await createFleetVehicle('SUV', 'AB-123-CD');
      const created = await request(server())
        .post('/api/trips')
        .set('Cookie', cookie)
        .send({ ...BASE_TRIP, clientRef: client.ref, vehicleType: 'Business' })
        .expect(201);

      await request(server())
        .patch(`/api/trips/${(created.body as TripBody).ref}/assign`)
        .set('Cookie', cookie)
        .send({ fleetRegNbr: vehicle.regNbr })
        .expect(400);
    });

    it('rejects an unresolvable driverRef/fleetRegNbr', async () => {
      const client = await createClient();
      const created = await request(server())
        .post('/api/trips')
        .set('Cookie', cookie)
        .send({ ...BASE_TRIP, clientRef: client.ref })
        .expect(201);
      const ref = (created.body as TripBody).ref;

      await request(server())
        .patch(`/api/trips/${ref}/assign`)
        .set('Cookie', cookie)
        .send({ driverRef: 'NOPE' })
        .expect(400);
      await request(server())
        .patch(`/api/trips/${ref}/assign`)
        .set('Cookie', cookie)
        .send({ fleetRegNbr: 'NOPE' })
        .expect(400);
    });
  });
  // Ported from autoAssignLinkedVehicleInBookingBar / quickUpdateTrip
  // (common.js:989/3320): a partner chauffeur's reserved vehicle is honoured
  // rather than left informational. Server-side here, so create, update and
  // the Planning drag & drop all get it from one place.
  describe('reserved vehicle auto-assignment', () => {
    async function createReservedPair(regNbr = 'ZZ-999-ZZ') {
      const driverRes = await request(server())
        .post('/api/drivers')
        .set('Cookie', cookie)
        .send({
          firstName: 'Res',
          lastName: 'Erved',
          phone: '0699999999',
          company: 'Uber Elite',
          email: 'reserved@example.com',
        })
        .expect(201);
      const driver = driverRes.body as DriverBody;

      const vehicleRes = await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send({
          category: 'Business',
          regNbr,
          make: 'Mercedes-Benz',
          model: 'E-Class',
          yearOfBuild: new Date().getFullYear() - 1,
          fourWD: false,
          nbPax: 3,
          isLocal: false,
          countryCode: 'FR',
          area: 'Nice',
          partnerCompany: 'Uber Elite',
          driverRef: driver.ref,
        })
        .expect(201);
      return { driver, vehicle: vehicleRes.body as { ref: string } };
    }

    async function createPlainVehicle(
      category: string,
      regNbr: string,
      model: string,
    ): Promise<{ ref: string; regNbr: string }> {
      const res = await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send({
          category,
          regNbr,
          make: 'Mercedes-Benz',
          model,
          yearOfBuild: new Date().getFullYear() - 1,
          fourWD: false,
          nbPax: 3,
        })
        .expect(201);
      return res.body as { ref: string; regNbr: string };
    }

    it('attaches the reserved vehicle when a booking is created with that driver and no Reg Nbr', async () => {
      const client = await createClient();
      const { driver, vehicle } = await createReservedPair();

      const res = await request(server())
        .post('/api/trips')
        .set('Cookie', cookie)
        .send({
          ...BASE_TRIP,
          clientRef: client.ref,
          driverRef: driver.ref,
          vehicleType: 'Business',
        })
        .expect(201);
      expect(
        (res.body as { fleetVehicle: { ref: string } | null }).fleetVehicle
          ?.ref,
      ).toBe(vehicle.ref);
    });

    it('never overrides a Reg Nbr the dispatcher named explicitly', async () => {
      const client = await createClient();
      const { driver } = await createReservedPair();
      const chosen = await createPlainVehicle(
        'Business',
        'YY-888-YY',
        'E-Class',
      );

      const res = await request(server())
        .post('/api/trips')
        .set('Cookie', cookie)
        .send({
          ...BASE_TRIP,
          clientRef: client.ref,
          driverRef: driver.ref,
          vehicleType: 'Business',
          fleetRegNbr: chosen.regNbr,
        })
        .expect(201);
      expect(
        (res.body as { fleetVehicle: { regNbr: string } | null }).fleetVehicle
          ?.regNbr,
      ).toBe(chosen.regNbr);
    });

    it('skips a reserved vehicle whose category is incompatible with the booking', async () => {
      const client = await createClient();
      const { driver } = await createReservedPair();

      const res = await request(server())
        .post('/api/trips')
        .set('Cookie', cookie)
        .send({
          ...BASE_TRIP,
          clientRef: client.ref,
          driverRef: driver.ref,
          // The reserved vehicle is a Business; a Van booking can't use it.
          vehicleType: 'Van',
          paxCount: 1,
        })
        .expect(201);
      expect(
        (res.body as { fleetVehicleId: string | null }).fleetVehicleId,
      ).toBeNull();
    });

    it('applies on the Planning drag & drop too (PATCH /assign)', async () => {
      const client = await createClient();
      const { driver, vehicle } = await createReservedPair();
      const created = await request(server())
        .post('/api/trips')
        .set('Cookie', cookie)
        .send({ ...BASE_TRIP, clientRef: client.ref, vehicleType: 'Business' })
        .expect(201);

      const res = await request(server())
        .patch(`/api/trips/${(created.body as TripBody).ref}/assign`)
        .set('Cookie', cookie)
        .send({ driverRef: driver.ref })
        .expect(200);
      expect(
        (res.body as { trip: { fleetVehicle: { ref: string } | null } }).trip
          .fleetVehicle?.ref,
      ).toBe(vehicle.ref);
    });
  });
  // Changing who meets the passenger only makes sense while nobody is on site
  // yet — the legacy greyed the POC fields out from "In position" onwards
  // (isBeforeArrival, common.js:2391). Not a permission: no role lifts it.
  describe('the POC stops being editable once the driver is in position', () => {
    async function tripAtArrived() {
      const client = await createClient();
      const driver = await createDriver();
      const created = await request(server())
        .post('/api/trips')
        .set('Cookie', cookie)
        .send({
          ...BASE_TRIP,
          clientRef: client.ref,
          driverRef: driver.ref,
          pocName: 'Sophie Durand',
          pocPhone: '0633333333',
        })
        .expect(201);
      const trip = created.body as TripBody;

      await request(server())
        .post(`/api/trips/${trip.ref}/dispatch-driver`)
        .set('Cookie', cookie)
        .expect(201);
      await request(server())
        .get(`/api/trips/${trip.ref}?viewer=driver`)
        .expect(200);
      // TRANSMITTED + RECEIVED are stamped above; ACCEPTED → ENROUTE → ARRIVED.
      for (let i = 0; i < 3; i++) {
        await request(server())
          .post(`/api/trips/${trip.ref}/advance-step`)
          .set('Cookie', cookie)
          .expect(201);
      }
      return { trip, client, driver };
    }

    const putBody = (
      trip: TripBody,
      client: ClientBody,
      driver: DriverBody,
      overrides: Record<string, unknown>,
    ) => ({
      ...BASE_TRIP,
      clientRef: client.ref,
      driverRef: driver.ref,
      pocName: 'Sophie Durand',
      pocPhone: '0633333333',
      ...overrides,
    });

    it('refuses a POC change from "In position" onwards', async () => {
      const { trip, client, driver } = await tripAtArrived();

      await request(server())
        .put(`/api/trips/${trip.ref}`)
        .set('Cookie', cookie)
        .send(putBody(trip, client, driver, { pocName: 'Someone Else' }))
        .expect(400);

      await request(server())
        .put(`/api/trips/${trip.ref}`)
        .set('Cookie', cookie)
        .send(putBody(trip, client, driver, { pocPhone: '0644444444' }))
        .expect(400);
    });

    it('still allows every other edit on the same trip', async () => {
      const { trip, client, driver } = await tripAtArrived();

      await request(server())
        .put(`/api/trips/${trip.ref}`)
        .set('Cookie', cookie)
        .send(putBody(trip, client, driver, { instructions: 'Gate B' }))
        .expect(200);
    });

    it('allows a POC change while the driver is still on the way', async () => {
      const client = await createClient();
      const driver = await createDriver();
      const created = await request(server())
        .post('/api/trips')
        .set('Cookie', cookie)
        .send({
          ...BASE_TRIP,
          clientRef: client.ref,
          driverRef: driver.ref,
          pocName: 'Sophie Durand',
          pocPhone: '0633333333',
        })
        .expect(201);
      const trip = created.body as TripBody;

      await request(server())
        .post(`/api/trips/${trip.ref}/dispatch-driver`)
        .set('Cookie', cookie)
        .expect(201);
      await request(server())
        .get(`/api/trips/${trip.ref}?viewer=driver`)
        .expect(200);
      // ACCEPTED → ENROUTE, one short of ARRIVED.
      for (let i = 0; i < 2; i++) {
        await request(server())
          .post(`/api/trips/${trip.ref}/advance-step`)
          .set('Cookie', cookie)
          .expect(201);
      }

      await request(server())
        .put(`/api/trips/${trip.ref}`)
        .set('Cookie', cookie)
        .send(putBody(trip, client, driver, { pocName: 'Someone Else' }))
        .expect(200);
    });
  });
});
