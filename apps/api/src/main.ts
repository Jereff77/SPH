import 'reflect-metadata';
// build: parametros presupuesto-mensual con lógica propia (obtener-o-crear 12 meses)
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import type { Env } from './common/config/env.validation.js';

async function bootstrap(): Promise<void> {
  // bodyParser: false → se registran abajo con límite propio (el default de Express
  // es 100 KB y la captura de pantalla del Agente de Soporte viaja en JSON base64).
  const app = await NestFactory.create(AppModule, { bufferLogs: false, bodyParser: false });
  const config = app.get(ConfigService<Env, true>);

  // Cabeceras de seguridad (CSP, etc.)
  app.use(helmet());

  // Parsers de body con límite de 2 MB (cap del payload; Zod acota además cada campo)
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));

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
