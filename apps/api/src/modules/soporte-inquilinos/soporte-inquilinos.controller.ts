import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { SoporteInquilinosService } from './soporte-inquilinos.service.js';
import { CuentasService } from '../correo/cuentas.service.js';
import {
  cuentaSchema as correoCuentaSchema,
  type CuentaDto,
} from '../correo/correo.schemas.js';
import {
  responderSchema,
  vincularSchema,
  cambiarEstadoSchema,
  designarCuentaSchema,
  asignarSchema,
  notaSchema,
  type ResponderDto,
  type VincularDto,
  type CambiarEstadoDto,
  type DesignarCuentaDto,
  type AsignarDto,
  type NotaDto,
} from './soporte-inquilinos.schemas.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';

const LIMITE = 15 * 1024 * 1024;

/**
 * Soporte a Inquilinos (submódulo de Arrendatarios). Claves de permiso:
 *  31 = ver/usar la bandeja de incidentes · 32 = responder ·
 *  33 = clasificar (vincular inquilino/nave + cambiar estado) · 34 = configurar la cuenta.
 */
@Controller('arrendatarios/soporte')
@UseGuards(JwtAuthGuard, PermisoGuard)
@RequierePermiso(31)
export class SoporteInquilinosController {
  constructor(
    private readonly soporte: SoporteInquilinosService,
    private readonly cuentas: CuentasService,
  ) {}

  // ----- Bandeja de incidentes (clave 31) -----
  @Get('incidentes')
  listar(
    @CurrentUser() actor: AuthUser,
    @Headers('x-ver-como') verComo?: string,
    @Query('estado') estado?: string,
    @Query('q') q?: string,
  ) {
    return this.soporte.listarIncidentes(
      { estado: estado || undefined, q: q || undefined },
      actor.uid,
      verComo || undefined,
    );
  }

  @Get('incidentes/:id')
  detalle(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Headers('x-ver-como') verComo?: string,
  ) {
    return this.soporte.detalle(id, actor.uid, verComo || undefined);
  }

  @Get('incidentes/:id/seguimientos')
  seguimientos(@Param('id') id: string) {
    return this.soporte.listarSeguimientos(id);
  }

  @Post('sincronizar')
  sincronizar() {
    return this.soporte.sincronizar();
  }

  /** ¿El usuario ve todos los incidentes (gerencia)? Útil para el front (tablero). */
  @Get('puede-ver-todos')
  async puedeVerTodos(
    @CurrentUser() actor: AuthUser,
    @Headers('x-ver-como') verComo?: string,
  ) {
    const uid = await this.soporte.uidObservado(actor.uid, verComo || undefined);
    return { verTodos: await this.soporte.puedeVerTodos(uid) };
  }

  // ----- Responder (clave 32) -----
  @Post('incidentes/:id/responder')
  @RequierePermiso(32)
  @UseInterceptors(FilesInterceptor('adjuntos', 20, { limits: { fileSize: LIMITE } }))
  async responder(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(responderSchema)) dto: ResponderDto,
    @UploadedFiles() adjuntos?: Express.Multer.File[],
  ) {
    const archivos = (adjuntos ?? []).map((a) => ({
      filename: a.originalname,
      content: a.buffer,
      contentType: a.mimetype,
    }));
    await this.soporte.responder(id, dto.body, archivos, actor.uid, dto.destinatarios, dto.cc);
    return { ok: true };
  }

  // ----- Clasificar: vincular + estado (clave 33) -----
  @Post('incidentes/:id/vincular')
  @RequierePermiso(33)
  async vincular(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(vincularSchema)) dto: VincularDto,
  ) {
    await this.soporte.vincular(id, dto, actor.uid);
    return { ok: true };
  }

  @Post('incidentes/:id/estado')
  @RequierePermiso(33)
  async cambiarEstado(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cambiarEstadoSchema)) dto: CambiarEstadoDto,
  ) {
    await this.soporte.cambiarEstado(id, dto.estado, actor.uid);
    return { ok: true };
  }

  // ----- Nota interna (clave 31: cualquiera con acceso al módulo) -----
  @Post('incidentes/:id/nota')
  async agregarNota(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(notaSchema)) dto: NotaDto,
  ) {
    await this.soporte.agregarNota(id, dto.texto, actor.uid);
    return { ok: true };
  }

  // ----- Clasificación por IA (clave 33) -----
  @Post('incidentes/:id/clasificar')
  @RequierePermiso(33)
  clasificar(
    @CurrentUser() actor: AuthUser,
    @Headers('authorization') auth: string,
    @Param('id') id: string,
  ) {
    const jwt = (auth ?? '').replace(/^Bearer\s+/i, '');
    return this.soporte.clasificar(id, jwt, actor.uid);
  }

  // ----- Asignación gerente -> agente (clave 35) -----
  @Post('incidentes/:id/asignar')
  @RequierePermiso(35)
  async asignar(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(asignarSchema)) dto: AsignarDto,
  ) {
    await this.soporte.asignar(id, dto.asignadoA ?? null, actor.uid);
    return { ok: true };
  }

  @Get('agentes')
  @RequierePermiso(35)
  agentes() {
    return this.soporte.agentes();
  }

  // Selectores para vincular (clave 33).
  @Get('inquilinos')
  @RequierePermiso(33)
  inquilinos() {
    return this.soporte.inquilinos();
  }

  @Get('inquilinos/:idArrendador/naves')
  @RequierePermiso(33)
  naves(@Param('idArrendador') idArrendador: string) {
    return this.soporte.navesDe(idArrendador);
  }

  // ----- Cuenta de correo de soporte (clave 34, salvo la lectura de la activa) -----
  @Get('cuenta')
  cuenta() {
    return this.soporte.cuentaSoporte();
  }

  @Get('cuentas-disponibles')
  @RequierePermiso(34)
  cuentasDisponibles() {
    return this.soporte.cuentasDisponibles();
  }

  @Put('cuenta/designar')
  @RequierePermiso(34)
  async designar(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(designarCuentaSchema)) dto: DesignarCuentaDto,
  ) {
    await this.soporte.designarCuenta(dto.idCuenta, actor.uid);
    return { ok: true };
  }

  @Post('cuenta')
  @RequierePermiso(34)
  async crearCuenta(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(correoCuentaSchema)) dto: CuentaDto,
  ) {
    const { id } = await this.cuentas.crear(dto, actor.uid);
    await this.soporte.designarCuenta(id, actor.uid); // la nueva queda como la de soporte
    return { id };
  }

  @Patch('cuenta/:id')
  @RequierePermiso(34)
  async editarCuenta(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(correoCuentaSchema)) dto: CuentaDto,
  ) {
    await this.cuentas.editar(id, dto, actor.uid);
    return { ok: true };
  }

  @Post('cuenta/probar')
  @RequierePermiso(34)
  probar(@Body(new ZodValidationPipe(correoCuentaSchema)) dto: CuentaDto) {
    return this.cuentas.probar(dto);
  }

  @Post('cuenta/:id/probar')
  @RequierePermiso(34)
  probarGuardada(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(correoCuentaSchema)) dto: CuentaDto,
  ) {
    return this.cuentas.probar(dto, id);
  }
}
