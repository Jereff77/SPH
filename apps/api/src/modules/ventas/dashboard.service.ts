import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';

export interface FiltrosDashboard {
  anio: number;
  mes: number;
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
  kpis: { monto: number; pagos: number; balance: number };
  meses: { mes: number; monto: number; pagos: number; balance: number }[];
  atrasos: {
    idNave: string | null;
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
  constructor(private readonly supabase: SupabaseService) {}

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

  private chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  /**
   * Propiedades en alcance: `pdpActivo = activo` e inversionista marcado como
   * `inversionista = true` y `pruebas = false`. Se **excluye el parque de
   * Tickets** (`propiedades.esTicket = false`): los tickets no son ventas y no
   * deben aparecer en el módulo de Ventas. Devuelve un mapa idPropiedad →
   * datos para enriquecer.
   */
  private async scopePropiedades(activo: boolean): Promise<Map<string, PropScope>> {
    const { data, error } = await this.supabase.admin
      .from('propiedades')
      .select(
        'idPropiedad, idNave, idParque, nomDescriptivo, idInversionista, inversionista!inner(razonsocial)',
      )
      .eq('pdpActivo', activo)
      .eq('esTicket', false)
      .eq('inversionista.inversionista', true)
      .eq('inversionista.pruebas', false);
    if (error) throw new InternalServerErrorException(error.message);

    type Row = {
      idPropiedad: string;
      idNave: string | null;
      idParque: string | null;
      nomDescriptivo: string | null;
      idInversionista: string | null;
      inversionista: { razonsocial: string | null } | { razonsocial: string | null }[] | null;
    };
    const rows = (data ?? []) as unknown as Row[];

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

  /** Tabla principal (planes de pago) del año/mes, en el universo activo+1000. */
  async tabla(f: FiltrosDashboard) {
    const scope = await this.scopePropiedades(f.activo);
    const scopeIds = [...scope.keys()];
    if (scopeIds.length === 0) return [];

    const [ini, fin] = this.rangoMes(f.anio, f.mes);
    const parciales = await this.fetchParcialidades(scopeIds, ini, fin);
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
  async tarjetas(anio: number, mes: number, activo: boolean) {
    const scope = await this.scopePropiedades(activo);
    const scopeIds = [...scope.keys()];
    if (scopeIds.length === 0) {
      return { anual: resumenVacio(), mes: resumenVacio(), mesReal: resumenVacio() };
    }

    const [mesIni, mesFin] = this.rangoMes(anio, mes);
    const [anioIni, anioFin] = this.rangoAnio(anio);

    const [parcMes, parcAnio] = await Promise.all([
      this.fetchParcialidades(scopeIds, mesIni, mesFin),
      this.fetchParcialidades(scopeIds, anioIni, anioFin),
    ]);

    const objetivoMes = parcMes.reduce((a, p) => a + (p.monto ?? 0), 0);
    const objetivoAnual = parcAnio.reduce((a, p) => a + (p.monto ?? 0), 0);

    const [cobranzaMes, cobranzaAnual, cobranzaReal] = await Promise.all([
      this.sumPagosDeParcialidades(parcMes.map((p) => p.idPdpDet)),
      this.sumPagosDeParcialidades(parcAnio.map((p) => p.idPdpDet)),
      this.cobranzaRealDelMes(scopeIds, mesIni, mesFin),
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
   * Dashboard gráfico (clave 620): KPIs anuales (Monto/Pagos/Balance), serie de
   * 12 meses (por vencimiento) y **naves con atrasos** (parcialidades vencidas
   * con saldo > 0). Universo: planes activos (`pdpActivo=true`), sin Tickets.
   * Reutiliza `scopePropiedades`/`fetchParcialidades`/`pagosAggPorParcialidad`.
   */
  async reporteGrafico(anio: number): Promise<ReporteGrafico> {
    const meses = Array.from({ length: 12 }, (_, i) => ({
      mes: i + 1,
      monto: 0,
      pagos: 0,
      balance: 0,
    }));
    const vacio: ReporteGrafico = {
      kpis: { monto: 0, pagos: 0, balance: 0 },
      meses,
      atrasos: [],
      totalVencido: 0,
    };

    const scope = await this.scopePropiedades(true);
    const scopeIds = [...scope.keys()];
    if (scopeIds.length === 0) return vacio;

    const hoy = this.hoyMx();
    const [anioIni, anioFin] = this.rangoAnio(anio);

    // 1) KPIs y serie mensual del año (objetivo por vencimiento + sus pagos).
    const parcAnio = await this.fetchParcialidades(scopeIds, anioIni, anioFin);
    const aggAnio = await this.pagosAggPorParcialidad(parcAnio.map((p) => p.idPdpDet));
    let kMonto = 0;
    let kPagos = 0;
    for (const pd of parcAnio) {
      const monto = pd.monto ?? 0;
      const pagos = aggAnio.get(pd.idPdpDet)?.pagos ?? 0;
      kMonto += monto;
      kPagos += pagos;
      const m = pd.fecha ? Number(pd.fecha.slice(5, 7)) : 0;
      if (m >= 1 && m <= 12) {
        meses[m - 1]!.monto += monto;
        meses[m - 1]!.pagos += pagos;
      }
    }
    for (const mm of meses) mm.balance = mm.pagos - mm.monto;
    const kpis = { monto: kMonto, pagos: kPagos, balance: kPagos - kMonto };

    // 2) Naves con atrasos: parcialidades vencidas (fecha < hoy) con saldo > 0,
    //    en TODO el historial (cartera vencida real, no solo del año del gráfico).
    const parcVencidas = await this.fetchParcialidades(scopeIds, '1900-01-01', hoy);
    const aggVenc = await this.pagosAggPorParcialidad(parcVencidas.map((p) => p.idPdpDet));
    const porNave = new Map<
      string,
      {
        idNave: string | null;
        nave: string | null;
        razonsocial: string | null;
        montoVencido: number;
        fechaMasAntigua: string | null;
      }
    >();
    for (const pd of parcVencidas) {
      const saldo = (pd.monto ?? 0) - (aggVenc.get(pd.idPdpDet)?.pagos ?? 0);
      if (saldo <= 0.005) continue; // sin saldo vencido
      const sc = pd.idPropiedad ? scope.get(pd.idPropiedad) : undefined;
      const key = pd.idPropiedad ?? pd.idPdpDet;
      const cur =
        porNave.get(key) ??
        {
          idNave: sc?.idNave ?? null,
          nave: sc?.nomDescriptivo ?? sc?.nomParque ?? null,
          razonsocial: sc?.razonsocial ?? null,
          montoVencido: 0,
          fechaMasAntigua: null as string | null,
        };
      cur.montoVencido += saldo;
      if (pd.fecha && (!cur.fechaMasAntigua || pd.fecha < cur.fechaMasAntigua))
        cur.fechaMasAntigua = pd.fecha;
      porNave.set(key, cur);
    }
    const atrasos = [...porNave.values()]
      .map((v) => ({
        idNave: v.idNave,
        nave: v.nave,
        razonsocial: v.razonsocial,
        montoVencido: Math.round(v.montoVencido * 100) / 100,
        diasAtraso: v.fechaMasAntigua ? this.diasEntre(v.fechaMasAntigua, hoy) : 0,
      }))
      .sort((a, b) => b.montoVencido - a.montoVencido);
    const totalVencido = Math.round(atrasos.reduce((s, a) => s + a.montoVencido, 0) * 100) / 100;

    return { kpis, meses, atrasos, totalVencido };
  }

  /** "Hoy" en horario de México (yyyy-MM-dd). */
  private hoyMx(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  }

  /** Días naturales entre dos fechas yyyy-MM-dd (>= 0). */
  private diasEntre(desde: string, hasta: string): number {
    const a = new Date(`${desde}T00:00:00Z`).getTime();
    const b = new Date(`${hasta}T00:00:00Z`).getTime();
    return Math.max(0, Math.round((b - a) / 86_400_000));
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
  async rentas(anio: number, mes: number, tipo: string) {
    let q = this.supabase.admin
      .from('v_rentasCombinadas')
      .select('*')
      .eq('yearExtraido', anio)
      .eq('mes', mes);
    if (tipo && tipo !== 'Todos') q = q.eq('tipo_renta', tipo);
    const { data, error } = await q.order('nomDescriptivo', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /** Años disponibles para el combo (min/max de las fechas de parcialidades). */
  async filtros() {
    const [min, max] = await Promise.all([
      this.supabase.admin
        .from('pdpDetalle')
        .select('fecha')
        .not('fecha', 'is', null)
        .order('fecha', { ascending: true })
        .limit(1)
        .maybeSingle(),
      this.supabase.admin
        .from('pdpDetalle')
        .select('fecha')
        .not('fecha', 'is', null)
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const actual = new Date().getFullYear();
    const yMin = min.data?.fecha ? Number(min.data.fecha.slice(0, 4)) : actual;
    const yMax = max.data?.fecha ? Number(max.data.fecha.slice(0, 4)) : actual;
    const anios: number[] = [];
    for (let y = yMax; y >= yMin; y--) anios.push(y);
    return { anios: anios.length ? anios : [actual] };
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
