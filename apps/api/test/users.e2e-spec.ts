import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';
import { resetDatabase, TEST_ADMIN } from './utils/reset-db';
import { loginAs } from './utils/auth';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '../generated/prisma/enums';

interface UserResponseBody {
  id: string;
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
        phone: '0600000000',
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
});
