import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KardexService } from './kardex.service.js';
import { DispersionesService } from './dispersiones.service.js';
import { ContabilidadService } from './contabilidad.service.js';
import { ConsultasService } from './consultas.service.js';
import { AportacionesService } from './aportaciones.service.js';
import { ConfigFideService } from './config-fide.service.js';
import { PagosVentaService } from '../ventas/pagos-venta.service.js';
import { EscriturasService } from '../ventas/escrituras.service.js';
import { PlanesService } from '../ventas/planes.service.js';
import {
  celdaSchema,
  conceptoSchema,
  condicionesSchema,
  crearPdpSchema,
  ivaSchema,
  montoPartidaSchema,
  movimientoContaSchema,
  naveTicketSchema,
  saldoSchema,
  tipoPartidaSchema,
  type CeldaDto,
  type ConceptoDto,
  type CondicionesDto,
  type CrearPdpDto,
  type IvaDto,
  type MontoPartidaDto,
  type MovimientoContaDto,
  type NaveTicketDto,
  type SaldoDto,
  type TipoPartidaDto,
} from './fideicomiso.schemas.js';
import {
  comentarioSchema,
  docSchema,
  escrituraFechaSchema,
  inversionistaSchema,
  registrarPagoSchema,
  type ComentarioDto,
  type DocDto,
  type EscrituraFechaDto,
  type InversionistaDto,
  type RegistrarPagoDto,
} from '../ventas/ventas.schemas.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';

/**
 * Módulo Fideicomiso. Claves de permiso del catálogo `segModulos` (idénticas a
 * v1): 500 Dashboard · 510 Aportaciones · 520 Adhesiones (y Contabilidad, que en
 * v1 comparte la 520) · 530 Dispersión · 540 Reportes (Kardex). El Dashboard y
 * Adhesiones son la MISMA vista (`v_fideicomiso`). Todo el acceso a datos pasa
 * por el backend; el front nunca toca Supabase.
 */
const LIMITE_ARCHIVO = 15 * 1024 * 1024; // 15 MB
const EXT_POR_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Controller('fideicomiso')
@UseGuards(JwtAuthGuard, PermisoGuard)
export class FideicomisoController {
  constructor(
    private readonly kardex: KardexService,
    private readonly dispersiones: DispersionesService,
    private readonly contabilidad: ContabilidadService,
    private readonly consultas: ConsultasService,
    private readonly aportaciones: AportacionesService,
    private readonly configFide: ConfigFideService,
    private readonly pagos: PagosVentaService,
    private readonly escrituras: EscriturasService,
    private readonly planes: PlanesService,
  ) {}

  // ============================ Reportes / Kardex (540) ============================

  @Get('kardex/inversionistas')
  @RequierePermiso(540)
  kardexInversionistas() {
    return this.kardex.inversionistas();
  }

  @Get('kardex/propiedades')
  @RequierePermiso(540)
  kardexPropiedades(@Query('inversionista') inversionista?: string) {
    const nombre = (inversionista ?? '').trim();
    if (!nombre) throw new BadRequestException('Falta el inversionista.');
    return this.kardex.propiedadesDe(nombre);
  }

  @Get('kardex')
  @RequierePermiso(540)
  kardexReporte(
    @Query('inversionista') inversionista?: string,
    @Query('propiedad') propiedad?: string,
  ) {
    const nombre = (inversionista ?? '').trim();
    if (!nombre) throw new BadRequestException('Falta el inversionista.');
    const prop = (propiedad ?? '').trim() || undefined;
    return this.kardex.kardex(nombre, prop);
  }

  // ========================== Dispersiones (530) ==========================

  @Get('dispersiones/opciones')
  @RequierePermiso(530)
  dispersionesOpciones() {
    return this.dispersiones.opciones();
  }

  @Get('dispersiones/resumen')
  @RequierePermiso(530)
  dispersionesResumen(
    @Query('idFide') idFide?: string,
    @Query('noDispersion') noDispersion?: string,
  ) {
    if (!idFide || !noDispersion)
      throw new BadRequestException('Faltan idFide y noDispersion.');
    return this.dispersiones.resumenCompleto(idFide, noDispersion);
  }

  @Get('dispersiones/plan')
  @RequierePermiso(530)
  dispersionesPlan(
    @Query('idFide') idFide?: string,
    @Query('noAdhesion') noAdhesion?: string,
    @Query('noDispersion') noDispersion?: string,
  ) {
    if (!idFide || !noAdhesion)
      throw new BadRequestException('Faltan idFide y noAdhesion.');
    return this.dispersiones.planAdhesion(idFide, noAdhesion, noDispersion);
  }

  @Get('dispersiones/resumen-adhesion')
  @RequierePermiso(530)
  dispersionesResumenAdhesion(
    @Query('idFide') idFide?: string,
    @Query('noAdhesion') noAdhesion?: string,
    @Query('noDispersion') noDispersion?: string,
  ) {
    if (!idFide || !noAdhesion || !noDispersion)
      throw new BadRequestException(
        'Faltan idFide, noAdhesion y noDispersion.',
      );
    return this.dispersiones.resumenAdhesion(idFide, noAdhesion, noDispersion);
  }

  // =========================== Contabilidad (520) ===========================

  @Get('contabilidad/pivote')
  @RequierePermiso(520)
  contabilidadPivote(@Query('anio') anio?: string) {
    return this.contabilidad.pivote(this.parseAnio(anio));
  }

  @Get('contabilidad/totales')
  @RequierePermiso(520)
  contabilidadTotales(@Query('anio') anio?: string) {
    return this.contabilidad.totales(this.parseAnio(anio));
  }

  @Get('contabilidad/conceptos')
  @RequierePermiso(520)
  contabilidadConceptos() {
    return this.contabilidad.conceptos();
  }

  @Get('contabilidad/saldos')
  @RequierePermiso(520)
  contabilidadSaldos(@Query('anio') anio?: string) {
    return this.contabilidad.saldos(this.parseAnio(anio));
  }

  @Post('contabilidad/movimientos')
  @RequierePermiso(520)
  crearMovimiento(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(movimientoContaSchema)) dto: MovimientoContaDto,
  ) {
    return this.contabilidad.crearMovimiento(dto, actor.uid);
  }

  @Patch('contabilidad/celda')
  @RequierePermiso(520)
  editarCelda(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(celdaSchema)) dto: CeldaDto,
  ) {
    return this.contabilidad.guardarCelda(dto, actor.uid);
  }

  @Patch('contabilidad/celda-iva')
  @RequierePermiso(520)
  toggleIva(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(ivaSchema)) dto: IvaDto,
  ) {
    return this.contabilidad.toggleIva(dto, actor.uid);
  }

  @Post('contabilidad/conceptos')
  @RequierePermiso(520)
  crearConcepto(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(conceptoSchema)) dto: ConceptoDto,
  ) {
    return this.contabilidad.crearConcepto(dto, actor.uid);
  }

  @Put('contabilidad/saldos')
  @RequierePermiso(520)
  guardarSaldo(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(saldoSchema)) dto: SaldoDto,
  ) {
    return this.contabilidad.guardarSaldo(dto, actor.uid);
  }

  @Delete('contabilidad/saldos')
  @RequierePermiso(520)
  eliminarSaldo(
    @CurrentUser() actor: AuthUser,
    @Query('anio') anio?: string,
    @Query('mes') mes?: string,
  ) {
    const m = Number(mes);
    if (!Number.isInteger(m) || m < 1 || m > 12)
      throw new BadRequestException('Mes inválido.');
    return this.contabilidad.eliminarSaldo(this.parseAnio(anio), m, actor.uid);
  }

  // ===================== Aportaciones (510) / Adhesiones (520) =====================

  @Get('aportaciones/inversionistas')
  @RequierePermiso(510)
  aportacionesInversionistas() {
    return this.consultas.inversionistasTicket();
  }

  @Get('aportaciones/propiedades')
  @RequierePermiso(510)
  aportacionesPropiedades(@Query('inversionista') inversionista?: string) {
    const id = (inversionista ?? '').trim();
    if (!id) throw new BadRequestException('Falta el inversionista.');
    return this.consultas.propiedadesTicket(id);
  }

  @Get('aportaciones/pagos')
  @RequierePermiso(510)
  aportacionesPagos(@Query('propiedad') propiedad?: string) {
    const id = (propiedad ?? '').trim();
    if (!id) throw new BadRequestException('Falta la propiedad.');
    return this.consultas.pagos(id);
  }

  // ----- Pagos de una partida (icono $) -----
  @Get('aportaciones/pagos-detalle/:idPdpDet')
  @RequierePermiso(510)
  aportacionesPagosDetalle(@Param('idPdpDet') idPdpDet: string) {
    return this.aportaciones.pagosDetalle(idPdpDet);
  }

  @Post('aportaciones/pagos/:idPdpDet')
  @RequierePermiso(510)
  @UseInterceptors(FileInterceptor('comprobante', { limits: { fileSize: LIMITE_ARCHIVO } }))
  registrarPagoAportacion(
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

  @Delete('aportaciones/pagos/:idPago')
  @RequierePermiso(510)
  async eliminarPagoAportacion(
    @CurrentUser() actor: AuthUser,
    @Param('idPago') idPago: string,
  ) {
    await this.pagos.eliminarPago(idPago, actor.uid);
    return { ok: true };
  }

  // ----- Comentarios de una partida (icono 💬) -----
  @Get('aportaciones/comentarios/:idPdpDet')
  @RequierePermiso(510)
  aportacionesComentarios(@Param('idPdpDet') idPdpDet: string) {
    return this.aportaciones.comentarios(idPdpDet);
  }

  @Post('aportaciones/comentarios/:idPdpDet')
  @RequierePermiso(510)
  agregarComentarioAportacion(
    @CurrentUser() actor: AuthUser,
    @Param('idPdpDet') idPdpDet: string,
    @Body(new ZodValidationPipe(comentarioSchema)) dto: ComentarioDto,
  ) {
    return this.aportaciones.agregarComentario(idPdpDet, dto.comentario, actor.uid);
  }

  // ----- Editar Fecha Plan de la partida (pdpDetalle.fecha) -----
  @Patch('aportaciones/partida/:idPdpDet/fecha')
  @RequierePermiso(510)
  editarFechaPlan(
    @CurrentUser() actor: AuthUser,
    @Param('idPdpDet') idPdpDet: string,
    @Body(new ZodValidationPipe(escrituraFechaSchema)) dto: EscrituraFechaDto,
  ) {
    return this.escrituras.actualizarFecha(idPdpDet, dto.fecha, actor.uid);
  }

  // ================== Configuración del propietario (engrane ⚙️, 510) ==================
  // Réplica completa de `config_propietario_fide` de v1. Datos del inversionista y
  // documentos se delegan en PlanesService; el resto (condiciones, naves-ticket, PDP)
  // en ConfigFideService.

  @Get('config/propiedades')
  @RequierePermiso(510)
  cfgPropiedades(@Query('inversionista') inversionista?: string) {
    const id = (inversionista ?? '').trim();
    if (!id) throw new BadRequestException('Falta el inversionista.');
    return this.configFide.propiedadesDeInversionista(id);
  }

  @Get('config/propiedades-fide')
  @RequierePermiso(510)
  cfgPropiedadesFide(@Query('inversionista') inversionista?: string) {
    const id = (inversionista ?? '').trim();
    if (!id) throw new BadRequestException('Falta el inversionista.');
    return this.configFide.propiedadesFide(id);
  }

  // ----- Datos del inversionista -----
  @Get('config/inversionista/:id')
  @RequierePermiso(510)
  cfgGetInversionista(@Param('id') id: string) {
    return this.planes.getInversionista(id);
  }

  @Patch('config/inversionista/:id')
  @RequierePermiso(510)
  async cfgActualizarInversionista(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(inversionistaSchema)) dto: InversionistaDto,
  ) {
    await this.planes.actualizarInversionista(id, dto, actor.uid);
    return { ok: true };
  }

  // ----- Documentos -----
  @Get('config/docs')
  @RequierePermiso(510)
  cfgDocs(@Query('inversionista') inversionista?: string) {
    const id = (inversionista ?? '').trim();
    if (!id) throw new BadRequestException('Falta el inversionista.');
    return this.planes.listarDocs(id);
  }

  @Post('config/docs')
  @RequierePermiso(510)
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: LIMITE_ARCHIVO } }))
  cfgSubirDoc(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(docSchema)) dto: DocDto,
    @UploadedFile() archivo?: Express.Multer.File,
  ) {
    if (!archivo) throw new BadRequestException('Falta el archivo.');
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

  @Delete('config/docs/:idDocumento')
  @RequierePermiso(510)
  async cfgEliminarDoc(@CurrentUser() actor: AuthUser, @Param('idDocumento') idDocumento: string) {
    await this.planes.eliminarDoc(idDocumento, actor.uid);
    return { ok: true };
  }

  // ----- Condiciones (fideCondiciones) -----
  @Get('config/condiciones')
  @RequierePermiso(510)
  cfgCondiciones(@Query('propiedad') propiedad?: string) {
    const id = (propiedad ?? '').trim();
    if (!id) throw new BadRequestException('Falta la propiedad.');
    return this.configFide.condiciones(id);
  }

  @Post('config/condiciones')
  @RequierePermiso(510)
  cfgGuardarCondiciones(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(condicionesSchema)) dto: CondicionesDto,
  ) {
    return this.configFide.guardarCondiciones(dto, actor.uid);
  }

  // ----- Naves / Propiedades -----
  @Get('config/parques')
  @RequierePermiso(510)
  cfgParques() {
    return this.configFide.parquesTicket();
  }

  @Post('config/naves')
  @RequierePermiso(510)
  cfgCrearNave(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(naveTicketSchema)) dto: NaveTicketDto,
  ) {
    return this.configFide.crearNaveProp(dto, actor.uid);
  }

  @Delete('config/propiedades/:idPropiedad')
  @RequierePermiso(510)
  cfgEliminarPropiedad(@CurrentUser() actor: AuthUser, @Param('idPropiedad') idPropiedad: string) {
    return this.configFide.eliminarPropiedad(idPropiedad, actor.uid);
  }

  // ----- PDP -----
  @Get('config/pdp')
  @RequierePermiso(510)
  cfgPdp(@Query('propiedad') propiedad?: string) {
    const id = (propiedad ?? '').trim();
    if (!id) throw new BadRequestException('Falta la propiedad.');
    return this.configFide.pdp(id);
  }

  @Post('config/pdp')
  @RequierePermiso(510)
  cfgCrearPdp(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(crearPdpSchema)) dto: CrearPdpDto,
  ) {
    return this.configFide.crearPdp(dto, actor.uid);
  }

  @Patch('config/partida/:idPdpDet/monto')
  @RequierePermiso(510)
  cfgEditarMonto(
    @CurrentUser() actor: AuthUser,
    @Param('idPdpDet') idPdpDet: string,
    @Body(new ZodValidationPipe(montoPartidaSchema)) dto: MontoPartidaDto,
  ) {
    return this.configFide.editarMonto(idPdpDet, dto.monto, actor.uid);
  }

  @Patch('config/partida/:idPdpDet/tipo')
  @RequierePermiso(510)
  cfgEditarTipo(
    @CurrentUser() actor: AuthUser,
    @Param('idPdpDet') idPdpDet: string,
    @Body(new ZodValidationPipe(tipoPartidaSchema)) dto: TipoPartidaDto,
  ) {
    return this.configFide.editarTipo(idPdpDet, dto.tipoPago, actor.uid);
  }

  @Patch('config/partida/:idPdpDet/fecha')
  @RequierePermiso(510)
  cfgEditarFecha(
    @CurrentUser() actor: AuthUser,
    @Param('idPdpDet') idPdpDet: string,
    @Body(new ZodValidationPipe(escrituraFechaSchema)) dto: EscrituraFechaDto,
  ) {
    return this.escrituras.actualizarFecha(idPdpDet, dto.fecha, actor.uid);
  }

  @Post('config/pdp/:idPdp/recalcular')
  @RequierePermiso(510)
  cfgRecalcular(@CurrentUser() actor: AuthUser, @Param('idPdp') idPdp: string) {
    return this.configFide.recalcularEnganche(idPdp, actor.uid);
  }

  @Patch('config/pdp/:idPropiedad/activar')
  @RequierePermiso(510)
  cfgActivarPdp(@CurrentUser() actor: AuthUser, @Param('idPropiedad') idPropiedad: string) {
    return this.configFide.activarPdp(idPropiedad, actor.uid);
  }

  @Patch('config/pdp/:idPropiedad/desactivar')
  @RequierePermiso(510)
  cfgDesactivarPdp(@CurrentUser() actor: AuthUser, @Param('idPropiedad') idPropiedad: string) {
    return this.configFide.desactivarPdp(idPropiedad, actor.uid);
  }

  @Delete('config/pdp')
  @RequierePermiso(510)
  cfgEliminarPdp(
    @CurrentUser() actor: AuthUser,
    @Query('propiedad') propiedad?: string,
    @Query('idPdp') idPdp?: string,
  ) {
    if (!propiedad || !idPdp) throw new BadRequestException('Faltan propiedad e idPdp.');
    return this.configFide.eliminarPdp(propiedad, idPdp, actor.uid);
  }

  // El Dashboard (clave 500) y Adhesiones (clave 520) son la MISMA vista de v1
  // (la tabla `v_fideicomiso`): se permite el acceso con cualquiera de las dos.
  @Get('adhesiones')
  @RequierePermiso(500, 520)
  adhesiones() {
    return this.consultas.adhesiones();
  }

  /** Año de contabilidad: si no llega, usa el año en curso (horario MX). */
  private parseAnio(anio?: string): number {
    if (anio && anio.trim() !== '') {
      const n = Number(anio);
      if (Number.isInteger(n) && n >= 2000 && n <= 2100) return n;
      throw new BadRequestException('Año inválido.');
    }
    return Number(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
      }).format(new Date()),
    );
  }
}
