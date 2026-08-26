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

    const list = await request(server())
      .get('/api/clients')
      .set('Cookie', cookie)
      .expect(200);
    const refs = (list.body as ClientBody[]).map((c) => c.ref);
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
    const reactivatedClient = (reactivated.body as ClientBody[]).find(
      (c) => c.ref === (a.body as ClientBody).ref,
    );
    expect(reactivatedClient?.active).toBe(true);
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
});
