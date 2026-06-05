import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AprobacionService } from './aprobacion.service.js';
import {
  aprobarSchema,
  motivoSchema,
  type AprobarDto,
  type MotivoDto,
} from './aprobacion.schemas.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';

/**
 * CxP > "Aprobar Solicitudes" (clave 430). Bandeja del aprobador: Regresar,
 * Rechazar, Aprobar (con validación de presupuesto) y reasignar fuera de presupuesto.
 */
@Controller('cxp/aprobar')
@UseGuards(JwtAuthGuard, PermisoGuard)
@RequierePermiso(430)
export class AprobacionController {
  constructor(private readonly svc: AprobacionService) {}

  @Get()
  listar(
    @CurrentUser() actor: AuthUser,
    @Query('idEstado') idEstado?: string,
    @Headers('x-ver-como') verComo?: string,
  ) {
    const estado = idEstado ? Number(idEstado) : 2;
    return this.svc.listar(
      actor.uid,
      Number.isFinite(estado) ? estado : 2,
      verComo || undefined,
    );
  }

  @Get(':idCxp/presupuesto')
  presupuesto(
    @CurrentUser() actor: AuthUser,
    @Param('idCxp') idCxp: string,
    @Headers('x-ver-como') verComo?: string,
  ) {
    return this.svc.presupuesto(idCxp, actor.uid, verComo || undefined);
  }

  @Post(':idCxp/regresar')
  async regresar(
    @CurrentUser() actor: AuthUser,
    @Param('idCxp') idCxp: string,
    @Body(new ZodValidationPipe(motivoSchema)) dto: MotivoDto,
  ) {
    await this.svc.regresar(idCxp, dto.comentario, actor.uid);
    return { ok: true };
  }

  @Post(':idCxp/rechazar')
  async rechazar(
    @CurrentUser() actor: AuthUser,
    @Param('idCxp') idCxp: string,
    @Body(new ZodValidationPipe(motivoSchema)) dto: MotivoDto,
  ) {
    await this.svc.rechazar(idCxp, dto.comentario, actor.uid);
    return { ok: true };
  }

  @Post(':idCxp/aprobar')
  aprobar(
    @CurrentUser() actor: AuthUser,
    @Param('idCxp') idCxp: string,
    @Body(new ZodValidationPipe(aprobarSchema)) dto: AprobarDto,
  ) {
    return this.svc.aprobar(idCxp, dto.comentario, actor.uid);
  }

  @Post(':idCxp/fuera-presupuesto')
  async fueraPresupuesto(
    @CurrentUser() actor: AuthUser,
    @Param('idCxp') idCxp: string,
  ) {
    await this.svc.reasignarFueraPresupuesto(idCxp, actor.uid);
    return { ok: true };
  }
}
