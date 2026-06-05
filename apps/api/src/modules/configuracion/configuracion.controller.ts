import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ConfiguracionService,
  type FondoLogo,
  type LogoConfig,
} from './configuracion.service.js';
import {
  dominioSchema,
  correoSchema,
  dimensionesLogoSchema,
  type DominioDto,
  type CorreoDto,
  type DimensionesLogoDto,
} from './configuracion.schemas.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';

const MIME_LOGO = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Configuración del sistema (Configuraciones > Sistema).
 * - GET /logo es PÚBLICO (lo usan login/registro, sin sesión).
 * - El resto requiere autenticación. Cuando definamos la clave de permiso de
 *   "Configuraciones > Sistema", añadir @RequierePermiso(<clave>) + PermisoGuard.
 *
 * La escritura solo afecta a parámetros propios de v2 (DOMINIOS_AUTORIZADOS,
 * LOGO_URL) de SPHConfiguraciones y al bucket `branding`.
 */
@Controller('configuracion')
export class ConfiguracionController {
  constructor(private readonly cfg: ConfiguracionService) {}

  // ----- Logos (fondo claro / fondo oscuro, con dimensiones) -----

  /** Público: logotipos + favicon para login/registro y todas las pantallas. */
  @Get('logos')
  async logos(): Promise<{
    claro: LogoConfig;
    oscuro: LogoConfig;
    favicon: string | null;
  }> {
    return this.cfg.obtenerLogos();
  }

  @Post('favicon')
  @UseGuards(JwtAuthGuard, PermisoGuard)
  @RequierePermiso(221)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_LOGO_BYTES, files: 1 },
    }),
  )
  async subirFavicon(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('Archivo requerido.');
    if (!MIME_LOGO.includes(file.mimetype)) {
      throw new BadRequestException(
        'Formato no permitido (PNG, JPG, SVG, WEBP).',
      );
    }
    if (file.size > MAX_LOGO_BYTES) {
      throw new BadRequestException('El favicon no debe superar 2 MB.');
    }
    const url = await this.cfg.guardarFavicon(file.buffer, file.mimetype);
    return { url };
  }

  @Post('logo/:fondo')
  @UseGuards(JwtAuthGuard, PermisoGuard)
  @RequierePermiso(221)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_LOGO_BYTES, files: 1 },
    }),
  )
  async subirLogo(
    @Param('fondo') fondo: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<{ logo: LogoConfig }> {
    const f = this.validarFondo(fondo);
    if (!file) throw new BadRequestException('Archivo requerido.');
    if (!MIME_LOGO.includes(file.mimetype)) {
      throw new BadRequestException('Formato no permitido (PNG, JPG, SVG, WEBP).');
    }
    if (file.size > MAX_LOGO_BYTES) {
      throw new BadRequestException('El logo no debe superar 2 MB.');
    }
    const logo = await this.cfg.guardarLogoArchivo(file.buffer, file.mimetype, f);
    return { logo };
  }

  @Patch('logo/:fondo/dimensiones')
  @UseGuards(JwtAuthGuard, PermisoGuard)
  @RequierePermiso(221)
  async dimensiones(
    @Param('fondo') fondo: string,
    @Body(new ZodValidationPipe(dimensionesLogoSchema)) dto: DimensionesLogoDto,
  ): Promise<{ logo: LogoConfig }> {
    const f = this.validarFondo(fondo);
    const logo = await this.cfg.guardarLogoDimensiones(f, dto.ancho, dto.alto);
    return { logo };
  }

  private validarFondo(fondo: string): FondoLogo {
    if (fondo !== 'claro' && fondo !== 'oscuro') {
      throw new BadRequestException('Fondo inválido (claro | oscuro).');
    }
    return fondo;
  }

  // ----- Dominios autorizados -----

  @Get('dominios')
  @UseGuards(JwtAuthGuard, PermisoGuard)
  @RequierePermiso(221)
  async listar(): Promise<{ dominios: string[] }> {
    return { dominios: await this.cfg.obtenerDominios() };
  }

  @Post('dominios')
  @UseGuards(JwtAuthGuard, PermisoGuard)
  @RequierePermiso(221)
  async agregar(
    @Body(new ZodValidationPipe(dominioSchema)) dto: DominioDto,
  ): Promise<{ dominios: string[] }> {
    const actuales = await this.cfg.obtenerDominios();
    const dominios = await this.cfg.guardarDominios([...actuales, dto.dominio]);
    return { dominios };
  }

  @Delete('dominios/:dominio')
  @UseGuards(JwtAuthGuard, PermisoGuard)
  @RequierePermiso(221)
  async quitar(
    @Param('dominio') dominio: string,
  ): Promise<{ dominios: string[] }> {
    const objetivo = dominio.trim().toLowerCase();
    const actuales = await this.cfg.obtenerDominios();
    const dominios = await this.cfg.guardarDominios(
      actuales.filter((d) => d !== objetivo),
    );
    return { dominios };
  }

  // ----- Correos específicos autorizados (excepciones de dominio) -----

  @Get('correos')
  @UseGuards(JwtAuthGuard, PermisoGuard)
  @RequierePermiso(221)
  async listarCorreos(): Promise<{ correos: string[] }> {
    return { correos: await this.cfg.obtenerCorreos() };
  }

  @Post('correos')
  @UseGuards(JwtAuthGuard, PermisoGuard)
  @RequierePermiso(221)
  async agregarCorreo(
    @Body(new ZodValidationPipe(correoSchema)) dto: CorreoDto,
  ): Promise<{ correos: string[] }> {
    const actuales = await this.cfg.obtenerCorreos();
    const correos = await this.cfg.guardarCorreos([...actuales, dto.correo]);
    return { correos };
  }

  @Delete('correos/:correo')
  @UseGuards(JwtAuthGuard, PermisoGuard)
  @RequierePermiso(221)
  async quitarCorreo(
    @Param('correo') correo: string,
  ): Promise<{ correos: string[] }> {
    const objetivo = correo.trim().toLowerCase();
    const actuales = await this.cfg.obtenerCorreos();
    const correos = await this.cfg.guardarCorreos(
      actuales.filter((c) => c !== objetivo),
    );
    return { correos };
  }
}
