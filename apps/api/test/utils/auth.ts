import { INestApplication } from '@nestjs/common';
import request from 'supertest';

/** Runs the full login -> OTP verify flow and returns the `session=...` cookie header value. */
export async function loginAs(
  app: INestApplication,
  email: string,
  password: string,
): Promise<string> {
  const server = app.getHttpServer() as Parameters<typeof request>[0];
  const loginRes = await request(server)
    .post('/api/auth/login')
    .send({ email, password })
    .expect(201);

  const code = (loginRes.body as { devCode?: string }).devCode;
  if (!code) {
    throw new Error(
      'No devCode in login response — is AUTH_DEV_OTP=true in .env.test?',
    );
  }

  const verifyRes = await request(server)
    .post('/api/auth/verify')
    .send({ email, code })
    .expect(201);

  const setCookie = verifyRes.headers['set-cookie'] as unknown as string[];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return cookie.split(';')[0];
}
