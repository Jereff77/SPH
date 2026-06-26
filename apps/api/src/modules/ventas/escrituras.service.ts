import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';

const fmt = (n: number | null | undefined) => (n ?? 0).toFixed(2);

type Db = ReturnType<SupabaseService['comoActor']>;

/** Fila de la pantalla Escrituras (parcialidad con tipoPago='Escrituracion'). */
export interface EscrituraRow {
  idPdpDet: string;
  idPropiedad: string | null;
  idNave: string | null;
  idInversionista: string | null;
  tipoPago: string | null;
  /** Nave a mostrar: "{nomParque} - {numNaveNAME}" (como el nomDescriptivo de v1). */
  nave: string | null;
  /** Parque (nomParque) — para filtrar por parque de forma independiente. */
  parque: string | null;
  /** Número de nave (numNaveNAME) — para filtrar por nave de forma independiente. */
  numNave: string | null;
  numPago: number | null;
  /** Razón social del inversionista (con respaldo a nombre+apellido). */
  inversionista: string | null;
  fecha: string | null;
  monto: number | null;
  /** Estatus manual: `true` = Escriturada, `false` = Pendiente. */
  escriturada: boolean;
  /** Fecha real de escrituración (independiente de la fecha programada). */
  fechaEscrituracion: string | null;
}

/**
 * Ventas > Escrituras (clave 630). Réplica de la pantalla "Fechas de
 * escrituración" de v1: lista las parcialidades cuyo `tipoPago='Escrituracion'`
 * y permite editar su **fecha** y **monto** (`pdpDetalle`). Cálculos sin vistas
 * (desde tablas base) y **excluyendo el parque de Tickets** (regla del módulo).
 * Todas las escrituras se auditan con `comoActor(uid)` + bitácora `actividad`.
 */
@Injectable()
export class EscriturasService {
  private readonly logger = new Logger(EscriturasService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async listar(): Promise<{
    filas: EscrituraRow[];
    total: number;
    escrituradas: number;
    pendientes: number;
  }> {
    const { data, error } = await this.supabase.admin
      .from('pdpDetalle')
      .select(
        'idPdpDet, idPdp, idPropiedad, idNave, idInversionista, numPago, fecha, monto, tipoPago, escriturada, fechaEscrituracion',
      )
      .eq('tipoPago', 'Escrituracion')
      .eq('status', true);
    if (error) throw new InternalServerErrorException(error.message);
    const det = data ?? [];
    if (det.length === 0) return { filas: [], total: 0, escrituradas: 0, pendientes: 0 };

    // Nave → numNaveNAME + parque.
    const idsNave = [...new Set(det.map((d) => d.idNave).filter((x): x is string => !!x))];
    const navesMap = new Map<string, { numNaveNAME: string | null; idParque: string | null }>();
    if (idsNave.length > 0) {
      const { data: naves } = await this.supabase.admin
        .from('naves')
        .select('idNave, numNaveNAME, idParque')
        .in('idNave', idsNave);
      for (const n of naves ?? [])
        navesMap.set(n.idNave, { numNaveNAME: n.numNaveNAME, idParque: n.idParque });
    }
    const idsParque = [
      ...new Set([...navesMap.values()].map((n) => n.idParque).filter((x): x is string => !!x)),
    ];
    const parquesMap = new Map<string, string | null>();
    if (idsParque.length > 0) {
      const { data: pq } = await this.supabase.admin
        .from('parques')
        .select('idParque, nomParque')
        .in('idParque', idsParque);
      for (const p of pq ?? []) parquesMap.set(p.idParque, p.nomParque);
    }

    // Propiedad → esTicket (excluir Tickets) + idInversionista (respaldo).
    const idsProp = [...new Set(det.map((d) => d.idPropiedad).filter((x): x is string => !!x))];
    const propMap = new Map<string, { esTicket: boolean | null; idInversionista: string | null }>();
    if (idsProp.length > 0) {
      const { data: props } = await this.supabase.admin
        .from('propiedades')
        .select('idPropiedad, esTicket, idInversionista')
        .in('idPropiedad', idsProp);
      for (const p of props ?? [])
        propMap.set(p.idPropiedad, { esTicket: p.esTicket, idInversionista: p.idInversionista });
    }

    // Inversionista → razón social.
    const idsInv = [
      ...new Set(
        det
          .map(
            (d) =>
              d.idInversionista ??
              (d.idPropiedad ? (propMap.get(d.idPropiedad)?.idInversionista ?? null) : null),
          )
          .filter((x): x is string => !!x),
      ),
    ];
    const invMap = new Map<string, string | null>();
    if (idsInv.length > 0) {
      const { data: invs } = await this.supabase.admin
        .from('inversionista')
        .select('idInversionista, razonsocial, nombre, apellido1')
        .in('idInversionista', idsInv);
      for (const i of invs ?? [])
        invMap.set(
          i.idInversionista,
          (i.razonsocial?.trim()
            ? i.razonsocial
            : [i.nombre, i.apellido1].filter(Boolean).join(' ')) || null,
        );
    }

    const filas: EscrituraRow[] = [];
    for (const d of det) {
      const prop = d.idPropiedad ? propMap.get(d.idPropiedad) : undefined;
      if (prop?.esTicket === true) continue; // El parque de Tickets no es venta.
      const nv = d.idNave ? navesMap.get(d.idNave) : undefined;
      const nomParque = nv?.idParque ? (parquesMap.get(nv.idParque) ?? null) : null;
      const numNave = nv?.numNaveNAME ?? null;
      const nave = [nomParque, numNave].filter(Boolean).join(' - ') || null;
      const idInv = d.idInversionista ?? prop?.idInversionista ?? null;
      filas.push({
        idPdpDet: d.idPdpDet,
        idPropiedad: d.idPropiedad,
        idNave: d.idNave,
        idInversionista: idInv,
        tipoPago: d.tipoPago,
        nave,
        parque: nomParque,
        numNave,
        numPago: d.numPago,
        inversionista: idInv ? (invMap.get(idInv) ?? null) : null,
        fecha: d.fecha,
        monto: d.monto,
        escriturada: d.escriturada ?? false,
        fechaEscrituracion: d.fechaEscrituracion,
      });
    }

    // Orden por nave → inversionista → fecha (como v1).
    filas.sort((a, b) => {
      const n = (a.nave ?? '').localeCompare(b.nave ?? '', 'es', { numeric: true });
      if (n !== 0) return n;
      const inv = (a.inversionista ?? '').localeCompare(b.inversionista ?? '', 'es');
      if (inv !== 0) return inv;
      return (a.fecha ?? '').localeCompare(b.fecha ?? '');
    });

    const total = filas.reduce((s, f) => s + (f.monto ?? 0), 0);
    const escrituradas = filas.filter((f) => f.escriturada).length;
    const pendientes = filas.length - escrituradas;
    return { filas, total, escrituradas, pendientes };
  }

  /** Actualiza la fecha de la parcialidad de escrituración. */
  async actualizarFecha(idPdpDet: string, fecha: string, actorUid: string): Promise<{ ok: true }> {
    const det = await this.cargar(idPdpDet);
    const db = this.supabase.comoActor(actorUid);
    const { error } = await db.from('pdpDetalle').update({ fecha }).eq('idPdpDet', idPdpDet);
    if (error) {
      this.logger.error(`Error actualizando fecha ${idPdpDet}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo actualizar la fecha.');
    }
    await this.registrarActividad(db, {
      pantalla: 'Escrituras',
      widget: 'input',
      nomwidget: 'Modificar Fecha',
      comentario: `Se actualiza fecha de ${det.fecha ?? '-'} a ${fecha} | idPdpDet${idPdpDet}`,
      actorUid,
    });
    return { ok: true };
  }

  /** Actualiza el monto de la parcialidad de escrituración. */
  async actualizarMonto(idPdpDet: string, monto: number, actorUid: string): Promise<{ ok: true }> {
    const det = await this.cargar(idPdpDet);
    const db = this.supabase.comoActor(actorUid);
    const { error } = await db.from('pdpDetalle').update({ monto }).eq('idPdpDet', idPdpDet);
    if (error) {
      this.logger.error(`Error actualizando monto ${idPdpDet}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo actualizar el monto.');
    }
    await this.registrarActividad(db, {
      pantalla: 'Escrituras',
      widget: 'input',
      nomwidget: 'Modificar Monto',
      comentario: `Se actualiza monto de ${fmt(det.monto)} a ${fmt(monto)} | idPdpDet${idPdpDet}`,
      actorUid,
    });
    return { ok: true };
  }

  /** Cambia el estatus manual de escrituración (Escriturada / Pendiente). */
  async actualizarEstatus(
    idPdpDet: string,
    escriturada: boolean,
    actorUid: string,
  ): Promise<{ ok: true }> {
    const det = await this.cargar(idPdpDet);
    const db = this.supabase.comoActor(actorUid);
    const { error } = await db.from('pdpDetalle').update({ escriturada }).eq('idPdpDet', idPdpDet);
    if (error) {
      this.logger.error(`Error actualizando estatus ${idPdpDet}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo actualizar el estatus.');
    }
    await this.registrarActividad(db, {
      pantalla: 'Escrituras',
      widget: 'switch',
      nomwidget: 'Estatus de escrituración',
      comentario: `Estatus de escrituración: ${det.escriturada ? 'Escriturada' : 'Pendiente'} → ${
        escriturada ? 'Escriturada' : 'Pendiente'
      } | idPdpDet${idPdpDet}`,
      actorUid,
    });
    return { ok: true };
  }

  /** Actualiza la fecha real de escrituración (`null` la limpia). */
  async actualizarFechaEscrituracion(
    idPdpDet: string,
    fecha: string | null,
    actorUid: string,
  ): Promise<{ ok: true }> {
    const det = await this.cargar(idPdpDet);
    const db = this.supabase.comoActor(actorUid);
    const { error } = await db
      .from('pdpDetalle')
      .update({ fechaEscrituracion: fecha })
      .eq('idPdpDet', idPdpDet);
    if (error) {
      this.logger.error(`Error actualizando fecha de escrituración ${idPdpDet}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo actualizar la fecha de escrituración.');
    }
    await this.registrarActividad(db, {
      pantalla: 'Escrituras',
      widget: 'input',
      nomwidget: 'Fecha de escrituración',
      comentario: `Fecha de escrituración de ${det.fechaEscrituracion ?? '-'} a ${
        fecha ?? '-'
      } | idPdpDet${idPdpDet}`,
      actorUid,
    });
    return { ok: true };
  }

  private async cargar(idPdpDet: string) {
    const { data, error } = await this.supabase.admin
      .from('pdpDetalle')
      .select('idPdpDet, fecha, monto, tipoPago, status, escriturada, fechaEscrituracion')
      .eq('idPdpDet', idPdpDet)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data || data.status === false)
      throw new NotFoundException('Parcialidad no encontrada.');
    return data;
  }

  /** Inserta un registro en la bitácora `actividad` (entorno 3 = web/servidor). */
  private async registrarActividad(
    db: Db,
    a: { pantalla: string; widget: string; nomwidget: string; comentario: string; actorUid: string },
  ): Promise<void> {
    const { error } = await db.from('actividad').insert({
      uid: a.actorUid,
      entorno: 3,
      logeado: true,
      pantalla: a.pantalla,
      widget: a.widget,
      nomwidget: a.nomwidget,
      comentario: a.comentario,
      version: 'erp-v2',
    });
    if (error) this.logger.warn(`No se pudo registrar actividad: ${error.message}`);
  }
}
