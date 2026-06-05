import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ParametrosService } from './parametros.service.js';
import {
  inpcCrearSchema,
  inpcEditarSchema,
  cuentaCrearSchema,
  cuentaEditarSchema,
  responsableSchema,
  valorBoolSchema,
  guardarMensualSchema,
  fechaCxpCrearSchema,
  fechaCxpToggleSchema,
  type InpcCrearDto,
  type InpcEditarDto,
  type CuentaCrearDto,
  type CuentaEditarDto,
  type ResponsableDto,
  type ValorBoolDto,
  type GuardarMensualDto,
  type FechaCxpCrearDto,
  type FechaCxpToggleDto,
} from './parametros.schemas.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';

/**
 * Configuraciones > Parámetros (acceso al módulo: clave 210). Las pestañas tienen
 * claves más finas (INPC 212, Cuentas 213, Fechas CxP 214); por ahora se exige el
 * acceso general 210, que se puede refinar por método más adelante.
 */
@Controller('parametros')
@UseGuards(JwtAuthGuard, PermisoGuard)
@RequierePermiso(210)
export class ParametrosController {
  constructor(private readonly svc: ParametrosService) {}

  // ----- INPC -----
  @Get('inpc')
  listarInpc() {
    return this.svc.listarInpc();
  }

  @Post('inpc')
  async crearInpc(
    @Body(new ZodValidationPipe(inpcCrearSchema)) dto: InpcCrearDto,
  ) {
    await this.svc.crearInpc(dto);
    return { ok: true };
  }

  @Patch('inpc/:consecutivo')
  async editarInpc(
    @Param('consecutivo') consecutivo: string,
    @Body(new ZodValidationPipe(inpcEditarSchema)) dto: InpcEditarDto,
  ) {
    await this.svc.editarInpc(Number(consecutivo), dto);
    return { ok: true };
  }

  @Delete('inpc/:consecutivo')
  async eliminarInpc(@Param('consecutivo') consecutivo: string) {
    await this.svc.eliminarInpc(Number(consecutivo));
    return { ok: true };
  }

  // ----- Cuentas -----
  @Get('cuentas')
  listarCuentas(
    @Query('cuenta') cuenta?: string,
    @Query('seccion') seccion?: string,
  ) {
    return this.svc.listarCuentas(cuenta, seccion);
  }

  @Get('responsables')
  listarResponsables() {
    return this.svc.listarResponsables();
  }

  @Post('cuentas')
  async crearCuenta(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(cuentaCrearSchema)) dto: CuentaCrearDto,
  ) {
    await this.svc.crearCuenta(dto, actor.uid);
    return { ok: true };
  }

  @Patch('cuentas/:idCategoria')
  async editarCuenta(
    @Param('idCategoria') idCategoria: string,
    @Body(new ZodValidationPipe(cuentaEditarSchema)) dto: CuentaEditarDto,
  ) {
    await this.svc.editarCuenta(idCategoria, dto);
    return { ok: true };
  }

  @Patch('cuentas/:idCategoria/responsable')
  async cambiarResponsable(
    @Param('idCategoria') idCategoria: string,
    @Body(new ZodValidationPipe(responsableSchema)) dto: ResponsableDto,
  ) {
    await this.svc.cambiarResponsable(idCategoria, dto.uidResponsable);
    return { ok: true };
  }

  @Patch('cuentas/:idCategoria/presupuestable')
  async presupuestable(
    @Param('idCategoria') idCategoria: string,
    @Body(new ZodValidationPipe(valorBoolSchema)) dto: ValorBoolDto,
  ) {
    await this.svc.setPresupuestable(idCategoria, dto.valor);
    return { ok: true };
  }

  @Patch('cuentas/:idCategoria/status')
  async statusCuenta(
    @Param('idCategoria') idCategoria: string,
    @Body(new ZodValidationPipe(valorBoolSchema)) dto: ValorBoolDto,
  ) {
    await this.svc.setStatusCuenta(idCategoria, dto.valor);
    return { ok: true };
  }

  @Delete('cuentas/:idCategoria')
  async eliminarCuenta(@Param('idCategoria') idCategoria: string) {
    await this.svc.eliminarCuenta(idCategoria);
    return { ok: true };
  }

  // ----- Presupuesto mensual -----
  @Get('cuentas/:idCategoria/presupuesto-mensual')
  presupuestoMensual(
    @Param('idCategoria') idCategoria: string,
    @Query('idPresupuesto') idPresupuesto: string,
  ) {
    return this.svc.obtenerPresupuestoMensual(idCategoria, idPresupuesto);
  }

  @Put('cuentas/:idCategoria/presupuesto-mensual')
  async guardarMensual(
    @CurrentUser() actor: AuthUser,
    @Param('idCategoria') idCategoria: string,
    @Body(new ZodValidationPipe(guardarMensualSchema)) dto: GuardarMensualDto,
  ) {
    await this.svc.guardarPresupuestoMensual(
      idCategoria,
      dto.idPresupuesto,
      dto.meses,
      actor.uid,
    );
    return { ok: true };
  }

  // ----- Fechas CxP -----
  @Get('fechas-cxp/periodos')
  periodos() {
    return this.svc.listarPeriodos();
  }

  @Get('fechas-cxp')
  listarFechas(@Query('periodo') periodo?: string) {
    return this.svc.listarFechas(periodo);
  }

  @Post('fechas-cxp')
  async crearFecha(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(fechaCxpCrearSchema)) dto: FechaCxpCrearDto,
  ) {
    await this.svc.crearFecha(dto, actor.uid);
    return { ok: true };
  }

  @Patch('fechas-cxp/:fecha')
  async toggleFecha(
    @Param('fecha') fecha: string,
    @Body(new ZodValidationPipe(fechaCxpToggleSchema)) dto: FechaCxpToggleDto,
  ) {
    await this.svc.toggleFecha(fecha, dto);
    return { ok: true };
  }

  @Delete('fechas-cxp/:fecha')
  async eliminarFecha(@Param('fecha') fecha: string) {
    await this.svc.eliminarFecha(fecha);
    return { ok: true };
  }
}
