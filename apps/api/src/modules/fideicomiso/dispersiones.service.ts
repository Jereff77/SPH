import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';

export interface DispersionOpciones {
  fideicomisos: { idFide: string; titulo: string | null }[];
  periodos: { noDispersion: string; fecInicio: string; fecFin: string }[];
  adhesiones: { noAdhesion: string; razonsocial: string | null }[];
}

/**
 * Fideicomiso → Dispersiones (clave 530). Sustituye el WebView inseguro de v1
 * (que instanciaba supabase-js con la anon key en el navegador): aquí el cálculo
 * lo hacen las **mismas RPCs de negocio que usa v1** (SIN el sufijo `_corregido`) y
 * el backend las invoca con parámetros enlazados. El front solo consume el JSON.
 *
 * ⚠️ Histórico: estas llamadas usaban las variantes `_corregido`, pero
 * `plan_dispersiones_dinamico_corregido` itera sobre `fidePdpDispersion` (periodos
 * de dispersión planeados) en vez de `pagos` (pagos reales), por lo que el Desglose
 * Detallado salía inflado: repetía cada ticket una vez por periodo histórico. Se
 * volvió a las originales para igualar a v1 (verificado contra producción: las
 * variantes de resumen daban resultado idéntico; solo la del plan estaba mal).
 */
@Injectable()
export class DispersionesService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Opciones de los selectores: fideicomisos, periodos y adhesiones. */
  async opciones(): Promise<DispersionOpciones> {
    const [fides, periodos, adh] = await Promise.all([
      this.supabase.admin
        .from('fideicomiso')
        .select('idFide, titulo')
        .order('fecinicio', { ascending: false, nullsFirst: false }),
      this.supabase.admin
        .from('fide_periodos_dispersion')
        .select('no_dispersion, fec_inicio, fec_fin')
        .order('fec_inicio', { ascending: true }),
      this.supabase.admin
        .from('v_fideicomiso')
        .select('noAdhesion, razonsocial')
        .not('noAdhesion', 'is', null),
    ]);
    if (fides.error) throw new InternalServerErrorException(fides.error.message);
    if (periodos.error)
      throw new InternalServerErrorException(periodos.error.message);
    if (adh.error) throw new InternalServerErrorException(adh.error.message);

    // Adhesiones distintas, ordenadas numéricamente por su número.
    const mapaAdh = new Map<string, string | null>();
    for (const a of adh.data ?? []) {
      const no = a.noAdhesion?.trim();
      if (!no) continue;
      if (!mapaAdh.has(no)) mapaAdh.set(no, a.razonsocial ?? null);
    }

    return {
      fideicomisos: (fides.data ?? []).map((f) => ({
        idFide: f.idFide,
        titulo: f.titulo,
      })),
      periodos: (periodos.data ?? []).map((p) => ({
        noDispersion: p.no_dispersion,
        fecInicio: p.fec_inicio,
        fecFin: p.fec_fin,
      })),
      adhesiones: [...mapaAdh.entries()]
        .map(([noAdhesion, razonsocial]) => ({ noAdhesion, razonsocial }))
        .sort((a, b) =>
          a.noAdhesion.localeCompare(b.noAdhesion, 'es', { numeric: true }),
        ),
    };
  }

  /** Resumen completo del fideicomiso para un periodo (todas las adhesiones). */
  async resumenCompleto(idFide: string, noDispersion: string) {
    const { data, error } = await this.supabase.admin.rpc(
      'resumen_fideicomiso_completo',
      { p_id_fideicomiso: idFide, p_no_dispersion: noDispersion },
    );
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /** Plan de dispersiones (detalle por pago) de una adhesión. */
  async planAdhesion(idFide: string, noAdhesion: string, noDispersion?: string) {
    const { data, error } = await this.supabase.admin.rpc(
      'plan_dispersiones_dinamico',
      {
        p_id_fideicomiso: idFide,
        p_no_adhesion: noAdhesion,
        ...(noDispersion ? { p_no_dispersion: noDispersion } : {}),
      },
    );
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /** Resumen de una adhesión en un periodo concreto. */
  async resumenAdhesion(
    idFide: string,
    noAdhesion: string,
    noDispersion: string,
  ) {
    const { data, error } = await this.supabase.admin.rpc(
      'resumen_dispersion_dinamico',
      {
        p_id_fideicomiso: idFide,
        p_no_adhesion: noAdhesion,
        p_no_dispersion: noDispersion,
      },
    );
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }
}
