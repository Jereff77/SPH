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
 * Configuraciones > Parámetros. El acceso al módulo es la clave 210, pero cada
 * pestaña tiene su propia clave de VISUALIZACIÓN (catálogo `segModulos`), que se
 * exige por endpoint con @RequierePermiso a nivel de método (sobreescribe la de
 * clase): INPC = 212, Cuentas = 213, Fechas CxP = 214. (Claves SAT = 215 vive en
 * su propio controlador `cxp/claves-sat`; Pizarra de Avisos = 216 aún sin backend.)
 * La clave de clase 210 queda como respaldo para cualquier endpoint sin clave fina.
 */
@Controller('parametros')
@UseGuards(JwtAuthGuard, PermisoGuard)
@RequierePermiso(210)
export class ParametrosController {
  constructor(private readonly svc: ParametrosService) {}

  // ----- INPC (clave 212) -----
  @Get('inpc')
  @RequierePermiso(212)
  listarInpc() {
    return this.svc.listarInpc();
  }

  @Post('inpc')
  @RequierePermiso(212)
  async crearInpc(
    @Body(new ZodValidationPipe(inpcCrearSchema)) dto: InpcCrearDto,
  ) {
    await this.svc.crearInpc(dto);
    return { ok: true };
  }

  @Patch('inpc/:consecutivo')
  @RequierePermiso(212)
  async editarInpc(
    @Param('consecutivo') consecutivo: string,
    @Body(new ZodValidationPipe(inpcEditarSchema)) dto: InpcEditarDto,
  ) {
    await this.svc.editarInpc(Number(consecutivo), dto);
    return { ok: true };
  }

  @Delete('inpc/:consecutivo')
  @RequierePermiso(212)
  async eliminarInpc(@Param('consecutivo') consecutivo: string) {
    await this.svc.eliminarInpc(Number(consecutivo));
    return { ok: true };
  }

  // ----- Cuentas (clave 213) -----
  @Get('cuentas')
  @RequierePermiso(213)
  listarCuentas(
    @Query('cuenta') cuenta?: string,
    @Query('seccion') seccion?: string,
  ) {
    return this.svc.listarCuentas(cuenta, seccion);
  }

  @Get('responsables')
  @RequierePermiso(213)
  listarResponsables() {
    return this.svc.listarResponsables();
  }

  @Post('cuentas')
  @RequierePermiso(213)
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
  @RequierePermiso(213)
  async cambiarResponsable(
    @Param('idCategoria') idCategoria: string,
    @Body(new ZodValidationPipe(responsableSchema)) dto: ResponsableDto,
  ) {
    await this.svc.cambiarResponsable(idCategoria, dto.uidResponsable);
    return { ok: true };
  }

  @Patch('cuentas/:idCategoria/presupuestable')
  @RequierePermiso(213)
  async presupuestable(
    @Param('idCategoria') idCategoria: string,
    @Body(new ZodValidationPipe(valorBoolSchema)) dto: ValorBoolDto,
  ) {
    await this.svc.setPresupuestable(idCategoria, dto.valor);
    return { ok: true };
  }

  @Patch('cuentas/:idCategoria/status')
  @RequierePermiso(213)
  async statusCuenta(
    @Param('idCategoria') idCategoria: string,
    @Body(new ZodValidationPipe(valorBoolSchema)) dto: ValorBoolDto,
  ) {
    await this.svc.setStatusCuenta(idCategoria, dto.valor);
    return { ok: true };
  }

  @Delete('cuentas/:idCategoria')
  @RequierePermiso(213)
  async eliminarCuenta(@Param('idCategoria') idCategoria: string) {
    await this.svc.eliminarCuenta(idCategoria);
    return { ok: true };
  }

  // ----- Presupuesto mensual (parte de Cuentas, clave 213) -----
  @Get('cuentas/:idCategoria/presupuesto-mensual')
  @RequierePermiso(213)
  presupuestoMensual(
    @Param('idCategoria') idCategoria: string,
    @Query('idPresupuesto') idPresupuesto: string,
  ) {
    return this.svc.obtenerPresupuestoMensual(idCategoria, idPresupuesto);
  }

  @Put('cuentas/:idCategoria/presupuesto-mensual')
  @RequierePermiso(213)
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

  // ----- Fechas CxP (clave 214) -----
  @Get('fechas-cxp/periodos')
  @RequierePermiso(214)
  periodos() {
    return this.svc.listarPeriodos();
  }

  @Get('fechas-cxp')
  @RequierePermiso(214)
  listarFechas(@Query('periodo') periodo?: string) {
    return this.svc.listarFechas(periodo);
  }

  @Post('fechas-cxp')
  @RequierePermiso(214)
  async crearFecha(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(fechaCxpCrearSchema)) dto: FechaCxpCrearDto,
  ) {
    await this.svc.crearFecha(dto, actor.uid);
    return { ok: true };
  }

  @Patch('fechas-cxp/:fecha')
  @RequierePermiso(214)
  async toggleFecha(
    @Param('fecha') fecha: string,
    @Body(new ZodValidationPipe(fechaCxpToggleSchema)) dto: FechaCxpToggleDto,
  ) {
    await this.svc.toggleFecha(fecha, dto);
    return { ok: true };
  }

  @Delete('fechas-cxp/:fecha')
  @RequierePermiso(214)
  async eliminarFecha(@Param('fecha') fecha: string) {
    await this.svc.eliminarFecha(fecha);
    return { ok: true };
  }
}
