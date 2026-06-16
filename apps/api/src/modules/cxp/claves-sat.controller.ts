import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClavesSatService } from './claves-sat.service.js';
import {
  claveSatSchema,
  editarClaveSatSchema,
  importarClavesSatSchema,
  statusClaveSatSchema,
  type ClaveSatDto,
  type EditarClaveSatDto,
  type ImportarClavesSatDto,
  type StatusClaveSatDto,
} from './claves-sat.schemas.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';

/**
 * Catálogo de claves Producto/Servicio del SAT (con reglas de retención).
 * Se administra desde Configuraciones → Parámetros, pestaña "Claves SAT"
 * (clave de visualización 215, definida en `segModulos`).
 */
@Controller('cxp/claves-sat')
@UseGuards(JwtAuthGuard, PermisoGuard)
@RequierePermiso(215)
export class ClavesSatController {
  constructor(private readonly svc: ClavesSatService) {}

  @Get()
  listar() {
    return this.svc.listar();
  }

  @Post()
  async crear(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(claveSatSchema)) dto: ClaveSatDto,
  ) {
    return this.svc.crear(dto, actor.uid);
  }

  @Patch(':idClave')
  async editar(
    @CurrentUser() actor: AuthUser,
    @Param('idClave') idClave: string,
    @Body(new ZodValidationPipe(editarClaveSatSchema)) dto: EditarClaveSatDto,
  ) {
    await this.svc.editar(idClave, dto, actor.uid);
    return { ok: true };
  }

  @Patch(':idClave/status')
  async setStatus(
    @CurrentUser() actor: AuthUser,
    @Param('idClave') idClave: string,
    @Body(new ZodValidationPipe(statusClaveSatSchema)) body: StatusClaveSatDto,
  ) {
    await this.svc.setStatus(idClave, body.status, actor.uid);
    return { ok: true };
  }

  /** Importación masiva (un lote por llamada; el front itera en chunks). */
  @Post('importar')
  async importar(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(importarClavesSatSchema)) dto: ImportarClavesSatDto,
  ) {
    return this.svc.importar(dto, actor.uid);
  }
}
