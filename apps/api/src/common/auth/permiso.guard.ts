import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../supabase/supabase.service.js';
import { exigirPermiso } from './exigir-permiso.js';
import { PERMISO_KEY } from './permisos.decorator.js';
import type { AuthenticatedRequest } from './auth.types.js';

/**
 * RBAC server-side. Lee la tabla EXISTENTE `segModulosUsuarios` con el `uid`
 * tomado del JWT verificado (no del cliente) usando service_role, y autoriza
 * según la clave declarada con @RequierePermiso(clave).
 *
 * Esto cierra dos hallazgos críticos de la auditoría:
 *  - La autorización deja de ser cosmética del cliente (permisos.dart).
 *  - El usuario ya no puede auto-concederse permisos: la decisión ocurre en el
 *    servidor y la escritura de permisos debe restringirse en la BD (P0).
 *
 * Debe ejecutarse DESPUÉS de JwtAuthGuard (que adjunta req.user).
 */
@Injectable()
export class PermisoGuard implements CanActivate {
  private readonly logger = new Logger(PermisoGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const claves = this.reflector.getAllAndOverride<number[] | undefined>(
      PERMISO_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Sin @RequierePermiso, este guard no restringe (basta con estar autenticado).
    if (!claves || claves.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req.user;
    if (!user?.uid) {
      throw new UnauthorizedException('No autenticado.');
    }

    // Regla de soporte + any-of: vive en `exigirPermiso` (única implementación,
    // reutilizable desde servicios). Mismas respuestas y mismo log que antes.
    await exigirPermiso(this.supabase, this.logger, user.uid, claves);
    return true;
  }
}
