import { Module } from '@nestjs/common';
import { CorreoModule } from '../correo/correo.module.js';
import { SoporteInquilinosController } from './soporte-inquilinos.controller.js';
import { SoporteInquilinosService } from './soporte-inquilinos.service.js';
import { SoporteInquilinosScheduler } from './soporte-inquilinos.scheduler.js';

/**
 * Soporte a Inquilinos (submódulo de Arrendatarios): gestión de incidentes por
 * correo. Reutiliza la infraestructura del módulo Correo (IMAP/SMTP/cuentas) y
 * monta encima la capa de incidentes (tablas `incidentes` / `incidentes_remitentes`).
 */
@Module({
  imports: [CorreoModule],
  controllers: [SoporteInquilinosController],
  providers: [SoporteInquilinosService, SoporteInquilinosScheduler],
})
export class SoporteInquilinosModule {}
