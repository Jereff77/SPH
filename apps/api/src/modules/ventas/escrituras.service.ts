import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';

type Db = ReturnType<SupabaseService['comoActor']>;

const fmtFecha = (f: string | null | undefined) => f ?? '-';

/** Tamaño de página al leer tablas completas (PostgREST corta en 1000 filas por petición). */
const PAGE = 1000;
/** Máximo de ids por consulta `.in(...)`: evita URLs enormes. */
const LOTE_IN = 150;

const lotes = <T>(xs: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
};

/**
 * Fila de la pantalla Escrituras: una por plan de pagos (`pdp`) activo y una por cada
 * nave que todavía no tiene plan (`tienePlan = false`: sin estatus ni fecha que capturar).
 */
export interface EscrituraRow {
  /** Plan de pagos; `null` mientras la nave no tenga un plan activo. */
  idPdp: string | null;
  idPropiedad: string | null;
  idNave: string | null;
  idInversionista: string | null;
  /** Parque (nomParque) — para filtrar por parque de forma independiente. */
  parque: string | null;
  /** Número de nave (numNaveNAME) — para filtrar por nave de forma independiente. */
  numNave: string | null;
  /** Razón social del inversionista (con respaldo a nombre+apellido). */
  inversionista: string | null;
  /** `false` = la nave no tiene plan de pagos (se muestra «Sin plan»). */
  tienePlan: boolean;
  /** Estatus manual: `true` = Escriturada, `false` = Pendiente (siempre `false` sin plan). */
  escriturada: boolean;
  /** Fecha de escrituración (obligatoria cuando está Escriturada; `null` sin plan). */
  fechaEscrituracion: string | null;
}

/** Respuesta del listado: todas las filas y los conteos (escrituradas/pendientes solo cuentan naves con plan). */
export interface EscriturasResp {
  filas: EscrituraRow[];
  /** Todas las naves mostradas (con plan + sin plan). */
  total: number;
  conPlan: number;
  sinPlan: number;
  escrituradas: number;
  pendientes: number;
}

interface PlanDb {
  idPdp: string;
  idPropiedad: string | null;
  escriturada: boolean;
  fechaEscrituracion: string | null;
}
interface PropiedadDb {
  idPropiedad: string;
  idNave: string | null;
  idInversionista: string | null;
  status: boolean | null;
  PActual: boolean | null;
}
interface NaveDb {
  idNave: string;
  numNave: number | null;
  numNaveNAME: string | null;
  idParque: string | null;
}
interface ParqueDb {
  idParque: string;
  nomParque: string | null;
}
/** Fila intermedia antes de resolver nombres. */
type FilaBase = Pick<
  EscrituraRow,
  'idPdp' | 'idPropiedad' | 'idNave' | 'idInversionista' | 'tienePlan' | 'escriturada' | 'fechaEscrituracion'
>;

/**
 * Ventas > Escrituras (clave 630). Seguimiento de la escrituración **por nave**:
 * una fila por plan de pagos (`pdp`) de una nave vendida, con su estatus
 * (`pdp.escriturada`) y su fecha (`pdp.fechaEscrituracion`), ambos editables aquí,
 * **más una fila «Sin plan» por cada nave que aún no tiene plan** (lista completa de
 * naves; sin nada que editar: la escrituración vive dentro del plan de pagos y la
 * nave pasa sola a «Pendiente» cuando se le crea uno).
 * Cálculos sin vistas (desde tablas base) y **excluyendo el parque de Tickets**
 * (regla del módulo). Toda mutación se audita con `comoActor(uid)` + bitácora `actividad`.
 */
@Injectable()
export class EscriturasService {
  private readonly logger = new Logger(EscriturasService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async listar(): Promise<EscriturasResp> {
    const [planes, propiedades, parquesLista] = await Promise.all([
      this.leerPaginas<PlanDb>('pdp', (desde, hasta) =>
        this.supabase.admin
          .from('pdp')
          .select('idPdp, idPropiedad, escriturada, fechaEscrituracion')
          .eq('status', true)
          .eq('esTicket', false)
          .order('idPdp', { ascending: true })
          .range(desde, hasta),
      ),
      this.leerPaginas<PropiedadDb>('propiedades', (desde, hasta) =>
        this.supabase.admin
          .from('propiedades')
          .select('idPropiedad, idNave, idInversionista, status, PActual')
          .order('idPropiedad', { ascending: true })
          .range(desde, hasta),
      ),
      // Parques que NO son de Tickets (regla del módulo).
      this.leerPaginas<ParqueDb>('parques', (desde, hasta) =>
        this.supabase.admin
          .from('parques')
          .select('idParque, nomParque')
          .eq('status', true)
          .eq('esTicket', false)
          .order('idParque', { ascending: true })
          .range(desde, hasta),
      ),
    ]);

    const parquesMap = new Map<string, string | null>(
      parquesLista.map((p) => [p.idParque, p.nomParque]),
    );

    // Naves visibles: activas, que no son de Tickets y de un parque que tampoco lo es.
    const idsParque = [...parquesMap.keys()];
    const visibles: NaveDb[] =
      idsParque.length === 0
        ? []
        : await this.leerPaginas<NaveDb>('naves', (desde, hasta) =>
            this.supabase.admin
              .from('naves')
              .select('idNave, numNave, numNaveNAME, idParque')
              .eq('status', true)
              .eq('esTicket', false)
              .in('idParque', idsParque)
              .order('idNave', { ascending: true })
              .range(desde, hasta),
          );
    const navesMap = new Map<string, NaveDb>(visibles.map((n) => [n.idNave, n]));

    const propPorId = new Map<string, PropiedadDb>(propiedades.map((p) => [p.idPropiedad, p]));

    // Un plan activo SIEMPRE se muestra, aunque su nave no cumpla el filtro de «visibles»
    // (comportamiento previo de la pantalla): se completan sus naves y parques.
    const navesDePlanes = [
      ...new Set(
        planes
          .map((pl) => (pl.idPropiedad ? propPorId.get(pl.idPropiedad)?.idNave : null))
          .filter((x): x is string => !!x && !navesMap.has(x)),
      ),
    ];
    for (const grupo of lotes(navesDePlanes, LOTE_IN)) {
      const { data, error } = await this.supabase.admin
        .from('naves')
        .select('idNave, numNave, numNaveNAME, idParque')
        .in('idNave', grupo);
      if (error) this.fallo('naves de planes', error.message);
      for (const n of (data ?? []) as NaveDb[]) navesMap.set(n.idNave, n);
    }
    const parquesFaltan = [
      ...new Set(
        [...navesMap.values()]
          .map((n) => n.idParque)
          .filter((x): x is string => !!x && !parquesMap.has(x)),
      ),
    ];
    for (const grupo of lotes(parquesFaltan, LOTE_IN)) {
      const { data, error } = await this.supabase.admin
        .from('parques')
        .select('idParque, nomParque')
        .in('idParque', grupo);
      if (error) this.fallo('parques de planes', error.message);
      for (const p of (data ?? []) as ParqueDb[]) parquesMap.set(p.idParque, p.nomParque);
    }

    // Dueño vigente de cada nave (para las que aún no tienen plan): propiedad activa y actual.
    const duenoVigente = new Map<string, string>();
    for (const p of propiedades) {
      if (p.idNave && p.idInversionista && p.status === true && p.PActual === true && !duenoVigente.has(p.idNave))
        duenoVigente.set(p.idNave, p.idInversionista);
    }

    // Filas con plan (una por plan) + filas sin plan (una por nave visible sin plan).
    const bases: FilaBase[] = [];
    const navesConPlan = new Set<string>();
    for (const pl of planes) {
      const prop = pl.idPropiedad ? propPorId.get(pl.idPropiedad) : undefined;
      if (prop?.idNave) navesConPlan.add(prop.idNave);
      bases.push({
        idPdp: pl.idPdp,
        idPropiedad: pl.idPropiedad,
        idNave: prop?.idNave ?? null,
        idInversionista: prop?.idInversionista ?? null,
        tienePlan: true,
        escriturada: pl.escriturada,
        fechaEscrituracion: pl.fechaEscrituracion,
      });
    }
    for (const nv of visibles) {
      if (navesConPlan.has(nv.idNave)) continue;
      bases.push({
        idPdp: null,
        idPropiedad: null,
        idNave: nv.idNave,
        idInversionista: duenoVigente.get(nv.idNave) ?? null,
        tienePlan: false,
        escriturada: false,
        fechaEscrituracion: null,
      });
    }

    // Inversionista → razón social (con respaldo a nombre + apellido).
    const idsInv = [...new Set(bases.map((b) => b.idInversionista).filter((x): x is string => !!x))];
    const invMap = new Map<string, string | null>();
    for (const grupo of lotes(idsInv, LOTE_IN)) {
      const { data: invs, error } = await this.supabase.admin
        .from('inversionista')
        .select('idInversionista, razonsocial, nombre, apellido1')
        .in('idInversionista', grupo);
      if (error) this.fallo('inversionistas', error.message);
      for (const i of invs ?? [])
        invMap.set(
          i.idInversionista,
          (i.razonsocial?.trim()
            ? i.razonsocial
            : [i.nombre, i.apellido1].filter(Boolean).join(' ')) || null,
        );
    }

    const filas: EscrituraRow[] = bases.map((b) => {
      const nv = b.idNave ? navesMap.get(b.idNave) : undefined;
      return {
        ...b,
        parque: nv?.idParque ? (parquesMap.get(nv.idParque) ?? null) : null,
        numNave: nv?.numNaveNAME ?? (nv?.numNave != null ? String(nv.numNave) : null),
        inversionista: b.idInversionista ? (invMap.get(b.idInversionista) ?? null) : null,
      };
    });

    // Orden por parque → nave (numérico) → inversionista.
    filas.sort(
      (a, b) =>
        (a.parque ?? '').localeCompare(b.parque ?? '', 'es') ||
        (a.numNave ?? '').localeCompare(b.numNave ?? '', 'es', { numeric: true }) ||
        (a.inversionista ?? '').localeCompare(b.inversionista ?? '', 'es'),
    );

    const conPlan = filas.filter((f) => f.tienePlan).length;
    const escrituradas = filas.filter((f) => f.tienePlan && f.escriturada).length;
    return {
      filas,
      total: filas.length,
      conPlan,
      sinPlan: filas.length - conPlan,
      escrituradas,
      pendientes: conPlan - escrituradas,
    };
  }

  /** Lee una consulta completa por páginas de 1000 (hay que ordenar por una clave estable). */
  private async leerPaginas<T>(
    etiqueta: string,
    pagina: (
      desde: number,
      hasta: number,
    ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  ): Promise<T[]> {
    const filas: T[] = [];
    for (let desde = 0; ; desde += PAGE) {
      const { data, error } = await pagina(desde, desde + PAGE - 1);
      if (error) this.fallo(etiqueta, error.message);
      filas.push(...((data ?? []) as T[]));
      if (!data || data.length < PAGE) break;
    }
    return filas;
  }

  private fallo(etiqueta: string, mensaje: string): never {
    this.logger.error(`Error listando escrituras (${etiqueta}): ${mensaje}`);
    throw new InternalServerErrorException('No se pudieron cargar las escrituras.');
  }

  /**
   * Reprograma la fecha de una parcialidad de escrituración (`pdpDetalle.fecha`).
   * Lo consume Fideicomiso (partidas); no forma parte de la pantalla Escrituras.
   */
  async actualizarFecha(idPdpDet: string, fecha: string, actorUid: string): Promise<{ ok: true }> {
    const { data: det, error: errCarga } = await this.supabase.admin
      .from('pdpDetalle')
      .select('idPdpDet, fecha, status')
      .eq('idPdpDet', idPdpDet)
      .maybeSingle();
    if (errCarga) {
      this.logger.error(`Error cargando parcialidad ${idPdpDet}: ${errCarga.message}`);
      throw new InternalServerErrorException('No se pudo cargar la parcialidad.');
    }
    if (!det || det.status === false) throw new NotFoundException('Parcialidad no encontrada.');
    const db = this.supabase.comoActor(actorUid);
    const { error } = await db.from('pdpDetalle').update({ fecha }).eq('idPdpDet', idPdpDet);
    if (error) {
      this.logger.error(`Error actualizando fecha ${idPdpDet}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo actualizar la fecha.');
    }
    await this.registrarActividad(db, {
      widget: 'input',
      nomwidget: 'Modificar Fecha',
      comentario: `Se actualiza fecha de ${fmtFecha(det.fecha)} a ${fecha} | idPdpDet${idPdpDet}`,
      actorUid,
    });
    return { ok: true };
  }

  /**
   * Cambia el estatus (Escriturada / Pendiente). Para marcar Escriturada hace falta
   * una fecha: la que llega en `fecha` o, si no, la que ya tiene el plan.
   */
  async actualizarEstatus(
    idPdp: string,
    escriturada: boolean,
    fecha: string | null | undefined,
    actorUid: string,
  ): Promise<{ ok: true }> {
    const plan = await this.cargar(idPdp);
    const fechaFinal = fecha ?? plan.fechaEscrituracion;
    if (escriturada && !fechaFinal) {
      throw new BadRequestException('Captura la fecha de escrituración para marcarla como Escriturada.');
    }
    const cambios: { escriturada: boolean; fechaEscrituracion?: string } = { escriturada };
    if (fecha) cambios.fechaEscrituracion = fecha;

    const db = this.supabase.comoActor(actorUid);
    const { error } = await db.from('pdp').update(cambios).eq('idPdp', idPdp);
    if (error) {
      this.logger.error(`Error actualizando estatus ${idPdp}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo actualizar el estatus.');
    }
    await this.registrarActividad(db, {
      widget: 'switch',
      nomwidget: 'Estatus de escrituración',
      comentario: `Estatus de escrituración: ${plan.escriturada ? 'Escriturada' : 'Pendiente'} → ${
        escriturada ? 'Escriturada' : 'Pendiente'
      }${fecha ? ` (fecha ${fecha})` : ''} | idPdp${idPdp}`,
      actorUid,
    });
    return { ok: true };
  }

  /** Actualiza la fecha de escrituración (`null` la limpia; no se puede limpiar si está Escriturada). */
  async actualizarFechaEscrituracion(
    idPdp: string,
    fecha: string | null,
    actorUid: string,
  ): Promise<{ ok: true }> {
    const plan = await this.cargar(idPdp);
    if (!fecha && plan.escriturada) {
      throw new BadRequestException(
        'Una escrituración marcada como Escriturada necesita fecha. Cámbiala a Pendiente primero.',
      );
    }
    const db = this.supabase.comoActor(actorUid);
    const { error } = await db.from('pdp').update({ fechaEscrituracion: fecha }).eq('idPdp', idPdp);
    if (error) {
      this.logger.error(`Error actualizando fecha de escrituración ${idPdp}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo actualizar la fecha de escrituración.');
    }
    await this.registrarActividad(db, {
      widget: 'input',
      nomwidget: 'Fecha de escrituración',
      comentario: `Fecha de escrituración de ${plan.fechaEscrituracion ?? '-'} a ${
        fecha ?? '-'
      } | idPdp${idPdp}`,
      actorUid,
    });
    return { ok: true };
  }

  private async cargar(idPdp: string) {
    const { data, error } = await this.supabase.admin
      .from('pdp')
      .select('idPdp, status, esTicket, escriturada, fechaEscrituracion')
      .eq('idPdp', idPdp)
      .maybeSingle();
    if (error) {
      this.logger.error(`Error cargando plan ${idPdp}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo cargar el plan de pagos.');
    }
    if (!data || data.status === false || data.esTicket) {
      throw new NotFoundException('Escrituración no encontrada.');
    }
    return data;
  }

  /** Inserta un registro en la bitácora `actividad` (entorno 3 = web/servidor). */
  private async registrarActividad(
    db: Db,
    a: { widget: string; nomwidget: string; comentario: string; actorUid: string },
  ): Promise<void> {
    const { error } = await db.from('actividad').insert({
      uid: a.actorUid,
      entorno: 3,
      logeado: true,
      pantalla: 'Escrituras',
      widget: a.widget,
      nomwidget: a.nomwidget,
      comentario: a.comentario,
      version: 'erp-v2',
    });
    if (error) this.logger.warn(`No se pudo registrar actividad: ${error.message}`);
  }
}
