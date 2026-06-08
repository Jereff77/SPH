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
import {
  aplicarPagoSchema,
  conceptoFinanciadoSchema,
  crearPlanRentaSchema,
  docArreSchema,
  editarCampoSchema,
  vincularNaveArreSchema,
  type AplicarPagoDto,
  type ConceptoFinanciadoDto,
  type CrearPlanRentaDto,
  type DocArreDto,
  type EditarCampoDto,
  type VincularNaveArreDto,
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
  @RequierePermiso(20)
  crearPlan(
    @CurrentUser() actor: AuthUser,
    @Param('idNavArrend') idNavArrend: string,
    @Body(new ZodValidationPipe(crearPlanRentaSchema)) dto: CrearPlanRentaDto,
  ) {
    // El idNavArrend de la ruta manda sobre el del body.
    return this.planes.crearPlan({ ...dto, idNavArrend }, actor.uid);
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
  @RequierePermiso(20)
  async agregarConcepto(
    @CurrentUser() actor: AuthUser,
    @Param('idArrePdp') idArrePdp: string,
    @Body(new ZodValidationPipe(conceptoFinanciadoSchema)) dto: ConceptoFinanciadoDto,
  ) {
    await this.planes.agregarConcepto(idArrePdp, dto, actor.uid);
    return { ok: true };
  }

  @Delete('planes/:idArrePdp/conceptos/:concepto')
  @RequierePermiso(20)
  async eliminarConcepto(
    @CurrentUser() actor: AuthUser,
    @Param('idArrePdp') idArrePdp: string,
    @Param('concepto') concepto: string,
  ) {
    await this.planes.eliminarConcepto(idArrePdp, decodeURIComponent(concepto), actor.uid);
    return { ok: true };
  }

  @Post('planes/:idArrePdp/activar')
  @RequierePermiso(20)
  async activar(
    @CurrentUser() actor: AuthUser,
    @Query('idNavArrend') idNavArrend: string,
  ) {
    if (!idNavArrend) throw new BadRequestException('Falta idNavArrend.');
    await this.planes.setActivo(idNavArrend, true, actor.uid);
    return { ok: true };
  }

  @Post('planes/:idArrePdp/desactivar')
  @RequierePermiso(20)
  async desactivar(
    @CurrentUser() actor: AuthUser,
    @Query('idNavArrend') idNavArrend: string,
  ) {
    if (!idNavArrend) throw new BadRequestException('Falta idNavArrend.');
    await this.planes.setActivo(idNavArrend, false, actor.uid);
    return { ok: true };
  }

  @Delete('planes/:idArrePdp')
  @RequierePermiso(20)
  eliminarPlan(@CurrentUser() actor: AuthUser, @Param('idArrePdp') idArrePdp: string) {
    return this.planes.eliminarPlan(idArrePdp, actor.uid);
  }

  // ----- Config: Datos generales (solo lectura) -----
  @Get(':id/datos')
  @RequierePermiso(20)
  datos(@Param('id') id: string) {
    return this.planes.datosGenerales(id);
  }

  // ----- Config: Documentos -----
  @Get(':id/documentos')
  @RequierePermiso(20)
  docs(@Param('id') id: string) {
    return this.planes.listarDocs(id);
  }

  @Post('documentos')
  @RequierePermiso(20)
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
  @RequierePermiso(20)
  async eliminarDoc(
    @CurrentUser() actor: AuthUser,
    @Param('idDocumento') idDocumento: string,
  ) {
    await this.planes.eliminarDoc(idDocumento, actor.uid);
    return { ok: true };
  }

  // ----- Config: Propiedades -----
  @Get('parques')
  @RequierePermiso(20)
  parques() {
    return this.planes.parquesDisponibles();
  }

  @Get('naves-disponibles')
  @RequierePermiso(20)
  navesDisponibles(@Query('idParque') idParque?: string) {
    return this.planes.navesDisponibles(idParque || undefined);
  }

  @Post('propiedades')
  @RequierePermiso(20)
  vincularNave(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(vincularNaveArreSchema)) dto: VincularNaveArreDto,
  ) {
    return this.planes.vincularNave(dto, actor.uid);
  }

  @Get('inpc')
  @RequierePermiso(20)
  inpc() {
    return this.planes.inpc();
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
    @Query('anio') anio?: string,
    @Query('mes') mes?: string,
    @Query('parque') parque?: string,
    @Query('arrendatario') arrendatario?: string,
    @Query('soloPendientes') soloPendientes?: string,
  ) {
    return this.cobranza.pagos({
      anio: toNum(anio),
      mes: toNum(mes),
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
  ) {
    return this.cobranza.depositosSinAplicar(busqueda || undefined, toNum(anio), toNum(mes));
  }

  @Post('cobranza/aplicar-pago')
  @RequierePermiso(10)
  aplicarPago(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(aplicarPagoSchema)) dto: AplicarPagoDto,
  ) {
    return this.cobranza.aplicarPago(dto, actor.uid);
  }
}
