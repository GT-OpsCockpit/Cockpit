import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';
import { resetDatabase, TEST_ADMIN } from './utils/reset-db';
import { loginAs } from './utils/auth';
import { PrismaService } from '../src/prisma/prisma.service';

interface ClientBody {
  ref: string;
  name: string;
  active: boolean;
  pocPhone: string;
  pocName: string | null;
}

interface ClientListBody {
  data: ClientBody[];
  total: number;
  page: number;
  limit: number;
}

describe('Clients (e2e)', () => {
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

  it('creates an individual client, deriving name and normalizing the POC phone', async () => {
    const res = await request(server())
      .post('/api/clients')
      .set('Cookie', cookie)
      .send({
        clientType: 'INDIVIDUAL',
        contactFirstName: 'Jane',
        contactLastName: 'Doe',
        pocPhone: '+33 6 12 34 56 78',
      })
      .expect(201);
    const body = res.body as ClientBody;
    expect(body.ref).toBe('CI1');
    expect(body.name).toBe('Jane Doe');
    expect(body.pocPhone).toBe('33612345678');
    expect(body.pocName).toBe('Jane Doe');
  });

  it('rejects an individual client without both contact names', async () => {
    await request(server())
      .post('/api/clients')
      .set('Cookie', cookie)
      .send({ clientType: 'INDIVIDUAL', contactFirstName: 'Jane' })
      .expect(400);
  });

  it('requires a company name for a Company-type account, and gives independent CC/CI/CE sequences', async () => {
    await request(server())
      .post('/api/clients')
      .set('Cookie', cookie)
      .send({ clientType: 'COMPANY' })
      .expect(400);

    const company = await request(server())
      .post('/api/clients')
      .set('Cookie', cookie)
      .send({ clientType: 'COMPANY', company: 'Acme Corp' })
      .expect(201);
    expect((company.body as ClientBody).ref).toBe('CC1');

    const individual = await request(server())
      .post('/api/clients')
      .set('Cookie', cookie)
      .send({
        clientType: 'INDIVIDUAL',
        contactFirstName: 'A',
        contactLastName: 'B',
      })
      .expect(201);
    expect((individual.body as ClientBody).ref).toBe('CI1');
  });

  it('requires event name and full date range for an Events-type account', async () => {
    await request(server())
      .post('/api/clients')
      .set('Cookie', cookie)
      .send({ clientType: 'EVENT', company: 'Grand Prix' })
      .expect(400);

    const res = await request(server())
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
    expect((res.body as ClientBody).ref).toBe('CE1');
  });

  it('lists active accounts before inactive ones, updates, and supports reversible deactivation', async () => {
    const a = await request(server())
      .post('/api/clients')
      .set('Cookie', cookie)
      .send({
        clientType: 'INDIVIDUAL',
        contactFirstName: 'A',
        contactLastName: 'A',
      })
      .expect(201);
    const b = await request(server())
      .post('/api/clients')
      .set('Cookie', cookie)
      .send({
        clientType: 'INDIVIDUAL',
        contactFirstName: 'B',
        contactLastName: 'B',
      })
      .expect(201);

    await request(server())
      .patch(`/api/clients/${(a.body as ClientBody).ref}/active`)
      .set('Cookie', cookie)
      .send({ active: false })
      .expect(200);

    // includeInactive=true — `a` was just deactivated, and the default list
    // (active-only) would drop it out entirely rather than order it last.
    const list = await request(server())
      .get('/api/clients?includeInactive=true')
      .set('Cookie', cookie)
      .expect(200);
    const refs = (list.body as ClientListBody).data.map((c) => c.ref);
    expect(refs.indexOf((b.body as ClientBody).ref)).toBeLessThan(
      refs.indexOf((a.body as ClientBody).ref),
    );

    const updated = await request(server())
      .put(`/api/clients/${(b.body as ClientBody).ref}`)
      .set('Cookie', cookie)
      .send({
        clientType: 'INDIVIDUAL',
        contactFirstName: 'Bea',
        contactLastName: 'B',
      })
      .expect(200);
    expect((updated.body as ClientBody).name).toBe('Bea B');

    // Deactivation is reversible for clients (unlike access accounts).
    await request(server())
      .patch(`/api/clients/${(a.body as ClientBody).ref}/active`)
      .set('Cookie', cookie)
      .send({ active: true })
      .expect(200);
    const reactivated = await request(server())
      .get('/api/clients')
      .set('Cookie', cookie)
      .expect(200);
    const reactivatedClient = (reactivated.body as ClientListBody).data.find(
      (c) => c.ref === (a.body as ClientBody).ref,
    );
    expect(reactivatedClient?.active).toBe(true);
  });

  it('PUT without clientType keeps validating against the existing type, not Individual', async () => {
    const company = await request(server())
      .post('/api/clients')
      .set('Cookie', cookie)
      .send({ clientType: 'COMPANY', company: 'Acme Corp' })
      .expect(201);
    const ref = (company.body as ClientBody).ref;

    // No clientType, no contact names, and no company change: must not be
    // mis-routed into the Individual branch demanding contact names.
    const updated = await request(server())
      .put(`/api/clients/${ref}`)
      .set('Cookie', cookie)
      .send({ acronym: 'ACME' })
      .expect(200);
    expect((updated.body as ClientBody & { acronym: string }).acronym).toBe(
      'ACME',
    );
  });

  it('PUT on an Events account still requires the full event fields, and clears them once switched away from Event', async () => {
    const event = await request(server())
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
    const ref = (event.body as ClientBody).ref;

    await request(server())
      .put(`/api/clients/${ref}`)
      .set('Cookie', cookie)
      .send({ clientType: 'EVENT', company: 'Grand Prix', eventCountry: '' })
      .expect(400);

    const switched = await request(server())
      .put(`/api/clients/${ref}`)
      .set('Cookie', cookie)
      .send({ clientType: 'COMPANY', company: 'Grand Prix' })
      .expect(200);
    const body = switched.body as ClientBody & {
      eventCountry: string | null;
      eventArea: string | null;
      eventStartDate: string | null;
      eventEndDate: string | null;
    };
    expect(body.eventCountry).toBeNull();
    expect(body.eventArea).toBeNull();
    expect(body.eventStartDate).toBeNull();
    expect(body.eventEndDate).toBeNull();
  });

  it('refuses to delete a client that has trips or invoices on file', async () => {
    const client = await request(server())
      .post('/api/clients')
      .set('Cookie', cookie)
      .send({
        clientType: 'INDIVIDUAL',
        contactFirstName: 'A',
        contactLastName: 'A',
        pocPhone: '0611111111',
      })
      .expect(201);
    const ref = (client.body as ClientBody).ref;

    await request(server())
      .post('/api/trips')
      .set('Cookie', cookie)
      .send({
        countryCode: 'FR',
        pickupAt: '2026-06-01T14:30:00.000Z',
        pickupLocation: 'Nice Airport',
        dropoffLocation: 'Cannes',
        service: 'TSF',
        passengerName: 'John Passenger',
        clientRef: ref,
      })
      .expect(201);

    await request(server())
      .delete(`/api/clients/${ref}`)
      .set('Cookie', cookie)
      .expect(400);
  });

  it('permanently deletes a client account', async () => {
    const created = await request(server())
      .post('/api/clients')
      .set('Cookie', cookie)
      .send({
        clientType: 'INDIVIDUAL',
        contactFirstName: 'A',
        contactLastName: 'A',
      })
      .expect(201);

    await request(server())
      .delete(`/api/clients/${(created.body as ClientBody).ref}`)
      .set('Cookie', cookie)
      .expect(200);

    await request(server())
      .put(`/api/clients/${(created.body as ClientBody).ref}`)
      .set('Cookie', cookie)
      .send({
        clientType: 'INDIVIDUAL',
        contactFirstName: 'A',
        contactLastName: 'A',
      })
      .expect(404);
  });

  it('rejects a malformed email on create, for both the account email and the POC email', async () => {
    await request(server())
      .post('/api/clients')
      .set('Cookie', cookie)
      .send({
        clientType: 'INDIVIDUAL',
        contactFirstName: 'A',
        contactLastName: 'A',
        email: 'not-an-email',
      })
      .expect(400);

    await request(server())
      .post('/api/clients')
      .set('Cookie', cookie)
      .send({
        clientType: 'INDIVIDUAL',
        contactFirstName: 'A',
        contactLastName: 'A',
        pocEmail: 'not-an-email',
      })
      .expect(400);
  });

  it('normalizes email casing/whitespace and rejects a duplicate — on create and on update, case-insensitively', async () => {
    const first = await request(server())
      .post('/api/clients')
      .set('Cookie', cookie)
      .send({
        clientType: 'INDIVIDUAL',
        contactFirstName: 'A',
        contactLastName: 'A',
        email: '  Jane.Doe@Example.com  ',
      })
      .expect(201);
    expect((first.body as ClientBody & { email: string }).email).toBe(
      'jane.doe@example.com',
    );

    // Same address, different casing/whitespace — must still collide.
    await request(server())
      .post('/api/clients')
      .set('Cookie', cookie)
      .send({
        clientType: 'INDIVIDUAL',
        contactFirstName: 'B',
        contactLastName: 'B',
        email: 'jane.doe@EXAMPLE.com',
      })
      .expect(409);

    // A second, distinct account can update into the same address just as little.
    const second = await request(server())
      .post('/api/clients')
      .set('Cookie', cookie)
      .send({
        clientType: 'INDIVIDUAL',
        contactFirstName: 'C',
        contactLastName: 'C',
        email: 'other@example.com',
      })
      .expect(201);
    await request(server())
      .put(`/api/clients/${(second.body as ClientBody).ref}`)
      .set('Cookie', cookie)
      .send({ email: 'JANE.DOE@example.com' })
      .expect(409);

    // But updating a record with its own (unchanged) email must not self-conflict.
    await request(server())
      .put(`/api/clients/${(first.body as ClientBody).ref}`)
      .set('Cookie', cookie)
      .send({ acronym: 'JD' })
      .expect(200);
    await request(server())
      .put(`/api/clients/${(first.body as ClientBody).ref}`)
      .set('Cookie', cookie)
      .send({ email: 'Jane.Doe@example.com' })
      .expect(200);
  });

  it('filters, searches and paginates the list server-side', async () => {
    for (let i = 1; i <= 3; i++) {
      await request(server())
        .post('/api/clients')
        .set('Cookie', cookie)
        .send({ clientType: 'COMPANY', company: `Riviera Transfers ${i}` })
        .expect(201);
    }
    const other = await request(server())
      .post('/api/clients')
      .set('Cookie', cookie)
      .send({
        clientType: 'INDIVIDUAL',
        contactFirstName: 'Someone',
        contactLastName: 'Else',
      })
      .expect(201);
    await request(server())
      .patch(`/api/clients/${(other.body as ClientBody).ref}/active`)
      .set('Cookie', cookie)
      .send({ active: false })
      .expect(200);

    // search — matches the company name, case-insensitively, substring.
    const searched = await request(server())
      .get('/api/clients?search=riviera')
      .set('Cookie', cookie)
      .expect(200);
    const searchedBody = searched.body as ClientListBody;
    expect(searchedBody.total).toBe(3);
    expect(searchedBody.data).toHaveLength(3);

    // type — exact match only.
    const typed = await request(server())
      .get('/api/clients?type=COMPANY')
      .set('Cookie', cookie)
      .expect(200);
    const typedBody = typed.body as Omit<ClientListBody, 'data'> & {
      data: (ClientBody & { clientType: string })[];
    };
    expect(typedBody.total).toBeGreaterThanOrEqual(3);
    expect(typedBody.data.every((c) => c.clientType === 'COMPANY')).toBe(true);

    // includeInactive — deactivated accounts are excluded by default.
    const defaultList = await request(server())
      .get('/api/clients?search=else')
      .set('Cookie', cookie)
      .expect(200);
    expect((defaultList.body as ClientListBody).total).toBe(0);
    const withInactive = await request(server())
      .get('/api/clients?search=else&includeInactive=true')
      .set('Cookie', cookie)
      .expect(200);
    expect((withInactive.body as ClientListBody).total).toBe(1);

    // pagination — page/limit slice the (search-filtered) result set.
    const page1 = await request(server())
      .get('/api/clients?search=riviera&limit=2&page=1')
      .set('Cookie', cookie)
      .expect(200);
    const page1Body = page1.body as ClientListBody;
    expect(page1Body.data).toHaveLength(2);
    expect(page1Body.total).toBe(3);
    expect(page1Body.page).toBe(1);
    expect(page1Body.limit).toBe(2);

    const page2 = await request(server())
      .get('/api/clients?search=riviera&limit=2&page=2')
      .set('Cookie', cookie)
      .expect(200);
    const page2Body = page2.body as ClientListBody;
    expect(page2Body.data).toHaveLength(1);
    expect(page1Body.data.map((c) => c.ref)).not.toEqual(
      expect.arrayContaining(page2Body.data.map((c) => c.ref)),
    );
  });

  it('rejects a limit above 100 (there is no "everything" mode)', async () => {
    await request(server())
      .get('/api/clients?limit=101')
      .set('Cookie', cookie)
      .expect(400);
  });
  // Feeds the "Link to an Event" picker on the driver and fleet-vehicle
  // forms: it must offer only what EventLinkService would actually accept,
  // and it filters in Prisma rather than over the current page because the
  // listing is paginated (audit §4.3).
  describe('Events picker filters', () => {
    async function createEvent(overrides: Record<string, unknown>) {
      const res = await request(server())
        .post('/api/clients')
        .set('Cookie', cookie)
        .send({
          clientType: 'EVENT',
          eventStartDate: '2027-05-20',
          eventEndDate: '2027-05-24',
          ...overrides,
        })
        .expect(201);
      return (res.body as { ref: string }).ref;
    }

    async function refs(query: string) {
      const res = await request(server())
        .get(`/api/clients?${query}`)
        .set('Cookie', cookie)
        .expect(200);
      return (res.body as ClientListBody).data.map((c) => c.ref);
    }

    it('keeps only upcoming Events happening at the given location', async () => {
      const here = await createEvent({
        company: 'Grand Prix',
        eventCountry: 'MC',
        eventArea: 'Monaco',
      });
      const otherCountry = await createEvent({
        company: 'Cannes Festival',
        eventCountry: 'FR',
        eventArea: 'Monaco',
      });
      const otherArea = await createEvent({
        company: 'Larvotto Show',
        eventCountry: 'MC',
        eventArea: 'Larvotto',
      });
      const ended = await createEvent({
        company: 'Last Year Grand Prix',
        eventCountry: 'MC',
        eventArea: 'Monaco',
        eventStartDate: '2026-05-20',
        eventEndDate: '2026-05-24',
      });

      const offered = await refs(
        'type=EVENT&eventCountry=MC&eventArea=Monaco&eventNotEnded=true&limit=100',
      );
      expect(offered).toContain(here);
      expect(offered).not.toContain(otherCountry);
      expect(offered).not.toContain(otherArea);
      expect(offered).not.toContain(ended);
    });

    it('matches the area case- and whitespace-insensitively', async () => {
      const ref = await createEvent({
        company: 'Yacht Show',
        eventCountry: 'MC',
        eventArea: 'Monte-Carlo',
      });
      expect(
        await refs(
          'type=EVENT&eventCountry=MC&eventArea=%20monte-carlo%20&limit=100',
        ),
      ).toContain(ref);
    });
  });
});
