import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { SaldosVencidosService } from './saldos-vencidos.service.js';
import { firmarDocumentos } from '../cxp/documentos.util.js';

export interface FiltrosDashboard {
  anio: number;
  /** Uno o varios meses (1-12). Vacío o los 12 = todo el año. */
  meses: number[];
  activo: boolean;
}

/** Datos de la propiedad que enriquecen cada parcialidad (como hacía `v_pagos`). */
interface PropScope {
  idNave: string | null;
  idParque: string | null;
  nomParque: string | null;
  nomDescriptivo: string | null;
  idInversionista: string | null;
  razonsocial: string | null;
}

interface ParcialRow {
  idPdpDet: string;
  idPdp: string | null;
  numPago: number | null;
  fecha: string | null;
  monto: number | null;
  idPropiedad: string | null;
  tipoPago: string | null;
  ultimoPago: boolean | null;
}

interface AggPagos {
  terreno: number;
  construccion: number;
  ticket: number;
  pagos: number;
  descuentos: number;
}

/** Salida del Dashboard gráfico (clave 620). */
export interface ReporteGrafico {
  /**
   * `programado`/`cobrado`: del periodo (año + meses filtrados). `vencido`: el
   * adeudo realmente exigible **al día de hoy** (FIFO por plan, todo el
   * historial), no una proyección anual.
   */
  kpis: { programado: number; cobrado: number; vencido: number };
  meses: { mes: number; monto: number; pagos: number; balance: number }[];
  atrasos: {
    idNave: string | null;
    /** Para navegar al plan de la nave desde el Dashboard (doble clic). */
    idPropiedad: string | null;
    idInversionista: string | null;
    nave: string | null;
    razonsocial: string | null;
    montoVencido: number;
    diasAtraso: number;
  }[];
  totalVencido: number;
}

const resumenVacio = () => ({ objetivo: 0, cobranza: 0, balance: 0 });

/**
 * Ventas > Dashboard (clave 600). **Sin vistas**: todos los cálculos (tabla y
 * tarjetas) se hacen aquí, desde las tablas base, con un **único universo
 * consistente**: parcialidades de propiedades con `pdpActivo = <filtro>` cuyo
 * inversionista está marcado como `inversionista = true` y `pruebas = false`.
 * Así el total de la tabla y las tarjetas siempre cuadran. Reemplaza
 * `InicioWidget` de v1.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly saldosVencidos: SaldosVencidosService,
  ) {}

  // ------------------------------- helpers -------------------------------

  private rangoMes(anio: number, mes: number): [string, string] {
    const ini = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const fin =
      mes === 12 ? `${anio + 1}-01-01` : `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
    return [ini, fin];
  }

  private rangoAnio(anio: number): [string, string] {
    return [`${anio}-01-01`, `${anio + 1}-01-01`];
  }

  /** Conjunto de meses válido (1-12). Vacío → todos los meses (todo el año). */
  private mesesSet(meses: number[]): Set<number> {
    const v = meses.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);
    return new Set(v.length ? v : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  }

  /** Mes (1-12) de una fecha ISO `yyyy-MM-dd`, o 0 si no hay fecha. */
  private mesDe(fecha: string | null): number {
    return fecha ? Number(fecha.slice(5, 7)) : 0;
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  /**
   * Propiedades en alcance (universo de cobranza): `pdpActivo = activo`, titular
   * **no de pruebas** (`inversionista.pruebas = false`) y que sea **venta real
   * (`inversionista.inversionista = true`) O ticket (`propiedades.esTicket =
   * true`)**. Antes se excluía el parque de Tickets; los tickets de A3 ahora se
   * **integran** a Gestión de Pagos (600) y al Dashboard gráfico (620). Devuelve
   * un mapa idPropiedad → datos para enriquecer.
   */
  private async scopePropiedades(activo: boolean): Promise<Map<string, PropScope>> {
    const { data, error } = await this.supabase.admin
      .from('propiedades')
      .select(
        'idPropiedad, idNave, idParque, nomDescriptivo, idInversionista, esTicket, inversionista!inner(razonsocial, inversionista)',
      )
      .eq('pdpActivo', activo)
      .eq('inversionista.pruebas', false);
    if (error) throw new InternalServerErrorException(error.message);

    type Row = {
      idPropiedad: string;
      idNave: string | null;
      idParque: string | null;
      nomDescriptivo: string | null;
      idInversionista: string | null;
      esTicket: boolean | null;
      inversionista:
        | { razonsocial: string | null; inversionista: boolean | null }
        | { razonsocial: string | null; inversionista: boolean | null }[]
        | null;
    };
    // Venta real O ticket (el filtro `inversionista=true` no puede convivir con
    // el OR en el query, así que se aplica en memoria).
    const rows = ((data ?? []) as unknown as Row[]).filter((r) => {
      const inv = Array.isArray(r.inversionista) ? r.inversionista[0] : r.inversionista;
      return inv?.inversionista === true || r.esTicket === true;
    });

    // Nombre de parque (no hay FK propiedades→parques: se resuelve aparte).
    const idParques = [
      ...new Set(rows.map((r) => r.idParque).filter((x): x is string => !!x)),
    ];
    const parqueMap = new Map<string, string | null>();
    for (const grupo of this.chunk(idParques, 200)) {
      const { data: pqs } = await this.supabase.admin
        .from('parques')
        .select('idParque, nomParque')
        .in('idParque', grupo);
      for (const pq of pqs ?? []) parqueMap.set(pq.idParque, pq.nomParque);
    }

    const map = new Map<string, PropScope>();
    for (const r of rows) {
      const inv = Array.isArray(r.inversionista) ? r.inversionista[0] : r.inversionista;
      map.set(r.idPropiedad, {
        idNave: r.idNave,
        idParque: r.idParque,
        nomParque: r.idParque ? (parqueMap.get(r.idParque) ?? null) : null,
        nomDescriptivo: r.nomDescriptivo,
        idInversionista: r.idInversionista,
        razonsocial: inv?.razonsocial ?? null,
      });
    }
    return map;
  }

  /** Parcialidades (pdpDetalle) de las propiedades en alcance, en un rango de fechas. */
  private async fetchParcialidades(
    scopeIds: string[],
    ini: string,
    fin: string,
  ): Promise<ParcialRow[]> {
    if (scopeIds.length === 0) return [];
    const rows: ParcialRow[] = [];
    const PAGE = 1000;
    let desde = 0;
    for (;;) {
      const { data, error } = await this.supabase.admin
        .from('pdpDetalle')
        .select('idPdpDet, idPdp, numPago, fecha, monto, idPropiedad, tipoPago, ultimoPago')
        .gte('fecha', ini)
        .lt('fecha', fin)
        .in('idPropiedad', scopeIds)
        .order('idPdpDet', { ascending: true })
        .range(desde, desde + PAGE - 1);
      if (error) throw new InternalServerErrorException(error.message);
      rows.push(...((data ?? []) as ParcialRow[]));
      if (!data || data.length < PAGE) break;
      desde += PAGE;
    }
    return rows;
  }

  /** Suma de pagos por parcialidad (terreno/construcción/ticket/total/descuentos). */
  private async pagosAggPorParcialidad(ids: string[]): Promise<Map<string, AggPagos>> {
    const map = new Map<string, AggPagos>();
    for (const grupo of this.chunk(ids, 150)) {
      const { data, error } = await this.supabase.admin
        .from('pagos')
        .select('idPdpDet, tipomovimiento, tipoOperacion, monto')
        .in('idPdpDet', grupo);
      if (error) throw new InternalServerErrorException(error.message);
      for (const p of data ?? []) {
        if (!p.idPdpDet) continue;
        const cur =
          map.get(p.idPdpDet) ??
          { terreno: 0, construccion: 0, ticket: 0, pagos: 0, descuentos: 0 };
        const m = p.monto ?? 0;
        cur.pagos += m;
        if (p.tipomovimiento === 1) cur.terreno += m;
        else if (p.tipomovimiento === 2) cur.construccion += m;
        else if (p.tipomovimiento === 3) cur.ticket += m;
        if (p.tipoOperacion === 2) cur.descuentos += m;
        map.set(p.idPdpDet, cur);
      }
    }
    return map;
  }

  /** Monto total del plan (pdp.monto) por idPdp. */
  private async montoTotalPorPdp(idPdps: string[]): Promise<Map<string, number | null>> {
    const map = new Map<string, number | null>();
    for (const grupo of this.chunk(idPdps, 150)) {
      const { data, error } = await this.supabase.admin
        .from('pdp')
        .select('idPdp, monto')
        .in('idPdp', grupo);
      if (error) throw new InternalServerErrorException(error.message);
      for (const r of data ?? []) map.set(r.idPdp, r.monto);
    }
    return map;
  }

  /** Suma de todos los pagos hechos sobre un conjunto de parcialidades. */
  private async sumPagosDeParcialidades(ids: string[]): Promise<number> {
    let total = 0;
    for (const grupo of this.chunk(ids, 150)) {
      const { data, error } = await this.supabase.admin
        .from('pagos')
        .select('monto')
        .in('idPdpDet', grupo);
      if (error) throw new InternalServerErrorException(error.message);
      total += (data ?? []).reduce((a, p) => a + (p.monto ?? 0), 0);
    }
    return total;
  }

  // ------------------------------- endpoints -------------------------------

  /** Tabla principal (planes de pago) del año/meses, en el universo activo+1000. */
  async tabla(f: FiltrosDashboard) {
    const scope = await this.scopePropiedades(f.activo);
    const scopeIds = [...scope.keys()];
    if (scopeIds.length === 0) return [];

    // Se cargan las parcialidades del año y se filtran por los meses pedidos
    // (permite meses no contiguos o todo el año en una sola consulta).
    const [ini, fin] = this.rangoAnio(f.anio);
    const set = this.mesesSet(f.meses);
    const parcialesAnio = await this.fetchParcialidades(scopeIds, ini, fin);
    const parciales =
      set.size >= 12
        ? parcialesAnio
        : parcialesAnio.filter((p) => set.has(this.mesDe(p.fecha)));
    if (parciales.length === 0) return [];

    const [agg, montoTotal] = await Promise.all([
      this.pagosAggPorParcialidad(parciales.map((p) => p.idPdpDet)),
      this.montoTotalPorPdp([
        ...new Set(parciales.map((p) => p.idPdp).filter((x): x is string => !!x)),
      ]),
    ]);

    const filas = parciales.map((pd) => {
      const sc = pd.idPropiedad ? scope.get(pd.idPropiedad) : undefined;
      const ag = agg.get(pd.idPdpDet) ?? {
        terreno: 0,
        construccion: 0,
        ticket: 0,
        pagos: 0,
        descuentos: 0,
      };
      const fecha = pd.fecha ?? null;
      return {
        idPdpDet: pd.idPdpDet,
        idPdp: pd.idPdp,
        numPago: pd.numPago,
        fecha,
        mes: fecha ? Number(fecha.slice(5, 7)) : null,
        anio: fecha ? Number(fecha.slice(0, 4)) : null,
        monto: pd.monto,
        montototal: pd.idPdp ? (montoTotal.get(pd.idPdp) ?? null) : null,
        idPropiedad: pd.idPropiedad,
        nomParque: sc?.nomParque ?? null,
        idNave: sc?.idNave ?? null,
        idInversionista: sc?.idInversionista ?? null,
        pagos_terreno: ag.terreno,
        pagos_construccion: ag.construccion,
        pagos_ticket: ag.ticket,
        descuentos: ag.descuentos,
        pagos: ag.pagos,
        balance: ag.pagos - (pd.monto ?? 0),
        pagos_acumulados: null,
        porcentaje_avance: null,
        tipoPago: pd.tipoPago,
        fecha_pagos: null,
        razonsocial: sc?.razonsocial ?? null,
        pdpActivo: f.activo,
        nomDescriptivo: sc?.nomDescriptivo ?? null,
        ultimoPago: pd.ultimoPago,
      };
    });

    // Orden: fecha asc, luego nombre descriptivo (como v1).
    filas.sort(
      (a, b) =>
        (a.fecha ?? '').localeCompare(b.fecha ?? '') ||
        (a.nomDescriptivo ?? '').localeCompare(b.nomDescriptivo ?? ''),
    );
    return filas;
  }

  /**
   * Las 3 tarjetas, todas {objetivo, cobranza, balance} (balance = cobranza −
   * objetivo) en el MISMO universo que la tabla (activo + tipoCliente 1000):
   * - `anual`: todas las parcialidades del año (objetivo) y sus pagos (cobranza).
   * - `mes`: parcialidades cuyo **vencimiento** cae en el mes.
   * - `mesReal`: mismo objetivo del mes, pero la cobranza son los pagos
   *   **realizados durante el mes** (por fecha de pago), incl. atrasados/adelantados.
   */
  async tarjetas(anio: number, meses: number[], activo: boolean) {
    const scope = await this.scopePropiedades(activo);
    const scopeIds = [...scope.keys()];
    if (scopeIds.length === 0) {
      return { anual: resumenVacio(), mes: resumenVacio(), mesReal: resumenVacio() };
    }

    const [anioIni, anioFin] = this.rangoAnio(anio);
    const set = this.mesesSet(meses);

    // Se carga el año una sola vez y las parcialidades de los meses pedidos
    // salen filtrando en memoria (la tarjeta "mes" pasa a ser "de los meses").
    const parcAnio = await this.fetchParcialidades(scopeIds, anioIni, anioFin);
    const parcMes =
      set.size >= 12 ? parcAnio : parcAnio.filter((p) => set.has(this.mesDe(p.fecha)));

    const objetivoMes = parcMes.reduce((a, p) => a + (p.monto ?? 0), 0);
    const objetivoAnual = parcAnio.reduce((a, p) => a + (p.monto ?? 0), 0);

    const [cobranzaMes, cobranzaAnual, cobranzaReal] = await Promise.all([
      this.sumPagosDeParcialidades(parcMes.map((p) => p.idPdpDet)),
      this.sumPagosDeParcialidades(parcAnio.map((p) => p.idPdpDet)),
      this.cobranzaRealDeMeses(scopeIds, anio, [...set]),
    ]);

    const t = (objetivo: number, cobranza: number) => ({
      objetivo,
      cobranza,
      balance: cobranza - objetivo,
    });

    return {
      anual: t(objetivoAnual, cobranzaAnual),
      mes: t(objetivoMes, cobranzaMes),
      mesReal: t(objetivoMes, cobranzaReal),
    };
  }

  /**
   * Dashboard gráfico (clave 620). KPIs **a hoy**, serie de 12 meses (por
   * vencimiento) y **naves con atrasos** (parcialidades vencidas con saldo > 0).
   * Universo: planes activos (`pdpActivo=true`), sin Tickets.
   *
   * - `mesesSel`: uno o varios meses (1-12) para acotar el periodo. Vacío = todo
   *   el año. Afecta la serie mensual y los KPIs `programado`/`cobrado`.
   * - KPI `vencido`: el adeudo realmente exigible **al día de hoy** (FIFO por
   *   plan, todo el historial) — sustituye al antiguo "balance" (proyección
   *   anual `pagos − monto`, que incluía parcialidades futuras y confundía).
   *
   * Reutiliza `scopePropiedades`/`fetchParcialidades`/`pagosAggPorParcialidad`.
   */
  async reporteGrafico(anio: number, mesesSel: number[] = []): Promise<ReporteGrafico> {
    const set = this.mesesSet(mesesSel);
    const meses = Array.from({ length: 12 }, (_, i) => ({
      mes: i + 1,
      monto: 0,
      pagos: 0,
      balance: 0,
    }));
    const vacio: ReporteGrafico = {
      kpis: { programado: 0, cobrado: 0, vencido: 0 },
      meses,
      atrasos: [],
      totalVencido: 0,
    };

    const scope = await this.scopePropiedades(true);
    const scopeIds = [...scope.keys()];
    if (scopeIds.length === 0) return vacio;

    const [anioIni, anioFin] = this.rangoAnio(anio);

    // 1) Serie mensual + KPIs de periodo (programado vs cobrado) del año,
    //    acotados a los meses seleccionados (vacío = todo el año).
    const parcAnio = await this.fetchParcialidades(scopeIds, anioIni, anioFin);
    const parcSel =
      set.size >= 12 ? parcAnio : parcAnio.filter((p) => set.has(this.mesDe(p.fecha)));
    const aggSel = await this.pagosAggPorParcialidad(parcSel.map((p) => p.idPdpDet));
    let programado = 0;
    let cobrado = 0;
    for (const pd of parcSel) {
      const monto = pd.monto ?? 0;
      const pagos = aggSel.get(pd.idPdpDet)?.pagos ?? 0;
      programado += monto;
      cobrado += pagos;
      const m = this.mesDe(pd.fecha);
      if (m >= 1 && m <= 12) {
        meses[m - 1]!.monto += monto;
        meses[m - 1]!.pagos += pagos;
      }
    }
    for (const mm of meses) mm.balance = mm.pagos - mm.monto;

    // 2) Naves con atrasos: saldos vencidos con lógica de **cuenta corriente
    //    (FIFO por plan)** sobre TODO el historial. Incluye Tickets (decisión de
    //    negocio para vencidos). Fuente única: SaldosVencidosService — el mismo
    //    cálculo que el reporte de Vencidos, por lo que ambos cuadran.
    const vencidas = await this.saldosVencidos.calcular({ incluirTickets: true });
    const porNave = new Map<
      string,
      {
        idNave: string | null;
        idPropiedad: string | null;
        idInversionista: string | null;
        nave: string | null;
        razonsocial: string | null;
        montoVencido: number;
        diasAtraso: number;
      }
    >();
    for (const v of vencidas) {
      const key = v.idPropiedad ?? v.idPdpDet;
      const cur =
        porNave.get(key) ??
        {
          idNave: v.idNave,
          idPropiedad: v.idPropiedad,
          idInversionista: v.idInversionista,
          nave: v.nomDescriptivo ?? v.nomParque ?? null,
          razonsocial: v.razonsocial,
          montoVencido: 0,
          diasAtraso: 0,
        };
      cur.montoVencido += v.saldoVencido;
      if (v.diasVencimiento > cur.diasAtraso) cur.diasAtraso = v.diasVencimiento;
      porNave.set(key, cur);
    }
    const atrasos = [...porNave.values()]
      .map((v) => ({
        idNave: v.idNave,
        idPropiedad: v.idPropiedad,
        idInversionista: v.idInversionista,
        nave: v.nave,
        razonsocial: v.razonsocial,
        montoVencido: Math.round(v.montoVencido * 100) / 100,
        diasAtraso: v.diasAtraso,
      }))
      .sort((a, b) => b.montoVencido - a.montoVencido);
    const totalVencido = Math.round(atrasos.reduce((s, a) => s + a.montoVencido, 0) * 100) / 100;

    const kpis = { programado, cobrado, vencido: totalVencido };
    return { kpis, meses, atrasos, totalVencido };
  }

  /** Cobranza real (pagos por fecha de pago) sumada sobre varios meses. */
  private async cobranzaRealDeMeses(
    scopeIds: string[],
    anio: number,
    meses: number[],
  ): Promise<number> {
    const sumas = await Promise.all(
      meses.map((m) => {
        const [ini, fin] = this.rangoMes(anio, m);
        return this.cobranzaRealDelMes(scopeIds, ini, fin);
      }),
    );
    return sumas.reduce((a, b) => a + b, 0);
  }

  /** Pagos realizados durante el mes (por fecha de pago), dentro del universo. */
  private async cobranzaRealDelMes(
    scopeIds: string[],
    ini: string,
    fin: string,
  ): Promise<number> {
    const set = new Set(scopeIds);
    const { data, error } = await this.supabase.admin
      .from('pagos')
      .select('monto, idPropiedad')
      .gte('fecha', ini)
      .lt('fecha', fin);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []).reduce(
      (a, p) => (p.idPropiedad && set.has(p.idPropiedad) ? a + (p.monto ?? 0) : a),
      0,
    );
  }

  /** 2ª pestaña: Renta Garantizada / Administrada (sigue usando `v_rentasCombinadas`). */
  async rentas(anio: number, meses: number[], tipo: string) {
    const set = this.mesesSet(meses);
    let q = this.supabase.admin
      .from('v_rentasCombinadas')
      .select('*')
      .eq('yearExtraido', anio);
    if (set.size < 12) q = q.in('mes', [...set]);
    if (tipo && tipo !== 'Todos') q = q.eq('tipo_renta', tipo);
    const { data, error } = await q.order('nomDescriptivo', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /**
   * Años disponibles para el combo: los **años distintos que existen en las
   * parcialidades de PLANES ACTIVOS** (mismo universo que la tabla:
   * `pdpActivo=true`, sin Tickets, inversionista real). No es un rango continuo
   * (que generaba años intermedios sin datos) ni toma planes inactivos. Se
   * descartan además fechas de captura claramente erróneas (años fuera de
   * `[2000, añoActual+20]`, p. ej. 0025 o 2303).
   */
  async filtros() {
    const actual = new Date().getFullYear();
    const scope = await this.scopePropiedades(true);
    const scopeIds = [...scope.keys()];
    if (scopeIds.length === 0) return { anios: [actual] };

    const parciales = await this.fetchParcialidades(scopeIds, '1900-01-01', '9999-12-31');
    const anios = new Set<number>();
    for (const p of parciales) {
      const y = p.fecha ? Number(p.fecha.slice(0, 4)) : NaN;
      if (Number.isFinite(y) && y >= 2000 && y <= actual + 20) anios.add(y);
    }
    const lista = [...anios].sort((a, b) => b - a);
    return { anios: lista.length ? lista : [actual] };
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
    const filas = data ?? [];

    // El comprobante se guarda como PATH en el bucket privado `cxp` (documento
    // fiscal): se entrega como **URL firmada temporal**. El helper resuelve también
    // las URLs públicas históricas (bucket `comprobantes`), sin migrar datos.
    const firmados = await firmarDocumentos(
      this.supabase.admin,
      filas.map((p) => p.comprobante),
      'cxp',
    );
    return filas.map((p) => ({
      ...p,
      comprobante: p.comprobante ? (firmados.get(p.comprobante) ?? null) : null,
    }));
  }
}
