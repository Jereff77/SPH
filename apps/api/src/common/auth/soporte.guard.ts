import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { AuthenticatedRequest } from './auth.types.js';

/**
 * Restringe un endpoint EXCLUSIVAMENTE al personal de soporte
 * (`catUsers.isSupport = true`), validado server-side con el `uid` del JWT
 * verificado (nunca de datos del cliente).
 *
 * A diferencia de `PermisoGuard`, NO depende de ninguna `clave` de
 * `segModulos`: por diseño, este acceso **no se puede asignar desde la app**
 * (no hay UI para concederlo). El flag `isSupport` solo se cambia desde el
 * backend/BD (o por otro usuario de soporte en Configuraciones → Usuarios).
 *
 * Debe ejecutarse DESPUÉS de `JwtAuthGuard` (que adjunta `req.user`).
 */
@Injectable()
export class SoporteGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const uid = req.user?.uid;
    if (!uid) {
      throw new UnauthorizedException('No autenticado.');
    }
    if (!(await this.supabase.esSoporte(uid))) {
      throw new ForbiddenException('Acceso restringido a personal de soporte.');
    }
    return true;
  }
}
