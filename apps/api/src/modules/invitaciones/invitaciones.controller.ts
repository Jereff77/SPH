import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  InvitacionesService,
  type InvitacionListado,
} from './invitaciones.service.js';
import {
  invitarSchema,
  aceptarSchema,
  type InvitarDto,
  type AceptarDto,
} from './invitaciones.schemas.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';

/**
 * Invitaciones de registro de usuarios.
 *
 * - Rutas de gestión (crear/listar/reenviar/cancelar): exigen acceso al módulo
 *   Usuarios (clave 200) — ahí mismo está el botón "Invitar usuario".
 * - Rutas públicas (validar token / aceptar): SIN guard, porque el invitado aún
 *   no tiene sesión. El token (hash en BD) es la credencial; se limita su abuso
 *   con rate limiting.
 */
@Controller('invitaciones')
export class InvitacionesController {
  constructor(private readonly invitaciones: InvitacionesService) {}

  // ----- Gestión (módulo Usuarios, clave 200) -----

  @Post()
  @UseGuards(JwtAuthGuard, PermisoGuard)
  @RequierePermiso(200)
  invitar(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(invitarSchema)) dto: InvitarDto,
  ) {
    return this.invitaciones.invitar(actor.uid, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermisoGuard)
  @RequierePermiso(200)
  listar(): Promise<InvitacionListado[]> {
    return this.invitaciones.listar();
  }

  @Post(':id/reenviar')
  @UseGuards(JwtAuthGuard, PermisoGuard)
  @RequierePermiso(200)
  reenviar(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.invitaciones.reenviar(actor.uid, id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermisoGuard)
  @RequierePermiso(200)
  async cancelar(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.invitaciones.cancelar(actor.uid, id);
    return { ok: true };
  }

  // ----- Públicas (registro) -----

  /** Valida el token y devuelve los datos para precargar el formulario. */
  @Get('validar/:token')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  validar(@Param('token') token: string) {
    return this.invitaciones.validarToken(token);
  }

  /** Crea el usuario a partir de la invitación (define su contraseña y datos). */
  @Post('aceptar')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  aceptar(
    @Body(new ZodValidationPipe(aceptarSchema)) dto: AceptarDto,
  ): Promise<{ ok: true }> {
    return this.invitaciones.aceptar(dto);
  }
}
