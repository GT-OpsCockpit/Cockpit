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
}

// Same shape as trips.e2e-spec.ts's BASE_TRIP — deliberately dated in the
// past (relative to "today" in this test environment) so it doubles as the
// trip:edit-past fixture without a separate helper.
const PAST_TRIP = {
  countryCode: 'FR',
  pickupAt: '2026-06-01T14:30:00.000Z',
  pickupLocation: 'Nice Airport',
  dropoffLocation: 'Cannes',
  service: 'TSF',
  passengerName: 'John Passenger',
};
const FUTURE_TRIP = { ...PAST_TRIP, pickupAt: '2027-06-01T14:30:00.000Z' };

const DISPATCHER = {
  email: 'dispatcher@test.local',
  password: 'dispatcher-password',
};

/**
 * Covers the RBAC layer itself (common/permissions/permissions.ts,
 * RequirePermission + PermissionsGuard, and the conditional `can()` checks
 * inside TripsService.update) — the v2 replacement for the legacy's
 * promptAdminPassword gate. See docs/agents/permissions.md for the full
 * design and the legacy-fidelity table. Individual features' own business
 * rules (e.g. trip creation validation) stay in their own spec files; this
 * one only asserts who is and isn't allowed to act.
 */
describe('Permissions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminCookie: string;
  let dispatcherCookie: string;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    prisma = app.get(PrismaService);
  });

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  beforeEach(async () => {
    await resetDatabase(prisma);
    adminCookie = await loginAs(app, TEST_ADMIN.email, TEST_ADMIN.password);

    await request(server())
      .post('/api/users')
      .set('Cookie', adminCookie)
      .send({
        email: DISPATCHER.email,
        password: DISPATCHER.password,
        role: 'DISPATCHER',
        firstName: 'Dana',
        lastName: 'Dispatcher',
      })
      .expect(201);
    dispatcherCookie = await loginAs(
      app,
      DISPATCHER.email,
      DISPATCHER.password,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  async function createClient(pocPhone = '0611111111'): Promise<ClientBody> {
    const res = await request(server())
      .post('/api/clients')
      .set('Cookie', adminCookie)
      .send({
        clientType: 'INDIVIDUAL',
        contactFirstName: 'Jane',
        contactLastName: 'Doe',
        pocPhone,
      })
      .expect(201);
    return res.body as ClientBody;
  }

  async function createDriver(phone = '0622222222'): Promise<{ ref: string }> {
    const res = await request(server())
      .post('/api/drivers')
      .set('Cookie', adminCookie)
      .send({ firstName: 'Bob', lastName: 'Driver', phone })
      .expect(201);
    return res.body as { ref: string };
  }

  it("GET /auth/me resolves the caller's role into a permission list", async () => {
    const adminMe = await request(server())
      .get('/api/auth/me')
      .set('Cookie', adminCookie)
      .expect(200);
    expect((adminMe.body as { permissions: string[] }).permissions).toEqual(
      expect.arrayContaining([
        'trip:cancel',
        'trip:edit-past',
        'trip:edit-price',
        'client:edit',
        'company:edit',
        'user:manage',
        'record:delete',
      ]),
    );

    const dispatcherMe = await request(server())
      .get('/api/auth/me')
      .set('Cookie', dispatcherCookie)
      .expect(200);
    expect(
      (dispatcherMe.body as { permissions: string[] }).permissions,
    ).toEqual([]);
  });

  it('trip:cancel is unconditional — a DISPATCHER is blocked, an ADMIN is allowed', async () => {
    const client = await createClient();
    const created = await request(server())
      .post('/api/trips')
      .set('Cookie', adminCookie)
      .send({ ...FUTURE_TRIP, clientRef: client.ref })
      .expect(201);
    const ref = (created.body as TripBody).ref;

    await request(server())
      .post(`/api/trips/${ref}/cancel-assignment`)
      .set('Cookie', dispatcherCookie)
      .send({ cancellationFee: 'FREE' })
      .expect(403);

    await request(server())
      .post(`/api/trips/${ref}/cancel-assignment`)
      .set('Cookie', adminCookie)
      .send({ cancellationFee: 'FREE' })
      .expect(201);
  });

  it('trip:edit-past — a DISPATCHER may edit an upcoming trip but not one whose pickup already passed', async () => {
    const client = await createClient();

    const upcoming = await request(server())
      .post('/api/trips')
      .set('Cookie', adminCookie)
      .send({ ...FUTURE_TRIP, clientRef: client.ref })
      .expect(201);
    await request(server())
      .put(`/api/trips/${(upcoming.body as TripBody).ref}`)
      .set('Cookie', dispatcherCookie)
      .send({
        ...FUTURE_TRIP,
        clientRef: client.ref,
        pickupLocation: 'Nice Airport — Terminal 2',
      })
      .expect(200);

    const past = await request(server())
      .post('/api/trips')
      .set('Cookie', adminCookie)
      .send({ ...PAST_TRIP, clientRef: client.ref })
      .expect(201);
    await request(server())
      .put(`/api/trips/${(past.body as TripBody).ref}`)
      .set('Cookie', dispatcherCookie)
      .send({
        ...PAST_TRIP,
        clientRef: client.ref,
        pickupLocation: 'Nice Airport — Terminal 2',
      })
      .expect(403);
    await request(server())
      .put(`/api/trips/${(past.body as TripBody).ref}`)
      .set('Cookie', adminCookie)
      .send({
        ...PAST_TRIP,
        clientRef: client.ref,
        pickupLocation: 'Nice Airport — Terminal 2',
      })
      .expect(200);
  });

  it("trip:edit-past also gates the Planning Gantt's PATCH /assign — a DISPATCHER may reassign an upcoming trip but not one whose pickup already passed", async () => {
    const client = await createClient();
    const driver = await createDriver();

    const upcoming = await request(server())
      .post('/api/trips')
      .set('Cookie', adminCookie)
      .send({ ...FUTURE_TRIP, clientRef: client.ref })
      .expect(201);
    await request(server())
      .patch(`/api/trips/${(upcoming.body as TripBody).ref}/assign`)
      .set('Cookie', dispatcherCookie)
      .send({ driverRef: driver.ref })
      .expect(200);

    const past = await request(server())
      .post('/api/trips')
      .set('Cookie', adminCookie)
      .send({ ...PAST_TRIP, clientRef: client.ref })
      .expect(201);
    await request(server())
      .patch(`/api/trips/${(past.body as TripBody).ref}/assign`)
      .set('Cookie', dispatcherCookie)
      .send({ driverRef: driver.ref })
      .expect(403);
    await request(server())
      .patch(`/api/trips/${(past.body as TripBody).ref}/assign`)
      .set('Cookie', adminCookie)
      .send({ driverRef: driver.ref })
      .expect(200);
  });

  it('trip:edit-price — a DISPATCHER may edit an upcoming trip freely, but not its Retail net', async () => {
    const client = await createClient();
    const created = await request(server())
      .post('/api/trips')
      .set('Cookie', adminCookie)
      .send({ ...FUTURE_TRIP, clientRef: client.ref, priceEur: 100 })
      .expect(201);
    const ref = (created.body as TripBody).ref;

    await request(server())
      .put(`/api/trips/${ref}`)
      .set('Cookie', dispatcherCookie)
      .send({
        ...FUTURE_TRIP,
        clientRef: client.ref,
        priceEur: 100,
        instructions: 'ok to edit',
      })
      .expect(200);

    await request(server())
      .put(`/api/trips/${ref}`)
      .set('Cookie', dispatcherCookie)
      .send({ ...FUTURE_TRIP, clientRef: client.ref, priceEur: 150 })
      .expect(403);

    await request(server())
      .put(`/api/trips/${ref}`)
      .set('Cookie', adminCookie)
      .send({ ...FUTURE_TRIP, clientRef: client.ref, priceEur: 150 })
      .expect(200);
  });

  it('client:edit is unconditional — a DISPATCHER is blocked, an ADMIN is allowed', async () => {
    const client = await createClient();

    await request(server())
      .put(`/api/clients/${client.ref}`)
      .set('Cookie', dispatcherCookie)
      .send({ contactFirstName: 'Jane', contactLastName: 'Doe-Edited' })
      .expect(403);

    await request(server())
      .put(`/api/clients/${client.ref}`)
      .set('Cookie', adminCookie)
      .send({ contactFirstName: 'Jane', contactLastName: 'Doe-Edited' })
      .expect(200);
  });

  it('company:edit and user:manage block a DISPATCHER, allow an ADMIN', async () => {
    await request(server())
      .put('/api/company-info')
      .set('Cookie', dispatcherCookie)
      .send({})
      .expect(403);
    await request(server())
      .get('/api/users')
      .set('Cookie', dispatcherCookie)
      .expect(403);

    await request(server())
      .get('/api/users')
      .set('Cookie', adminCookie)
      .expect(200);
  });

  it('driver:reactivate only gates the false→true transition — a DISPATCHER may deactivate but not reactivate, an ADMIN can do both', async () => {
    const created = await request(server())
      .post('/api/drivers')
      .set('Cookie', adminCookie)
      .send({ firstName: 'John', lastName: 'Smith', phone: '0611112222' })
      .expect(201);
    const ref = (created.body as { ref: string }).ref;

    await request(server())
      .patch(`/api/drivers/${ref}/active`)
      .set('Cookie', dispatcherCookie)
      .send({ active: false })
      .expect(200);

    await request(server())
      .patch(`/api/drivers/${ref}/active`)
      .set('Cookie', dispatcherCookie)
      .send({ active: true })
      .expect(403);

    await request(server())
      .patch(`/api/drivers/${ref}/active`)
      .set('Cookie', adminCookie)
      .send({ active: true })
      .expect(200);
  });

  it('vehicle:reactivate only gates the false→true transition — a DISPATCHER may deactivate but not reactivate, an ADMIN can do both', async () => {
    const created = await request(server())
      .post('/api/fleet-vehicles')
      .set('Cookie', adminCookie)
      .send({
        category: 'Business',
        regNbr: 'AB-123-CD',
        make: 'Mercedes-Benz',
        model: 'E-Class',
        yearOfBuild: new Date().getFullYear() - 1,
        fourWD: false,
        nbPax: 3,
      })
      .expect(201);
    const ref = (created.body as { ref: string }).ref;

    await request(server())
      .patch(`/api/fleet-vehicles/${ref}/active`)
      .set('Cookie', dispatcherCookie)
      .send({ active: false })
      .expect(200);

    await request(server())
      .patch(`/api/fleet-vehicles/${ref}/active`)
      .set('Cookie', dispatcherCookie)
      .send({ active: true })
      .expect(403);

    await request(server())
      .patch(`/api/fleet-vehicles/${ref}/active`)
      .set('Cookie', adminCookie)
      .send({ active: true })
      .expect(200);
  });

  it('client:create-past-event only gates an Events-type account whose start date is already in the past — a DISPATCHER can create one dated in the future, only an ADMIN can create one dated in the past', async () => {
    await request(server())
      .post('/api/clients')
      .set('Cookie', dispatcherCookie)
      .send({
        clientType: 'EVENT',
        company: 'Future Gala',
        eventCountry: 'MC',
        eventArea: 'Monte-Carlo',
        eventStartDate: '2027-06-01',
        eventEndDate: '2027-06-03',
      })
      .expect(201);

    await request(server())
      .post('/api/clients')
      .set('Cookie', dispatcherCookie)
      .send({
        clientType: 'EVENT',
        company: 'Past Gala',
        eventCountry: 'MC',
        eventArea: 'Monte-Carlo',
        eventStartDate: '2026-01-01',
        eventEndDate: '2026-01-03',
      })
      .expect(403);

    await request(server())
      .post('/api/clients')
      .set('Cookie', adminCookie)
      .send({
        clientType: 'EVENT',
        company: 'Past Gala',
        eventCountry: 'MC',
        eventArea: 'Monte-Carlo',
        eventStartDate: '2026-01-01',
        eventEndDate: '2026-01-03',
      })
      .expect(201);
  });
  // The legacy gated every permanent hard-delete behind one Manager-password
  // prompt (openRecordModal's onPermanentDelete, common.js:385-395) — a
  // single gate, so a single v2 permission covers all four routes.
  it('record:delete is unconditional on every permanent delete — a DISPATCHER is blocked, an ADMIN is allowed', async () => {
    const client = await request(server())
      .post('/api/clients')
      .set('Cookie', adminCookie)
      .send({ clientType: 'COMPANY', company: 'Deletable SA' })
      .expect(201);
    const driver = await request(server())
      .post('/api/drivers')
      .set('Cookie', adminCookie)
      .send({
        firstName: 'Del',
        lastName: 'Etable',
        phone: '+33600000042',
        countryCode: 'FR',
      })
      .expect(201);
    const vehicleType = await request(server())
      .post('/api/vehicles')
      .set('Cookie', adminCookie)
      .send({ name: 'Deletable Class', maxPax: 3 })
      .expect(201);
    const fleetVehicle = await request(server())
      .post('/api/fleet-vehicles')
      .set('Cookie', adminCookie)
      .send({
        category: 'Business',
        regNbr: 'DEL-42-ZZ',
        make: 'Mercedes-Benz',
        model: 'E-Class',
        yearOfBuild: new Date().getFullYear() - 1,
        fourWD: false,
        nbPax: 3,
      })
      .expect(201);

    const targets: [string, string][] = [
      ['/api/clients', (client.body as { ref: string }).ref],
      ['/api/drivers', (driver.body as { ref: string }).ref],
      ['/api/fleet-vehicles', (fleetVehicle.body as { ref: string }).ref],
      ['/api/vehicles', (vehicleType.body as { ref: string }).ref],
    ];

    for (const [base, ref] of targets) {
      await request(server())
        .delete(`${base}/${ref}`)
        .set('Cookie', dispatcherCookie)
        .expect(403);
    }
    for (const [base, ref] of targets) {
      await request(server())
        .delete(`${base}/${ref}`)
        .set('Cookie', adminCookie)
        .expect(200);
    }
  });
});
