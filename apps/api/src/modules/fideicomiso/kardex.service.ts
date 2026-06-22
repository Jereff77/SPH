import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';

/** Una fila del Kardex (dispersión de `fidePdpDispersion`) con su estado calculado. */
export interface KardexFila {
  idFidePdpD: string;
  numMov: number | null;
  monto: number | null;
  fecini: string | null;
  fecfin: string | null;
  dias: number | null;
  rend: number | null;
  calculo: number | null;
  comsph: number | null;
  retencionIsr: number | null;
  dispersion: number | null;
  /** true = Pagado (status && fecfin<=hoy); false = Pendiente. */
  pagado: boolean;
}

export interface KardexReporte {
  /** Datos de cabecera del inversionista seleccionado. */
  info: {
    nombreInversionista: string;
    personalidad: string | null;
    idPropiedad: string | null;
    /** Rendimiento promedio (% medio de `rend` sobre TODAS las filas). */
    rendimientoPromedio: number;
  };
  kpis: { total: number; pagados: number; pendientes: number };
  /** Totales financieros calculados SOLO sobre filas pagadas. */
  totales: {
    calculo: number;
    comsph: number;
    retencionIsr: number;
    dispersion: number;
  };
  filas: KardexFila[];
}

/** Inversionista con dispersiones (para el selector del Kardex). */
export interface KardexInversionistaOpt {
  nombreInversionista: string;
  personalidad: string | null;
}

/** Propiedad con dispersiones (para el filtro por propiedad del Kardex). */
export interface KardexPropiedadOpt {
  idPropiedad: string;
  label: string;
}

/**
 * Fideicomiso → Reporte Kardex (clave 530). Réplica del reporte nativo
 * `fide_reportes` de v1, pero **calculado en el servidor** (el front solo
 * presenta): estado "Pagado" = `status===true && fecfin<=hoy` (solo fecha),
 * totales financieros solo de pagados, y rendimiento promedio sobre todas las
 * filas. Lee la tabla EXISTENTE `fidePdpDispersion` (solo lectura).
 */
@Injectable()
export class KardexService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Inversionistas con dispersiones (distintos), ordenados por nombre. */
  async inversionistas(): Promise<KardexInversionistaOpt[]> {
    const { data, error } = await this.supabase.admin
      .from('fidePdpDispersion')
      .select('nombreInversionista, personalidad')
      .not('nombreInversionista', 'is', null);
    if (error) throw new InternalServerErrorException(error.message);
    const mapa = new Map<string, string | null>();
    for (const r of data ?? []) {
      const nom = r.nombreInversionista?.trim();
      if (!nom) continue;
      if (!mapa.has(nom)) mapa.set(nom, r.personalidad ?? null);
    }
    return [...mapa.entries()]
      .map(([nombreInversionista, personalidad]) => ({
        nombreInversionista,
        personalidad,
      }))
      .sort((a, b) =>
        a.nombreInversionista.localeCompare(b.nombreInversionista, 'es'),
      );
  }

  /** Propiedades (distintas) con dispersiones de un inversionista, para el filtro. */
  async propiedadesDe(nombreInversionista: string): Promise<KardexPropiedadOpt[]> {
    const { data, error } = await this.supabase.admin
      .from('fidePdpDispersion')
      .select('idPropiedad')
      .eq('nombreInversionista', nombreInversionista)
      .not('idPropiedad', 'is', null);
    if (error) throw new InternalServerErrorException(error.message);
    const ids = [...new Set((data ?? []).map((d) => d.idPropiedad).filter((x): x is string => !!x))];
    if (ids.length === 0) return [];
    const { data: props } = await this.supabase.admin
      .from('propiedades')
      .select('idPropiedad, nomDescriptivo')
      .in('idPropiedad', ids);
    const labelDe = new Map<string, string | null>();
    for (const p of props ?? []) labelDe.set(p.idPropiedad, p.nomDescriptivo);
    return ids
      .map((idPropiedad) => ({ idPropiedad, label: labelDe.get(idPropiedad) ?? idPropiedad }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }

  /**
   * Reporte Kardex de un inversionista (opcionalmente filtrado por una o varias propiedades).
   * Replica la regla de "Pagado" de v1 (`status===true && fecfin<=hoy`, solo fecha).
   */
  async kardex(nombreInversionista: string, propiedades?: string[]): Promise<KardexReporte> {
    let q = this.supabase.admin
      .from('fidePdpDispersion')
      .select(
        'idFidePdpD, numMov, monto, fecini, fecfin, dias, rend, comsph, calculo, calculo_comsph, retencion_isr, dispersion, personalidad, idPropiedad, status, nombreInversionista',
      )
      .eq('nombreInversionista', nombreInversionista);
    if (propiedades && propiedades.length > 0) q = q.in('idPropiedad', propiedades);
    const { data, error } = await q.order('fecfin', { ascending: true, nullsFirst: false });
    if (error) throw new InternalServerErrorException(error.message);
    const rows = data ?? [];

    // "Hoy" como fecha (sin hora) en horario de México — igual que v1, que usaba
    // la fecha local del dispositivo. Se compara como cadena ISO 'YYYY-MM-DD'
    // (TZ-safe; evita que el día se corra por la zona horaria del servidor).
    const hoyMX = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const filas: KardexFila[] = rows.map((r) => {
      const pagado = this.esPagado(r.status, r.fecfin, hoyMX);
      return {
        idFidePdpD: r.idFidePdpD,
        numMov: r.numMov,
        monto: r.monto,
        fecini: r.fecini,
        fecfin: r.fecfin,
        dias: r.dias,
        rend: r.rend,
        calculo: r.calculo,
        comsph: r.calculo_comsph,
        retencionIsr: r.retencion_isr,
        dispersion: r.dispersion,
        pagado,
      };
    });

    const pagadas = filas.filter((f) => f.pagado);
    const totales = pagadas.reduce(
      (acc, f) => {
        acc.calculo += f.calculo ?? 0;
        acc.comsph += f.comsph ?? 0;
        acc.retencionIsr += f.retencionIsr ?? 0;
        acc.dispersion += f.dispersion ?? 0;
        return acc;
      },
      { calculo: 0, comsph: 0, retencionIsr: 0, dispersion: 0 },
    );

    // Rendimiento promedio = promedio de `rend` sobre TODAS las filas (como v1).
    const rendimientoPromedio =
      filas.length > 0
        ? filas.reduce((s, f) => s + (f.rend ?? 0), 0) / filas.length
        : 0;

    return {
      info: {
        nombreInversionista,
        personalidad: rows[0]?.personalidad ?? null,
        idPropiedad:
          propiedades && propiedades.length === 1
            ? (propiedades[0] ?? null)
            : (rows[0]?.idPropiedad ?? null),
        rendimientoPromedio,
      },
      kpis: {
        total: filas.length,
        pagados: pagadas.length,
        pendientes: filas.length - pagadas.length,
      },
      totales,
      filas,
    };
  }

  /** Pagado = status===true Y fecfin <= hoy (comparando solo la fecha, ISO). */
  private esPagado(
    status: boolean | null,
    fecfin: string | null,
    hoyMX: string,
  ): boolean {
    if (status !== true || !fecfin) return false;
    return fecfin.slice(0, 10) <= hoyMX;
  }
}
