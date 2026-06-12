import { Module } from '@nestjs/common';
import { SoporteController } from './soporte.controller.js';
import { SoporteService } from './soporte.service.js';
import { KbService } from './kb.service.js';
import { CorreoModule } from '../correo/correo.module.js';

/**
 * Agente de IA de Soporte (v2). Ayuda a los usuarios a usar la app (how-to,
 * diagnóstico, contexto) y escala a ticket. Reutiliza `CorreoModule` (SmtpService
 * + CuentasService, exportados) para notificar las escalaciones.
 */
@Module({
  imports: [CorreoModule],
  controllers: [SoporteController],
  providers: [SoporteService, KbService],
})
export class SoporteModule {}
