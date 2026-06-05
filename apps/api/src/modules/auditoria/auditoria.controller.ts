import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';

/**
 * Bitácora de auditoría. Se consulta desde Configuraciones > Usuarios (acceso al
 * módulo: clave 200): el historial de lo que ha hecho cada usuario.
 */
@Controller('auditoria')
@UseGuards(JwtAuthGuard, PermisoGuard)
@RequierePermiso(200)
export class AuditoriaController {
  constructor(private readonly svc: AuditoriaService) {}

  @Get()
  historial(
    @Query('uid') uid: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.historialDeUsuario(
      uid,
      limit ? Number(limit) : 50,
      offset ? Number(offset) : 0,
    );
  }
}
