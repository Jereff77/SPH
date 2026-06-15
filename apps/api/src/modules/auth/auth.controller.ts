import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import {
  loginSchema,
  cambiarContrasenaSchema,
  recuperarSchema,
  restablecerSchema,
  type LoginDto,
  type CambiarContrasenaDto,
  type RecuperarDto,
  type RestablecerDto,
} from './auth.schemas.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';
import type { Env } from '../../common/config/env.validation.js';

const REFRESH_COOKIE = 'sph_rt';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * POST /api/auth/login
   * Devuelve el access token (para memoria del cliente) y setea el refresh token
   * en una cookie httpOnly (no accesible por JS -> mitiga XSS, corrige el hallazgo
   * de persistencia de tokens en localStorage de v1).
   */
  @Post('login')
  @HttpCode(200)
  // Anti fuerza bruta / credential stuffing: 10 intentos por minuto por IP.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { result, refreshToken } = await this.auth.login(dto);
    this.setRefreshCookie(res, refreshToken);
    return result;
  }

  /**
   * POST /api/auth/refresh
   * Renueva la sesión usando el refresh token de la cookie httpOnly.
   */
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.readRefreshCookie(req);
    if (!token) throw new UnauthorizedException('No hay sesión activa.');
    const { result, refreshToken } = await this.auth.refresh(token);
    this.setRefreshCookie(res, refreshToken);
    return result;
  }

  /**
   * POST /api/auth/logout
   * Revoca la sesión y limpia la cookie.
   */
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.readRefreshCookie(req);
    await this.auth.logout(token);
    this.clearRefreshCookie(res);
    return { ok: true };
  }

  /**
   * GET /api/auth/me
   * Perfil + permisos del usuario autenticado (derivado del JWT verificado).
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthUser) {
    const { usuario, permisos } = await this.auth.perfilDeUid(user.uid);
    return { usuario, permisos };
  }

  /**
   * GET /api/auth/contexto/:uid
   * Perfil + permisos de OTRO usuario para la función "Ver como" (solo soporte,
   * solo lectura). No cambia la sesión ni concede privilegios del objetivo.
   */
  @Get('contexto/:uid')
  @UseGuards(JwtAuthGuard)
  async contexto(@CurrentUser() user: AuthUser, @Param('uid') uid: string) {
    return this.auth.contextoComoSoporte(user.uid, uid);
  }

  /**
   * POST /api/auth/cambiar-contrasena
   * Cambia la propia contraseña (verifica la actual). Disponible para cualquier
   * usuario autenticado (no requiere permiso especial).
   */
  @Post('cambiar-contrasena')
  @HttpCode(200)
  // Verifica la contraseña actual con signInWithPassword: limitamos para evitar
  // fuerza bruta de la contraseña vigente. 5 intentos por minuto.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UseGuards(JwtAuthGuard)
  async cambiarContrasena(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(cambiarContrasenaSchema))
    dto: CambiarContrasenaDto,
  ) {
    await this.auth.cambiarContrasena(
      user.uid,
      user.email,
      dto.actual,
      dto.nueva,
    );
    return { ok: true };
  }

  /**
   * POST /api/auth/recuperar  (PÚBLICO)
   * Inicia el flujo "olvidé mi contraseña": dispara el correo de recuperación de
   * Supabase. La respuesta es SIEMPRE genérica (no revela si la cuenta existe).
   */
  @Post('recuperar')
  @HttpCode(200)
  // Anti-abuso del envío de correos: 5 solicitudes por minuto por IP.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UsePipes(new ZodValidationPipe(recuperarSchema))
  async recuperar(@Body() dto: RecuperarDto): Promise<{ ok: true }> {
    await this.auth.solicitarRecuperacion(dto.usuario);
    // Mensaje genérico (anti-enumeración): el frontend siempre muestra lo mismo.
    return { ok: true };
  }

  /**
   * POST /api/auth/restablecer  (PÚBLICO)
   * Fija la nueva contraseña usando el token de recovery del enlace del correo
   * (el frontend lo extrae del fragmento de la URL y lo reenvía aquí).
   */
  @Post('restablecer')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @UsePipes(new ZodValidationPipe(restablecerSchema))
  async restablecer(@Body() dto: RestablecerDto): Promise<{ ok: true }> {
    await this.auth.restablecerConToken(dto.accessToken, dto.nueva);
    return { ok: true };
  }

  // ----- helpers de cookie -----

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      // 'strict': el refresh/logout siempre los dispara la propia SPA (mismo
      // sitio), nunca una navegación cross-site. Cierra el vector CSRF en los
      // dos endpoints que se autentican solo con la cookie.
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 días
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  }

  private readRefreshCookie(req: Request): string | undefined {
    const cookies = (req as Request & { cookies?: Record<string, string> })
      .cookies;
    return cookies?.[REFRESH_COOKIE];
  }
}
