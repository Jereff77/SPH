import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';

/**
 * Una parcialidad **vencida con saldo**, después de aplicar los pagos del plan
 * con lógica de **cuenta corriente (FIFO)**. El `saldoVencido` ya tiene
 * descontado el saldo a favor que dejó cualquier sobrepago previo del MISMO plan.
 */
export interface ParcialidadVencida {
  idPdp: string | null;
  idPdpDet: string;
  idPropiedad: string | null;
  idNave: string | null;
  idParque: string | null;
  nomParque: string | null;
  /** Nombre descriptivo de la propiedad/nave. */
  nomDescriptivo: string | null;
  idInversionista: string | null;
  razonsocial: string | null;
  /** Fecha de vencimiento (yyyy-MM-dd); siempre presente (la parcialidad ya venció). */
  fecha: string;
  anio: number;
  mes: number;
  numPago: number | null;
  tipoPago: string | null;
  /** Monto programado de la parcialidad. */
  monto: number;
  /** Saldo aún adeudado tras aplicar el FIFO del plan (> 0). */
  saldoVencido: number;
  /** Días naturales de atraso (hoy − fecha), en horario de México. */
  diasVencimiento: number;
}

export interface OpcionesVencidos {
  /**
   * Incluir el parque de **Tickets** (`propiedades.esTicket = true`) en el
   * universo. Para el módulo de Ventas se incluyen en el cálculo de vencidos
   * (decisión 2026-06). Default: `true`.
   */
  incluirTickets?: boolean;
}

/** Datos de la propiedad para enriquecer cada parcialidad. */
interface PropScope {
  idNave: string | null;
  idParque: string | null;
  nomParque: string | null;
  nomDescriptivo: string | null;
  idInversionista: string | null;
  razonsocial: string | null;
}

interface ParcialRow {
  idPdp: string | null;
  idPdpDet: string;
  numPago: number | null;
  fecha: string | null;
  monto: number | null;
  idPropiedad: string | null;
  tipoPago: string | null;
}

/**
 * Núcleo del cálculo de **saldos vencidos** de Ventas.
 *
 * **Por qué existe (cuenta corriente vs parcialidad aislada):** el cálculo
 * anterior evaluaba cada parcialidad por separado (`saldo = monto − pagos de
 * ESA parcialidad`). Cuando un cliente concentra un pago grande en una sola
 * parcialidad (adelanta varias mensualidades), ese **saldo a favor** no se
 * propagaba y las demás parcialidades figuraban como vencidas aunque ya estaban
 * cubiertas. Aquí se aplica la lógica de **cuenta corriente por plan (FIFO)**:
 * todos los pagos del plan se aplican a sus parcialidades **de la más antigua a
 * la más nueva**, y solo queda como vencido el **saldo remanente** de las
 * parcialidades cuya fecha ya pasó.
 *
 * Reglas de negocio (acordadas con el usuario, 2026-06):
 * - El saldo a favor se aplica **solo dentro del mismo plan** (`idPdp`); nunca
 *   cruza a otro plan.
 * - Aplicación **FIFO**: primero lo más antiguo; el excedente fluye hacia el
 *   futuro.
 * - **Pagos cancelados (`status = false`) NO cuentan.** Los **descuentos**
 *   (`tipoOperacion = 2`) **SÍ** cuentan como pago.
 * - Universo: inversionista real (`inversionista = true`, `pruebas = false`),
 *   plan activo (`pdpActivo = true`); Tickets incluidos por defecto.
 *
 * Es la **única fuente de verdad** de los saldos vencidos: lo consumen tanto el
 * Dashboard gráfico (`DashboardService.reporteGrafico`) como el reporte de
 * Vencidos (`ReportesService`). Sustituye a las RPCs v1
 * `v_pdpdetalle_get_saldos_vencidos_*` (obsoletas; ver OBSOLESCENCIA-BD.md).
 */
@Injectable()
export class SaldosVencidosService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Devuelve **todas** las parcialidades vencidas con saldo del universo, ya con
   * el FIFO aplicado. NO aplica filtros de año/mes/parque: el FIFO necesita el
   * plan completo, así que los consumidores filtran el resultado en memoria.
   */
  async calcular(opts: OpcionesVencidos = {}): Promise<ParcialidadVencida[]> {
    const incluirTickets = opts.incluirTickets ?? true;

    const scope = await this.scopePropiedades(incluirTickets);
    const scopeIds = [...scope.keys()];
    if (scopeIds.length === 0) return [];

    const parciales = await this.fetchParcialidades(scopeIds);
    if (parciales.length === 0) return [];

    const pagos = await this.pagosPorParcialidad(parciales.map((p) => p.idPdpDet));

    // Agrupar por plan (idPdp). Las parcialidades sin plan se tratan aisladas.
    const porPlan = new Map<string, ParcialRow[]>();
    for (const p of parciales) {
      const key = p.idPdp ?? `__sinplan__${p.idPdpDet}`;
      const arr = porPlan.get(key);
      if (arr) arr.push(p);
      else porPlan.set(key, [p]);
    }

    const hoy = this.hoyMx();
    const out: ParcialidadVencida[] = [];

    for (const lista of porPlan.values()) {
      // "Bolsa" del plan = suma de TODOS sus pagos válidos (cuenta corriente).
      const bolsa = lista.reduce((a, p) => a + (pagos.get(p.idPdpDet) ?? 0), 0);

      // Orden FIFO: fecha asc (nulos al final), luego número de pago.
      const ordenadas = [...lista].sort(
        (a, b) =>
          (a.fecha ?? '9999-12-31').localeCompare(b.fecha ?? '9999-12-31') ||
          (a.numPago ?? 0) - (b.numPago ?? 0),
      );

      let acum = 0; // monto acumulado del plan hasta esta parcialidad (incl.)
      for (const pd of ordenadas) {
        const monto = pd.monto ?? 0;
        acum += monto;
        // Saldo remanente de esta parcialidad tras aplicar la bolsa por antigüedad.
        const saldo = Math.max(0, Math.min(monto, acum - bolsa));
        if (saldo <= 0.005) continue; // cubierta por pagos del plan
        if (!pd.fecha || pd.fecha >= hoy) continue; // solo cuenta lo ya vencido

        const sc = pd.idPropiedad ? scope.get(pd.idPropiedad) : undefined;
        out.push({
          idPdp: pd.idPdp,
          idPdpDet: pd.idPdpDet,
          idPropiedad: pd.idPropiedad,
          idNave: sc?.idNave ?? null,
          idParque: sc?.idParque ?? null,
          nomParque: sc?.nomParque ?? null,
          nomDescriptivo: sc?.nomDescriptivo ?? null,
          idInversionista: sc?.idInversionista ?? null,
          razonsocial: sc?.razonsocial ?? null,
          fecha: pd.fecha,
          anio: Number(pd.fecha.slice(0, 4)),
          mes: Number(pd.fecha.slice(5, 7)),
          numPago: pd.numPago,
          tipoPago: pd.tipoPago,
          monto,
          saldoVencido: Math.round(saldo * 100) / 100,
          diasVencimiento: this.diasEntre(pd.fecha, hoy),
        });
      }
    }
    return out;
  }

  // ------------------------------- helpers -------------------------------

  /**
   * Propiedades en alcance: plan activo (`pdpActivo = true`) e inversionista real
   * (`inversionista = true`, `pruebas = false`). A diferencia del Dashboard, los
   * **Tickets se incluyen** por defecto (decisión de negocio para vencidos).
   */
  private async scopePropiedades(incluirTickets: boolean): Promise<Map<string, PropScope>> {
    let q = this.supabase.admin
      .from('propiedades')
      .select(
        'idPropiedad, idNave, idParque, nomDescriptivo, idInversionista, inversionista!inner(razonsocial)',
      )
      .eq('pdpActivo', true)
      .eq('inversionista.inversionista', true)
      .eq('inversionista.pruebas', false);
    if (!incluirTickets) q = q.eq('esTicket', false);

    const { data, error } = await q;
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
    const idParques = [...new Set(rows.map((r) => r.idParque).filter((x): x is string => !!x))];
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

  /** TODAS las parcialidades (todo el historial) de las propiedades en alcance. */
  private async fetchParcialidades(scopeIds: string[]): Promise<ParcialRow[]> {
    if (scopeIds.length === 0) return [];
    const rows: ParcialRow[] = [];
    const PAGE = 1000;
    let desde = 0;
    for (;;) {
      const { data, error } = await this.supabase.admin
        .from('pdpDetalle')
        .select('idPdp, idPdpDet, numPago, fecha, monto, idPropiedad, tipoPago')
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

  /**
   * Suma de pagos **válidos** por parcialidad. Filtra `status = true` (los
   * cancelados no cuentan) e incluye descuentos (`tipoOperacion = 2`).
   */
  private async pagosPorParcialidad(ids: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    for (const grupo of this.chunk(ids, 150)) {
      const { data, error } = await this.supabase.admin
        .from('pagos')
        .select('idPdpDet, monto')
        .eq('status', true)
        .in('idPdpDet', grupo);
      if (error) throw new InternalServerErrorException(error.message);
      for (const p of data ?? []) {
        if (!p.idPdpDet) continue;
        map.set(p.idPdpDet, (map.get(p.idPdpDet) ?? 0) + (p.monto ?? 0));
      }
    }
    return map;
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

  private chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }
}
