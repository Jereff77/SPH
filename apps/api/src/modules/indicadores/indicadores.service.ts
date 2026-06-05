import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type { Env } from '../../common/config/env.validation.js';

export interface TipoCambio {
  valor: number;
  fecha: string; // dd/MM/yyyy según Banxico
}

export interface UltimoInpc {
  inpc: number;
  anio: number;
  mes: number;
  id: string; // "AAAA/MM"
}

// Serie SF43718 = tipo de cambio FIX (pesos por dólar), igual que en v1.
const BANXICO_SERIE = 'SF43718';

/**
 * Indicadores del landing: tipo de cambio (Banxico, vía proxy server-side para
 * no exponer el token) y último INPC capturado (tabla `inpc`, solo lectura).
 */
@Injectable()
export class IndicadoresService {
  private readonly logger = new Logger(IndicadoresService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Tipo de cambio FIX USD/MXN más reciente publicado por Banxico. */
  async obtenerTipoCambio(): Promise<TipoCambio> {
    const token = this.config.get('BANXICO_TOKEN', { infer: true });
    const url = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${BANXICO_SERIE}/datos/oportuno?token=${token}`;

    let payload: unknown;
    try {
      const resp = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      payload = await resp.json();
    } catch (err) {
      this.logger.error(`Banxico no respondió: ${(err as Error).message}`);
      throw new InternalServerErrorException(
        'No se pudo obtener el tipo de cambio.',
      );
    }

    const dato = this.extraerDato(payload);
    if (!dato) {
      throw new InternalServerErrorException(
        'Respuesta inesperada de Banxico.',
      );
    }
    const valor = Number(dato.dato);
    if (!Number.isFinite(valor)) {
      throw new InternalServerErrorException(
        'Tipo de cambio no numérico.',
      );
    }
    return { valor, fecha: dato.fecha };
  }

  private extraerDato(
    payload: unknown,
  ): { dato: string; fecha: string } | null {
    const series = (payload as { bmx?: { series?: unknown[] } })?.bmx?.series;
    const primera = Array.isArray(series) ? series[0] : undefined;
    const datos = (primera as { datos?: unknown[] })?.datos;
    const dato = Array.isArray(datos) ? datos[0] : undefined;
    const d = dato as { dato?: unknown; fecha?: unknown } | undefined;
    if (!d || typeof d.dato !== 'string' || typeof d.fecha !== 'string') {
      return null;
    }
    return { dato: d.dato, fecha: d.fecha };
  }

  /** Último INPC capturado (el de mayor consecutivo). */
  async ultimoInpc(): Promise<UltimoInpc | null> {
    const { data, error } = await this.supabase.admin
      .from('inpc')
      .select('id, anio, mes, inpc')
      .order('consecutivo', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      this.logger.error(`Error leyendo último INPC: ${error.message}`);
      throw new InternalServerErrorException('No se pudo obtener el INPC.');
    }
    if (!data || data.inpc == null) return null;

    return {
      inpc: Number(data.inpc),
      anio: data.anio,
      mes: data.mes,
      id: data.id,
    };
  }
}
