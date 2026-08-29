import { INestApplication, RequestMethod } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

/** Shared app configuration applied both by main.ts and by e2e test setup. */
export function configureApp(app: INestApplication): void {
  app.use(cookieParser());
  // NameboardController proxies stored nameboard files back from the storage
  // bucket. It stays outside the /api prefix so the `/uploads/nameboards/<file>`
  // URLs already persisted in `trip.nameboardUrl` (and used as-is by the
  // frontend) keep resolving — same shape the express.static mount served.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'uploads/nameboards/:filename', method: RequestMethod.GET },
    ],
  });

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
