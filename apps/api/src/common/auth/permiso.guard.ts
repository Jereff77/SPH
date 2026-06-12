import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../supabase/supabase.service.js';
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

    // Soporte (super-admin) tiene acceso total: evita el bloqueo de quien
    // administra el sistema y el "catch-22" de no poder darse permisos.
    const { data: perfil } = await this.supabase.admin
      .from('catUsers')
      .select('isSupport')
      .eq('uid', user.uid)
      .maybeSingle();
    if (perfil?.isSupport === true) return true;

    // any-of: basta con tener acceso a UNA de las claves declaradas.
    const { data, error } = await this.supabase.admin
      .from('segModulosUsuarios')
      .select('acceso')
      .eq('uid', user.uid)
      .in('clave', claves)
      .eq('acceso', true)
      .limit(1);

    if (error) {
      this.logger.error(
        `Error verificando permiso ${claves.join('/')} para ${user.uid}: ${error.message}`,
      );
      throw new ForbiddenException('No se pudo verificar el permiso.');
    }

    if (!data || data.length === 0) {
      throw new ForbiddenException(
        `Acceso denegado (permiso ${claves.join(' o ')}).`,
      );
    }
    return true;
  }
}
