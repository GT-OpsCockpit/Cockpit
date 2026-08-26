import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';
import { resetDatabase, TEST_ADMIN } from './utils/reset-db';
import { loginAs } from './utils/auth';
import { PrismaService } from '../src/prisma/prisma.service';

interface FleetVehicleBody {
  ref: string;
  regNbr: string;
  active: boolean;
  driver: { ref: string } | null;
  unavailability: { type: string } | null;
}

interface DriverBody {
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

describe('Fleet (e2e)', () => {
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

  describe('vehicle types', () => {
    it('creates a vehicle type with a V{n} ref continuing after the 12 seeded defaults, and rejects duplicate names', async () => {
      const res = await request(server())
        .post('/api/vehicles')
        .set('Cookie', cookie)
        .send({ name: 'Custom Type', maxPax: 4 })
        .expect(201);
      expect((res.body as { ref: string }).ref).toBe('V13');

      await request(server())
        .post('/api/vehicles')
        .set('Cookie', cookie)
        .send({ name: 'Custom Type', maxPax: 2 })
        .expect(409);
    });

    it('supports the full CRUD lifecycle: update, deactivate/reactivate, delete', async () => {
      const created = await request(server())
        .post('/api/vehicles')
        .set('Cookie', cookie)
        .send({ name: 'Custom Type', maxPax: 4 })
        .expect(201);
      const ref = (created.body as { ref: string }).ref;

      const updated = await request(server())
        .put(`/api/vehicles/${ref}`)
        .set('Cookie', cookie)
        .send({ name: 'Custom Type', maxPax: 6 })
        .expect(200);
      expect((updated.body as { maxPax: number }).maxPax).toBe(6);

      const deactivated = await request(server())
        .patch(`/api/vehicles/${ref}/active`)
        .set('Cookie', cookie)
        .send({ active: false })
        .expect(200);
      expect((deactivated.body as { active: boolean }).active).toBe(false);

      await request(server())
        .patch(`/api/vehicles/${ref}/active`)
        .set('Cookie', cookie)
        .send({ active: true })
        .expect(200);

      await request(server())
        .delete(`/api/vehicles/${ref}`)
        .set('Cookie', cookie)
        .expect(200);
      await request(server())
        .delete(`/api/vehicles/${ref}`)
        .set('Cookie', cookie)
        .expect(404);
    });

    it('refuses to delete a vehicle type that is in use by a fleet vehicle', async () => {
      const created = await request(server())
        .post('/api/vehicles')
        .set('Cookie', cookie)
        .send({ name: 'Custom Type', maxPax: 4 })
        .expect(201);
      const ref = (created.body as { ref: string }).ref;

      await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send({ ...BASE_VEHICLE, category: 'Custom Type' })
        .expect(201);

      await request(server())
        .delete(`/api/vehicles/${ref}`)
        .set('Cookie', cookie)
        .expect(400);
    });
  });

  describe('fleet vehicles', () => {
    it('creates a local vehicle with full validation (category/make/model/category-model compatibility/year/pax)', async () => {
      await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send({ ...BASE_VEHICLE, category: 'Nonexistent' })
        .expect(400);

      await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send({ ...BASE_VEHICLE, make: 'Yugo' })
        .expect(400);

      await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send({ ...BASE_VEHICLE, model: 'Cullinan' }) // Mercedes doesn't make a Cullinan
        .expect(400);

      // Valid make/model pair, but not allowed for the "Business" category.
      await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send({ ...BASE_VEHICLE, make: 'Tesla', model: 'Model 3' })
        .expect(400);

      await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send({ ...BASE_VEHICLE, yearOfBuild: 1990 })
        .expect(400);

      await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send({ ...BASE_VEHICLE, nbPax: 99 })
        .expect(400);

      const res = await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send(BASE_VEHICLE)
        .expect(201);
      const body = res.body as FleetVehicleBody;
      expect(body.ref).toBe('F1');
      expect(body.regNbr).toBe('AB-123-CD');
    });

    it('rejects a case-insensitive duplicate registration', async () => {
      await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send(BASE_VEHICLE)
        .expect(201);

      await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send({ ...BASE_VEHICLE, regNbr: 'ab-123-cd' })
        .expect(409);
    });

    it('requires country/area/partnerCompany for an external vehicle', async () => {
      await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send({ ...BASE_VEHICLE, isLocal: false })
        .expect(400);

      const res = await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send({
          ...BASE_VEHICLE,
          isLocal: false,
          countryCode: 'US-CA',
          area: 'Los Angeles',
          partnerCompany: 'Uber',
        })
        .expect(201);
      expect((res.body as FleetVehicleBody).ref).toBe('F1');
    });

    it('only allows unavailability for local vehicles, validates dates, and clears it', async () => {
      const external = await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send({
          ...BASE_VEHICLE,
          isLocal: false,
          countryCode: 'US-CA',
          area: 'Los Angeles',
          partnerCompany: 'Uber',
        })
        .expect(201);
      await request(server())
        .patch(
          `/api/fleet-vehicles/${(external.body as FleetVehicleBody).ref}/unavailability`,
        )
        .set('Cookie', cookie)
        .send({
          type: 'REPAIR',
          startDate: '2026-01-01',
          endDate: '2026-01-05',
        })
        .expect(400);

      const local = await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send({ ...BASE_VEHICLE, regNbr: 'ZZ-999-ZZ' })
        .expect(201);
      const ref = (local.body as FleetVehicleBody).ref;

      await request(server())
        .patch(`/api/fleet-vehicles/${ref}/unavailability`)
        .set('Cookie', cookie)
        .send({
          type: 'REPAIR',
          startDate: '2026-01-05',
          endDate: '2026-01-01',
        })
        .expect(400);

      const set = await request(server())
        .patch(`/api/fleet-vehicles/${ref}/unavailability`)
        .set('Cookie', cookie)
        .send({
          type: 'REPAIR',
          startDate: '2026-01-01',
          endDate: '2026-01-05',
        })
        .expect(200);
      expect((set.body as FleetVehicleBody).unavailability?.type).toBe(
        'REPAIR',
      );

      const cleared = await request(server())
        .patch(`/api/fleet-vehicles/${ref}/unavailability`)
        .set('Cookie', cookie)
        .send({})
        .expect(200);
      expect((cleared.body as FleetVehicleBody).unavailability).toBeNull();
    });

    it('links and unlinks a partner vehicle to a driver via PATCH .../driver', async () => {
      const driver = await request(server())
        .post('/api/drivers')
        .set('Cookie', cookie)
        .send({ company: 'Uber', email: 'ops@uber.test' })
        .expect(201);

      const vehicle = await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send({
          ...BASE_VEHICLE,
          isLocal: false,
          countryCode: 'US-CA',
          area: 'Los Angeles',
          partnerCompany: 'Uber',
        })
        .expect(201);
      const ref = (vehicle.body as FleetVehicleBody).ref;

      const linked = await request(server())
        .patch(`/api/fleet-vehicles/${ref}/driver`)
        .set('Cookie', cookie)
        .send({ driverRef: (driver.body as DriverBody).ref })
        .expect(200);
      expect((linked.body as FleetVehicleBody).driver?.ref).toBe(
        (driver.body as DriverBody).ref,
      );

      const unlinked = await request(server())
        .patch(`/api/fleet-vehicles/${ref}/driver`)
        .set('Cookie', cookie)
        .send({})
        .expect(200);
      expect((unlinked.body as FleetVehicleBody).driver).toBeNull();
    });

    it('a PUT that omits driverRef does not silently wipe an existing chauffeur link', async () => {
      const driver = await request(server())
        .post('/api/drivers')
        .set('Cookie', cookie)
        .send({ company: 'Uber', email: 'ops@uber.test' })
        .expect(201);
      const vehicle = await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send({
          ...BASE_VEHICLE,
          isLocal: false,
          countryCode: 'US-CA',
          area: 'Los Angeles',
          partnerCompany: 'Uber',
        })
        .expect(201);
      const ref = (vehicle.body as FleetVehicleBody).ref;
      await request(server())
        .patch(`/api/fleet-vehicles/${ref}/driver`)
        .set('Cookie', cookie)
        .send({ driverRef: (driver.body as DriverBody).ref })
        .expect(200);

      // Edit popup PUT never sends driverRef — the link must survive.
      const updated = await request(server())
        .put(`/api/fleet-vehicles/${ref}`)
        .set('Cookie', cookie)
        .send({
          ...BASE_VEHICLE,
          isLocal: false,
          countryCode: 'US-CA',
          area: 'Los Angeles',
          partnerCompany: 'Uber',
          color: 'White',
        })
        .expect(200);
      expect((updated.body as FleetVehicleBody).driver?.ref).toBe(
        (driver.body as DriverBody).ref,
      );
    });

    it('nulls out countryCode/area (like partnerCompany/driverRef) for a local vehicle', async () => {
      const res = await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send({ ...BASE_VEHICLE, countryCode: 'FR', area: 'Nice' })
        .expect(201);
      const body = res.body as FleetVehicleBody & {
        countryCode: string | null;
        area: string | null;
      };
      expect(body.countryCode).toBeNull();
      expect(body.area).toBeNull();
    });

    it('refuses to reserve a driver to a local vehicle via PATCH .../driver', async () => {
      const driver = await request(server())
        .post('/api/drivers')
        .set('Cookie', cookie)
        .send({ firstName: 'John', lastName: 'Smith', phone: '0611111111' })
        .expect(201);
      const local = await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send(BASE_VEHICLE)
        .expect(201);

      await request(server())
        .patch(
          `/api/fleet-vehicles/${(local.body as FleetVehicleBody).ref}/driver`,
        )
        .set('Cookie', cookie)
        .send({ driverRef: (driver.body as DriverBody).ref })
        .expect(400);
    });

    it('refuses to reserve a driver who is already reserved to another vehicle', async () => {
      const driver = await request(server())
        .post('/api/drivers')
        .set('Cookie', cookie)
        .send({ company: 'Uber', email: 'ops@uber.test' })
        .expect(201);
      const partnerFields = {
        isLocal: false,
        countryCode: 'US-CA',
        area: 'Los Angeles',
        partnerCompany: 'Uber',
      };
      const vehicleA = await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send({ ...BASE_VEHICLE, ...partnerFields })
        .expect(201);
      const vehicleB = await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send({ ...BASE_VEHICLE, ...partnerFields, regNbr: 'ZZ-999-ZZ' })
        .expect(201);

      await request(server())
        .patch(
          `/api/fleet-vehicles/${(vehicleA.body as FleetVehicleBody).ref}/driver`,
        )
        .set('Cookie', cookie)
        .send({ driverRef: (driver.body as DriverBody).ref })
        .expect(200);

      await request(server())
        .patch(
          `/api/fleet-vehicles/${(vehicleB.body as FleetVehicleBody).ref}/driver`,
        )
        .set('Cookie', cookie)
        .send({ driverRef: (driver.body as DriverBody).ref })
        .expect(409);
    });

    it('deletes a local vehicle that has an active unavailability window without a raw FK error', async () => {
      const created = await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send(BASE_VEHICLE)
        .expect(201);
      const ref = (created.body as FleetVehicleBody).ref;
      await request(server())
        .patch(`/api/fleet-vehicles/${ref}/unavailability`)
        .set('Cookie', cookie)
        .send({
          type: 'REPAIR',
          startDate: '2026-01-01',
          endDate: '2026-01-05',
        })
        .expect(200);

      await request(server())
        .delete(`/api/fleet-vehicles/${ref}`)
        .set('Cookie', cookie)
        .expect(200);
    });

    it('reversibly deactivates and permanently deletes a vehicle', async () => {
      const created = await request(server())
        .post('/api/fleet-vehicles')
        .set('Cookie', cookie)
        .send(BASE_VEHICLE)
        .expect(201);
      const ref = (created.body as FleetVehicleBody).ref;

      const deactivated = await request(server())
        .patch(`/api/fleet-vehicles/${ref}/active`)
        .set('Cookie', cookie)
        .send({ active: false })
        .expect(200);
      expect((deactivated.body as FleetVehicleBody).active).toBe(false);

      await request(server())
        .delete(`/api/fleet-vehicles/${ref}`)
        .set('Cookie', cookie)
        .expect(200);
      await request(server())
        .delete(`/api/fleet-vehicles/${ref}`)
        .set('Cookie', cookie)
        .expect(404);
    });
  });
});
