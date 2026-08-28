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

/**
 * An Events driver based in MC / Monaco. Its own Country + Area are what the
 * "Link to an Event" popup shows read-only and sends back as
 * eventCountry/eventArea — they are the same location, never two.
 */
const EVENTS_DRIVER = {
  eventsOnly: true,
  company: 'Acme',
  firstName: 'A',
  lastName: 'B',
  email: 'a@b.test',
  phone: '+33611111111',
  countryCode: 'MC',
  area: 'Monaco',
  eventCountry: 'MC',
  eventArea: 'Monaco',
};

/** Defaults to a range in the future — a linkable Event is one that hasn't ended. */
async function createEvent(
  server: Parameters<typeof request>[0],
  cookie: string,
  overrides: Record<string, unknown>,
): Promise<ClientBody> {
  const res = await request(server)
    .post('/api/clients')
    .set('Cookie', cookie)
    .send({
      clientType: 'EVENT',
      eventStartDate: '2027-05-20',
      eventEndDate: '2027-05-24',
      ...overrides,
    })
    .expect(201);
  return res.body as ClientBody;
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
      .send({
        firstName: 'John',
        lastName: 'Smith',
        phone: '+33 6 12 34 56 78',
      })
      .expect(201);
    const body = res.body as DriverBody;
    expect(body.ref).toBe('D-FR-INT-001');
    expect(body.name).toBe('John Smith');
    // Stored canonically, spacing dropped.
    expect(body.phone).toBe('+33612345678');
  });

  it('refuses a phone that is not a real number in international format', async () => {
    // "0612345678" is the shape the column used to hold, and the one that made
    // Twilio's `whatsapp:+0612345678` undialable — a national number cannot be
    // resolved without knowing the country, so the API no longer guesses.
    for (const phone of [
      '0612345678',
      '33612345678',
      'not-a-phone',
      '+33400456789',
    ]) {
      await request(server())
        .post('/api/drivers')
        .set('Cookie', cookie)
        .send({ firstName: 'John', lastName: 'Smith', phone })
        .expect(400);
    }
  });

  it('refuses an email that is not one', async () => {
    await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ company: 'Uber', email: 'ops@uber' })
      .expect(400);
  });

  it('dedups by phone: posting the same phone again returns the existing driver, not a new one', async () => {
    const first = await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ firstName: 'John', lastName: 'Smith', phone: '+33612345678' })
      .expect(201);

    const second = await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ firstName: 'Someone', lastName: 'Else', phone: '+33612345678' })
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
        phone: '+33611111111',
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
        phone: '+33611111111',
      })
      .expect(400); // no eventRef

    const eventClient = await createEvent(server(), cookie, {
      company: 'Grand Prix',
      eventCountry: 'MC',
      eventArea: 'Monaco',
    });

    await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({
        ...EVENTS_DRIVER,
        eventRef: 'NOT-A-REAL-CLIENT',
      })
      .expect(400); // eventRef doesn't resolve

    await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ ...EVENTS_DRIVER, eventRef: eventClient.ref })
      .expect(201);
  });

  // openEventLinkModal (common.js:3034) only ever offered an Event that had
  // not ended yet, happening in the driver's own Country + Area — and showed
  // that Country/Area read-only, straight off the driver's record, precisely
  // so the two could not disagree. v2 offered every Events account instead,
  // which made an incoherent link a couple of clicks away.
  describe('linking a driver to an Event', () => {
    it('refuses an Event that has already ended', async () => {
      const past = await createEvent(server(), cookie, {
        company: 'Last Year Gala',
        eventCountry: 'MC',
        eventArea: 'Monaco',
        eventStartDate: '2026-05-20',
        eventEndDate: '2026-05-24',
      });

      await request(server())
        .post('/api/drivers')
        .set('Cookie', cookie)
        .send({ ...EVENTS_DRIVER, eventRef: past.ref })
        .expect(400);
    });

    it('refuses an Event happening in another country or another area', async () => {
      const elsewhere = await createEvent(server(), cookie, {
        company: 'Cannes Festival',
        eventCountry: 'FR',
        eventArea: 'Cannes',
      });

      // The driver is based in MC/Monaco; the event is in FR/Cannes.
      await request(server())
        .post('/api/drivers')
        .set('Cookie', cookie)
        .send({ ...EVENTS_DRIVER, eventRef: elsewhere.ref })
        .expect(400);

      // Same country, different area.
      const otherArea = await createEvent(server(), cookie, {
        company: 'Nice Carnival',
        eventCountry: 'MC',
        eventArea: 'Larvotto',
      });
      await request(server())
        .post('/api/drivers')
        .set('Cookie', cookie)
        .send({ ...EVENTS_DRIVER, eventRef: otherArea.ref })
        .expect(400);
    });

    it('matches the area case- and whitespace-insensitively', async () => {
      const event = await createEvent(server(), cookie, {
        company: 'Yacht Show',
        eventCountry: 'MC',
        eventArea: '  monaco ',
      });

      await request(server())
        .post('/api/drivers')
        .set('Cookie', cookie)
        .send({ ...EVENTS_DRIVER, eventRef: event.ref })
        .expect(201);
    });

    // The popup's Country/Area are the record's own, shown read-only — they
    // are not a second, independent choice.
    it("refuses an Event location that isn't the driver's own", async () => {
      const event = await createEvent(server(), cookie, {
        company: 'Grand Prix',
        eventCountry: 'MC',
        eventArea: 'Monaco',
      });

      await request(server())
        .post('/api/drivers')
        .set('Cookie', cookie)
        .send({
          ...EVENTS_DRIVER,
          // Driver based in FR/Nice, claiming an MC/Monaco event link.
          countryCode: 'FR',
          area: 'Nice',
          eventRef: event.ref,
        })
        .expect(400);
    });

    it('refuses to link a driver that has no location of its own', async () => {
      const event = await createEvent(server(), cookie, {
        company: 'Grand Prix',
        eventCountry: 'MC',
        eventArea: 'Monaco',
      });

      await request(server())
        .post('/api/drivers')
        .set('Cookie', cookie)
        .send({
          ...EVENTS_DRIVER,
          countryCode: undefined,
          area: undefined,
          eventCountry: undefined,
          eventArea: undefined,
          eventRef: event.ref,
        })
        .expect(400);
    });
  });

  it('sets, validates and clears unavailability', async () => {
    const created = await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ firstName: 'John', lastName: 'Smith', phone: '+33612345678' })
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
      .send({ firstName: 'John', lastName: 'Smith', phone: '+33612345678' })
      .expect(201);
    const second = await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ firstName: 'Jane', lastName: 'Doe', phone: '+33699999999' })
      .expect(201);

    await request(server())
      .put(`/api/drivers/${(second.body as DriverBody).ref}`)
      .set('Cookie', cookie)
      .send({ firstName: 'Jane', lastName: 'Doe', phone: '+33612345678' })
      .expect(409);
  });

  it('deletes a driver that has an active unavailability window without a raw FK error', async () => {
    const created = await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ firstName: 'John', lastName: 'Smith', phone: '+33612345678' })
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
      .send({ firstName: 'John', lastName: 'Smith', phone: '+33612345678' })
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
    const found = (listed.body as DriverListBody).data.find(
      (d) => d.ref === ref,
    )!;
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
        .send({
          firstName: 'Riviera',
          lastName: `Driver${i}`,
          phone: `+3361111000${i}`,
        })
        .expect(201);
    }
    const other = await request(server())
      .post('/api/drivers')
      .set('Cookie', cookie)
      .send({ firstName: 'Someone', lastName: 'Else', phone: '+33622220000' })
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
  // Ported from the legacy's driverEligibleForTrip + isEffectivelyActive
  // (common.js:3010/3087), which gated every assignment picker client-side.
  // They now live in the API (common/business/assignability.ts) because the
  // list is paginated — filtering the rendered page would hide drivers
  // rather than exclude them.
  describe('GET /api/drivers — assignment-picker rules', () => {
    function isoOffsetDays(days: number): string {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
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
          eventStartDate: isoOffsetDays(-1),
          eventEndDate: isoOffsetDays(3),
          pocPhone: '+33611111111',
        })
        .expect(201);
      return res.body as ClientBody;
    }

    async function createDailyClient(): Promise<ClientBody> {
      const res = await request(server())
        .post('/api/clients')
        .set('Cookie', cookie)
        .send({
          clientType: 'COMPANY',
          company: 'Acme Corp',
          pocPhone: '+33622222222',
        })
        .expect(201);
      return res.body as ClientBody;
    }

    async function createInternalDriver(phone: string): Promise<DriverBody> {
      const res = await request(server())
        .post('/api/drivers')
        .set('Cookie', cookie)
        .send({ firstName: 'Inter', lastName: 'Nal', phone })
        .expect(201);
      return res.body as DriverBody;
    }

    async function createPartnerDriver(phone: string): Promise<DriverBody> {
      const res = await request(server())
        .post('/api/drivers')
        .set('Cookie', cookie)
        .send({
          firstName: 'Part',
          lastName: 'Ner',
          phone,
          company: 'Uber Elite',
          email: 'partner@example.com',
        })
        .expect(201);
      return res.body as DriverBody;
    }

    async function createEventsDriver(
      phone: string,
      eventRef: string,
    ): Promise<DriverBody> {
      const res = await request(server())
        .post('/api/drivers')
        .set('Cookie', cookie)
        .send({
          firstName: 'Even',
          lastName: 'Tor',
          phone,
          company: 'Acme',
          email: 'events@example.com',
          eventsOnly: true,
          // An Events driver is based where its event happens — the link
          // popup reads Country/Area straight off the record (common.js:3034).
          countryCode: 'MC',
          area: 'Monaco',
          eventCountry: 'MC',
          eventArea: 'Monaco',
          eventRef,
        })
        .expect(201);
      return res.body as DriverBody;
    }

    async function listRefs(query: string): Promise<string[]> {
      const res = await request(server())
        .get(`/api/drivers?${query}`)
        .set('Cookie', cookie)
        .expect(200);
      return (res.body as DriverListBody).data.map((d) => d.ref);
    }

    it('a daily booking excludes Events drivers, keeps in-house and partners', async () => {
      const eventClient = await createEventClient();
      const dailyClient = await createDailyClient();
      const internal = await createInternalDriver('+33630000001');
      const partner = await createPartnerDriver('+33630000002');
      const events = await createEventsDriver('+33630000003', eventClient.ref);

      const refs = await listRefs(`tripClientRef=${dailyClient.ref}`);
      expect(refs).toContain(internal.ref);
      expect(refs).toContain(partner.ref);
      expect(refs).not.toContain(events.ref);
    });

    it('a non-local Events booking keeps only Events drivers', async () => {
      const eventClient = await createEventClient();
      const internal = await createInternalDriver('+33630000001');
      const partner = await createPartnerDriver('+33630000002');
      const events = await createEventsDriver('+33630000003', eventClient.ref);

      const refs = await listRefs(
        `tripClientRef=${eventClient.ref}&tripArea=Paris&tripCountryCode=FR`,
      );
      expect(refs).toContain(events.ref);
      expect(refs).not.toContain(internal.ref);
      expect(refs).not.toContain(partner.ref);
    });

    it('a LOCAL Events booking also keeps in-house drivers, but never partners', async () => {
      const eventClient = await createEventClient();
      const internal = await createInternalDriver('+33630000001');
      const partner = await createPartnerDriver('+33630000002');
      const events = await createEventsDriver('+33630000003', eventClient.ref);

      // Monaco makes the booking local (isLocalTrip), which is what lets an
      // in-house driver take an Events job.
      const refs = await listRefs(
        `tripClientRef=${eventClient.ref}&tripCountryCode=MC&tripArea=Monaco`,
      );
      expect(refs).toContain(events.ref);
      expect(refs).toContain(internal.ref);
      expect(refs).not.toContain(partner.ref);
    });

    it('availableOnly drops a driver on a day off today, keeps one off tomorrow', async () => {
      const offToday = await createInternalDriver('+33630000001');
      const offTomorrow = await createInternalDriver('+33630000002');
      for (const [driver, date] of [
        [offToday, isoOffsetDays(0)],
        [offTomorrow, isoOffsetDays(1)],
      ] as const) {
        await request(server())
          .patch(`/api/drivers/${driver.ref}/unavailability`)
          .set('Cookie', cookie)
          .send({ type: 'OFF', date })
          .expect(200);
      }

      const refs = await listRefs('availableOnly=true');
      expect(refs).not.toContain(offToday.ref);
      expect(refs).toContain(offTomorrow.ref);
      // Without the flag the roster is unchanged — this is a picker filter,
      // not a change to what the Drivers page shows.
      expect(await listRefs('')).toContain(offToday.ref);
    });

    it('availableOnly drops a driver on holidays covering today', async () => {
      const driver = await createInternalDriver('+33630000001');
      await request(server())
        .patch(`/api/drivers/${driver.ref}/unavailability`)
        .set('Cookie', cookie)
        .send({
          type: 'HOLIDAYS',
          startDate: isoOffsetDays(-2),
          endDate: isoOffsetDays(2),
        })
        .expect(200);

      expect(await listRefs('availableOnly=true')).not.toContain(driver.ref);
    });

    it('availableOnly drops an Events driver whose event has not started yet', async () => {
      const upcoming = await request(server())
        .post('/api/clients')
        .set('Cookie', cookie)
        .send({
          clientType: 'EVENT',
          company: 'Next Year GP',
          eventCountry: 'MC',
          eventArea: 'Monaco',
          eventStartDate: isoOffsetDays(30),
          eventEndDate: isoOffsetDays(35),
          pocPhone: '+33611111111',
        })
        .expect(201);
      const resting = await createEventsDriver(
        '+33630000003',
        (upcoming.body as ClientBody).ref,
      );

      expect(await listRefs('availableOnly=true')).not.toContain(resting.ref);

      const running = await createEventClient();
      const active = await createEventsDriver('+33630000004', running.ref);
      expect(await listRefs('availableOnly=true')).toContain(active.ref);
    });
  });
});
