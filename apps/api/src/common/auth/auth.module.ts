import { Global, Module } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PermisoGuard } from './permiso.guard.js';
import { SoporteGuard } from './soporte.guard.js';

/**
 * Expone los guards de seguridad para usarlos en cualquier módulo:
 *   @UseGuards(JwtAuthGuard, PermisoGuard)   // RBAC por clave (segModulos)
 *   @UseGuards(JwtAuthGuard, SoporteGuard)   // solo personal de soporte (isSupport)
 */
@Global()
@Module({
  providers: [JwtAuthGuard, PermisoGuard, SoporteGuard],
  exports: [JwtAuthGuard, PermisoGuard, SoporteGuard],
})
export class AuthModule {}
