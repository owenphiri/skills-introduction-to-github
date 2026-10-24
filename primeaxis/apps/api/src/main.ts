import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Payment webhooks must verify signatures against the raw body.
    rawBody: true,
  });

  app.use(helmet());
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // strip unknown fields
      forbidNonWhitelisted: true, // …and reject them loudly
      transform: true,            // DTO types coerced (query strings → numbers)
    }),
  );

  app.enableShutdownHooks();
  await app.listen(Number(process.env.API_PORT ?? 4000));
}
bootstrap();
