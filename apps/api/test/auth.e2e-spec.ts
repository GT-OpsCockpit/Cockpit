import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';
import { resetDatabase, TEST_ADMIN } from './utils/reset-db';
import { PrismaService } from '../src/prisma/prisma.service';

interface LoginResponseBody {
  devCode?: string;
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  it('rejects login with a wrong password', async () => {
    const res = await request(server())
      .post('/api/auth/login')
      .send({ email: TEST_ADMIN.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(typeof (res.body as { error: string }).error).toBe('string');
  });

  it('rejects login for an unknown email without leaking existence', async () => {
    const res = await request(server())
      .post('/api/auth/login')
      .send({ email: 'nobody@cockpit.test', password: 'whatever12' });
    expect(res.status).toBe(401);
  });

  it('logs in, returns a dev OTP code, and completes 2FA to get a session cookie', async () => {
    const loginRes = await request(server())
      .post('/api/auth/login')
      .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password })
      .expect(201);
    const loginBody = loginRes.body as LoginResponseBody;
    expect(loginBody.devCode).toMatch(/^\d{6}$/);

    const verifyRes = await request(server())
      .post('/api/auth/verify')
      .send({ email: TEST_ADMIN.email, code: loginBody.devCode })
      .expect(201);

    const setCookie = verifyRes.headers['set-cookie'] as unknown as string[];
    expect(setCookie[0]).toMatch(/^session=.+; Max-Age=\d+;.*HttpOnly/);
  });

  it('rejects verify with a wrong code and eventually locks out after 5 attempts', async () => {
    await request(server())
      .post('/api/auth/login')
      .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password })
      .expect(201);

    for (let i = 0; i < 5; i++) {
      await request(server())
        .post('/api/auth/verify')
        .send({ email: TEST_ADMIN.email, code: '000000' })
        .expect(401);
    }

    await request(server())
      .post('/api/auth/verify')
      .send({ email: TEST_ADMIN.email, code: '000000' })
      .expect(429);
  });

  it('rejects verify when there is no pending code', async () => {
    await request(server())
      .post('/api/auth/verify')
      .send({ email: TEST_ADMIN.email, code: '123456' })
      .expect(400);
  });

  it('rejects protected routes without a session cookie', async () => {
    await request(server()).get('/api/users').expect(401);
  });

  it('verify-password re-checks the current user password', async () => {
    const loginRes = await request(server())
      .post('/api/auth/login')
      .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password })
      .expect(201);
    const verifyRes = await request(server())
      .post('/api/auth/verify')
      .send({
        email: TEST_ADMIN.email,
        code: (loginRes.body as LoginResponseBody).devCode,
      })
      .expect(201);
    const cookie = (
      verifyRes.headers['set-cookie'] as unknown as string[]
    )[0].split(';')[0];

    await request(server())
      .post('/api/auth/verify-password')
      .set('Cookie', cookie)
      .send({ password: TEST_ADMIN.password })
      .expect(201);

    await request(server())
      .post('/api/auth/verify-password')
      .set('Cookie', cookie)
      .send({ password: 'nope' })
      .expect(401);
  });

  it('logout clears the session so the cookie no longer authenticates', async () => {
    const loginRes = await request(server())
      .post('/api/auth/login')
      .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password })
      .expect(201);
    const verifyRes = await request(server())
      .post('/api/auth/verify')
      .send({
        email: TEST_ADMIN.email,
        code: (loginRes.body as LoginResponseBody).devCode,
      })
      .expect(201);
    const cookie = (
      verifyRes.headers['set-cookie'] as unknown as string[]
    )[0].split(';')[0];

    await request(server()).get('/api/users').set('Cookie', cookie).expect(200);
    await request(server())
      .post('/api/auth/logout')
      .set('Cookie', cookie)
      .expect(201);
    await request(server()).get('/api/users').set('Cookie', cookie).expect(401);
  });
});
