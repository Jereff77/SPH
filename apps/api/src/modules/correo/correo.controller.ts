import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CuentasService } from './cuentas.service.js';
import { CorreoService } from './correo.service.js';
import {
  cuentaSchema,
  responderSchema,
  type CuentaDto,
  type ResponderDto,
} from './correo.schemas.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';
import { z } from 'zod';

const activoSchema = z.object({ activo: z.boolean() });
const LIMITE = 15 * 1024 * 1024;

/** Módulo Correo (clave 800): cuentas (config) + bandeja + responder. */
@Controller('correo')
@UseGuards(JwtAuthGuard, PermisoGuard)
@RequierePermiso(800)
export class CorreoController {
  constructor(
    private readonly cuentas: CuentasService,
    private readonly correo: CorreoService,
  ) {}

  // ----- Cuentas (lectura: 800 para que la bandeja sepa la cuenta activa) -----
  @Get('cuentas')
  listarCuentas() {
    return this.cuentas.listar();
  }

  // ----- Configurar cuenta: requiere permiso 801 -----
  @Post('cuentas')
  @RequierePermiso(801)
  crearCuenta(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(cuentaSchema)) dto: CuentaDto,
  ) {
    return this.cuentas.crear(dto, actor.uid);
  }

  @Patch('cuentas/:id')
  @RequierePermiso(801)
  async editarCuenta(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cuentaSchema)) dto: CuentaDto,
  ) {
    await this.cuentas.editar(id, dto, actor.uid);
    return { ok: true };
  }

  @Patch('cuentas/:id/activo')
  @RequierePermiso(801)
  async setActivo(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(activoSchema)) body: { activo: boolean },
  ) {
    await this.cuentas.setActivo(id, body.activo, actor.uid);
    return { ok: true };
  }

  /** Probar conexión con datos del formulario (alta nueva). */
  @Post('cuentas/probar')
  @RequierePermiso(801)
  probar(@Body(new ZodValidationPipe(cuentaSchema)) dto: CuentaDto) {
    return this.cuentas.probar(dto);
  }

  /** Probar una cuenta guardada (usa su contraseña si no se reescribe). */
  @Post('cuentas/:id/probar')
  @RequierePermiso(801)
  probarGuardada(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cuentaSchema)) dto: CuentaDto,
  ) {
    return this.cuentas.probar(dto, id);
  }

  // ----- Bandeja -----
  @Post('sincronizar')
  sincronizar(@Query('idCuenta') idCuenta: string) {
    return this.correo.sincronizar(idCuenta);
  }

  @Get('bandeja')
  bandeja(@Query('idCuenta') idCuenta: string) {
    return this.correo.bandeja(idCuenta);
  }

  @Get('hilo/:conversationId')
  hilo(
    @Param('conversationId') conversationId: string,
    @Query('idCuenta') idCuenta: string,
  ) {
    return this.correo.hilo(idCuenta, conversationId);
  }

  @Post('responder/:idMensaje')
  @UseInterceptors(FilesInterceptor('adjuntos', 10, { limits: { fileSize: LIMITE } }))
  async responder(
    @Param('idMensaje') idMensaje: string,
    @Body(new ZodValidationPipe(responderSchema)) dto: ResponderDto,
    @UploadedFiles() adjuntos?: Express.Multer.File[],
  ) {
    const archivos = (adjuntos ?? []).map((a) => ({
      filename: a.originalname,
      content: a.buffer,
      contentType: a.mimetype,
    }));
    await this.correo.responder(idMensaje, dto.body, archivos);
    return { ok: true };
  }
}
