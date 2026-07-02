import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IncrementosService } from './incrementos.service.js';
import {
  aplicarIncrementosSchema,
  revertirIncrementoSchema,
  type AplicarIncrementosDto,
  type RevertirIncrementoDto,
} from './incrementos.schemas.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';

/**
 * Arrendatarios · Incrementos de renta por INPC. El flujo lo dispara quien
 * captura el INPC (permiso 212 — Configuraciones → Parámetros → INPC): vista
 * previa → confirmación → aplicación → bitácora reversible. La bitácora
 * también se consulta con la clave 20 (historial por plan en Planes de Renta).
 * Diseño: `base-conocimiento/PLAN-incrementos-inpc-automaticos.md`.
 */
@Controller('arrendatarios/incrementos')
@UseGuards(JwtAuthGuard, PermisoGuard)
export class IncrementosController {
  constructor(private readonly incrementos: IncrementosService) {}

  /** Vista previa: qué planes recibirían el incremento de un INPC capturado. */
  @Get('preview')
  @RequierePermiso(212)
  preview(@Query('idInpc') idInpc?: string) {
    if (!idInpc?.trim()) throw new BadRequestException('Falta el registro de INPC (idInpc).');
    return this.incrementos.preview(idInpc.trim());
  }

  /** Aplica los incrementos confirmados en la vista previa. */
  @Post('aplicar')
  @RequierePermiso(212)
  aplicar(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(aplicarIncrementosSchema)) dto: AplicarIncrementosDto,
  ) {
    return this.incrementos.aplicar(dto.idInpc, dto.planes, actor.uid);
  }

  /** Revierte un incremento aplicado (contingencia / corrección). */
  @Post(':id/revertir')
  @RequierePermiso(212)
  revertir(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(revertirIncrementoSchema)) dto: RevertirIncrementoDto,
  ) {
    return this.incrementos.revertir(id, dto.motivo, actor.uid);
  }

  /** Corrección: revierte y re-aplica con el INPC vigente del catálogo. */
  @Post(':id/reaplicar')
  @RequierePermiso(212)
  reaplicar(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.incrementos.reaplicar(id, actor.uid);
  }

  /** Reenvía el correo de notificación de un incremento aplicado. */
  @Post(':id/reenviar-correo')
  @RequierePermiso(212)
  reenviarCorreo(@Param('id') id: string) {
    return this.incrementos.reenviarCorreo(id);
  }

  /** Bitácora de incrementos (por plan o por captura de INPC). */
  @Get()
  @RequierePermiso(212, 20)
  bitacora(@Query('idArrePdp') idArrePdp?: string, @Query('idInpc') idInpc?: string) {
    return this.incrementos.bitacora({
      idArrePdp: idArrePdp?.trim() || undefined,
      idInpc: idInpc?.trim() || undefined,
    });
  }
}
