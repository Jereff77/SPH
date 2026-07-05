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
import { PlanesArreService } from './planes-arre.service.js';
import { CobranzaService } from './cobranza.service.js';
import { ReportesArreService } from './reportes-arre.service.js';
import {
  aplicarPagoSchema,
  cancelarAnticipadoSchema,
  conceptoFinanciadoSchema,
  crearPlanRentaSchema,
  agregarConceptoPartidaSchema,
  desaplicarPagoSchema,
  docArreSchema,
  editarCampoSchema,
  quitarSugerenciaSchema,
  renovarPlanSchema,
  vincularNaveArreSchema,
  liberarNaveArreSchema,
  type AgregarConceptoPartidaDto,
  type AplicarPagoDto,
  type CancelarAnticipadoDto,
  type ConceptoFinanciadoDto,
  type CrearPlanRentaDto,
  type DesaplicarPagoDto,
  type DocArreDto,
  type EditarCampoDto,
  type QuitarSugerenciaDto,
  type RenovarPlanDto,
  type VincularNaveArreDto,
  type LiberarNaveArreDto,
} from './arrendatarios.schemas.js';
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

function toNum(v: string | undefined): number | undefined {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function toBool(v: string | undefined): boolean {
  return v === 'true' || v === '1';
}
/** Query repetible (`?x=a&x=b`) o único → arreglo de números finitos (o undefined). */
function toNumArr(v: string | string[] | undefined): number[] | undefined {
  if (v == null) return undefined;
  const arr = (Array.isArray(v) ? v : [v]).map((s) => Number(s?.trim())).filter((n) => Number.isFinite(n));
  return arr.length ? [...new Set(arr)] : undefined;
}

/**
 * Módulo Arrendatarios. Planes de Renta (clave 20) y Dashboard de cobranza
 * (clave 10). Todas las escrituras se auditan (comoActor) y el cálculo de la
 * corrida se delega en las RPCs `arrepdp_*` existentes.
 */
@Controller('arrendatarios')
@UseGuards(JwtAuthGuard, PermisoGuard)
export class ArrendatariosController {
  constructor(
    private readonly planes: PlanesArreService,
    private readonly cobranza: CobranzaService,
    private readonly reportes: ReportesArreService,
  ) {}

  // ============================ Planes de Renta (20) ============================

  @Get('lista')
  @RequierePermiso(20)
  lista() {
    return this.planes.arrendatarios();
  }

  @Get(':id/propiedades')
  @RequierePermiso(20)
  propiedades(@Param('id') id: string) {
    return this.planes.propiedadesDe(id);
  }

  @Get('propiedades/:idNavArrend/planes')
  @RequierePermiso(20)
  planesDe(
    @Param('idNavArrend') idNavArrend: string,
    @Query('idArrendador') idArrendador: string,
  ) {
    if (!idArrendador) throw new BadRequestException('Falta el arrendatario (idArrendador).');
    return this.planes.planesDe(idNavArrend, idArrendador);
  }

  @Get('planes/:idArrePdp/resumen')
  @RequierePermiso(20)
  resumen(@Param('idArrePdp') idArrePdp: string) {
    return this.planes.resumenPlan(idArrePdp);
  }

  @Get('planes/:idArrePdp/detalle')
  @RequierePermiso(20)
  detalle(@Param('idArrePdp') idArrePdp: string, @Query('numPartida') numPartida?: string) {
    return this.planes.detallePlan(idArrePdp, toNum(numPartida));
  }

  @Post('propiedades/:idNavArrend/planes')
  @RequierePermiso(25)
  crearPlan(
    @CurrentUser() actor: AuthUser,
    @Param('idNavArrend') idNavArrend: string,
    @Body(new ZodValidationPipe(crearPlanRentaSchema)) dto: CrearPlanRentaDto,
  ) {
    return this.planes.crearPlan(idNavArrend, dto, actor.uid);
  }

  @Patch('planes/:idArrePdp/detalle')
  @RequierePermiso(20)
  async editarCampo(
    @CurrentUser() actor: AuthUser,
    @Param('idArrePdp') idArrePdp: string,
    @Body(new ZodValidationPipe(editarCampoSchema)) dto: EditarCampoDto,
  ) {
    await this.planes.editarCampo(idArrePdp, dto, actor.uid);
    return { ok: true };
  }

  @Post('planes/:idArrePdp/conceptos')
  @RequierePermiso(25)
  async agregarConcepto(
    @CurrentUser() actor: AuthUser,
    @Param('idArrePdp') idArrePdp: string,
    @Body(new ZodValidationPipe(conceptoFinanciadoSchema)) dto: ConceptoFinanciadoDto,
  ) {
    await this.planes.agregarConcepto(idArrePdp, dto, actor.uid);
    return { ok: true };
  }

  @Delete('planes/:idArrePdp/conceptos/:concepto')
  @RequierePermiso(25)
  async eliminarConcepto(
    @CurrentUser() actor: AuthUser,
    @Param('idArrePdp') idArrePdp: string,
    @Param('concepto') concepto: string,
  ) {
    await this.planes.eliminarConcepto(idArrePdp, decodeURIComponent(concepto), actor.uid);
    return { ok: true };
  }

  @Post('planes/:idArrePdp/activar')
  @RequierePermiso(25)
  async activar(
    @CurrentUser() actor: AuthUser,
    @Query('idNavArrend') idNavArrend: string,
  ) {
    if (!idNavArrend) throw new BadRequestException('Falta idNavArrend.');
    await this.planes.setActivo(idNavArrend, true, actor.uid);
    return { ok: true };
  }

  @Post('planes/:idArrePdp/desactivar')
  @RequierePermiso(25)
  async desactivar(
    @CurrentUser() actor: AuthUser,
    @Query('idNavArrend') idNavArrend: string,
  ) {
    if (!idNavArrend) throw new BadRequestException('Falta idNavArrend.');
    await this.planes.setActivo(idNavArrend, false, actor.uid);
    return { ok: true };
  }

  @Delete('planes/:idArrePdp')
  @RequierePermiso(25)
  eliminarPlan(@CurrentUser() actor: AuthUser, @Param('idArrePdp') idArrePdp: string) {
    return this.planes.eliminarPlan(idArrePdp, actor.uid);
  }

  // ----- Renovación (clave 23) -----
  @Get('planes/:idArrePdp/renovacion-precarga')
  @RequierePermiso(23)
  renovacionPrecarga(@Param('idArrePdp') idArrePdp: string) {
    return this.planes.precargaRenovacion(idArrePdp);
  }

  @Post('planes/:idArrePdp/renovar')
  @RequierePermiso(23)
  renovar(
    @CurrentUser() actor: AuthUser,
    @Param('idArrePdp') idArrePdp: string,
    @Body(new ZodValidationPipe(renovarPlanSchema)) dto: RenovarPlanDto,
  ) {
    return this.planes.renovar(idArrePdp, dto, actor.uid);
  }

  // ----- Cancelación anticipada (clave 22) -----
  @Get('planes/:idArrePdp/cancelacion-precarga')
  @RequierePermiso(22)
  cancelacionPrecarga(@Param('idArrePdp') idArrePdp: string) {
    return this.planes.precargaCancelacion(idArrePdp);
  }

  @Post('planes/:idArrePdp/cancelar')
  @RequierePermiso(22)
  cancelar(
    @CurrentUser() actor: AuthUser,
    @Param('idArrePdp') idArrePdp: string,
    @Body(new ZodValidationPipe(cancelarAnticipadoSchema)) dto: CancelarAnticipadoDto,
  ) {
    return this.planes.cancelarAnticipado(idArrePdp, dto, actor.uid);
  }

  // ----- Config: Datos generales (solo lectura) — clave 25 -----
  @Get(':id/datos')
  @RequierePermiso(25)
  datos(@Param('id') id: string) {
    return this.planes.datosGenerales(id);
  }

  // ----- Config: Documentos — clave 25 -----
  @Get(':id/documentos')
  @RequierePermiso(25)
  docs(@Param('id') id: string) {
    return this.planes.listarDocs(id);
  }

  @Post('documentos')
  @RequierePermiso(25)
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: LIMITE_ARCHIVO } }))
  async subirDoc(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(docArreSchema)) dto: DocArreDto,
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

  @Delete('documentos/:idDocumento')
  @RequierePermiso(25)
  async eliminarDoc(
    @CurrentUser() actor: AuthUser,
    @Param('idDocumento') idDocumento: string,
  ) {
    await this.planes.eliminarDoc(idDocumento, actor.uid);
    return { ok: true };
  }

  // ----- Config: Propiedades — clave 25 -----
  @Get('parques')
  @RequierePermiso(25)
  parques() {
    return this.planes.parquesDisponibles();
  }

  @Get('naves-disponibles')
  @RequierePermiso(25)
  navesDisponibles(@Query('idParque') idParque?: string) {
    return this.planes.navesDisponibles(idParque || undefined);
  }

  @Post('propiedades')
  @RequierePermiso(25)
  vincularNave(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(vincularNaveArreSchema)) dto: VincularNaveArreDto,
  ) {
    return this.planes.vincularNave(dto, actor.uid);
  }

  @Post('propiedades/:idNavArrend/liberar')
  @RequierePermiso(24)
  async liberarNave(
    @CurrentUser() actor: AuthUser,
    @Param('idNavArrend') idNavArrend: string,
    @Body(new ZodValidationPipe(liberarNaveArreSchema)) dto: LiberarNaveArreDto,
  ) {
    await this.planes.liberarNave(idNavArrend, actor.uid, dto.motivo);
    return { ok: true };
  }

  @Get('inpc')
  @RequierePermiso(20)
  inpc() {
    return this.planes.inpc();
  }

  // ============================ Reportes (20 — acceso al módulo) ============================

  @Get('reportes/cancelaciones')
  @RequierePermiso(20)
  reporteCancelaciones(
    @Query('anio') anio?: string,
    @Query('parque') parque?: string,
    @Query('busqueda') busqueda?: string,
  ) {
    return this.reportes.cancelaciones({
      anio: toNum(anio),
      parque: parque || undefined,
      busqueda: busqueda || undefined,
    });
  }

  @Get('reportes/vencimientos')
  @RequierePermiso(20)
  reporteVencimientos() {
    return this.reportes.vencimientos();
  }

  @Get('reportes/estado-cuenta/opciones')
  @RequierePermiso(20)
  estadoCuentaOpciones() {
    return this.reportes.estadoCuentaOpciones();
  }

  @Get('reportes/estado-cuenta/:idArrePdp')
  @RequierePermiso(20)
  estadoCuentaCorrida(@Param('idArrePdp') idArrePdp: string) {
    return this.reportes.estadoCuentaCorrida(idArrePdp);
  }

  // ============================ Cobranza (10) ============================

  @Get('cobranza/filtros')
  @RequierePermiso(10)
  filtrosCobranza() {
    return this.cobranza.filtros();
  }

  @Get('cobranza/pagos')
  @RequierePermiso(10)
  pagosCobranza(
    @Query('anio') anio?: string | string[],
    @Query('mes') mes?: string | string[],
    @Query('parque') parque?: string,
    @Query('arrendatario') arrendatario?: string,
    @Query('soloPendientes') soloPendientes?: string,
  ) {
    return this.cobranza.pagos({
      anios: toNumArr(anio),
      meses: toNumArr(mes),
      parque: parque || undefined,
      arrendatario: arrendatario || undefined,
      soloPendientes: toBool(soloPendientes),
    });
  }

  @Get('cobranza/contratos-por-vencer')
  @RequierePermiso(10)
  contratosPorVencer(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.cobranza.contratosPorVencer(desde || undefined, hasta || undefined);
  }

  @Get('cobranza/contratos-vencidos')
  @RequierePermiso(10)
  contratosVencidos() {
    return this.cobranza.contratosVencidos();
  }

  @Get('cobranza/depositos-sin-aplicar')
  @RequierePermiso(10)
  depositos(
    @Query('busqueda') busqueda?: string,
    @Query('anio') anio?: string,
    @Query('mes') mes?: string,
    @Query('idArrePdp') idArrePdp?: string,
  ) {
    return this.cobranza.depositosSinAplicar(
      busqueda || undefined,
      toNum(anio),
      toNum(mes),
      idArrePdp || undefined,
    );
  }

  /** Todas las partidas pendientes del arrendatario (cualquier mes), para el modal de pago. */
  @Get('cobranza/partidas-pendientes')
  @RequierePermiso(10)
  partidasPendientes(@Query('arrendatario') arrendatario?: string) {
    return this.cobranza.partidasPendientesArrendatario(arrendatario ?? '');
  }

  /** Margen de tolerancia (centavos) configurable para aplicar pagos. */
  @Get('cobranza/tolerancia-pago')
  @RequierePermiso(10)
  toleranciaPago() {
    return this.cobranza.toleranciaConfig();
  }

  @Post('cobranza/aplicar-pago')
  @RequierePermiso(10)
  aplicarPago(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(aplicarPagoSchema)) dto: AplicarPagoDto,
  ) {
    return this.cobranza.aplicarPago(dto, actor.uid);
  }

  /** Desaplica (revierte) un pago previamente aplicado, por su `uidPago`. */
  @Post('cobranza/desaplicar-pago')
  @RequierePermiso(10)
  desaplicarPago(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(desaplicarPagoSchema)) dto: DesaplicarPagoDto,
  ) {
    return this.cobranza.desaplicarPago(dto.uidPago, actor.uid, dto.motivo);
  }

  /** Quita una sugerencia (mapeo ordenante↔arrendatario) — ⭐ del modal de pago. */
  @Post('cobranza/quitar-sugerencia')
  @RequierePermiso(10)
  quitarSugerencia(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(quitarSugerenciaSchema)) dto: QuitarSugerenciaDto,
  ) {
    return this.cobranza.quitarSugerencia(dto.idArrePdp, dto.ordenante, actor.uid);
  }

  /** Agrega un concepto libre (penalización/interés) a una partida (mes/nave). */
  @Post('cobranza/agregar-concepto')
  @RequierePermiso(10)
  agregarConceptoCobranza(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(agregarConceptoPartidaSchema)) dto: AgregarConceptoPartidaDto,
  ) {
    return this.cobranza.agregarConcepto(dto.idArrePdpDet, dto.concepto, dto.monto, actor.uid);
  }

  /** Registro de movimientos: historial de pagos aplicados/desaplicados. */
  @Get('cobranza/historial-pagos')
  @RequierePermiso(10)
  historialPagos(
    @Query('idArrendador') idArrendador?: string,
    @Query('idArrePdp') idArrePdp?: string,
    @Query('anio') anio?: string,
    @Query('mes') mes?: string,
    @Query('limite') limite?: string,
  ) {
    return this.cobranza.historialPagos({
      idArrendador: idArrendador || undefined,
      idArrePdp: idArrePdp || undefined,
      anio: toNum(anio),
      mes: toNum(mes),
      limite: toNum(limite),
    });
  }

  /** Detalle de una aplicación (`uidPago`): a qué naves/conceptos/meses se aplicó y cuánto. */
  @Get('cobranza/aplicacion-detalle')
  @RequierePermiso(10)
  aplicacionDetalle(@Query('uidPago') uidPago?: string) {
    return this.cobranza.detalleAplicacion(uidPago ?? '');
  }

  /**
   * Importa un estado de cuenta de BanBajío (.xlsx) y registra los SPEI Recibido
   * faltantes en `movbancarios` (anti-duplicado por rastreo). Devuelve el resumen.
   */
  @Post('cobranza/importar-estado-cuenta')
  @RequierePermiso(10)
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: LIMITE_ARCHIVO } }))
  importarEstadoCuenta(
    @CurrentUser() actor: AuthUser,
    @UploadedFile() archivo?: Express.Multer.File,
  ) {
    if (!archivo) throw new BadRequestException('Falta el archivo del estado de cuenta.');
    const esXlsx =
      archivo.mimetype ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      archivo.mimetype === 'application/vnd.ms-excel' ||
      /\.xlsx?$/i.test(archivo.originalname ?? '');
    if (!esXlsx) throw new BadRequestException('El archivo debe ser un Excel (.xlsx).');
    return this.cobranza.importarEstadoCuenta(archivo.buffer, actor.uid);
  }
}
