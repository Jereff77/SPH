import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PendientesService } from './pendientes.service.js';
import {
  cambiarResponsableSchema,
  type CambiarResponsableDto,
} from './pendientes.schemas.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';

/**
 * CxP > Solicitudes pendientes (dashboard de gestión, clave 450). Muestra todas
 * las solicitudes con filtros; permite cambiar el responsable por registro y
 * devolver a "Guardado".
 */
@Controller('cxp/pendientes')
@UseGuards(JwtAuthGuard, PermisoGuard)
@RequierePermiso(450)
export class PendientesController {
  constructor(private readonly svc: PendientesService) {}

  @Get('anios')
  anios() {
    return this.svc.anios();
  }

  @Get('responsables')
  responsables() {
    return this.svc.responsables();
  }

  @Get()
  listar(
    @Query('anio') anio?: string,
    @Query('mes') mes?: string,
    @Query('idEstado') idEstado?: string,
    @Query('numSem') numSem?: string,
    @Query('uidGerente') uidGerente?: string,
  ) {
    return this.svc.listar({
      anio: anio ? Number(anio) : undefined,
      mes: mes ? Number(mes) : undefined,
      idEstado: idEstado != null && idEstado !== '' ? Number(idEstado) : undefined,
      numSem: numSem ? Number(numSem) : undefined,
      uidGerente: uidGerente || undefined,
    });
  }

  @Patch(':idCxp/responsable')
  async cambiarResponsable(
    @CurrentUser() actor: AuthUser,
    @Param('idCxp') idCxp: string,
    @Body(new ZodValidationPipe(cambiarResponsableSchema)) dto: CambiarResponsableDto,
  ) {
    await this.svc.cambiarResponsable(idCxp, dto.uidGerente, actor.uid);
    return { ok: true };
  }

  @Patch(':idCxp/devolver')
  async devolver(
    @CurrentUser() actor: AuthUser,
    @Param('idCxp') idCxp: string,
  ) {
    await this.svc.devolver(idCxp, actor.uid);
    return { ok: true };
  }
}
