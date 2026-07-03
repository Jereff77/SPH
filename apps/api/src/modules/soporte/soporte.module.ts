import { Module } from '@nestjs/common';
import { SoporteController } from './soporte.controller.js';
import { SoporteService } from './soporte.service.js';
import { SoporteAdminController } from './soporte-admin.controller.js';
import { SoporteAdminService } from './soporte-admin.service.js';
import { KbService } from './kb.service.js';
import { ConsultasService } from './consultas.service.js';
import { CorreoModule } from '../correo/correo.module.js';

/**
 * Agente de IA de Soporte (v2). Ayuda a los usuarios a usar la app (how-to,
 * diagnóstico, contexto) y escala a ticket. Reutiliza `CorreoModule` (SmtpService
 * + CuentasService, exportados) para notificar las escalaciones.
 *
 * `SoporteAdminController/Service` añade la vista de **auditoría** (Configuraciones
 * → Soporte): revisar las conversaciones de todos los usuarios y atender tickets.
 * Está restringida a personal de soporte por `SoporteGuard`.
 */
@Module({
  imports: [CorreoModule],
  controllers: [SoporteController, SoporteAdminController],
  providers: [SoporteService, SoporteAdminService, KbService, ConsultasService],
})
export class SoporteModule {}
