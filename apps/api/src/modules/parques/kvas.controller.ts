import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KvasService } from './kvas.service.js';
import {
  acometidaSchema,
  bajaDocumentoSchema,
  cancelarAsignacionSchema,
  crearAsignacionSchema,
  devolucionSchema,
  documentoNaveSchema,
  editarAsignacionSchema,
  type AcometidaDto,
  type BajaDocumentoDto,
  type CancelarAsignacionDto,
  type CrearAsignacionDto,
  type DevolucionDto,
  type DocumentoNaveDto,
  type EditarAsignacionDto,
} from './kvas.schemas.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';
import { LIMITE_ARCHIVO, validarArchivo } from '../../common/utils/archivo-seguro.js';

/**
 * Administración de KVA's. Claves: 720 ver · 721 asignar · 722 registrar
 * devolución · 723 documentos de la nave. El RBAC es server-side (el front solo
 * oculta botones).
 */
@Controller('kvas')
@UseGuards(JwtAuthGuard, PermisoGuard)
@RequierePermiso(720)
export class KvasController {
  constructor(private readonly svc: KvasService) {}

  // ---------- Lectura (720) ----------

  @Get('resumen')
  resumen() {
    return this.svc.resumen();
  }

  @Get('parque/:idParque')
  porParque(@Param('idParque') idParque: string) {
    return this.svc.porParque(idParque);
  }

  @Get('nave/:idNave')
  porNave(@Param('idNave') idNave: string) {
    return this.svc.porNave(idNave);
  }

  @Get('asignacion/:idKvas/devoluciones')
  devoluciones(@Param('idKvas') idKvas: string) {
    return this.svc.devolucionesDe(idKvas);
  }

  // ---------- Asignaciones (721) ----------

  @Post('asignacion')
  @RequierePermiso(721)
  crear(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(crearAsignacionSchema)) dto: CrearAsignacionDto,
  ) {
    return this.svc.crear(dto, actor.uid);
  }

  @Patch('asignacion/:idKvas')
  @RequierePermiso(721)
  async editar(
    @CurrentUser() actor: AuthUser,
    @Param('idKvas') idKvas: string,
    @Body(new ZodValidationPipe(editarAsignacionSchema)) dto: EditarAsignacionDto,
  ) {
    await this.svc.editar(idKvas, dto, actor.uid);
    return { ok: true };
  }

  /**
   * Baja LÓGICA con motivo (no borra: el histórico alimenta la trazabilidad).
   * Es POST y no DELETE porque el motivo es obligatorio y viaja en el body.
   */
  @Post('asignacion/:idKvas/cancelar')
  @RequierePermiso(721)
  async cancelar(
    @CurrentUser() actor: AuthUser,
    @Param('idKvas') idKvas: string,
    @Body(new ZodValidationPipe(cancelarAsignacionSchema)) dto: CancelarAsignacionDto,
  ) {
    await this.svc.cancelar(idKvas, dto.motivo, actor.uid);
    return { ok: true };
  }

  // ---------- Devolución (722) ----------

  @Post('asignacion/:idKvas/devolucion')
  @RequierePermiso(722)
  // Campos del multipart: `archivo` = el PDF/imagen probatoria · `documento` =
  // el folio (texto, lo valida Zod). Nombres distintos para que no colisionen.
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: LIMITE_ARCHIVO } }))
  async registrarDevolucion(
    @CurrentUser() actor: AuthUser,
    @Param('idKvas') idKvas: string,
    @Body(new ZodValidationPipe(devolucionSchema)) dto: DevolucionDto,
    @UploadedFile() archivo?: Express.Multer.File,
  ) {
    // El archivo NO es opcional: es justo lo que acredita la devolución.
    if (!archivo)
      throw new BadRequestException(
        'Adjunta el documento que acredita la devolución de los KVA al parque.',
      );
    return this.svc.registrarDevolucion(
      idKvas,
      dto,
      validarArchivo(archivo),
      actor.uid,
    );
  }

  // ---------- Expediente de documentos de la nave (723) ----------

  /** Documentos de KVA de la nave. Ver = 720 (el mismo que el tablero). */
  @Get('nave/:idNave/documentos')
  documentosDeNave(@Param('idNave') idNave: string) {
    return this.svc.documentosDeNave(idNave);
  }

  /**
   * Sube un documento al expediente de la nave.
   * Multipart: `archivo` = el PDF/imagen · `titulo`/`descripcion` = texto.
   */
  @Post('nave/:idNave/documentos')
  @RequierePermiso(723)
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: LIMITE_ARCHIVO } }))
  async subirDocumento(
    @CurrentUser() actor: AuthUser,
    @Param('idNave') idNave: string,
    @Body(new ZodValidationPipe(documentoNaveSchema)) dto: DocumentoNaveDto,
    @UploadedFile() archivo?: Express.Multer.File,
  ) {
    if (!archivo) throw new BadRequestException('Adjunta el archivo del documento.');
    return this.svc.subirDocumentoNave(idNave, dto, validarArchivo(archivo), actor.uid);
  }

  /** Baja LÓGICA con motivo. POST (no DELETE) porque el motivo va en el body. */
  @Post('documento/:idDoc/baja')
  @RequierePermiso(723)
  async bajaDocumento(
    @CurrentUser() actor: AuthUser,
    @Param('idDoc') idDoc: string,
    @Body(new ZodValidationPipe(bajaDocumentoSchema)) dto: BajaDocumentoDto,
  ) {
    await this.svc.bajaDocumentoNave(idDoc, dto.motivo, actor.uid);
    return { ok: true };
  }

  // ---------- Acometidas ----------

  @Post('acometida')
  @RequierePermiso(721)
  crearAcometida(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(acometidaSchema)) dto: AcometidaDto,
  ) {
    return this.svc.crearAcometida(dto, actor.uid);
  }

  @Patch('acometida/:idAcometida')
  @RequierePermiso(721)
  async editarAcometida(
    @CurrentUser() actor: AuthUser,
    @Param('idAcometida') idAcometida: string,
    @Body(new ZodValidationPipe(acometidaSchema)) dto: AcometidaDto,
  ) {
    await this.svc.editarAcometida(idAcometida, dto, actor.uid);
    return { ok: true };
  }

  /** Cuelga un parque de una acometida (o lo descuelga con `idAcometida: null`). */
  @Patch('parque/:idParque/acometida')
  @RequierePermiso(721)
  async asignarAcometida(
    @CurrentUser() actor: AuthUser,
    @Param('idParque') idParque: string,
    @Body() body: { idAcometida?: string | null },
  ) {
    const id = body?.idAcometida ?? null;
    if (id !== null && (typeof id !== 'string' || id.trim() === ''))
      throw new BadRequestException('Acometida inválida.');
    await this.svc.asignarAcometida(idParque, id, actor.uid);
    return { ok: true };
  }
}
