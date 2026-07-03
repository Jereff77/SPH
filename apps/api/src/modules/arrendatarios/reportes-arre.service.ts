import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';

/** Filtros del reporte de cancelaciones anticipadas (todos opcionales). */
export interface FiltrosCancelaciones {
  anio?: number;
  parque?: string;
  busqueda?: string;
}

/** Plan (arrePdp) de una nave para el selector del estado de cuenta. */
export interface EstadoCuentaPlanOpcion {
  idArrePdp: string;
  fecInicio: string | null;
  fecFin: string | null;
  plazo: number | null;
  moneda: string | null;
  vigencia: string | null;
}

/** Nave arrendada con sus planes (opciones de los selectores Parque → Nave → Plan). */
export interface EstadoCuentaNave {
  idNavArrend: string;
  idParque: string;
  parque: string;
  nave: string;
  arrendatario: string;
  planes: EstadoCuentaPlanOpcion[];
}

/** Cabecera del estado de cuenta (datos del plan arrePdp). */
export interface EstadoCuentaCabecera {
  idArrePdp: string;
  arrendatario: string;
  parque: string;
  nave: string;
  moneda: string;
  /** Estado visual del contrato. */
  estado: 'VIGENTE' | 'TERMINADO' | 'CANCELADO';
  fecInicio: string | null;
  fecFin: string | null;
  plazo: number | null;
  deposito: number;
  vigencia: string | null;
  precioM2: number;
  construccionM2: number;
  pm2Admin: number;
  pm2Mtto: number;
  pm2Vig: number;
  inpcPlus: number;
}

/** Partida (mes) de la corrida desglosada por concepto. */
export interface EstadoCuentaPartida {
  numPartida: number;
  anio: number | null;
  ciclo: number | null;
  fecha: string | null;
  pm2: number;
  constM2: number;
  inpc: number;
  inpcTotal: number;
  renta: number;
  admin: number;
  mtto: number;
  vig: number;
  otros: number;
  nota: string;
  total: number;
  montoPagado: number;
  fecPago: string | null;
  pagado: boolean;
}

/** Respuesta del estado de cuenta de un plan: cabecera + corrida. */
export interface EstadoCuentaCorrida {
  cabecera: EstadoCuentaCabecera;
  partidas: EstadoCuentaPartida[];
}

/** Fila cruda de `arrePdp` (incluye `canceladoAnticipado`, aún no en @erp/types). */
interface PlanCabeceraRow {
  idArrePdp: string;
  idNavArrend: string | null;
  idArrendador: string | null;
  fecInicio: string | null;
  fecFin: string | null;
  plazo: number | null;
  deposito: number | null;
  precioM2: number | null;
  construccionM2: number | null;
  pm2Admin: number | null;
  pm2Mtto: number | null;
  pm2Vig: number | null;
  INPCPlus: number | null;
  Moneda: string | null;
  arrePdpVigente: string | null;
  canceladoAnticipado: boolean | null;
}

/** Normaliza el nombre de un concepto (sin acentos/minúsculas) para clasificarlo. */
const normConcepto = (c: string): string =>
  c
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

const montoTxt = (n: number): string => String(Math.round(n * 100) / 100);

/** Fila del reporte de Cancelaciones Anticipadas (enriquecida en memoria). */
export interface CancelacionReporteRow {
  idArrePdp: string;
  arrendatario: string;
  parque: string | null;
  nave: string | null;
  fecInicio: string | null;
  fecFin: string | null;
  fecCancelacion: string | null;
  motivo: string | null;
  cancelo: string | null;
  moneda: string | null;
}

/** Fila del reporte de Vencimientos: contrato activo vencido o por vencer. */
export interface VencimientoReporteRow {
  idArrePdp: string;
  idNavArrend: string;
  arrendatario: string;
  parque: string | null;
  nave: string | null;
  fecInicio: string | null;
  fecFin: string | null;
  /** Estado de vigencia: 'No' (vencido) | '1 Mes' | '2 Meses' | '3 Meses'. */
  estado: string;
  rentaBase: number;
  moneda: string | null;
}

/** Cabecera `arrePdp` mínima para el reporte de vencimientos (select('*') casteado). */
interface PlanVencRow {
  idArrePdp: string;
  idNavArrend: string | null;
  fecInicio: string | null;
  fecFin: string | null;
  rtaBase: number | null;
  Moneda: string | null;
  arrePdpVigente: string | null;
  canceladoAnticipado: boolean | null;
}

/**
 * Cabecera `arrePdp` con las columnas v2 de cancelación (aún NO tipadas en
 * `@erp/types` hasta regenerar `database.types.ts` tras aplicar el ALTER). Se
 * castea localmente el resultado de `select('*')`.
 */
interface ArrePdpCanceladoRow {
  idArrePdp: string;
  idArrendador: string | null;
  idNavArrend: string | null;
  fecInicio: string | null;
  fecFin: string | null;
  fecCancelacion: string | null;
  motivoCancelacion: string | null;
  canceladoPor: string | null;
  Moneda: string | null;
}

/**
 * Arrendatarios > Reportes (clave 20 — visible para quien tenga acceso al
 * módulo). Primer reporte: **Cancelaciones Anticipadas** — contratos terminados
 * anticipadamente (`arrePdp.canceladoAnticipado = true`), enriquecidos en memoria
 * (sin vistas nuevas): nave/parque (excluye Tickets), arrendatario y quién canceló.
 */
@Injectable()
export class ReportesArreService {
  constructor(private readonly supabase: SupabaseService) {}

  private nombre(i: {
    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;
    razonsocial: string | null;
  }): string {
    return i.razonsocial?.trim()
      ? i.razonsocial
      : [i.nombre, i.apellido1, i.apellido2].filter(Boolean).join(' ');
  }

  async cancelaciones(f: FiltrosCancelaciones): Promise<CancelacionReporteRow[]> {
    // 1) Cabeceras canceladas. `canceladoAnticipado` aún no está en los tipos:
    //    select('*') las trae en runtime; el filtro castea el nombre de columna.
    const { data: rows, error } = await this.supabase.admin
      .from('arrePdp')
      .select('*')
      .eq('status', true)
      .eq('canceladoAnticipado' as 'status', true);
    if (error) throw new InternalServerErrorException(error.message);
    const cancelados = (rows ?? []) as unknown as ArrePdpCanceladoRow[];
    if (cancelados.length === 0) return [];

    // 2) Claves para enriquecer.
    const orEmpty = (xs: (string | null)[]): string[] => {
      const s = [...new Set(xs.filter((x): x is string => !!x))];
      return s.length ? s : [''];
    };
    const idsNav = orEmpty(cancelados.map((c) => c.idNavArrend));
    const idsArr = orEmpty(cancelados.map((c) => c.idArrendador));
    const idsUser = orEmpty(cancelados.map((c) => c.canceladoPor));

    const [{ data: props }, { data: invs }, { data: users }] = await Promise.all([
      this.supabase.admin
        .from('arrenPropiedades')
        .select('idNavArrend, idNave, idParque')
        .in('idNavArrend', idsNav),
      this.supabase.admin
        .from('inversionista')
        .select('idInversionista, nombre, apellido1, apellido2, razonsocial')
        .in('idInversionista', idsArr),
      this.supabase.admin.from('catUsers').select('uid, nomCompleto').in('uid', idsUser),
    ]);

    const idsNave = orEmpty((props ?? []).map((p) => p.idNave));
    const idsParque = orEmpty((props ?? []).map((p) => p.idParque));
    const [{ data: naves }, { data: parques }] = await Promise.all([
      this.supabase.admin
        .from('naves')
        .select('idNave, numNaveNAME, numNave')
        .in('idNave', idsNave),
      this.supabase.admin
        .from('parques')
        .select('idParque, nomParque, esTicket')
        .in('idParque', idsParque),
    ]);

    // 3) Mapas de apoyo.
    const propPorNav = new Map((props ?? []).map((p) => [p.idNavArrend, p]));
    const invPorId = new Map((invs ?? []).map((i) => [i.idInversionista, i]));
    const userPorUid = new Map((users ?? []).map((u) => [u.uid, u.nomCompleto]));
    const navePorId = new Map((naves ?? []).map((n) => [n.idNave, n]));
    const parquePorId = new Map((parques ?? []).map((p) => [p.idParque, p]));

    // 4) Armar filas (excluye parques de Tickets) y aplicar filtros.
    const busca = f.busqueda?.trim().toLowerCase();
    const filas: CancelacionReporteRow[] = [];
    for (const c of cancelados) {
      const prop = c.idNavArrend ? propPorNav.get(c.idNavArrend) : undefined;
      const parque = prop?.idParque ? parquePorId.get(prop.idParque) : undefined;
      if (parque?.esTicket === true) continue; // Tickets se gestionan en Ventas.

      const nave = prop?.idNave ? navePorId.get(prop.idNave) : undefined;
      const inv = c.idArrendador ? invPorId.get(c.idArrendador) : undefined;
      const nomNave = nave?.numNaveNAME ?? (nave?.numNave != null ? String(nave.numNave) : null);
      const arrendatario = inv ? this.nombre(inv) : '—';

      // Filtro por año (de fecCancelacion).
      if (f.anio && (!c.fecCancelacion || Number(c.fecCancelacion.slice(0, 4)) !== f.anio)) continue;
      // Filtro por parque (nombre exacto).
      if (f.parque && (parque?.nomParque ?? '') !== f.parque) continue;
      // Búsqueda libre (arrendatario / nave).
      if (
        busca &&
        !`${arrendatario} ${nomNave ?? ''}`.toLowerCase().includes(busca)
      )
        continue;

      filas.push({
        idArrePdp: c.idArrePdp,
        arrendatario,
        parque: parque?.nomParque ?? null,
        nave: nomNave,
        fecInicio: c.fecInicio,
        fecFin: c.fecFin,
        fecCancelacion: c.fecCancelacion,
        motivo: c.motivoCancelacion,
        cancelo: (c.canceladoPor ? userPorUid.get(c.canceladoPor) : null) ?? null,
        moneda: c.Moneda,
      });
    }

    // Orden por fecha de cancelación desc (más recientes primero).
    filas.sort((a, b) => (b.fecCancelacion ?? '').localeCompare(a.fecCancelacion ?? ''));
    return filas;
  }

  /**
   * Opciones de los selectores del Estado de Cuenta: todas las naves arrendadas
   * (vínculo activo, excluye Tickets) **con plan**, cada una con sus planes
   * (`arrePdp`, vigentes y terminados) para elegir Parque → Nave → Plan.
   */
  async estadoCuentaOpciones(): Promise<EstadoCuentaNave[]> {
    const { data: props, error } = await this.supabase.admin
      .from('arrenPropiedades')
      .select('idNavArrend, idArrendador, idNave, idParque')
      .eq('status', true);
    if (error) throw new InternalServerErrorException(error.message);
    const lista = props ?? [];
    if (lista.length === 0) return [];

    const orEmpty = (xs: (string | null)[]): string[] => {
      const s = [...new Set(xs.filter((x): x is string => !!x))];
      return s.length ? s : [''];
    };
    const [{ data: naves }, { data: parques }, { data: invs }, { data: planes }] =
      await Promise.all([
        this.supabase.admin
          .from('naves')
          .select('idNave, numNaveNAME, numNave')
          .in('idNave', orEmpty(lista.map((p) => p.idNave))),
        this.supabase.admin
          .from('parques')
          .select('idParque, nomParque, esTicket')
          .in('idParque', orEmpty(lista.map((p) => p.idParque))),
        this.supabase.admin
          .from('inversionista')
          .select('idInversionista, nombre, apellido1, apellido2, razonsocial')
          .in('idInversionista', orEmpty(lista.map((p) => p.idArrendador))),
        this.supabase.admin
          .from('arrePdp')
          .select('idArrePdp, idNavArrend, fecInicio, fecFin, plazo, Moneda, arrePdpVigente')
          .eq('status', true)
          .in('idNavArrend', orEmpty(lista.map((p) => p.idNavArrend))),
      ]);

    const navePorId = new Map((naves ?? []).map((n) => [n.idNave, n]));
    const parquePorId = new Map((parques ?? []).map((p) => [p.idParque, p]));
    const invPorId = new Map((invs ?? []).map((i) => [i.idInversionista, i]));
    const planesPorNav = new Map<string, EstadoCuentaPlanOpcion[]>();
    for (const pl of planes ?? []) {
      if (!pl.idNavArrend) continue;
      const arr = planesPorNav.get(pl.idNavArrend) ?? [];
      arr.push({
        idArrePdp: pl.idArrePdp,
        fecInicio: pl.fecInicio,
        fecFin: pl.fecFin,
        plazo: pl.plazo,
        moneda: pl.Moneda,
        vigencia: pl.arrePdpVigente,
      });
      planesPorNav.set(pl.idNavArrend, arr);
    }

    const out: EstadoCuentaNave[] = [];
    for (const p of lista) {
      const parque = p.idParque ? parquePorId.get(p.idParque) : undefined;
      if (parque?.esTicket === true) continue; // Tickets se gestionan en Ventas.
      const planesNav = planesPorNav.get(p.idNavArrend) ?? [];
      if (planesNav.length === 0) continue; // solo naves con plan
      const nave = p.idNave ? navePorId.get(p.idNave) : undefined;
      const inv = p.idArrendador ? invPorId.get(p.idArrendador) : undefined;
      out.push({
        idNavArrend: p.idNavArrend,
        idParque: p.idParque ?? '',
        parque: parque?.nomParque ?? '—',
        nave: nave?.numNaveNAME ?? (nave?.numNave != null ? String(nave.numNave) : '—'),
        arrendatario: inv ? this.nombre(inv) : '—',
        // Planes más recientes primero (el vigente suele ser el de mayor fecInicio).
        planes: planesNav.sort((a, b) => (b.fecInicio ?? '').localeCompare(a.fecInicio ?? '')),
      });
    }
    return out.sort(
      (a, b) => a.parque.localeCompare(b.parque, 'es') || a.nave.localeCompare(b.nave, 'es'),
    );
  }

  /**
   * Estado de cuenta de **un plan** (`arrePdp`): la cabecera (datos del plan) y la
   * **corrida completa** (`arrePdpDetalle`) **desglosada por partida** — una fila por
   * mes con el monto separado en Renta/Admin/Mtto/Vig + Otros Servicios (suma del
   * resto) + Nota (detalle), Total y el estado de pago (monto aplicado, fecha, pagado).
   */
  async estadoCuentaCorrida(idArrePdp: string): Promise<EstadoCuentaCorrida> {
    // select('*') para incluir `canceladoAnticipado` (aún no tipada en @erp/types).
    const { data: planRaw, error } = await this.supabase.admin
      .from('arrePdp')
      .select('*')
      .eq('idArrePdp', idArrePdp)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!planRaw) throw new NotFoundException('Plan no encontrado.');
    const plan = planRaw as unknown as PlanCabeceraRow;

    const estado: EstadoCuentaCabecera['estado'] = plan.canceladoAnticipado
      ? 'CANCELADO'
      : plan.arrePdpVigente === 'No'
        ? 'TERMINADO'
        : 'VIGENTE';

    // Enriquecer la cabecera (nave/parque/arrendatario).
    const { data: prop } = await this.supabase.admin
      .from('arrenPropiedades')
      .select('idNave, idParque')
      .eq('idNavArrend', plan.idNavArrend ?? '')
      .maybeSingle();
    const [{ data: nave }, { data: parque }, { data: inv }] = await Promise.all([
      prop?.idNave
        ? this.supabase.admin
            .from('naves')
            .select('numNaveNAME, numNave')
            .eq('idNave', prop.idNave)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      prop?.idParque
        ? this.supabase.admin
            .from('parques')
            .select('nomParque')
            .eq('idParque', prop.idParque)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      plan.idArrendador
        ? this.supabase.admin
            .from('inversionista')
            .select('nombre, apellido1, apellido2, razonsocial')
            .eq('idInversionista', plan.idArrendador)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const cabecera: EstadoCuentaCabecera = {
      idArrePdp: plan.idArrePdp,
      arrendatario: inv ? this.nombre(inv) : '—',
      parque: parque?.nomParque ?? '—',
      nave: nave?.numNaveNAME ?? (nave?.numNave != null ? String(nave.numNave) : '—'),
      moneda: plan.Moneda ?? 'MXN',
      estado,
      fecInicio: plan.fecInicio,
      fecFin: plan.fecFin,
      plazo: plan.plazo,
      deposito: Number(plan.deposito) || 0,
      vigencia: plan.arrePdpVigente,
      precioM2: Number(plan.precioM2) || 0,
      construccionM2: Number(plan.construccionM2) || 0,
      pm2Admin: Number(plan.pm2Admin) || 0,
      pm2Mtto: Number(plan.pm2Mtto) || 0,
      pm2Vig: Number(plan.pm2Vig) || 0,
      inpcPlus: Number(plan.INPCPlus) || 0,
    };

    const { data: det, error: detErr } = await this.supabase.admin
      .from('arrePdpDetalle')
      .select(
        'numPartida, anio, ciclo, concepto, fecha, pm2, constM2, INPC, inpcTotal, cantidad, cantidadAplicada, fecPago',
      )
      .eq('idArrePdp', idArrePdp)
      .eq('status', true)
      .order('numPartida', { ascending: true })
      .order('anio', { ascending: true });
    if (detErr) throw new InternalServerErrorException(detErr.message);

    interface Acc {
      numPartida: number;
      anio: number | null;
      ciclo: number | null;
      fecha: string | null;
      pm2: number;
      constM2: number;
      inpc: number;
      inpcTotal: number;
      renta: number;
      admin: number;
      mtto: number;
      vig: number;
      otros: number;
      detalle: Map<string, number>;
      total: number;
      montoPagado: number;
      fecPago: string | null;
      filas: number;
      filasPagadas: number;
    }
    const map = new Map<number, Acc>();
    for (const r of det ?? []) {
      const np = r.numPartida ?? 0;
      let a = map.get(np);
      if (!a) {
        a = {
          numPartida: np,
          anio: r.anio,
          ciclo: r.ciclo,
          fecha: r.fecha ? String(r.fecha).slice(0, 10) : null,
          pm2: 0,
          constM2: 0,
          inpc: 0,
          inpcTotal: 0,
          renta: 0,
          admin: 0,
          mtto: 0,
          vig: 0,
          otros: 0,
          detalle: new Map(),
          total: 0,
          montoPagado: 0,
          fecPago: null,
          filas: 0,
          filasPagadas: 0,
        };
        map.set(np, a);
      }
      const m = Number(r.cantidad) || 0;
      a.total += m;
      a.montoPagado += Number(r.cantidadAplicada) || 0;
      const n = normConcepto(r.concepto ?? '');
      if (n === 'renta') {
        a.renta += m;
        a.pm2 = Number(r.pm2) || a.pm2;
        a.constM2 = Number(r.constM2) || a.constM2;
        a.inpc = Number(r.INPC) || a.inpc;
        a.inpcTotal = Number(r.inpcTotal) || a.inpcTotal;
      } else if (n === 'vigilancia') a.vig += m;
      else if (n === 'administracion') a.admin += m;
      else if (n === 'mantenimiento') a.mtto += m;
      else {
        a.otros += m;
        const nom = r.concepto ?? 'Otro';
        a.detalle.set(nom, (a.detalle.get(nom) ?? 0) + m);
      }
      a.filas++;
      if (r.fecPago) {
        a.filasPagadas++;
        if (!a.fecPago || r.fecPago > a.fecPago) a.fecPago = r.fecPago;
      }
    }

    const partidas: EstadoCuentaPartida[] = [...map.values()]
      .map((a) => ({
        numPartida: a.numPartida,
        anio: a.anio,
        ciclo: a.ciclo,
        fecha: a.fecha,
        pm2: a.pm2,
        constM2: a.constM2,
        inpc: a.inpc,
        inpcTotal: a.inpcTotal,
        renta: a.renta,
        admin: a.admin,
        mtto: a.mtto,
        vig: a.vig,
        otros: a.otros,
        nota: [...a.detalle.entries()].map(([nom, mo]) => `${montoTxt(mo)} ${nom}`).join(', '),
        total: a.total,
        montoPagado: a.montoPagado,
        fecPago: a.fecPago,
        pagado: a.filas > 0 && a.filasPagadas === a.filas,
      }))
      .sort((x, y) => x.numPartida - y.numPartida);

    return { cabecera, partidas };
  }

  /**
   * Reporte de **Vencimientos**. Dos grupos, ambos sin Tickets ni cancelados:
   * - **Por vencer** ('1 Mes' / '2 Meses' / '3 Meses'): el contrato **activo** de la
   *   nave (vínculo `arrenPropiedades.status=true`), que sigue corriendo.
   * - **Vencidos** ('No'): planes cuya `fecFin` ya pasó, que **siguen vinculados** a su
   *   nave (`arrenPropiedades.status=true`) y cuya **nave física (`idNave`) no tiene
   *   ningún contrato vigente** — misma regla que el sidebar del dashboard
   *   (`contratos_vencidos_sin_renovacion`). Si el vínculo se cerró (`status=false`) el
   *   cliente se fue / la nave se re-rentó → **NO** debe aparecer (la nave queda
   *   disponible). Se excluyen arrendatarios de prueba. Regla acordada 2026-07-02.
   *
   * Cada fila lleva arrendatario/parque/nave + fechas + renta base + moneda. El
   * cálculo de "días" lo hace el front (zona horaria México). No usa vistas nuevas.
   */
  async vencimientos(): Promise<VencimientoReporteRow[]> {
    // "Hoy" en zona horaria de México (YYYY-MM-DD) para comparar contra fecFin.
    const hoy = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
    }).format(new Date());
    const finISO = (f: string | null): string | null => (f ? String(f).slice(0, 10) : null);

    const orEmpty = (xs: (string | null)[]): string[] => {
      const s = [...new Set(xs.filter((x): x is string => !!x))];
      return s.length ? s : [''];
    };

    // Vínculos activos (para los contratos "por vencer", que siguen corriendo).
    const [{ data: props, error }, { data: planesRaw, error: pErr }] = await Promise.all([
      this.supabase.admin
        .from('arrenPropiedades')
        .select('idNavArrend, idArrePdp, idArrendador, idNave, idParque')
        .eq('status', true),
      this.supabase.admin.from('arrePdp').select('*').eq('status', true),
    ]);
    if (error) throw new InternalServerErrorException(error.message);
    if (pErr) throw new InternalServerErrorException(pErr.message);

    const activos = props ?? [];
    const planes = (planesRaw ?? []) as unknown as PlanVencRow[];
    const planPorId = new Map(planes.map((p) => [p.idArrePdp, p]));

    // Vínculo ACTIVO por idNavArrend (trae idNave/arrendador/parque). Un vencido solo
    // cuenta si su vínculo sigue activo (status=true): desvinculado = el cliente se fue.
    const vinculoActivoPorNav = new Map(activos.map((ap) => [ap.idNavArrend, ap]));

    // Naves FÍSICAS (idNave) con algún contrato vigente (fecFin nula o >= hoy) → nave
    // ocupada/renovada; su último contrato vencido no debe listarse como "sin renovación".
    const navesOcupadas = new Set<string>();
    for (const p of planes) {
      if (!p.idNavArrend) continue;
      if (p.fecFin && (finISO(p.fecFin) as string) < hoy) continue; // solo contratos vigentes
      const ap = vinculoActivoPorNav.get(p.idNavArrend);
      if (ap?.idNave) navesOcupadas.add(ap.idNave);
    }

    const POR_VENCER = new Set(['1 Mes', '2 Meses', '3 Meses']);

    // Candidato: el plan + el vínculo (nave/parque/arrendatario) + el estado a mostrar.
    interface Candidato {
      plan: PlanVencRow;
      idNavArrend: string;
      idArrendador: string | null;
      idNave: string | null;
      idParque: string | null;
      estado: string;
    }
    const cands: Candidato[] = [];
    const incluidos = new Set<string>();

    // A) Por vencer: vínculo activo + plan en estado 1/2/3 Meses.
    for (const ap of activos) {
      const plan = ap.idArrePdp ? planPorId.get(ap.idArrePdp) : undefined;
      if (!plan || plan.canceladoAnticipado) continue;
      if (!POR_VENCER.has(plan.arrePdpVigente ?? '')) continue;
      cands.push({
        plan,
        idNavArrend: ap.idNavArrend,
        idArrendador: ap.idArrendador,
        idNave: ap.idNave,
        idParque: ap.idParque,
        estado: plan.arrePdpVigente ?? '',
      });
      incluidos.add(plan.idArrePdp);
    }

    // B) Vencidos sin renovación: fecFin < hoy, VÍNCULO ACTIVO (no desvinculado) y la
    //    nave física no tiene ningún contrato vigente. El vínculo activo ya trae
    //    nave/parque/arrendatario, así que no hace falta releer arrenPropiedades.
    const vencidos = planes.filter((p) => {
      if (p.canceladoAnticipado || !p.fecFin) return false;
      if ((finISO(p.fecFin) as string) >= hoy) return false; // aún no vence
      if (!p.idNavArrend || incluidos.has(p.idArrePdp)) return false;
      const ap = vinculoActivoPorNav.get(p.idNavArrend);
      if (!ap) return false; // desvinculado: el cliente ya no tiene la nave
      if (ap.idNave && navesOcupadas.has(ap.idNave)) return false; // nave ya ocupada/renovada
      return true;
    });
    for (const p of vencidos) {
      const ap = p.idNavArrend ? vinculoActivoPorNav.get(p.idNavArrend) : undefined;
      if (!ap) continue; // garantizado por el filtro; guarda de tipo sin aserción non-null
      cands.push({
        plan: p,
        idNavArrend: p.idNavArrend ?? '',
        idArrendador: ap.idArrendador,
        idNave: ap.idNave,
        idParque: ap.idParque,
        estado: 'No',
      });
      incluidos.add(p.idArrePdp);
    }

    if (cands.length === 0) return [];

    // Enriquecer nave/parque/arrendatario de todos los candidatos.
    const [{ data: naves }, { data: parques }, { data: invs }] = await Promise.all([
      this.supabase.admin
        .from('naves')
        .select('idNave, numNaveNAME, numNave')
        .in('idNave', orEmpty(cands.map((c) => c.idNave))),
      this.supabase.admin
        .from('parques')
        .select('idParque, nomParque, esTicket')
        .in('idParque', orEmpty(cands.map((c) => c.idParque))),
      this.supabase.admin
        .from('inversionista')
        .select('idInversionista, nombre, apellido1, apellido2, razonsocial, pruebas')
        .in('idInversionista', orEmpty(cands.map((c) => c.idArrendador))),
    ]);

    const navePorId = new Map((naves ?? []).map((n) => [n.idNave, n]));
    const parquePorId = new Map((parques ?? []).map((p) => [p.idParque, p]));
    const invPorId = new Map((invs ?? []).map((i) => [i.idInversionista, i]));

    const filas: VencimientoReporteRow[] = [];
    for (const c of cands) {
      const parque = c.idParque ? parquePorId.get(c.idParque) : undefined;
      if (parque?.esTicket === true) continue; // Tickets se gestionan en Ventas.
      const nave = c.idNave ? navePorId.get(c.idNave) : undefined;
      const inv = c.idArrendador ? invPorId.get(c.idArrendador) : undefined;
      if (inv?.pruebas === true) continue; // excluir datos de prueba (mismo criterio que la RPC)
      filas.push({
        idArrePdp: c.plan.idArrePdp,
        idNavArrend: c.idNavArrend,
        arrendatario: inv ? this.nombre(inv) : '—',
        parque: parque?.nomParque ?? null,
        nave: nave?.numNaveNAME ?? (nave?.numNave != null ? String(nave.numNave) : null),
        fecInicio: c.plan.fecInicio,
        fecFin: c.plan.fecFin,
        estado: c.estado,
        rentaBase: Number(c.plan.rtaBase) || 0,
        moneda: c.plan.Moneda,
      });
    }

    // Orden por urgencia (Vencido → 1 → 2 → 3 meses) y, dentro, por fecha de fin.
    const ORDEN: Record<string, number> = { No: 0, '1 Mes': 1, '2 Meses': 2, '3 Meses': 3 };
    filas.sort(
      (a, b) =>
        (ORDEN[a.estado] ?? 9) - (ORDEN[b.estado] ?? 9) ||
        (a.fecFin ?? '').localeCompare(b.fecFin ?? ''),
    );
    return filas;
  }
}
