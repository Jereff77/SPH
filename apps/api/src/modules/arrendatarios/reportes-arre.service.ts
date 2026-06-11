import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';

/** Filtros del reporte de cancelaciones anticipadas (todos opcionales). */
export interface FiltrosCancelaciones {
  anio?: number;
  parque?: string;
  busqueda?: string;
}

/** Fila del reporte Estado de Cuenta (agrupada por nave + cliente + divisa). */
export interface EstadoCuentaRow {
  nave: string;
  parque: string;
  razonSocial: string;
  divisa: string;
  pendiente: number;
  cobrado: number;
  renta: number;
  vig: number;
  admin: number;
  mtto: number;
  otros: number;
  nota: string;
}

/** Fila cruda de la RPC `pagos_arrendatarios`. */
interface PagoRow {
  nave: string | null;
  parque: string | null;
  razon_social: string | null;
  concepto: string | null;
  monto: number | null;
  divisa: string | null;
  fec_pago: string | null;
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

  /** Nombres de los parques de Tickets (esTicket=true), para excluirlos. */
  private async nombresParquesTicket(): Promise<Set<string>> {
    const { data } = await this.supabase.admin
      .from('parques')
      .select('nomParque')
      .eq('esTicket', true);
    return new Set((data ?? []).map((p) => p.nomParque).filter((x): x is string => !!x));
  }

  /**
   * Estado de cuenta acumulado (planes activos), agrupado por **nave + cliente +
   * divisa**, con el desglose por concepto (Renta/Vig/Admin/Mtto/Otros + Nota) y
   * los totales Pendiente/Cobrado — el mismo formato que el export del Dashboard de
   * cobranza. Reutiliza la RPC `pagos_arrendatarios` (solo `pdpActivo=true`) y
   * excluye los parques de Tickets. El filtrado fino (nave/cliente/divisa) se hace
   * en el frontend; aquí se acota opcionalmente por parque.
   */
  async estadoCuenta(f: { parque?: string }): Promise<EstadoCuentaRow[]> {
    const [{ data, error }, ticket] = await Promise.all([
      // Cast localizado: `pagos_arrendatarios` tiene sobrecargas; se pasan los 5
      // parámetros nombrados (con nulls) para resolver a la versión vigente.
      (
        this.supabase.admin.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: PagoRow[] | null; error: { message: string } | null }>
      )('pagos_arrendatarios', {
        p_anio: null,
        p_mes: null,
        p_parque: f.parque ?? null,
        p_arrendatario: null,
        p_solo_pendientes: false,
      }),
      this.nombresParquesTicket(),
    ]);
    if (error) throw new InternalServerErrorException(error.message);

    const filas = (data ?? []).filter((r) => !r.parque || !ticket.has(r.parque));

    interface Acc {
      nave: string;
      parque: string;
      razonSocial: string;
      divisa: string;
      pendiente: number;
      cobrado: number;
      renta: number;
      vig: number;
      admin: number;
      mtto: number;
      otros: number;
      detalle: Map<string, number>;
    }
    const map = new Map<string, Acc>();
    for (const r of filas) {
      const divisa = r.divisa === 'USD' ? 'USD' : 'MXN';
      const key = `${r.nave}||${r.parque}||${r.razon_social}||${divisa}`;
      let a = map.get(key);
      if (!a) {
        a = {
          nave: r.nave ?? '—',
          parque: r.parque ?? '—',
          razonSocial: r.razon_social ?? '—',
          divisa,
          pendiente: 0,
          cobrado: 0,
          renta: 0,
          vig: 0,
          admin: 0,
          mtto: 0,
          otros: 0,
          detalle: new Map(),
        };
        map.set(key, a);
      }
      const m = Number(r.monto) || 0;
      if (r.fec_pago) a.cobrado += m;
      else a.pendiente += m;
      const n = normConcepto(r.concepto ?? '');
      if (n === 'renta') a.renta += m;
      else if (n === 'vigilancia') a.vig += m;
      else if (n === 'administracion') a.admin += m;
      else if (n === 'mantenimiento') a.mtto += m;
      else {
        a.otros += m;
        const nom = r.concepto ?? 'Otro';
        a.detalle.set(nom, (a.detalle.get(nom) ?? 0) + m);
      }
    }

    return [...map.values()]
      .map((a) => ({
        nave: a.nave,
        parque: a.parque,
        razonSocial: a.razonSocial,
        divisa: a.divisa,
        pendiente: a.pendiente,
        cobrado: a.cobrado,
        renta: a.renta,
        vig: a.vig,
        admin: a.admin,
        mtto: a.mtto,
        otros: a.otros,
        nota: [...a.detalle.entries()].map(([nom, mo]) => `${montoTxt(mo)} ${nom}`).join(', '),
      }))
      .sort(
        (x, y) =>
          x.parque.localeCompare(y.parque, 'es') ||
          x.nave.localeCompare(y.nave, 'es') ||
          x.razonSocial.localeCompare(y.razonSocial, 'es'),
      );
  }
}
