import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jwtVerify } from 'jose';
import type { Env } from '../config/env.validation.js';
import type { AuthenticatedRequest, AuthUser } from './auth.types.js';

/**
 * Verifica el JWT de Supabase (HS256 firmado con el JWT Secret) en cada petición
 * protegida y adjunta `req.user` derivado del token. La identidad NUNCA se toma
 * de campos enviados por el cliente (a diferencia de v1, que confiaba en uids del
 * cliente). Si el proyecto migra a JWT asimétrico, sustituir por verificación JWKS.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private readonly secret: Uint8Array;
  private readonly issuer: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    const jwtSecret = this.config.get('SUPABASE_JWT_SECRET', { infer: true });
    this.secret = new TextEncoder().encode(jwtSecret);
    // Supabase emite los JWT con iss = `${SUPABASE_URL}/auth/v1`.
    const supabaseUrl = this.config
      .get('SUPABASE_URL', { infer: true })
      .replace(/\/+$/, '');
    this.issuer = `${supabaseUrl}/auth/v1`;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearer(req.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Falta el token de autenticación.');
    }

    try {
      // Fijamos algoritmo (HS256), issuer y audience: no basta con que la firma
      // sea válida; el token debe haber sido emitido por nuestro proyecto de
      // Supabase y para usuarios autenticados (evita confusión de algoritmo y
      // aceptar tokens de otro contexto firmados con el mismo secreto).
      const { payload } = await jwtVerify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: this.issuer,
        audience: 'authenticated',
      });
      const user: AuthUser = {
        uid: String(payload.sub ?? ''),
        email: typeof payload.email === 'string' ? payload.email : null,
        role: typeof payload.role === 'string' ? payload.role : 'authenticated',
      };
      if (!user.uid) {
        throw new UnauthorizedException('Token sin sujeto (sub).');
      }
      req.user = user;
      return true;
    } catch (err) {
      this.logger.warn(`JWT inválido: ${(err as Error).message}`);
      throw new UnauthorizedException('Token inválido o expirado.');
    }
  }

  private extractBearer(header?: string): string | null {
    if (!header) return null;
    const [scheme, value] = header.split(' ');
    return scheme === 'Bearer' && value ? value : null;
  }
}
