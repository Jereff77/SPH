import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PermisosService } from './permisos.service.js';
import {
  accesoSchema,
  aplicarPlantillaSchema,
  crearPlantillaSchema,
  type AccesoDto,
  type AplicarPlantillaDto,
  type CrearPlantillaDto,
} from './permisos.schemas.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';

/** Configuraciones > Permisos (clave 220). Solo quien tenga ese permiso (o soporte). */
@Controller('permisos')
@UseGuards(JwtAuthGuard, PermisoGuard)
@RequierePermiso(220)
export class PermisosController {
  constructor(private readonly svc: PermisosService) {}

  @Get('usuarios')
  listarUsuarios() {
    return this.svc.listarUsuarios();
  }

  @Get('plantillas')
  listarPlantillas() {
    return this.svc.listarPlantillas();
  }

  @Get(':uid')
  obtenerPermisos(@Param('uid') uid: string) {
    return this.svc.obtenerPermisos(uid);
  }

  @Patch(':uid/:idsegModulos')
  async setAcceso(
    @Param('uid') uid: string,
    @Param('idsegModulos') idsegModulos: string,
    @Body(new ZodValidationPipe(accesoSchema)) dto: AccesoDto,
  ) {
    await this.svc.setAcceso(uid, idsegModulos, dto.acceso);
    return { ok: true };
  }

  @Post('plantillas/aplicar')
  async aplicarPlantilla(
    @Body(new ZodValidationPipe(aplicarPlantillaSchema)) dto: AplicarPlantillaDto,
  ) {
    await this.svc.aplicarPlantilla(dto.uid, dto.idPlantilla, dto.reemplazarTodos);
    return { ok: true };
  }

  @Post('plantillas')
  async crearPlantilla(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(crearPlantillaSchema)) dto: CrearPlantillaDto,
  ) {
    await this.svc.crearPlantillaDesdeUsuario(
      dto.nombre,
      dto.descripcion,
      dto.uidOrigen,
      dto.categoria,
      dto.esPublica,
      actor.uid,
    );
    return { ok: true };
  }
}
