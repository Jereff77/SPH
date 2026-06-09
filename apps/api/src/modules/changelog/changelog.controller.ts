import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { ChangelogService } from './changelog.service.js';
import type { ChangelogResponse } from './changelog.types.js';

/**
 * Changelog / Novedades del sistema (Configuraciones → Novedades).
 *
 * Acceso: cualquier usuario AUTENTICADO. Solo `JwtAuthGuard`, SIN `PermisoGuard`
 * — por decisión del cliente, ver las novedades NO requiere clave de permiso
 * (igual que «Cambiar contraseña»). Es de solo lectura.
 */
@Controller('changelog')
@UseGuards(JwtAuthGuard)
export class ChangelogController {
  constructor(private readonly changelog: ChangelogService) {}

  /** Versiones publicadas (más reciente primero) + versión actual del sistema. */
  @Get()
  listar(): Promise<ChangelogResponse> {
    return this.changelog.listar();
  }
}
