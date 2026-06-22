import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { SaldosVencidosService, type ParcialidadVencida } from './saldos-vencidos.service.js';

/**
 * Filtros comunes de los reportes (todos opcionales y **multi-valor**, regla 7c).
 * Un arreglo vacío o ausente = sin filtro; varios valores = OR dentro del campo.
 */
export interface FiltrosReporte {
  anios?: number[];
  meses?: number[];
  razonsocial?: string[];
  parque?: string[];
  propiedad?: string[];
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
 * Ventas > Reportes (clave 620). Réplica de los reportes HTML de v1, pero
 * **seguros** (el navegador ya NO usa la anon key embebida de v1):
 * - **Estado de Cuenta** y **filtros** siguen usando las RPCs `v_pdpdetalle_get_*`
 *   (SECURITY DEFINER, parametrizadas) con `service_role`.
 * - **Vencidos** (saldos/resumen/evolución) se calculan con `SaldosVencidosService`
 *   (cuenta corriente FIFO por plan). Ya NO usan las RPCs
 *   `v_pdpdetalle_get_saldos_vencidos_*` (obsoletas; ver OBSOLESCENCIA-BD.md),
 *   que evaluaban cada parcialidad aislada e ignoraban el saldo a favor.
 */
@Injectable()
export class ReportesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly vencidos: SaldosVencidosService,
  ) {}

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

  /** Único valor si el arreglo trae exactamente uno (para filtrar en la RPC). */
  private uno<T>(a?: T[]): T | undefined {
    return a && a.length === 1 ? a[0] : undefined;
  }

  async estadoCuenta(f: FiltrosReporte): Promise<EstadoCuentaRow[]> {
    // La RPC filtra por igualdad (1 valor). Para multi-valor se pasa NULL a la
    // RPC en ese campo y se filtra en memoria (la RPC no hace cálculos que
    // dependan del filtro, así que es equivalente). Con 1 solo valor, la RPC ya
    // filtra (caso común, sin traer de más).
    const { data, error } = await this.supabase.admin.rpc(
      'v_pdpdetalle_get_estado_cuenta_detalle',
      {
        p_anio: this.uno(f.anios) ?? undefined,
        p_mes: this.uno(f.meses) ?? undefined,
        p_razonsocial: this.uno(f.razonsocial),
        p_parque: this.uno(f.parque),
        p_propiedad: this.uno(f.propiedad),
      },
    );
    if (error) throw new InternalServerErrorException(error.message);
    const rows = (data ?? []) as unknown as EstadoCuentaRow[];
    return rows.filter(
      (r) =>
        (!f.anios?.length || f.anios.includes(Number(r.anio))) &&
        (!f.meses?.length || f.meses.includes(Number(r.mes))) &&
        (!f.razonsocial?.length || (r.razonsocial != null && f.razonsocial.includes(r.razonsocial))) &&
        (!f.parque?.length || (r.nomParque != null && f.parque.includes(r.nomParque))) &&
        (!f.propiedad?.length || (r.nompropiedad != null && f.propiedad.includes(r.nompropiedad))),
    );
  }

  /** ¿La parcialidad vencida pasa los filtros (multi-valor) del reporte? */
  private coincide(v: ParcialidadVencida, f: FiltrosReporte): boolean {
    if (f.anios?.length && !f.anios.includes(v.anio)) return false;
    if (f.meses?.length && !f.meses.includes(v.mes)) return false;
    if (f.razonsocial?.length && !(v.razonsocial != null && f.razonsocial.includes(v.razonsocial))) return false;
    if (f.parque?.length && !(v.nomParque != null && f.parque.includes(v.nomParque))) return false;
    if (f.propiedad?.length && !(v.nomDescriptivo != null && f.propiedad.includes(v.nomDescriptivo))) return false;
    return true;
  }

  /** Detalle de saldos vencidos por parcialidad (cuenta corriente FIFO por plan). */
  async saldosVencidos(f: FiltrosReporte): Promise<VencidoRow[]> {
    const todas = await this.vencidos.calcular();
    return todas
      .filter((v) => this.coincide(v, f))
      .map((v) => ({
        anio: v.anio,
        mes: v.mes,
        fecha: v.fecha,
        nomParque: v.nomParque,
        numPago: v.numPago,
        tipoPago: v.tipoPago,
        razonsocial: v.razonsocial,
        nompropiedad: v.nomDescriptivo,
        saldo_vencido: v.saldoVencido,
        dias_vencimiento: v.diasVencimiento,
      }))
      .sort(
        (a, b) =>
          (a.nomParque ?? '').localeCompare(b.nomParque ?? '') ||
          (a.razonsocial ?? '').localeCompare(b.razonsocial ?? '') ||
          (a.fecha ?? '').localeCompare(b.fecha ?? '') ||
          (a.numPago ?? 0) - (b.numPago ?? 0),
      );
  }

  /** Resumen de saldos vencidos agrupado por parque (con % del total). */
  async resumenVencidos(f: FiltrosReporte): Promise<ResumenParqueRow[]> {
    const todas = await this.vencidos.calcular();
    const filtradas = todas.filter(
      (v) =>
        (!f.anios?.length || f.anios.includes(v.anio)) &&
        (!f.meses?.length || f.meses.includes(v.mes)) &&
        (!f.razonsocial?.length || (v.razonsocial != null && f.razonsocial.includes(v.razonsocial))),
    );
    const totalGeneral = filtradas.reduce((a, v) => a + v.saldoVencido, 0) || 1;
    const porParque = new Map<string, { total: number; cant: number }>();
    for (const v of filtradas) {
      const parque = v.nomParque ?? 'Sin Parque';
      const cur = porParque.get(parque) ?? { total: 0, cant: 0 };
      cur.total += v.saldoVencido;
      cur.cant += 1;
      porParque.set(parque, cur);
    }
    return [...porParque.entries()]
      .map(([parque, x]) => ({
        parque,
        total_saldo_vencido: Math.round(x.total * 100) / 100,
        cantidad_registros: x.cant,
        porcentaje_del_total: Math.round((x.total / totalGeneral) * 10000) / 100,
      }))
      .sort((a, b) => (b.total_saldo_vencido ?? 0) - (a.total_saldo_vencido ?? 0));
  }

  /** Evolución histórica de saldos vencidos por año y parque. */
  async evolucionVencidos(razonsocial?: string[], parque?: string[]): Promise<EvolucionRow[]> {
    const todas = await this.vencidos.calcular();
    const filtradas = todas.filter(
      (v) =>
        (!razonsocial?.length || (v.razonsocial != null && razonsocial.includes(v.razonsocial))) &&
        (!parque?.length || (v.nomParque != null && parque.includes(v.nomParque))),
    );
    const porAnioParque = new Map<string, { anio: number; parque: string; total: number }>();
    for (const v of filtradas) {
      const parqueNom = v.nomParque ?? 'Sin Parque';
      const key = `${v.anio}|${parqueNom}`;
      const cur = porAnioParque.get(key) ?? { anio: v.anio, parque: parqueNom, total: 0 };
      cur.total += v.saldoVencido;
      porAnioParque.set(key, cur);
    }
    return [...porAnioParque.values()]
      .map((x) => ({
        anio: x.anio,
        parque: x.parque,
        total_saldo_vencido: Math.round(x.total * 100) / 100,
      }))
      .sort(
        (a, b) => a.anio - b.anio || (a.parque ?? '').localeCompare(b.parque ?? ''),
      );
  }
}
