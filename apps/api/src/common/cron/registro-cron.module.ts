import { Global, Module } from '@nestjs/common';
import { RegistroCronService } from './registro-cron.service.js';

/**
 * Provee `RegistroCronService` de forma global, para que los schedulers de
 * cualquier módulo (correo, cxp, …) registren sus ejecuciones sin acoplarse al
 * módulo Cron ni generar dependencias circulares.
 */
@Global()
@Module({
  providers: [RegistroCronService],
  exports: [RegistroCronService],
})
export class RegistroCronModule {}
