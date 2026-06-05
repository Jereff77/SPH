import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { jwtVerify } from 'jose';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { PERMISO_KEY } from '../../common/auth/permisos.decorator.js';
import type { Env } from '../../common/config/env.validation.js';
import type { AuthenticatedRequest, AuthUser } from '../../common/auth/auth.types.js';

/**
 * Autenticación para los endpoints SSE. `EventSource` no permite cabeceras, así
 * que el access token (JWT de Supabase) viaja como query param `?token=`. Verifica
 * el JWT (HS256/issuer/audience, igual que JwtAuthGuard) y exige el permiso
 * declarado con `@RequierePermiso(clave)` en el endpoint (p. ej. 400 pagos, 430 aprobar).
 */
@Injectable()
export class SseAuthGuard implements CanActivate {
  private readonly logger = new Logger(SseAuthGuard.name);
  private readonly secret: Uint8Array;
  private readonly issuer: string;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly supabase: SupabaseService,
    private readonly reflector: Reflector,
  ) {
    this.secret = new TextEncoder().encode(
      this.config.get('SUPABASE_JWT_SECRET', { infer: true }),
    );
    this.issuer = `${this.config.get('SUPABASE_URL', { infer: true }).replace(/\/+$/, '')}/auth/v1`;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      AuthenticatedRequest & { query: Record<string, string | undefined> }
    >();
    const token = req.query?.token;
    if (!token) throw new UnauthorizedException('Falta el token.');

    let user: AuthUser;
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: this.issuer,
        audience: 'authenticated',
      });
      if (!payload.sub) throw new Error('sin sub');
      user = {
        uid: String(payload.sub),
        email: typeof payload.email === 'string' ? payload.email : null,
        role: typeof payload.role === 'string' ? payload.role : 'authenticated',
      };
      req.user = user;
    } catch (err) {
      this.logger.warn(`SSE JWT inválido: ${(err as Error).message}`);
      throw new UnauthorizedException('Token inválido o expirado.');
    }

    // Clave de permiso declarada en el endpoint con @RequierePermiso.
    const clave = this.reflector.getAllAndOverride<number | undefined>(
      PERMISO_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Soporte tiene acceso total; el resto necesita la clave del endpoint.
    const { data: perfil } = await this.supabase.admin
      .from('catUsers')
      .select('isSupport')
      .eq('uid', user.uid)
      .maybeSingle();
    if (perfil?.isSupport === true) return true;
    if (clave === undefined) return true;

    const { data } = await this.supabase.admin
      .from('segModulosUsuarios')
      .select('acceso')
      .eq('uid', user.uid)
      .eq('clave', clave)
      .maybeSingle();
    if (data?.acceso !== true)
      throw new ForbiddenException(`Acceso denegado (permiso ${clave}).`);
    return true;
  }
}
