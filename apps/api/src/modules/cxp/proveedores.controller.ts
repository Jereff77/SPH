import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ProveedoresService } from './proveedores.service.js';
import {
  crearProveedorSchema,
  editarProveedorSchema,
  statusProveedorSchema,
  type CrearProveedorDto,
  type EditarProveedorDto,
  type StatusProveedorDto,
} from './proveedores.schemas.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';

/**
 * CxP > Proveedores (catálogo). Acceso: clave 410. Escrituras sobre
 * `catProveedores` (autorizadas), auditadas con el usuario real.
 */
@Controller('cxp/proveedores')
@UseGuards(JwtAuthGuard, PermisoGuard)
@RequierePermiso(410)
export class ProveedoresController {
  constructor(private readonly svc: ProveedoresService) {}

  @Get()
  listar() {
    return this.svc.listar();
  }

  @Post()
  crear(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(crearProveedorSchema)) dto: CrearProveedorDto,
  ) {
    return this.svc.crear(dto, actor.uid);
  }

  @Patch(':idProveedor')
  async editar(
    @CurrentUser() actor: AuthUser,
    @Param('idProveedor') idProveedor: string,
    @Body(new ZodValidationPipe(editarProveedorSchema)) dto: EditarProveedorDto,
  ) {
    await this.svc.editar(idProveedor, dto, actor.uid);
    return { ok: true };
  }

  @Patch(':idProveedor/status')
  async status(
    @CurrentUser() actor: AuthUser,
    @Param('idProveedor') idProveedor: string,
    @Body(new ZodValidationPipe(statusProveedorSchema)) dto: StatusProveedorDto,
  ) {
    await this.svc.setStatus(idProveedor, dto.status, actor.uid);
    return { ok: true };
  }
}
