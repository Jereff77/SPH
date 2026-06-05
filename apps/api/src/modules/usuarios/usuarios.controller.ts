import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { UsuariosService, type UsuarioListado } from './usuarios.service.js';
import {
  statusSchema,
  rcSchema,
  soporteSchema,
  type StatusDto,
  type RcDto,
  type SoporteDto,
} from './usuarios.schemas.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';

/**
 * Configuraciones > Usuarios. Acceso al módulo: clave 200. Modificaciones: 203.
 * El toggle de soporte además exige que el actor sea soporte (validado en el service).
 */
@Controller('usuarios')
@UseGuards(JwtAuthGuard, PermisoGuard)
@RequierePermiso(200)
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  listar(): Promise<UsuarioListado[]> {
    return this.usuarios.listar();
  }

  @Patch(':uid/status')
  @RequierePermiso(203)
  async status(
    @Param('uid') uid: string,
    @Body(new ZodValidationPipe(statusSchema)) dto: StatusDto,
  ): Promise<{ ok: true }> {
    await this.usuarios.setStatus(uid, dto.status);
    return { ok: true };
  }

  @Patch(':uid/rc')
  @RequierePermiso(203)
  async rc(
    @Param('uid') uid: string,
    @Body(new ZodValidationPipe(rcSchema)) dto: RcDto,
  ): Promise<{ ok: true }> {
    await this.usuarios.setRC(uid, dto.esRC);
    return { ok: true };
  }

  @Patch(':uid/soporte')
  async soporte(
    @CurrentUser() actor: AuthUser,
    @Param('uid') uid: string,
    @Body(new ZodValidationPipe(soporteSchema)) dto: SoporteDto,
  ): Promise<{ ok: true }> {
    await this.usuarios.setSoporte(actor.uid, uid, dto.isSupport);
    return { ok: true };
  }
}
