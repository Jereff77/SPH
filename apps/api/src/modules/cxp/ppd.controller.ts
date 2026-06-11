import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { PpdService } from './ppd.service.js';
import {
  nuevaFacturaPpdSchema,
  nuevaParcialPpdSchema,
  dispensarComplementoSchema,
  type NuevaFacturaPpdDto,
  type NuevaParcialPpdDto,
  type DispensarComplementoDto,
} from './ppd.schemas.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';

/** Archivos recibidos por multipart (memoria). */
interface CfdiFiles {
  xml?: Express.Multer.File[];
  pdf?: Express.Multer.File[];
}
const LIMITE_ARCHIVO = 15 * 1024 * 1024; // 15 MB

/**
 * CxP > Solicitudes de Pago PPD (acceso: clave 420, igual que Solicitudes).
 * Estado de cuenta de las facturas PPD + alta de factura y de pagos parciales
 * (dosificación). Cada parcialidad fluye por Aprobar/Pagar como una solicitud.
 */
@Controller('cxp/ppd')
@UseGuards(JwtAuthGuard, PermisoGuard)
@RequierePermiso(420)
export class PpdController {
  constructor(private readonly svc: PpdService) {}

  /** Estado de cuenta: facturas PPD con total/solicitado/pagado/disponible. */
  @Get()
  listar() {
    return this.svc.listar();
  }

  /** Detalle de una factura PPD + sus parcialidades. */
  @Get(':idCxpPPD')
  detalle(@Param('idCxpPPD') idCxpPPD: string) {
    return this.svc.detalle(idCxpPPD);
  }

  /** Analiza el CFDI PPD (XML + PDF): valida y devuelve datos + saldo si existe. */
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
  async analizar(@UploadedFiles() files: CfdiFiles) {
    const xml = files.xml?.[0];
    const pdf = files.pdf?.[0];
    if (!xml) throw new BadRequestException('Falta el archivo XML del CFDI.');
    if (!pdf) throw new BadRequestException('Falta el archivo PDF del CFDI.');
    return this.svc.analizar(xml.buffer, pdf.buffer);
  }

  /** Registra la factura PPD + su primera solicitud parcial. */
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
    @Body(new ZodValidationPipe(nuevaFacturaPpdSchema)) dto: NuevaFacturaPpdDto,
  ) {
    const xml = files.xml?.[0];
    const pdf = files.pdf?.[0];
    if (!xml) throw new BadRequestException('Falta el archivo XML del CFDI.');
    if (!pdf) throw new BadRequestException('Falta el archivo PDF del CFDI.');
    return this.svc.crearConFactura(xml.buffer, pdf.buffer, dto, actor.uid);
  }

  /** Nueva solicitud parcial sobre una factura PPD existente. */
  @Post(':idCxpPPD/parcial')
  async nuevaParcial(
    @CurrentUser() actor: AuthUser,
    @Param('idCxpPPD') idCxpPPD: string,
    @Body(new ZodValidationPipe(nuevaParcialPpdSchema)) dto: NuevaParcialPpdDto,
  ) {
    return this.svc.nuevaParcial(idCxpPPD, dto, actor.uid);
  }

  /** Sube el Complemento de Pago (REP) de una parcialidad pagada (XML + PDF). */
  @Post('parcial/:idCxp/complemento')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'xml', maxCount: 1 },
        { name: 'pdf', maxCount: 1 },
      ],
      { limits: { fileSize: LIMITE_ARCHIVO } },
    ),
  )
  async subirComplemento(
    @CurrentUser() actor: AuthUser,
    @Param('idCxp') idCxp: string,
    @UploadedFiles() files: CfdiFiles,
  ) {
    const xml = files.xml?.[0];
    const pdf = files.pdf?.[0];
    if (!xml) throw new BadRequestException('Falta el archivo XML del complemento.');
    return this.svc.subirComplemento(idCxp, xml.buffer, pdf?.buffer ?? null, actor.uid);
  }

  /**
   * Dispensa de complemento por excepción (p. ej. proveedor de única vez que no
   * emitirá el REP). Requiere el permiso 403 (sobrescribe el 420 de la clase).
   */
  @Post('parcial/:idCxp/dispensar-complemento')
  @RequierePermiso(403)
  async dispensarComplemento(
    @CurrentUser() actor: AuthUser,
    @Param('idCxp') idCxp: string,
    @Body(new ZodValidationPipe(dispensarComplementoSchema)) dto: DispensarComplementoDto,
  ) {
    return this.svc.dispensarComplemento(idCxp, dto.motivo, actor.uid);
  }
}
