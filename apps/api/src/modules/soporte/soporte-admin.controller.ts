import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { SoporteGuard } from '../../common/auth/soporte.guard.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  atenderTicketSchema,
  configAgenteSchema,
  type AtenderTicketDto,
  type ConfigAgenteDto,
} from './soporte.schemas.js';
import {
  SoporteAdminService,
  type ConfigAgente,
  type ConversacionAdmin,
  type RecordatorioEnviado,
  type RecordatorioEnviadoDetalle,
  type SesionAdmin,
  type TicketAdmin,
} from './soporte-admin.service.js';

/**
 * Configuraciones → Soporte (auditoría de conversaciones + atención de tickets).
 *
 * Acceso EXCLUSIVO de personal de soporte: `JwtAuthGuard` + `SoporteGuard`
 * (valida `catUsers.isSupport`). NO usa `@RequierePermiso` a propósito —igual
 * que Cron—: este acceso no se asigna desde la app, solo por el flag `isSupport`.
 */
@Controller('soporte/admin')
@UseGuards(JwtAuthGuard, SoporteGuard)
export class SoporteAdminController {
  constructor(private readonly admin: SoporteAdminService) {}

  // --- Conversaciones (auditoría) ---

  @Get('sesiones')
  sesiones(@Query('eliminadas') eliminadas?: string): Promise<SesionAdmin[]> {
    return this.admin.listarSesiones(eliminadas === 'true');
  }

  @Get('sesiones/:id')
  conversacion(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConversacionAdmin> {
    return this.admin.conversacion(id);
  }

  // --- Tickets (atención) ---

  @Get('tickets')
  tickets(@Query('estado') estado?: string): Promise<TicketAdmin[]> {
    const valido =
      estado === 'abierto' || estado === 'en_proceso' || estado === 'cerrado'
        ? estado
        : undefined;
    return this.admin.listarTickets(valido);
  }

  @Patch('tickets/:id')
  atender(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(atenderTicketSchema)) dto: AtenderTicketDto,
  ): Promise<{ ok: true }> {
    return this.admin.atenderTicket(actor.uid, id, dto);
  }

  // --- Agente de Soporte (configuración del modelo/prompt + capacidades) ---

  @Get('agente')
  agente(): Promise<ConfigAgente> {
    return this.admin.configAgente();
  }

  @Patch('agente')
  actualizarAgente(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(configAgenteSchema)) dto: ConfigAgenteDto,
  ): Promise<{ ok: true }> {
    return this.admin.actualizarConfigAgente(actor.uid, dto);
  }

  // --- Recordatorios de aprobación CxP (correos enviados) ---

  @Get('recordatorios-aprobacion')
  recordatorios(
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ): Promise<RecordatorioEnviado[]> {
    const n = Number.parseInt(limit ?? '', 10);
    return this.admin.recordatoriosAprobacion(
      Number.isFinite(n) && n > 0 ? Math.min(n, 500) : 100,
      q,
    );
  }

  @Get('recordatorios-aprobacion/:id')
  recordatorio(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<RecordatorioEnviadoDetalle> {
    return this.admin.recordatorioAprobacion(id);
  }
}
