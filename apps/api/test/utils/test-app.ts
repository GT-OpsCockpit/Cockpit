import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap';
import { WHATSAPP_PROVIDER } from '../../src/notifications/whatsapp-provider.interface';
import { InMemoryWhatsAppProvider } from './in-memory-whatsapp.provider';

export interface TestApp {
  app: INestApplication;
  whatsapp: InMemoryWhatsAppProvider;
}

/** Boots a real Nest app (same wiring as main.ts minus the HTTP listener) against the test database, with Twilio replaced by an in-memory double. */
export async function createTestApp(): Promise<TestApp> {
  const whatsapp = new InMemoryWhatsAppProvider();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(WHATSAPP_PROVIDER)
    .useValue(whatsapp)
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, whatsapp };
}
