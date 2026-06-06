import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CorreoController } from './correo.controller.js';
import { CorreoService } from './correo.service.js';
import { CuentasService } from './cuentas.service.js';
import { ImapService } from './imap.service.js';
import { SmtpService } from './smtp.service.js';
import { CriptoService } from './cripto.service.js';
import { SyncScheduler } from './sync.scheduler.js';

/**
 * Módulo de Correo (buzón de facturas). IMAP (recepción) + SMTP (envío) desde el
 * backend, sin N8N. Sincronización periódica por cron + endpoint manual.
 */
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [CorreoController],
  providers: [
    CorreoService,
    CuentasService,
    ImapService,
    SmtpService,
    CriptoService,
    SyncScheduler,
  ],
})
export class CorreoModule {}
