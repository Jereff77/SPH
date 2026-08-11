import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ParquesService } from './parques.service.js';
import {
  crearParqueSchema,
  dotacionNaveSchema,
  editarParqueSchema,
  editarNaveSchema,
  agregarNavesSchema,
  type CrearParqueDto,
  type DotacionNaveDto,
  type EditarParqueDto,
  type EditarNaveDto,
  type AgregarNavesDto,
} from './parques.schemas.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';

/**
 * Módulo Parques (acceso: clave 700). Incluye la edición de naves, que es una
 * capacidad propia de este módulo. Las escrituras sobre `parques`/`naves` están
 * autorizadas por el cliente.
 */
@Controller('parques')
@UseGuards(JwtAuthGuard, PermisoGuard)
@RequierePermiso(700)
export class ParquesController {
  constructor(private readonly svc: ParquesService) {}

  @Get()
  listar() {
    return this.svc.listarParques();
  }

  @Get(':idParque/kvas')
  kvas(@Param('idParque') idParque: string) {
    return this.svc.obtenerKvas(idParque);
  }

  @Get(':idParque/naves')
  naves(@Param('idParque') idParque: string) {
    return this.svc.listarNavesDeParque(idParque);
  }

  // Agregar parque: permiso específico 701 (sobre el 700 del módulo).
  @Post()
  @RequierePermiso(701)
  crear(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(crearParqueSchema)) dto: CrearParqueDto,
  ) {
    return this.svc.crearParque(dto, actor.uid);
  }

  @Patch(':idParque')
  async editar(
    @CurrentUser() actor: AuthUser,
    @Param('idParque') idParque: string,
    @Body(new ZodValidationPipe(editarParqueSchema)) dto: EditarParqueDto,
  ) {
    await this.svc.editarParque(idParque, dto, actor.uid);
    return { ok: true };
  }

  // Agregar naves a un parque existente: permiso específico 702.
  @Post(':idParque/naves')
  @RequierePermiso(702)
  agregarNaves(
    @CurrentUser() actor: AuthUser,
    @Param('idParque') idParque: string,
    @Body(new ZodValidationPipe(agregarNavesSchema)) dto: AgregarNavesDto,
  ) {
    return this.svc.agregarNaves(idParque, dto, actor.uid);
  }

  // Detalle de una nave (para el editor).
  @Get('naves/:idNave')
  obtenerNave(@Param('idNave') idNave: string) {
    return this.svc.obtenerNave(idNave);
  }

  // Historial / trazabilidad de la nave (línea de tiempo reconstruida desde
  // `auditoria`). Hereda el guard de permiso 700 del controlador.
  @Get('naves/:idNave/historial')
  historialNave(@Param('idNave') idNave: string) {
    return this.svc.historialDeNave(idNave);
  }

  // Edición de nave (capacidad del módulo Parques, clave 700).
  @Patch('naves/:idNave')
  async editarNave(
    @CurrentUser() actor: AuthUser,
    @Param('idNave') idNave: string,
    @Body(new ZodValidationPipe(editarNaveSchema)) dto: EditarNaveDto,
  ) {
    await this.svc.editarNave(idNave, dto, actor.uid);
    return { ok: true };
  }

  /**
   * Dotación de la nave: los KVA que le tocan por disposición del parque.
   *
   * ⛔ Endpoint APARTE a propósito. Exige **721** (KVA), no el 700/702 del resto
   * del módulo: decidir cuántos KVA reserva una nave es una atribución del área
   * de KVA, no de quien edita el catálogo de naves. Mezclar dos permisos en un
   * mismo endpoint según los campos del body es imposible de auditar.
   */
  @Patch('naves/:idNave/dotacion')
  @RequierePermiso(721)
  async editarDotacionNave(
    @CurrentUser() actor: AuthUser,
    @Param('idNave') idNave: string,
    @Body(new ZodValidationPipe(dotacionNaveSchema)) dto: DotacionNaveDto,
  ) {
    await this.svc.editarDotacionNave(idNave, dto, actor.uid);
    return { ok: true };
  }
}

/**
 * Submenú Disponibilidad (acceso: clave 710). Solo lectura del tablero; la
 * edición de naves se hace contra el endpoint de Parques (clave 700).
 */
@Controller('disponibilidad')
@UseGuards(JwtAuthGuard, PermisoGuard)
@RequierePermiso(710)
export class DisponibilidadController {
  constructor(private readonly svc: ParquesService) {}

  @Get()
  listar(@Query('parque') parque: string) {
    return this.svc.listarDisponibilidad(parque);
  }
}
