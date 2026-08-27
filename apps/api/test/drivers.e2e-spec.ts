import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';
import { resetDatabase, TEST_ADMIN } from './utils/reset-db';
import { loginAs } from './utils/auth';
import { PrismaService } from '../src/prisma/prisma.service';

interface DriverBody {
  ref: string;
  name: string;
  phone: string;
  active: boolean;
  unavailability: { type: string } | null;
  fleetReserved: { ref: string; regNbr: string } | null;
}

interface FleetVehicleBody {
  ref: string;
}

const BASE_VEHICLE = {
  category: 'Business',
  regNbr: 'AB-123-CD',
  make: 'Mercedes-Benz',
  model: 'E-Class',
  yearOfBuild: new Date().getFullYear() - 1,
  fourWD: false,
  nbPax: 3,
};

interface DriverListBody {
  data: DriverBody[];
  total: number;
  page: number;
  limit: number;
}

interface ClientBody {
  ref: string;
}

describe('Drivers (e2e)', () => {
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

  it('creates an internal driver (no company) with a D-FR-INT-NNN ref, requiring firstName/lastName/phone', async () => {
    await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ firstName: 'John' })
      .expect(400);

    const res = await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ firstName: 'John', lastName: 'Smith', phone: '06 12 34 56 78' })
      .expect(201);
    const body = res.body as DriverBody;
    expect(body.ref).toBe('D-FR-INT-001');
    expect(body.name).toBe('John Smith');
    expect(body.phone).toBe('0612345678');
  });

  it('dedups by phone: posting the same phone again returns the existing driver, not a new one', async () => {
    const first = await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ firstName: 'John', lastName: 'Smith', phone: '0612345678' })
      .expect(201);

    const second = await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ firstName: 'Someone', lastName: 'Else', phone: '0612345678' })
      .expect(201);

    expect((second.body as DriverBody).ref).toBe(
      (first.body as DriverBody).ref,
    );

    const list = await request(server())
      .get('/api/drivers')
      .set('Cookie', cookie)
      .expect(200);
    expect((list.body as DriverListBody).data).toHaveLength(1);
  });

  it('requires only email for a partner company (no contact name)', async () => {
    await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ company: 'Uber' })
      .expect(400);

    const res = await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({
        company: 'Uber',
        email: 'ops@uber.test',
        countryCode: 'US-CA',
        area: 'Los Angeles',
      })
      .expect(201);
    expect((res.body as DriverBody).ref).toMatch(/^D-US-LO-UBE-001$/);
  });

  it('allows multiple phone-less partner companies without colliding on the phone unique constraint', async () => {
    await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ company: 'Uber', email: 'ops@uber.test' })
      .expect(201);
    const second = await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ company: 'Lyft', email: 'ops@lyft.test' })
      .expect(201);
    expect((second.body as DriverBody).ref).toBeDefined();
  });

  it('requires email AND phone for a named partner chauffeur', async () => {
    await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ company: 'Uber', firstName: 'Bob' })
      .expect(400);

    await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ company: 'Uber', firstName: 'Bob', email: 'bob@uber.test' })
      .expect(400);

    await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({
        company: 'Uber',
        firstName: 'Bob',
        email: 'bob@uber.test',
        phone: '0611111111',
      })
      .expect(201);
  });

  it('requires all identity fields plus a valid linked event for an Events driver', async () => {
    await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({
        eventsOnly: true,
        company: 'Acme',
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.test',
        phone: '0611111111',
      })
      .expect(400); // no eventRef

    const eventClient = await request(server())
      .post('/api/clients')
      .set('Cookie', cookie)
      .send({
        clientType: 'EVENT',
        company: 'Grand Prix',
        eventCountry: 'MC',
        eventArea: 'Monaco',
        eventStartDate: '2026-05-20',
        eventEndDate: '2026-05-24',
      })
      .expect(201);

    await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({
        eventsOnly: true,
        company: 'Acme',
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.test',
        phone: '0611111111',
        eventCountry: 'MC',
        eventArea: 'Monaco',
        eventRef: 'NOT-A-REAL-CLIENT',
      })
      .expect(400); // eventRef doesn't resolve

    await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({
        eventsOnly: true,
        company: 'Acme',
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.test',
        phone: '0611111111',
        eventCountry: 'MC',
        eventArea: 'Monaco',
        eventRef: (eventClient.body as ClientBody).ref,
      })
      .expect(201);
  });

  it('sets, validates and clears unavailability', async () => {
    const created = await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ firstName: 'John', lastName: 'Smith', phone: '0612345678' })
      .expect(201);
    const ref = (created.body as DriverBody).ref;

    await request(server())
      .patch(`/api/drivers/${ref}/unavailability`)
      .set('Cookie', cookie)
      .send({ type: 'OFF' })
      .expect(400); // missing date

    await request(server())
      .patch(`/api/drivers/${ref}/unavailability`)
      .set('Cookie', cookie)
      .send({
        type: 'HOLIDAYS',
        startDate: '2026-06-10',
        endDate: '2026-06-01',
      })
      .expect(400); // end before start

    const set = await request(server())
      .patch(`/api/drivers/${ref}/unavailability`)
      .set('Cookie', cookie)
      .send({ type: 'SICK', startDate: '2026-06-01', endDate: '2026-06-10' })
      .expect(200);
    expect((set.body as DriverBody).unavailability?.type).toBe('SICK');

    const cleared = await request(server())
      .patch(`/api/drivers/${ref}/unavailability`)
      .set('Cookie', cookie)
      .send({})
      .expect(200);
    expect((cleared.body as DriverBody).unavailability).toBeNull();
  });

  it("rejects a PUT that reuses another driver's phone number", async () => {
    await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ firstName: 'John', lastName: 'Smith', phone: '0612345678' })
      .expect(201);
    const second = await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ firstName: 'Jane', lastName: 'Doe', phone: '0699999999' })
      .expect(201);

    await request(server())
      .put(`/api/drivers/${(second.body as DriverBody).ref}`)
      .set('Cookie', cookie)
      .send({ firstName: 'Jane', lastName: 'Doe', phone: '0612345678' })
      .expect(409);
  });

  it('deletes a driver that has an active unavailability window without a raw FK error', async () => {
    const created = await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ firstName: 'John', lastName: 'Smith', phone: '0612345678' })
      .expect(201);
    const ref = (created.body as DriverBody).ref;
    await request(server())
      .patch(`/api/drivers/${ref}/unavailability`)
      .set('Cookie', cookie)
      .send({ type: 'SICK', startDate: '2026-06-01', endDate: '2026-06-10' })
      .expect(200);

    await request(server())
      .delete(`/api/drivers/${ref}`)
      .set('Cookie', cookie)
      .expect(200);
  });

  it('reversibly deactivates and permanently deletes a driver', async () => {
    const created = await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ firstName: 'John', lastName: 'Smith', phone: '0612345678' })
      .expect(201);
    const ref = (created.body as DriverBody).ref;

    const deactivated = await request(server())
      .patch(`/api/drivers/${ref}/active`)
      .set('Cookie', cookie)
      .send({ active: false })
      .expect(200);
    expect((deactivated.body as DriverBody).active).toBe(false);

    await request(server())
      .patch(`/api/drivers/${ref}/active`)
      .set('Cookie', cookie)
      .send({ active: true })
      .expect(200);

    await request(server())
      .delete(`/api/drivers/${ref}`)
      .set('Cookie', cookie)
      .expect(200);
    await request(server())
      .delete(`/api/drivers/${ref}`)
      .set('Cookie', cookie)
      .expect(404);
  });

  it('surfaces the reserved fleet vehicle on the driver, kept in sync via PATCH /fleet-vehicles/:ref/driver', async () => {
    const driver = await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ company: 'Uber', email: 'ops@uber.test' })
      .expect(201);
    const ref = (driver.body as DriverBody).ref;
    expect((driver.body as DriverBody).fleetReserved).toBeNull();

    const vehicle = await request(server())
      .post('/api/fleet-vehicles')
      .set('Cookie', cookie)
      .send({
        ...BASE_VEHICLE,
        isLocal: false,
        countryCode: 'US-CA',
        area: 'Los Angeles',
        partnerCompany: 'Uber',
        driverRef: ref,
      })
      .expect(201);
    const vehicleRef = (vehicle.body as FleetVehicleBody).ref;

    const listed = await request(server())
      .get('/api/drivers')
      .set('Cookie', cookie)
      .expect(200);
    const found = (listed.body as DriverListBody).data.find((d) => d.ref === ref)!;
    expect(found.fleetReserved).toEqual(
      expect.objectContaining({ ref: vehicleRef, regNbr: BASE_VEHICLE.regNbr }),
    );

    await request(server())
      .patch(`/api/fleet-vehicles/${vehicleRef}/driver`)
      .set('Cookie', cookie)
      .send({})
      .expect(200);

    const relisted = await request(server())
      .get('/api/drivers')
      .set('Cookie', cookie)
      .expect(200);
    const foundAfter = (relisted.body as DriverListBody).data.find(
      (d) => d.ref === ref,
    )!;
    expect(foundAfter.fleetReserved).toBeNull();
  });

  it('filters, searches and paginates the list server-side, always bounded (never "everything")', async () => {
    for (let i = 1; i <= 3; i++) {
      await request(server())
        .post('/api/drivers')
        .set('Cookie', cookie)
        .send({ firstName: 'Riviera', lastName: `Driver${i}`, phone: `061111000${i}` })
        .expect(201);
    }
    const other = await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ firstName: 'Someone', lastName: 'Else', phone: '0622220000' })
      .expect(201);
    await request(server())
      .patch(`/api/drivers/${(other.body as DriverBody).ref}/active`)
      .set('Cookie', cookie)
      .send({ active: false })
      .expect(200);

    const searched = await request(server())
      .get('/api/drivers?search=riviera')
      .set('Cookie', cookie)
      .expect(200);
    expect((searched.body as DriverListBody).total).toBe(3);

    const defaultList = await request(server())
      .get('/api/drivers?search=else')
      .set('Cookie', cookie)
      .expect(200);
    expect((defaultList.body as DriverListBody).total).toBe(0);
    const withInactive = await request(server())
      .get('/api/drivers?search=else&includeInactive=true')
      .set('Cookie', cookie)
      .expect(200);
    expect((withInactive.body as DriverListBody).total).toBe(1);

    const page1 = await request(server())
      .get('/api/drivers?search=riviera&limit=2&page=1')
      .set('Cookie', cookie)
      .expect(200);
    const page1Body = page1.body as DriverListBody;
    expect(page1Body.data).toHaveLength(2);
    expect(page1Body.total).toBe(3);

    const page2 = await request(server())
      .get('/api/drivers?search=riviera&limit=2&page=2')
      .set('Cookie', cookie)
      .expect(200);
    expect((page2.body as DriverListBody).data).toHaveLength(1);
  });

  it('rejects a limit above 100 (there is no "everything" mode)', async () => {
    await request(server())
      .get('/api/drivers?limit=101')
      .set('Cookie', cookie)
      .expect(400);
  });
});
