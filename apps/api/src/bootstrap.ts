import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import express from 'express';
import { dirname, resolve } from 'node:path';

/** Shared app configuration applied both by main.ts and by e2e test setup. */
export function configureApp(app: INestApplication): void {
  app.use(cookieParser());
  // Public (no session needed — the driver/dashboard pages that display a
  // nameboard photo are themselves public), mounted before the /api prefix.
  const uploadDir = process.env.NAMEBOARD_UPLOAD_DIR ?? './uploads/nameboards';
  app.use('/uploads', express.static(resolve(dirname(uploadDir))));
  app.setGlobalPrefix('api');
}
