import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { SoporteGuard } from '../../common/auth/soporte.guard.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { TableroPendientesService } from './pendientes.service.js';
import {
  cambiarEstadoSchema,
  guardarPendienteSchema,
  type CambiarEstadoDto,
  type GuardarPendienteDto,
} from './pendientes.schemas.js';

/**
 * Configuraciones → Pendientes (tablero de trabajo del proyecto).
 *
 * Acceso EXCLUSIVO de personal de soporte: `JwtAuthGuard` + `SoporteGuard`
 * (valida `catUsers.isSupport`). **NO usa `@RequierePermiso` a propósito**, igual
 * que Cron y Soporte: una clave de permiso existe para REPARTIRLA, y este tablero
 * lista deuda técnica y hallazgos de seguridad — no es material para repartir en
 * la empresa. Cada clave que no se asigna a nadie es una puerta que alguien puede
 * abrir por descuido.
 *
 * Segunda capa: `dev_pendientes` tiene RLS ON sin políticas y REVOKE a
 * anon/authenticated, así que solo el backend (service_role) la alcanza.
 */
@Controller('pendientes')
@UseGuards(JwtAuthGuard, SoporteGuard)
export class TableroPendientesController {
  constructor(private readonly svc: TableroPendientesService) {}

  @Get()
  listar(@Query('incluirCerrados') incluirCerrados?: string) {
    return this.svc.listar(incluirCerrados === 'true');
  }

  @Post()
  guardar(
    @Body(new ZodValidationPipe(guardarPendienteSchema)) dto: GuardarPendienteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.guardar(dto, user.uid);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(cambiarEstadoSchema)) dto: CambiarEstadoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.cambiarEstado(id, dto, user.uid);
  }

  @Delete(':id')
  borrar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.svc.borrar(id, user.uid);
  }
}
