import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  // Skipped in tests: it's pure overhead for the 84 e2e specs (which never
  // hit /api/docs*) and DocumentBuilder-scanning every controller on every
  // test-app boot would add avoidable startup cost to an already
  // run-per-file test suite.
  if (process.env.NODE_ENV !== 'test') {
    const config = new DocumentBuilder()
      .setTitle('Cockpit API')
      .setDescription('Cockpit v2 dispatch/booking API')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      useGlobalPrefix: true,
    });
  }
}
