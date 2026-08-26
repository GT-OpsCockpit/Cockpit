import { INestApplication } from '@nestjs/common';
import request from 'supertest';
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

  it('requires a session before opening the event stream', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/api/events/stream')
      .expect(401);
  });
});
