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
import {
  comentarioSchema,
  crearPlanPagosSchema,
  docSchema,
  inversionistaSchema,
  propiedadSchema,
  registrarPagoSchema,
  type CrearPlanPagosDto,
  type DocDto,
  type InversionistaDto,
  type PropiedadDto,
  type RegistrarPagoDto,
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
    @Query('activo') activo?: string,
  ) {
    const ahora = new Date();
    return this.dashboard.tabla({
      anio: toNum(anio, ahora.getFullYear()),
      mes: toNum(mes, ahora.getMonth() + 1),
      activo: activo === undefined ? true : toBool(activo),
    });
  }

  @Get('dashboard/tarjetas')
  @RequierePermiso(600)
  tarjetas(
    @Query('anio') anio?: string,
    @Query('mes') mes?: string,
    @Query('activo') activo?: string,
  ) {
    const ahora = new Date();
    return this.dashboard.tarjetas(
      toNum(anio, ahora.getFullYear()),
      toNum(mes, ahora.getMonth() + 1),
      activo === undefined ? true : toBool(activo),
    );
  }

  @Get('dashboard/rentas')
  @RequierePermiso(600)
  rentas(
    @Query('anio') anio?: string,
    @Query('mes') mes?: string,
    @Query('tipo') tipo?: string,
  ) {
    const ahora = new Date();
    return this.dashboard.rentas(
      toNum(anio, ahora.getFullYear()),
      toNum(mes, ahora.getMonth() + 1),
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

  // ----- Config: Crear Plan de Pagos -----
  @Post('planes/plan-pagos')
  @RequierePermiso(610)
  async crearPlanPagos(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(crearPlanPagosSchema)) dto: CrearPlanPagosDto,
  ) {
    return this.planes.crearPlanPagos(dto, actor.uid);
  }
}
