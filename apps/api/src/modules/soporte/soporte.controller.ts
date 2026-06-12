import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SoporteService } from './soporte.service.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';
import {
  escalarSchema,
  mensajeSchema,
  proponerTicketSchema,
  renombrarSchema,
  type EscalarDto,
  type MensajeDto,
  type ProponerTicketDto,
  type RenombrarDto,
} from './soporte.schemas.js';

/**
 * Agente de IA de Soporte. Disponible para **todos los usuarios autenticados**
 * (es una ayuda transversal, sin clave de permiso — como Novedades). La
 * seguridad real está en el backend: el agente solo lee con el rol de solo
 * lectura y nunca modifica la BD.
 */
@Controller('soporte')
@UseGuards(JwtAuthGuard)
export class SoporteController {
  constructor(private readonly soporte: SoporteService) {}

  @Get('sesiones')
  sesiones(@CurrentUser() actor: AuthUser) {
    return this.soporte.listarSesiones(actor.uid);
  }

  @Post('sesiones')
  nuevaSesion(@CurrentUser() actor: AuthUser) {
    return this.soporte.nuevaSesion(actor.uid);
  }

  @Get('sesiones/:id/mensajes')
  mensajes(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.soporte.mensajes(actor.uid, id);
  }

  @Patch('sesiones/:id')
  renombrar(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(renombrarSchema)) dto: RenombrarDto,
  ) {
    return this.soporte.renombrar(actor.uid, id, dto.titulo);
  }

  @Delete('sesiones/:id')
  eliminar(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.soporte.eliminar(actor.uid, id);
  }

  @Post('mensaje')
  enviar(
    @CurrentUser() actor: AuthUser,
    @Headers('authorization') auth: string,
    @Body(new ZodValidationPipe(mensajeSchema)) dto: MensajeDto,
  ) {
    // Reenviamos el JWT del usuario a la edge (la identifica con auth.getUser()).
    const jwt = (auth ?? '').replace(/^Bearer\s+/i, '');
    return this.soporte.enviar(jwt, actor.uid, dto);
  }

  @Post('escalar/proponer')
  proponerTicket(
    @CurrentUser() actor: AuthUser,
    @Headers('authorization') auth: string,
    @Body(new ZodValidationPipe(proponerTicketSchema)) dto: ProponerTicketDto,
  ) {
    const jwt = (auth ?? '').replace(/^Bearer\s+/i, '');
    return this.soporte.proponerTicket(jwt, actor.uid, dto);
  }

  @Post('escalar')
  escalar(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(escalarSchema)) dto: EscalarDto,
  ) {
    return this.soporte.escalar(actor.uid, dto);
  }
}
