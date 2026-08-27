import { INestApplication } from '@nestjs/common';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createTestApp } from './utils/test-app';
import { resetDatabase } from './utils/reset-db';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Realtime SSE (e2e)', () => {
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

  // The unauthenticated /driver/:ref and /track/:ref pages subscribe to this
  // stream without a session cookie, so it must stay reachable without one
  // (see the @Public() decorator on RealtimeController.stream()). Plain
  // supertest can't assert this: the response never ends, so `.expect(200)`
  // would hang — open a raw socket instead and check the status once headers
  // arrive, then tear the connection down.
  it('does not require a session to open the event stream', async () => {
    const server = app.getHttpServer() as http.Server;
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    await new Promise<void>((resolve, reject) => {
      const req = http.get(
        { host: '127.0.0.1', port, path: '/api/events/stream' },
        (res) => {
          try {
            expect(res.statusCode).toBe(200);
            resolve();
          } catch (err) {
            reject(err as Error);
          } finally {
            res.destroy();
            req.destroy();
          }
        },
      );
      req.on('error', reject);
    });

    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });
});
