import 'reflect-metadata';
// build: parametros presupuesto-mensual con lógica propia (obtener-o-crear 12 meses)
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import type { Env } from './common/config/env.validation.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService<Env, true>);

  // Cabeceras de seguridad (CSP, etc.)
  app.use(helmet());

  // Parser de cookies (para el refresh token httpOnly)
  app.use(cookieParser());

  // Todas las rutas bajo /api
  app.setGlobalPrefix('api');

  // CORS restringido al origen del frontend (no comodín)
  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }),
    credentials: true,
  });

  // La validación de payloads se hace por endpoint con ZodValidationPipe
  // (común al monorepo). Ver src/common/pipes/zod-validation.pipe.ts

  // Respuesta de error uniforme + logging sin datos sensibles
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = config.get('API_PORT', { infer: true });
  await app.listen(port);
  new Logger('Bootstrap').log(`API escuchando en http://localhost:${port}/api`);
}

void bootstrap();
