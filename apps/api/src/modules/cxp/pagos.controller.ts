import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PagosService, type FiltrosPagos } from './pagos.service.js';
import {
  aprobadosSinPagoSchema,
  asignarMovimientoSchema,
  registrarPagoSchema,
  type AprobadosSinPagoDto,
  type AsignarMovimientoDto,
  type RegistrarPagoDto,
} from './pagos.schemas.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';

const LIMITE_COMPROBANTE = 15 * 1024 * 1024; // 15 MB

const EXT_POR_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function toBool(v: string | undefined): boolean {
  return v === 'true' || v === '1';
}
function toNum(v: string | undefined): number | undefined {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * CxP > "Pagar solicitudes" (clave 400). Tesorería: listado + registro de pago.
 * Desaplicar pago requiere clave 401; el batch "aprobados sin pago" clave 402.
 */
@Controller('cxp/pagos')
@UseGuards(JwtAuthGuard, PermisoGuard)
@RequierePermiso(400)
export class PagosController {
  constructor(private readonly svc: PagosService) {}

  @Get('filtros')
  filtros() {
    return this.svc.filtros();
  }

  /** Movimientos bancarios candidatos para esta solicitud (Opción A). */
  @Get(':idCxp/movimientos')
  movimientos(@Param('idCxp') idCxp: string) {
    return this.svc.movimientos(idCxp);
  }

  @Get()
  listar(
    @Query('anio') anio?: string,
    @Query('mes') mes?: string,
    @Query('numSem') numSem?: string,
    @Query('idEstado') idEstado?: string,
    @Query('idProveedor') idProveedor?: string,
    @Query('cuenta') cuenta?: string,
    @Query('seccion') seccion?: string,
    @Query('incluirPagados') incluirPagados?: string,
  ) {
    const filtros: FiltrosPagos = {
      anio: toNum(anio),
      mes: toNum(mes),
      numSem: toNum(numSem),
      idEstado: toNum(idEstado),
      idProveedor: idProveedor || undefined,
      cuenta: cuenta || undefined,
      seccion: seccion || undefined,
      incluirPagados: toBool(incluirPagados),
    };
    return this.svc.listar(filtros);
  }

  @Post('aprobados-sin-pago')
  @RequierePermiso(402)
  async aprobadosSinPago(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(aprobadosSinPagoSchema)) dto: AprobadosSinPagoDto,
  ) {
    const data = await this.svc.aprobadosSinPago(dto.mes, dto.anio, actor.uid);
    return { ok: true, data };
  }

  @Get(':idCxp/transferencia')
  verTransferencia(@Param('idCxp') idCxp: string) {
    return this.svc.verTransferencia(idCxp);
  }

  @Post(':idCxp/desaplicar')
  @RequierePermiso(401)
  async desaplicar(
    @CurrentUser() actor: AuthUser,
    @Param('idCxp') idCxp: string,
  ) {
    await this.svc.desaplicarPago(idCxp, actor.uid);
    return { ok: true };
  }

  /** Opción A: asignar un movimiento bancario existente. */
  @Post(':idCxp/asignar')
  async asignar(
    @CurrentUser() actor: AuthUser,
    @Param('idCxp') idCxp: string,
    @Body(new ZodValidationPipe(asignarMovimientoSchema)) dto: AsignarMovimientoDto,
  ) {
    await this.svc.asignarMovimiento(idCxp, dto.idmov, actor.uid);
    return { ok: true };
  }

  /** Opción B: subir el comprobante PDF y leerlo con el webhook N8N. */
  @Post(':idCxp/analizar-comprobante')
  @UseInterceptors(
    FileInterceptor('pdf', { limits: { fileSize: LIMITE_COMPROBANTE } }),
  )
  async analizarComprobante(
    @CurrentUser() actor: AuthUser,
    @Param('idCxp') idCxp: string,
    @UploadedFile() pdf?: Express.Multer.File,
  ) {
    if (!pdf) throw new BadRequestException('Falta el archivo PDF del comprobante.');
    return this.svc.analizarComprobante(idCxp, pdf.buffer, actor.uid);
  }

  @Post(':idCxp')
  @UseInterceptors(
    FileInterceptor('comprobante', { limits: { fileSize: LIMITE_COMPROBANTE } }),
  )
  async registrarPago(
    @CurrentUser() actor: AuthUser,
    @Param('idCxp') idCxp: string,
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
    return this.svc.registrarPago(idCxp, dto, arch, actor.uid);
  }
}
