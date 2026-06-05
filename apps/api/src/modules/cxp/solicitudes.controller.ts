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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { SolicitudesService } from './solicitudes.service.js';
import {
  crearSolicitudSchema,
  editarSolicitudSchema,
  type CrearSolicitudDto,
  type EditarSolicitudDto,
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
