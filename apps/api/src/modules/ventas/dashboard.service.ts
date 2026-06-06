import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';

export interface FiltrosDashboard {
  anio: number;
  mes: number;
  activo: boolean;
}

/**
 * Ventas > Dashboard (clave 600). Vista de cobranza: lee las vistas de v1
 * (`v_pagos`, `v_montoTotalAnual`, `v_pagosTotalAnual`, `v_Totales_Anual_Mes`,
 * `v_rentasCombinadas`) desde el backend (service_role). El frontend nunca habla
 * con Supabase. Reemplaza `InicioWidget` de FlutterFlow.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Tabla principal (planes de pago) del año/mes filtrado por activo. */
  async tabla(f: FiltrosDashboard) {
    const { data, error } = await this.supabase.admin
      .from('v_pagos')
      .select('*')
      .eq('anio', f.anio)
      .eq('mes', f.mes)
      .eq('pdpActivo', f.activo)
      .order('fecha', { ascending: true })
      .order('nomDescriptivo', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /** Las 3 tarjetas de resumen (objetivo / cobranza / balance). */
  async tarjetas(anio: number, mes: number) {
    const [montoAnual, pagosAnual, totalesMes] = await Promise.all([
      this.supabase.admin
        .from('v_montoTotalAnual')
        .select('monto')
        .eq('year', anio)
        .eq('pdpActivo', true),
      this.supabase.admin.from('v_pagosTotalAnual').select('pagos').eq('year', anio),
      this.supabase.admin
        .from('v_Totales_Anual_Mes')
        .select('*')
        .eq('anio', anio)
        .eq('mes', mes)
        .eq('pdpActivo', true),
    ]);
    if (montoAnual.error) throw new InternalServerErrorException(montoAnual.error.message);
    if (pagosAnual.error) throw new InternalServerErrorException(pagosAnual.error.message);
    if (totalesMes.error) throw new InternalServerErrorException(totalesMes.error.message);

    const objetivoAnual = (montoAnual.data ?? []).reduce((a, r) => a + (r.monto ?? 0), 0);
    const cobranzaAnual = (pagosAnual.data ?? []).reduce((a, r) => a + (r.pagos ?? 0), 0);
    const m = (totalesMes.data ?? []).reduce(
      (acc, r) => {
        acc.objetivo += r.suma_monto ?? 0;
        acc.terreno += r.terreno ?? 0;
        acc.construccion += r.construccion ?? 0;
        acc.ticket += r.ticket ?? 0;
        acc.cobranza += r.TotalPagos ?? 0;
        acc.descuentos += r.descuentos ?? 0;
        acc.balance += r.balance ?? 0;
        return acc;
      },
      {
        objetivo: 0,
        terreno: 0,
        construccion: 0,
        ticket: 0,
        cobranza: 0,
        descuentos: 0,
        balance: 0,
      },
    );

    return {
      anual: {
        objetivo: objetivoAnual,
        cobranza: cobranzaAnual,
        balance: objetivoAnual - cobranzaAnual,
      },
      mes: m,
    };
  }

  /** 2ª pestaña: Renta Garantizada & Administrada (vista combinada). */
  async rentas(anio: number, mes: number, tipo: string) {
    let q = this.supabase.admin
      .from('v_rentasCombinadas')
      .select('*')
      .eq('yearExtraido', anio)
      .eq('mes', mes);
    // tipo: 'Todos' | 'Garantizada' | 'Administrada' (tipo_renta en la vista).
    if (tipo && tipo !== 'Todos') q = q.eq('tipo_renta', tipo);
    const { data, error } = await q.order('nomDescriptivo', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /** Años disponibles para el combo (distinct de v_pagos). */
  async filtros() {
    const { data, error } = await this.supabase.admin
      .from('v_pagos')
      .select('anio')
      .not('anio', 'is', null);
    if (error) throw new InternalServerErrorException(error.message);
    const anios = [
      ...new Set((data ?? []).map((r) => Number(r.anio)).filter((n) => Number.isFinite(n))),
    ].sort((a, b) => b - a);
    return { anios };
  }

  /** Detalle de pagos realizados de una parcialidad (`pagos` por idPdpDet). */
  async detallePagos(idPdpDet: string) {
    const { data, error } = await this.supabase.admin
      .from('pagos')
      .select('*')
      .eq('status', true)
      .eq('idPdpDet', idPdpDet)
      .order('fecha', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }
}
