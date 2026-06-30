import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { SolicitudesService } from './solicitudes.service.js';
import {
  crearSolicitudSchema,
  editarSolicitudSchema,
  crearUrgenteSchema,
  crearLineaCapturaSchema,
  crearDevolucionSchema,
  crearSinXmlSchema,
  type CrearSolicitudDto,
  type EditarSolicitudDto,
  type CrearUrgenteDto,
  type CrearLineaCapturaDto,
  type CrearDevolucionDto,
  type CrearSinXmlDto,
} from './solicitudes.schemas.js';

/** Archivos recibidos por multipart (memoria). */
interface CfdiFiles {
  xml?: Express.Multer.File[];
  pdf?: Express.Multer.File[];
}
const LIMITE_ARCHIVO = 15 * 1024 * 1024; // 15 MB
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';

/**
 * CxP > Solicitudes de pago (acceso: clave 420). Listado (con "Ver como") +
 * acciones sobre solicitudes GUARDADAS (idEstado=1): eliminar, enviar, editar.
 */
@Controller('cxp/solicitudes')
@UseGuards(JwtAuthGuard, PermisoGuard)
@RequierePermiso(420)
export class SolicitudesController {
  constructor(private readonly svc: SolicitudesService) {}

  @Get('semanas')
  semanas(
    @CurrentUser() actor: AuthUser,
    @Headers('x-ver-como') verComo?: string,
  ) {
    return this.svc.semanas(actor.uid, verComo || undefined);
  }

  @Get('catalogos')
  catalogos() {
    return this.svc.catalogos();
  }

  /** Inversionistas/clientes para el selector de Devoluciones. */
  @Get('inversionistas')
  inversionistas() {
    return this.svc.inversionistas();
  }

  /** ¿Hoy está abierto el periodo para subir solicitudes? (no aplica a urgentes). */
  @Get('puede-insertar')
  puedeInsertar() {
    return this.svc.puedeInsertar();
  }

  // ===================== Alta de tipos especiales =====================

  /** Urgentes (tipoOperacion=2): sin archivos. */
  @Post('urgente')
  async crearUrgente(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(crearUrgenteSchema)) dto: CrearUrgenteDto,
  ) {
    return this.svc.crearUrgente(dto, actor.uid);
  }

  /** Línea de Captura (tipoOperacion=4): requiere PDF. */
  @Post('linea-captura')
  @UseInterceptors(
    FileInterceptor('pdf', { limits: { fileSize: LIMITE_ARCHIVO } }),
  )
  async crearLineaCaptura(
    @CurrentUser() actor: AuthUser,
    @UploadedFile() pdf: Express.Multer.File | undefined,
    @Body(new ZodValidationPipe(crearLineaCapturaSchema)) dto: CrearLineaCapturaDto,
  ) {
    if (!pdf) throw new BadRequestException('Falta el archivo PDF del comprobante.');
    return this.svc.crearLineaCaptura(dto, pdf.buffer, actor.uid);
  }

  /** Devoluciones (tipoOperacion=5): contraparte = inversionista, documento OPCIONAL (PDF o imagen). */
  @Post('devolucion')
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: LIMITE_ARCHIVO } }),
  )
  async crearDevolucion(
    @CurrentUser() actor: AuthUser,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Body(new ZodValidationPipe(crearDevolucionSchema)) dto: CrearDevolucionDto,
  ) {
    return this.svc.crearDevolucion(
      dto,
      actor.uid,
      archivo ? { buffer: archivo.buffer, mimetype: archivo.mimetype } : undefined,
    );
  }

  /** Facturas sin XML (tipoOperacion=6): requiere PDF. */
  @Post('sin-xml')
  @UseInterceptors(
    FileInterceptor('pdf', { limits: { fileSize: LIMITE_ARCHIVO } }),
  )
  async crearSinXml(
    @CurrentUser() actor: AuthUser,
    @UploadedFile() pdf: Express.Multer.File | undefined,
    @Body(new ZodValidationPipe(crearSinXmlSchema)) dto: CrearSinXmlDto,
  ) {
    if (!pdf) throw new BadRequestException('Falta el archivo PDF del comprobante.');
    return this.svc.crearSinXml(dto, pdf.buffer, actor.uid);
  }

  /** Analiza el CFDI (XML + PDF) y devuelve los datos extraídos + proveedor. */
  @Post('analizar')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'xml', maxCount: 1 },
        { name: 'pdf', maxCount: 1 },
      ],
      { limits: { fileSize: LIMITE_ARCHIVO } },
    ),
  )
  async analizar(
    @CurrentUser() actor: AuthUser,
    @UploadedFiles() files: CfdiFiles,
  ) {
    const xml = files.xml?.[0];
    const pdf = files.pdf?.[0];
    if (!xml) throw new BadRequestException('Falta el archivo XML del CFDI.');
    if (!pdf) throw new BadRequestException('Falta el archivo PDF del CFDI.');
    return this.svc.analizar(xml.buffer, pdf.buffer, actor.uid);
  }

  /** Crea la solicitud de pago a partir del CFDI + categoría + justificación. */
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'xml', maxCount: 1 },
        { name: 'pdf', maxCount: 1 },
      ],
      { limits: { fileSize: LIMITE_ARCHIVO } },
    ),
  )
  async crear(
    @CurrentUser() actor: AuthUser,
    @UploadedFiles() files: CfdiFiles,
    @Body(new ZodValidationPipe(crearSolicitudSchema)) dto: CrearSolicitudDto,
  ) {
    const xml = files.xml?.[0];
    const pdf = files.pdf?.[0];
    if (!xml) throw new BadRequestException('Falta el archivo XML del CFDI.');
    if (!pdf) throw new BadRequestException('Falta el archivo PDF del CFDI.');
    return this.svc.crear(xml.buffer, pdf.buffer, dto, actor.uid);
  }

  @Get()
  listar(
    @CurrentUser() actor: AuthUser,
    @Query('rangoSemana') rangoSemana?: string,
    @Headers('x-ver-como') verComo?: string,
  ) {
    return this.svc.listar(actor.uid, rangoSemana || undefined, verComo || undefined);
  }

  /** Hilo de comentarios de la solicitud (justificación + respuestas del aprobador). */
  @Get(':idCxp/comentarios')
  comentarios(
    @CurrentUser() actor: AuthUser,
    @Param('idCxp') idCxp: string,
    @Headers('x-ver-como') verComo?: string,
  ) {
    return this.svc.comentarios(idCxp, actor.uid, verComo || undefined);
  }

  @Post(':idCxp/enviar')
  async enviar(
    @CurrentUser() actor: AuthUser,
    @Param('idCxp') idCxp: string,
  ) {
    await this.svc.enviar(idCxp, actor.uid);
    return { ok: true };
  }

  @Patch(':idCxp')
  async editar(
    @CurrentUser() actor: AuthUser,
    @Param('idCxp') idCxp: string,
    @Body(new ZodValidationPipe(editarSolicitudSchema)) dto: EditarSolicitudDto,
  ) {
    await this.svc.editar(idCxp, dto, actor.uid);
    return { ok: true };
  }

  @Delete(':idCxp')
  async eliminar(
    @CurrentUser() actor: AuthUser,
    @Param('idCxp') idCxp: string,
  ) {
    await this.svc.eliminar(idCxp, actor.uid);
    return { ok: true };
  }
}
