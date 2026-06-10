import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';

/** Filtros comunes de los reportes (todos opcionales). */
export interface FiltrosReporte {
  anio?: number | null;
  mes?: number | null;
  razonsocial?: string | null;
  parque?: string | null;
  propiedad?: string | null;
}

/** Fila del reporte Estado de Cuenta (RPC v_pdpdetalle_get_estado_cuenta_detalle). */
export interface EstadoCuentaRow {
  anio: string | number | null;
  mes: string | number | null;
  fecha: string | null;
  pago_fecha: string | null;
  nomParque: string | null;
  numPago: number | null;
  tipoPago: string | null;
  razonsocial: string | null;
  nompropiedad: string | null;
  suma_monto: number | null;
  suma_pago_monto: number | null;
  balance: number | null;
  pago_vencido: boolean | null;
  dias_vencimiento: number | null;
  avance: string | number | null;
  esTicket: boolean | null;
}

/** Fila del reporte Vencidos (RPC v_pdpdetalle_get_saldos_vencidos_por_parque). */
export interface VencidoRow {
  anio: string | number | null;
  mes: string | number | null;
  fecha: string | null;
  nomParque: string | null;
  numPago: number | null;
  tipoPago: string | null;
  razonsocial: string | null;
  nompropiedad: string | null;
  saldo_vencido: number | null;
  dias_vencimiento: number | null;
}

export interface ResumenParqueRow {
  parque: string | null;
  total_saldo_vencido: number | null;
  cantidad_registros: number | null;
  porcentaje_del_total: string | number | null;
}

export interface EvolucionRow {
  anio: string | number | null;
  parque: string | null;
  total_saldo_vencido: number | null;
}

/**
 * Ventas > Reportes (clave 620). Réplica de los reportes HTML de v1 (Estado de
 * Cuenta y Vencidos), pero **seguros**: el backend invoca las RPCs existentes
 * `v_pdpdetalle_get_*` (SECURITY DEFINER, parametrizadas) con `service_role`;
 * el navegador ya NO usa la anon key embebida de v1.
 */
@Injectable()
export class ReportesService {
  constructor(private readonly supabase: SupabaseService) {}

  private norm(v?: string | null): string | undefined {
    return v && v.trim() !== '' ? v : undefined;
  }

  /**
   * Combinaciones únicas (razón social, parque, propiedad, año) de `v_pdpdetalle`
   * (solo lectura). El frontend las usa para una **cascada de filtros
   * bidireccional**: cada selector muestra solo las opciones compatibles con los
   * demás filtros. `sinA3` excluye el parque de Tickets (reporte Vencidos).
   */
  async combosFiltros(
    sinA3: boolean,
  ): Promise<{ razonsocial: string; parque: string; propiedad: string; anio: string }[]> {
    const vistos = new Set<string>();
    const combos: { razonsocial: string; parque: string; propiedad: string; anio: string }[] = [];
    const PAGE = 1000;
    let desde = 0;
    for (;;) {
      let q = this.supabase.admin
        .from('v_pdpdetalle')
        .select('razonsocial, nomParque, nompropiedad, anio, esTicket');
      if (sinA3) q = q.eq('esTicket', false);
      const { data, error } = await q.range(desde, desde + PAGE - 1);
      if (error) throw new InternalServerErrorException(error.message);
      const filas = (data ?? []) as unknown as {
        razonsocial: string | null;
        nomParque: string | null;
        nompropiedad: string | null;
        anio: string | number | null;
      }[];
      for (const f of filas) {
        const razonsocial = f.razonsocial ?? '';
        const parque = f.nomParque ?? '';
        const propiedad = f.nompropiedad ?? '';
        const anio = f.anio != null ? String(f.anio) : '';
        const key = `${razonsocial}|${parque}|${propiedad}|${anio}`;
        if (!vistos.has(key)) {
          vistos.add(key);
          combos.push({ razonsocial, parque, propiedad, anio });
        }
      }
      if (filas.length < PAGE) break;
      desde += PAGE;
    }
    return combos;
  }

  /** Valores únicos para los filtros. tipo: 1=razón social,2=parque,3=propiedad,4=año,5=tipo pago. */
  async valoresUnicos(tipo: number, sinA3: boolean): Promise<string[]> {
    const fn = sinA3 ? 'v_pdpdetalle_get_unique_values_sin_a3' : 'v_pdpdetalle_get_unique_values';
    const { data, error } = await this.supabase.admin.rpc(fn, { tipo_dato: tipo });
    if (error) throw new InternalServerErrorException(error.message);
    return ((data ?? []) as { valor: string | null }[])
      .map((r) => r.valor)
      .filter((v): v is string => !!v);
  }

  /** Filtros dependientes (cascada razón social → parque → propiedad). */
  async filtrosDependientes(razonsocial?: string, parque?: string) {
    const { data, error } = await this.supabase.admin.rpc(
      'v_pdpdetalle_get_filtros_dependientes',
      { p_razonsocial: this.norm(razonsocial), p_parque: this.norm(parque) },
    );
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as unknown as {
      razonsocial?: string | null;
      nomParque: string | null;
      nompropiedad: string | null;
      anio: string | number | null;
      tipoPago: string | null;
    }[];
  }

  async estadoCuenta(f: FiltrosReporte): Promise<EstadoCuentaRow[]> {
    const { data, error } = await this.supabase.admin.rpc(
      'v_pdpdetalle_get_estado_cuenta_detalle',
      {
        p_anio: f.anio ?? undefined,
        p_mes: f.mes ?? undefined,
        p_razonsocial: this.norm(f.razonsocial),
        p_parque: this.norm(f.parque),
        p_propiedad: this.norm(f.propiedad),
      },
    );
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as unknown as EstadoCuentaRow[];
  }

  async saldosVencidos(f: FiltrosReporte): Promise<VencidoRow[]> {
    const { data, error } = await this.supabase.admin.rpc(
      'v_pdpdetalle_get_saldos_vencidos_por_parque',
      {
        p_anio: f.anio ?? undefined,
        p_mes: f.mes ?? undefined,
        p_razonsocial: this.norm(f.razonsocial),
        p_parque: this.norm(f.parque),
        p_propiedad: this.norm(f.propiedad),
      },
    );
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as unknown as VencidoRow[];
  }

  async resumenVencidos(f: FiltrosReporte): Promise<ResumenParqueRow[]> {
    const { data, error } = await this.supabase.admin.rpc(
      'v_pdpdetalle_get_resumen_saldos_vencidos_parque',
      { p_anio: f.anio ?? undefined, p_mes: f.mes ?? undefined, p_razonsocial: this.norm(f.razonsocial) },
    );
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as unknown as ResumenParqueRow[];
  }

  async evolucionVencidos(razonsocial?: string, parque?: string): Promise<EvolucionRow[]> {
    const { data, error } = await this.supabase.admin.rpc(
      'v_pdpdetalle_get_evolucion_saldos_vencidos',
      { p_razonsocial: this.norm(razonsocial), p_parque: this.norm(parque) },
    );
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as unknown as EvolucionRow[];
  }
}
