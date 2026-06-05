import { Global, Module } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PermisoGuard } from './permiso.guard.js';

/**
 * Expone los guards de seguridad para usarlos en cualquier módulo:
 *   @UseGuards(JwtAuthGuard, PermisoGuard)
 */
@Global()
@Module({
  providers: [JwtAuthGuard, PermisoGuard],
  exports: [JwtAuthGuard, PermisoGuard],
})
export class AuthModule {}
