import { Module } from '@nestjs/common';
import { InvitacionesController } from './invitaciones.controller.js';
import { InvitacionesService } from './invitaciones.service.js';
import { InvitacionesMailer } from './invitaciones.mailer.js';

/**
 * Invitaciones de registro de usuarios. Usa SupabaseService (global) y
 * ConfiguracionService (global) para los dominios/correos autorizados. El envío
 * va por una cuenta SMTP dedicada (InvitacionesMailer, vars SMTP_INVITACIONES_*).
 */
@Module({
  controllers: [InvitacionesController],
  providers: [InvitacionesService, InvitacionesMailer],
})
export class InvitacionesModule {}
