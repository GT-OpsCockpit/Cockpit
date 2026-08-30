import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';
import { resetDatabase, TEST_ADMIN } from './utils/reset-db';
import { loginAs } from './utils/auth';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '../generated/prisma/enums';

interface UserResponseBody {
  id: string;
  ref: string;
  active: boolean;
  deactivatedAt: string | null;
}

describe('Users (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminCookie: string;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    adminCookie = await loginAs(app, TEST_ADMIN.email, TEST_ADMIN.password);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  // The legacy gave each access record a readable reference — O-001, O-002…
  // for an Admin, D-001, D-002… for a Dispatch, two independent series, zero-
  // padded to three (server.js:788-801). v2's Settings table showed the first
  // eight characters of a cuid instead, which names nothing and cannot be read
  // out loud over the phone.
  it('gives every account a readable ref, on its own series per role', async () => {
    let phoneSeq = 0;
    const mk = async (email: string, role: Role) => {
      const res = await request(server())
        .post('/api/users')
        .set('Cookie', adminCookie)
        .send({
          email,
          password: 'a-password',
          role,
          firstName: 'A',
          lastName: 'B',
          phone: `+3360000010${phoneSeq++}`,
        })
        .expect(201);
      return res.body as UserResponseBody;
    };

    // The seeded admin took the first Admin number.
    const list = await request(server())
      .get('/api/users')
      .set('Cookie', adminCookie)
      .expect(200);
    expect((list.body as UserResponseBody[])[0].ref).toBe('O-001');

    expect((await mk('d1@cockpit.test', Role.DISPATCHER)).ref).toBe('D-001');
    expect((await mk('d2@cockpit.test', Role.DISPATCHER)).ref).toBe('D-002');
    expect((await mk('a2@cockpit.test', Role.ADMIN)).ref).toBe('O-002');
  });

  // Same convention as driver and fleet refs, which never change after
  // creation — the legacy said so explicitly (server.js:804-806).
  it('keeps the ref a role change would otherwise rewrite', async () => {
    const created = await request(server())
      .post('/api/users')
      .set('Cookie', adminCookie)
      .send({
        email: 'promoted@cockpit.test',
        password: 'a-password',
        role: Role.DISPATCHER,
        firstName: 'Pro',
        lastName: 'Moted',
        phone: '+33600000200',
      })
      .expect(201);
    const { id, ref } = created.body as UserResponseBody;
    expect(ref).toBe('D-001');

    const updated = await request(server())
      .put(`/api/users/${id}`)
      .set('Cookie', adminCookie)
      .send({
        email: 'promoted@cockpit.test',
        role: Role.ADMIN,
        firstName: 'Pro',
        lastName: 'Moted',
        phone: '+33600000200',
      })
      .expect(200);
    expect((updated.body as UserResponseBody).ref).toBe('D-001');
  });

  it('lets an admin create, list, update and deactivate a dispatcher account', async () => {
    const createRes = await request(server())
      .post('/api/users')
      .set('Cookie', adminCookie)
      .send({
        email: 'dispatcher@cockpit.test',
        password: 'dispatcher-pw',
        role: Role.DISPATCHER,
        firstName: 'Dana',
        lastName: 'Dispatch',
        phone: '+33600000000',
      })
      .expect(201);
    expect(createRes.body).not.toHaveProperty('passwordHash');
    const userId = (createRes.body as UserResponseBody).id;

    const listRes = await request(server())
      .get('/api/users')
      .set('Cookie', adminCookie)
      .expect(200);
    expect(listRes.body).toHaveLength(2); // seeded admin + new dispatcher

    await request(server())
      .put(`/api/users/${userId}`)
      .set('Cookie', adminCookie)
      .send({
        email: 'dispatcher@cockpit.test',
        role: Role.DISPATCHER,
        firstName: 'Dana',
        lastName: 'Updated',
        phone: '+33600000000',
      })
      .expect(200);

    const deactivateRes = await request(server())
      .patch(`/api/users/${userId}/deactivate`)
      .set('Cookie', adminCookie)
      .expect(200);
    const deactivated = deactivateRes.body as UserResponseBody;
    expect(deactivated.active).toBe(false);
    expect(deactivated.deactivatedAt).not.toBeNull();
  });

  it('rejects duplicate emails on create', async () => {
    await request(server())
      .post('/api/users')
      .set('Cookie', adminCookie)
      .send({
        email: TEST_ADMIN.email,
        password: 'dispatcher-pw',
        role: Role.DISPATCHER,
        firstName: 'Dana',
        lastName: 'Dispatch',
        phone: '+33600000001',
      })
      .expect(409);
  });

  it('forbids a non-admin dispatcher from managing users', async () => {
    await request(server())
      .post('/api/users')
      .set('Cookie', adminCookie)
      .send({
        email: 'dispatcher2@cockpit.test',
        password: 'dispatcher-pw',
        role: Role.DISPATCHER,
        firstName: 'Dana',
        lastName: 'Dispatch',
        phone: '+33600000002',
      })
      .expect(201);

    const dispatcherCookie = await loginAs(
      app,
      'dispatcher2@cockpit.test',
      'dispatcher-pw',
    );

    await request(server())
      .get('/api/users')
      .set('Cookie', dispatcherCookie)
      .expect(403);
  });

  it('a deactivated user can no longer log in', async () => {
    const createRes = await request(server())
      .post('/api/users')
      .set('Cookie', adminCookie)
      .send({
        email: 'gone@cockpit.test',
        password: 'dispatcher-pw',
        role: Role.DISPATCHER,
        firstName: 'Gone',
        lastName: 'User',
        phone: '+33600000003',
      })
      .expect(201);

    await request(server())
      .patch(`/api/users/${(createRes.body as UserResponseBody).id}/deactivate`)
      .set('Cookie', adminCookie)
      .expect(200);

    await request(server())
      .post('/api/auth/login')
      .send({ email: 'gone@cockpit.test', password: 'dispatcher-pw' })
      .expect(401);
  });

  // The legacy refused an access account with no mobile, on create and on
  // edit alike (server.js:262-264, 275-277). It is how a dispatcher is
  // reached off-hours, not decoration.
  it('refuses an account with no phone number', async () => {
    await request(server())
      .post('/api/users')
      .set('Cookie', adminCookie)
      .send({
        email: 'nophone@cockpit.test',
        password: 'dispatcher-pw',
        role: Role.DISPATCHER,
        firstName: 'No',
        lastName: 'Phone',
      })
      .expect(400);
  });

  // v2 gives each account its own password, which the legacy had no notion of
  // — and deactivation here is one-way. Without a way to set a new one, an
  // account whose password is lost is simply gone, with no way back in and no
  // way to retire it cleanly.
  describe('resetting a password', () => {
    async function createDispatcher(password: string): Promise<string> {
      const res = await request(server())
        .post('/api/users')
        .set('Cookie', adminCookie)
        .send({
          email: 'reset@cockpit.test',
          password,
          role: Role.DISPATCHER,
          firstName: 'Reset',
          lastName: 'Me',
          phone: '+33600000009',
        })
        .expect(201);
      return (res.body as UserResponseBody).id;
    }

    it('lets an admin set a new password, which then logs the account in', async () => {
      const id = await createDispatcher('original-pw');

      await request(server())
        .patch(`/api/users/${id}/password`)
        .set('Cookie', adminCookie)
        .send({ password: 'brand-new-pw' })
        .expect(200);

      await expect(
        loginAs(app, 'reset@cockpit.test', 'brand-new-pw'),
      ).resolves.toBeTruthy();
    });

    it('leaves the old password unusable', async () => {
      const id = await createDispatcher('original-pw');

      await request(server())
        .patch(`/api/users/${id}/password`)
        .set('Cookie', adminCookie)
        .send({ password: 'brand-new-pw' })
        .expect(200);

      await request(server())
        .post('/api/auth/login')
        .send({ email: 'reset@cockpit.test', password: 'original-pw' })
        .expect(401);
    });

    it('holds new passwords to the same minimum as account creation', async () => {
      const id = await createDispatcher('original-pw');

      await request(server())
        .patch(`/api/users/${id}/password`)
        .set('Cookie', adminCookie)
        .send({ password: 'short' })
        .expect(400);
    });

    it('404s on an account that does not exist', async () => {
      await request(server())
        .patch('/api/users/does-not-exist/password')
        .set('Cookie', adminCookie)
        .send({ password: 'brand-new-pw' })
        .expect(404);
    });
  });
});
