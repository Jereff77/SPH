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

/** Query repetible (`?x=a&x=b`) o único → arreglo de strings no vacíos (o undefined). */
function toArr(v: string | string[] | undefined): string[] | undefined {
  if (v == null) return undefined;
  const arr = (Array.isArray(v) ? v : [v]).map((s) => s?.trim()).filter((s): s is string => !!s);
  return arr.length ? [...new Set(arr)] : undefined;
}
/** Igual que `toArr` pero a números (descarta los no finitos). */
function toNumArr(v: string | string[] | undefined): number[] | undefined {
  const a = toArr(v);
  if (!a) return undefined;
  const nums = a.map((s) => Number(s)).filter((n) => Number.isFinite(n));
  return nums.length ? [...new Set(nums)] : undefined;
}

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
    @Query('anio') anio?: string | string[],
    @Query('mes') mes?: string | string[],
    @Query('idEstado') idEstado?: string | string[],
    @Query('numSem') numSem?: string,
    @Query('uidGerente') uidGerente?: string | string[],
  ) {
    return this.svc.listar({
      anio: toNumArr(anio),
      mes: toNumArr(mes),
      idEstado: toNumArr(idEstado),
      numSem: numSem ? Number(numSem) : undefined,
      uidGerente: toArr(uidGerente),
    });
  }

  /** Hilo de comentarios de la solicitud (justificación + respuestas del aprobador). */
  @Get(':idCxp/comentarios')
  comentarios(@Param('idCxp') idCxp: string) {
    return this.svc.comentarios(idCxp);
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
