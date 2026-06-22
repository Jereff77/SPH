import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DashboardService } from './dashboard.service.js';
import { PagosVentaService } from './pagos-venta.service.js';
import { PlanesService } from './planes.service.js';
import { EscriturasService } from './escrituras.service.js';
import { ReportesService } from './reportes.service.js';
import {
  comentarioSchema,
  crearPlanPagosSchema,
  docSchema,
  escrituraFechaSchema,
  escrituraMontoSchema,
  inversionistaSchema,
  propiedadSchema,
  registrarPagoSchema,
  tipoPagoSchema,
  type CrearPlanPagosDto,
  type DocDto,
  type EscrituraFechaDto,
  type EscrituraMontoDto,
  type InversionistaDto,
  type PropiedadDto,
  type RegistrarPagoDto,
  type TipoPagoDto,
} from './ventas.schemas.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';

const LIMITE_ARCHIVO = 15 * 1024 * 1024; // 15 MB

const EXT_POR_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function toNum(v: string | undefined, def: number): number {
  if (v === undefined || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
function toBool(v: string | undefined): boolean {
  return v === 'true' || v === '1';
}
/**
 * Lista de meses (1-12) desde el query `meses` (CSV, p. ej. "1,3,6"). Si no
 * llega, cae al `mes` único (compat). Filtra valores fuera de rango.
 */
function toMeses(meses: string | undefined, mes: string | undefined, def: number): number[] {
  const fuente = meses && meses.trim() ? meses : mes;
  if (!fuente || !fuente.trim()) return [def];
  const nums = fuente
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 12);
  return nums.length ? [...new Set(nums)] : [def];
}

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
 * Módulo Ventas (Inversionistas/Propietarios). Dashboard (clave 600) y Planes +
 * Configuración (clave 610). Todas las escrituras se auditan (comoActor).
 */
@Controller('ventas')
@UseGuards(JwtAuthGuard, PermisoGuard)
export class VentasController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly pagos: PagosVentaService,
    private readonly planes: PlanesService,
    private readonly escrituras: EscriturasService,
    private readonly reportes: ReportesService,
  ) {}

  // ============================ Dashboard (600) ============================

  @Get('dashboard/filtros')
  @RequierePermiso(600)
  filtros() {
    return this.dashboard.filtros();
  }

  @Get('dashboard/tabla')
  @RequierePermiso(600)
  tabla(
    @Query('anio') anio?: string,
    @Query('mes') mes?: string,
    @Query('meses') meses?: string,
    @Query('activo') activo?: string,
  ) {
    const ahora = new Date();
    return this.dashboard.tabla({
      anio: toNum(anio, ahora.getFullYear()),
      meses: toMeses(meses, mes, ahora.getMonth() + 1),
      activo: activo === undefined ? true : toBool(activo),
    });
  }

  @Get('dashboard/tarjetas')
  @RequierePermiso(600)
  tarjetas(
    @Query('anio') anio?: string,
    @Query('mes') mes?: string,
    @Query('meses') meses?: string,
    @Query('activo') activo?: string,
  ) {
    const ahora = new Date();
    return this.dashboard.tarjetas(
      toNum(anio, ahora.getFullYear()),
      toMeses(meses, mes, ahora.getMonth() + 1),
      activo === undefined ? true : toBool(activo),
    );
  }

  @Get('dashboard/rentas')
  @RequierePermiso(600)
  rentas(
    @Query('anio') anio?: string,
    @Query('mes') mes?: string,
    @Query('meses') meses?: string,
    @Query('tipo') tipo?: string,
  ) {
    const ahora = new Date();
    return this.dashboard.rentas(
      toNum(anio, ahora.getFullYear()),
      toMeses(meses, mes, ahora.getMonth() + 1),
      tipo || 'Todos',
    );
  }

  @Get('dashboard/pagos/:idPdpDet')
  @RequierePermiso(600)
  detallePagos(@Param('idPdpDet') idPdpDet: string) {
    return this.dashboard.detallePagos(idPdpDet);
  }

  @Post('dashboard/pagos/:idPdpDet')
  @RequierePermiso(600)
  @UseInterceptors(FileInterceptor('comprobante', { limits: { fileSize: LIMITE_ARCHIVO } }))
  async registrarPago(
    @CurrentUser() actor: AuthUser,
    @Param('idPdpDet') idPdpDet: string,
    @Body(new ZodValidationPipe(registrarPagoSchema)) dto: RegistrarPagoDto,
    @UploadedFile() comprobante?: Express.Multer.File,
  ) {
    const arch = comprobante
      ? {
          buffer: comprobante.buffer,
          contentType: comprobante.mimetype,
          ext: EXT_POR_MIME[comprobante.mimetype] ?? 'bin',
        }
      : null;
    return this.pagos.registrarPago(idPdpDet, dto, arch, actor.uid);
  }

  @Delete('dashboard/pagos/:idPago')
  @RequierePermiso(600)
  async eliminarPago(@CurrentUser() actor: AuthUser, @Param('idPago') idPago: string) {
    await this.pagos.eliminarPago(idPago, actor.uid);
    return { ok: true };
  }

  // ============================ Planes (610) ============================

  @Get('planes/inversionistas')
  @RequierePermiso(610)
  inversionistas() {
    return this.planes.inversionistas();
  }

  @Get('planes/propiedades')
  @RequierePermiso(610)
  propiedades(@Query('idInversionista') idInversionista: string) {
    return this.planes.propiedadesDe(idInversionista);
  }

  @Get('planes/plan/:idPropiedad')
  @RequierePermiso(610)
  plan(@Param('idPropiedad') idPropiedad: string) {
    return this.planes.planDePagos(idPropiedad);
  }

  @Get('planes/renta-garantizada/:idPropiedad')
  @RequierePermiso(610)
  rentaGarantizada(@Param('idPropiedad') idPropiedad: string) {
    return this.planes.rentaGarantizada(idPropiedad);
  }

  @Get('planes/renta-administrada/:idPropiedad')
  @RequierePermiso(610)
  rentaAdministrada(@Param('idPropiedad') idPropiedad: string) {
    return this.planes.rentaAdministrada(idPropiedad);
  }

  // ----- Comentarios de una parcialidad -----
  @Get('planes/comentarios/:idPdpDet')
  @RequierePermiso(610)
  comentarios(@Param('idPdpDet') idPdpDet: string) {
    return this.planes.comentariosDe(idPdpDet);
  }

  @Post('planes/comentarios/:idPdpDet')
  @RequierePermiso(610)
  async agregarComentario(
    @CurrentUser() actor: AuthUser,
    @Param('idPdpDet') idPdpDet: string,
    @Body(new ZodValidationPipe(comentarioSchema)) dto: { comentario: string },
  ) {
    await this.planes.agregarComentario(idPdpDet, dto.comentario, actor.uid);
    return { ok: true };
  }

  // ----- Config: Datos Generales -----
  @Get('planes/inversionista/:id')
  @RequierePermiso(610)
  getInversionista(@Param('id') id: string) {
    return this.planes.getInversionista(id);
  }

  @Patch('planes/inversionista/:id')
  @RequierePermiso(610)
  async actualizarInversionista(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(inversionistaSchema)) dto: InversionistaDto,
  ) {
    await this.planes.actualizarInversionista(id, dto, actor.uid);
    return { ok: true };
  }

  // ----- Config: Documentos -----
  @Get('planes/docs')
  @RequierePermiso(610)
  docs(@Query('idInversionista') idInversionista: string) {
    return this.planes.listarDocs(idInversionista);
  }

  @Post('planes/docs')
  @RequierePermiso(610)
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: LIMITE_ARCHIVO } }))
  async subirDoc(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(docSchema)) dto: DocDto,
    @UploadedFile() archivo?: Express.Multer.File,
  ) {
    if (!archivo) throw new BadRequestException('Falta el archivo del documento.');
    return this.planes.subirDoc(
      dto,
      {
        buffer: archivo.buffer,
        contentType: archivo.mimetype,
        ext: EXT_POR_MIME[archivo.mimetype] ?? 'bin',
      },
      actor.uid,
    );
  }

  @Delete('planes/docs/:idDocumento')
  @RequierePermiso(610)
  async eliminarDoc(
    @CurrentUser() actor: AuthUser,
    @Param('idDocumento') idDocumento: string,
  ) {
    await this.planes.eliminarDoc(idDocumento, actor.uid);
    return { ok: true };
  }

  // ----- Config: Propiedades -----
  @Get('planes/parques')
  @RequierePermiso(610)
  parques() {
    return this.planes.parquesDisponibles();
  }

  @Get('planes/naves-disponibles')
  @RequierePermiso(610)
  navesDisponibles(@Query('idParque') idParque?: string) {
    return this.planes.navesDisponibles(idParque || undefined);
  }

  @Post('planes/propiedades')
  @RequierePermiso(610)
  async vincularNave(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(propiedadSchema)) dto: PropiedadDto,
  ) {
    return this.planes.vincularNave(dto, actor.uid);
  }

  @Delete('planes/propiedades/:idPropiedad')
  @RequierePermiso(610)
  async desvincularNave(
    @CurrentUser() actor: AuthUser,
    @Param('idPropiedad') idPropiedad: string,
  ) {
    return this.planes.desvincularNave(idPropiedad, actor.uid);
  }

  // ----- Plan de Pagos: cambiar tipo de pago de una parcialidad -----
  @Patch('planes/tipo-pago/:idPdpDet')
  @RequierePermiso(610)
  async actualizarTipoPago(
    @CurrentUser() actor: AuthUser,
    @Param('idPdpDet') idPdpDet: string,
    @Body(new ZodValidationPipe(tipoPagoSchema)) dto: TipoPagoDto,
  ) {
    return this.planes.actualizarTipoPago(idPdpDet, dto.tipoPago, actor.uid);
  }

  // ----- Config: Crear Plan de Pagos -----
  @Post('planes/plan-pagos')
  @RequierePermiso(610)
  async crearPlanPagos(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(crearPlanPagosSchema)) dto: CrearPlanPagosDto,
  ) {
    return this.planes.crearPlanPagos(dto, actor.uid);
  }

  // ============================ Dashboard gráfico (620) ============================

  @Get('reporte')
  @RequierePermiso(620)
  reporteGrafico(@Query('anio') anio?: string) {
    return this.dashboard.reporteGrafico(toNum(anio, new Date().getFullYear()));
  }

  // ============================ Reportes (620) ============================

  @Get('reportes/combos')
  @RequierePermiso(620)
  reporteCombos(@Query('sinA3') sinA3?: string) {
    return this.reportes.combosFiltros(toBool(sinA3));
  }

  @Get('reportes/filtros')
  @RequierePermiso(620)
  reporteFiltros(@Query('tipo') tipo: string, @Query('sinA3') sinA3?: string) {
    return this.reportes.valoresUnicos(toNum(tipo, 1), toBool(sinA3));
  }

  @Get('reportes/filtros-dependientes')
  @RequierePermiso(620)
  reporteFiltrosDependientes(
    @Query('razonsocial') razonsocial?: string,
    @Query('parque') parque?: string,
  ) {
    return this.reportes.filtrosDependientes(razonsocial, parque);
  }

  @Get('reportes/edo-cuenta')
  @RequierePermiso(620)
  reporteEdoCuenta(
    @Query('anio') anio?: string | string[],
    @Query('mes') mes?: string | string[],
    @Query('razonsocial') razonsocial?: string | string[],
    @Query('parque') parque?: string | string[],
    @Query('propiedad') propiedad?: string | string[],
  ) {
    return this.reportes.estadoCuenta({
      anios: toNumArr(anio),
      meses: toNumArr(mes),
      razonsocial: toArr(razonsocial),
      parque: toArr(parque),
      propiedad: toArr(propiedad),
    });
  }

  @Get('reportes/vencidos')
  @RequierePermiso(620)
  reporteVencidos(
    @Query('anio') anio?: string | string[],
    @Query('mes') mes?: string | string[],
    @Query('razonsocial') razonsocial?: string | string[],
    @Query('parque') parque?: string | string[],
    @Query('propiedad') propiedad?: string | string[],
  ) {
    return this.reportes.saldosVencidos({
      anios: toNumArr(anio),
      meses: toNumArr(mes),
      razonsocial: toArr(razonsocial),
      parque: toArr(parque),
      propiedad: toArr(propiedad),
    });
  }

  @Get('reportes/vencidos-resumen')
  @RequierePermiso(620)
  reporteVencidosResumen(
    @Query('anio') anio?: string | string[],
    @Query('mes') mes?: string | string[],
    @Query('razonsocial') razonsocial?: string | string[],
  ) {
    return this.reportes.resumenVencidos({
      anios: toNumArr(anio),
      meses: toNumArr(mes),
      razonsocial: toArr(razonsocial),
    });
  }

  @Get('reportes/vencidos-evolucion')
  @RequierePermiso(620)
  reporteVencidosEvolucion(
    @Query('razonsocial') razonsocial?: string | string[],
    @Query('parque') parque?: string | string[],
  ) {
    return this.reportes.evolucionVencidos(toArr(razonsocial), toArr(parque));
  }

  // ============================ Escrituras (630) ============================

  @Get('escrituras')
  @RequierePermiso(630)
  listarEscrituras() {
    return this.escrituras.listar();
  }

  @Patch('escrituras/:idPdpDet/fecha')
  @RequierePermiso(630)
  async actualizarFechaEscritura(
    @CurrentUser() actor: AuthUser,
    @Param('idPdpDet') idPdpDet: string,
    @Body(new ZodValidationPipe(escrituraFechaSchema)) dto: EscrituraFechaDto,
  ) {
    return this.escrituras.actualizarFecha(idPdpDet, dto.fecha, actor.uid);
  }

  @Patch('escrituras/:idPdpDet/monto')
  @RequierePermiso(630)
  async actualizarMontoEscritura(
    @CurrentUser() actor: AuthUser,
    @Param('idPdpDet') idPdpDet: string,
    @Body(new ZodValidationPipe(escrituraMontoSchema)) dto: EscrituraMontoDto,
  ) {
    return this.escrituras.actualizarMonto(idPdpDet, dto.monto, actor.uid);
  }
}
