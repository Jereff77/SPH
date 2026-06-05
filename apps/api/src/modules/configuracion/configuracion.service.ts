import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type { Env } from '../../common/config/env.validation.js';

/** Parámetro en SPHConfiguraciones donde se guardan los dominios autorizados. */
const PARAM_DOMINIOS = 'DOMINIOS_AUTORIZADOS';
/** Correos específicos autorizados (excepciones a los dominios). */
const PARAM_CORREOS = 'CORREOS_AUTORIZADOS';
/** Logotipo para fondos claros (login, contenido). JSON { url, ancho, alto }. */
const PARAM_LOGO_CLARO = 'LOGO_FONDO_CLARO';
/** Logotipo para fondos oscuros (sidebar). JSON { url, ancho, alto }. */
const PARAM_LOGO_OSCURO = 'LOGO_FONDO_OSCURO';
/** Parámetro legado (URL simple) usado como respaldo del logo de fondo oscuro. */
const PARAM_LOGO_LEGACY = 'LOGO_URL';
/** Parámetro con la URL del favicon. */
const PARAM_FAVICON = 'FAVICON_URL';
/** Bucket de Storage (público) donde se almacena el branding (logos, favicon). */
const BUCKET_BRANDING = 'branding';

const EXT_POR_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
};

export type FondoLogo = 'claro' | 'oscuro';

/** Configuración de un logotipo: URL + dimensiones (px, opcionales). */
export interface LogoConfig {
  url: string | null;
  ancho: number | null;
  alto: number | null;
}

/**
 * Lee y escribe la configuración global del ERP en la tabla EXISTENTE
 * `SPHConfiguraciones` (clave-valor). Solo gestiona parámetros propios de v2
 * (p. ej. DOMINIOS_AUTORIZADOS); nunca altera otros parámetros del sistema
 * (version, INPC, prompts de IA, etc.).
 */
@Injectable()
export class ConfiguracionService {
  private readonly logger = new Logger(ConfiguracionService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Lee el valor de un parámetro activo. (Solo lectura.) */
  async obtenerParametro(parametro: string): Promise<string | null> {
    const { data, error } = await this.supabase.admin
      .from('SPHConfiguraciones')
      .select('valor')
      .eq('parametro', parametro)
      .eq('status', true)
      .limit(1);

    if (error) {
      this.logger.error(`Error leyendo parámetro ${parametro}: ${error.message}`);
      return null;
    }
    return data?.[0]?.valor ?? null;
  }

  /**
   * Dominios de correo autorizados. Fuente de verdad: SPHConfiguraciones; si el
   * parámetro aún no existe, usa el valor por defecto de la configuración (env).
   */
  async obtenerDominios(): Promise<string[]> {
    const csv =
      (await this.obtenerParametro(PARAM_DOMINIOS)) ??
      this.config.get('DOMINIOS_AUTORIZADOS', { infer: true }) ??
      '';
    return this.parseCsv(csv);
  }

  /** Persiste la lista de dominios (CSV) en SPHConfiguraciones. */
  async guardarDominios(dominios: string[]): Promise<string[]> {
    const limpios = [
      ...new Set(dominios.map((d) => d.trim().toLowerCase()).filter(Boolean)),
    ];
    if (limpios.length === 0) {
      throw new BadRequestException('Debe quedar al menos un dominio autorizado.');
    }
    await this.guardarParametro(
      PARAM_DOMINIOS,
      limpios.join(','),
      'Dominios de correo autorizados para inicio de sesión (v2)',
    );
    return limpios;
  }

  /**
   * Correos específicos autorizados (excepciones a los dominios). Permiten el
   * acceso a cuentas individuales aunque su dominio no esté en la lista. Opcional
   * (puede estar vacío).
   */
  async obtenerCorreos(): Promise<string[]> {
    const csv = await this.obtenerParametro(PARAM_CORREOS);
    return csv ? this.parseCsv(csv) : [];
  }

  /** Persiste la lista de correos específicos (CSV) en SPHConfiguraciones. */
  async guardarCorreos(correos: string[]): Promise<string[]> {
    const limpios = [
      ...new Set(correos.map((c) => c.trim().toLowerCase()).filter(Boolean)),
    ];
    await this.guardarParametro(
      PARAM_CORREOS,
      limpios.join(','),
      'Correos específicos autorizados (excepciones de dominio) (v2)',
    );
    return limpios;
  }

  // ----- Logotipos (fondo claro / fondo oscuro, con dimensiones) -----

  /** Logotipos (claro/oscuro) + favicon. El oscuro cae al parámetro legado. */
  async obtenerLogos(): Promise<{
    claro: LogoConfig;
    oscuro: LogoConfig;
    favicon: string | null;
  }> {
    const [claroRaw, oscuroRaw, legacy, favicon] = await Promise.all([
      this.obtenerParametro(PARAM_LOGO_CLARO),
      this.obtenerParametro(PARAM_LOGO_OSCURO),
      this.obtenerParametro(PARAM_LOGO_LEGACY),
      this.obtenerParametro(PARAM_FAVICON),
    ]);
    const claro = this.parseLogo(claroRaw);
    let oscuro = this.parseLogo(oscuroRaw);
    if (!oscuro.url && legacy) {
      oscuro = { url: legacy, ancho: null, alto: null };
    }
    return { claro, oscuro, favicon };
  }

  /** Sube el favicon al bucket y guarda su URL. */
  async guardarFavicon(buffer: Buffer, mimetype: string): Promise<string> {
    const ext = EXT_POR_MIME[mimetype];
    if (!ext) {
      throw new BadRequestException(
        'Formato no permitido. Usa PNG, SVG o WEBP.',
      );
    }
    const path = `favicon.${ext}`;

    const { error: upErr } = await this.supabase.admin.storage
      .from(BUCKET_BRANDING)
      .upload(path, buffer, { contentType: mimetype, upsert: true });
    if (upErr) {
      throw new InternalServerErrorException(
        `No se pudo subir el favicon: ${upErr.message}`,
      );
    }

    const { data } = this.supabase.admin.storage
      .from(BUCKET_BRANDING)
      .getPublicUrl(path);
    const url = `${data.publicUrl}?v=${Date.now()}`;
    await this.guardarParametro(PARAM_FAVICON, url, 'Favicon del sistema (v2)');
    return url;
  }

  /** Sube el archivo de un logotipo y conserva sus dimensiones actuales. */
  async guardarLogoArchivo(
    buffer: Buffer,
    mimetype: string,
    fondo: FondoLogo,
  ): Promise<LogoConfig> {
    const ext = EXT_POR_MIME[mimetype];
    if (!ext) {
      throw new BadRequestException(
        'Formato no permitido. Usa PNG, JPG, SVG o WEBP.',
      );
    }
    const path = `logo-${fondo}.${ext}`;

    const { error: upErr } = await this.supabase.admin.storage
      .from(BUCKET_BRANDING)
      .upload(path, buffer, { contentType: mimetype, upsert: true });
    if (upErr) {
      throw new InternalServerErrorException(
        `No se pudo subir el logo: ${upErr.message}`,
      );
    }

    const { data } = this.supabase.admin.storage
      .from(BUCKET_BRANDING)
      .getPublicUrl(path);
    const url = `${data.publicUrl}?v=${Date.now()}`;

    const actual = await this.obtenerLogoConfig(fondo);
    const nuevo: LogoConfig = { ...actual, url };
    await this.persistirLogo(fondo, nuevo);
    return nuevo;
  }

  /** Actualiza solo las dimensiones de un logotipo (conserva la URL). */
  async guardarLogoDimensiones(
    fondo: FondoLogo,
    ancho: number | null,
    alto: number | null,
  ): Promise<LogoConfig> {
    const actual = await this.obtenerLogoConfig(fondo);
    const nuevo: LogoConfig = { ...actual, ancho, alto };
    await this.persistirLogo(fondo, nuevo);
    return nuevo;
  }

  private async obtenerLogoConfig(fondo: FondoLogo): Promise<LogoConfig> {
    const raw = await this.obtenerParametro(this.paramDeFondo(fondo));
    const cfg = this.parseLogo(raw);
    if (!cfg.url && fondo === 'oscuro') {
      const legacy = await this.obtenerParametro(PARAM_LOGO_LEGACY);
      if (legacy) return { url: legacy, ancho: cfg.ancho, alto: cfg.alto };
    }
    return cfg;
  }

  private async persistirLogo(fondo: FondoLogo, cfg: LogoConfig): Promise<void> {
    await this.guardarParametro(
      this.paramDeFondo(fondo),
      JSON.stringify(cfg),
      `Logotipo para fondo ${fondo} (v2)`,
    );
  }

  private paramDeFondo(fondo: FondoLogo): string {
    return fondo === 'claro' ? PARAM_LOGO_CLARO : PARAM_LOGO_OSCURO;
  }

  private parseLogo(raw: string | null): LogoConfig {
    if (!raw) return { url: null, ancho: null, alto: null };
    try {
      const o = JSON.parse(raw) as Record<string, unknown>;
      return {
        url: typeof o.url === 'string' ? o.url : null,
        ancho: typeof o.ancho === 'number' ? o.ancho : null,
        alto: typeof o.alto === 'number' ? o.alto : null,
      };
    } catch {
      // Valor legado: URL en texto plano.
      return { url: raw, ancho: null, alto: null };
    }
  }

  /**
   * Upsert por nombre de parámetro. Si existe, actualiza solo ese registro; si
   * no, lo crea. No toca ningún otro parámetro.
   */
  private async guardarParametro(
    parametro: string,
    valor: string,
    detalle: string,
  ): Promise<void> {
    const { data, error: errSel } = await this.supabase.admin
      .from('SPHConfiguraciones')
      .select('idConfig')
      .eq('parametro', parametro)
      .limit(1);

    if (errSel) {
      throw new InternalServerErrorException(
        `No se pudo leer la configuración: ${errSel.message}`,
      );
    }

    const existente = data?.[0];
    if (existente) {
      const { error } = await this.supabase.admin
        .from('SPHConfiguraciones')
        .update({ valor, detalle, status: true })
        .eq('idConfig', existente.idConfig);
      if (error) {
        throw new InternalServerErrorException(
          `No se pudo actualizar la configuración: ${error.message}`,
        );
      }
    } else {
      const { error } = await this.supabase.admin
        .from('SPHConfiguraciones')
        .insert({
          idConfig: randomUUID(),
          parametro,
          valor,
          detalle,
          tipo: 0,
          status: true,
        });
      if (error) {
        throw new InternalServerErrorException(
          `No se pudo crear la configuración: ${error.message}`,
        );
      }
    }
  }

  private parseCsv(csv: string): string[] {
    return [
      ...new Set(
        csv
          .split(',')
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
  }
}
