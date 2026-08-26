import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  // credentials:true + a literal '*' origin is rejected by browsers (the
  // Access-Control-Allow-Origin echoed back can't be the wildcard when
  // credentials are involved), so cookie-based auth would silently fail on
  // every request past login. Treat unset/'*' as "reflect the request's own
  // origin" (origin:true) instead, which is the credentials-safe equivalent.
  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors({
    origin: corsOrigin && corsOrigin !== '*' ? corsOrigin : true,
    credentials: true,
  });
  configureApp(app);
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
