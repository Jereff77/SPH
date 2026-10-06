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

/** Fila de la pantalla Escrituras: una por propiedad con plan de pagos (`pdp`). */
export interface EscrituraRow {
  idPdp: string;
  idPropiedad: string | null;
  idNave: string | null;
  idInversionista: string | null;
  /** Parque (nomParque) — para filtrar por parque de forma independiente. */
  parque: string | null;
  /** Número de nave (numNaveNAME) — para filtrar por nave de forma independiente. */
  numNave: string | null;
  /** Razón social del inversionista (con respaldo a nombre+apellido). */
  inversionista: string | null;
  /** Estatus manual: `true` = Escriturada, `false` = Pendiente. */
  escriturada: boolean;
  /** Fecha de escrituración (obligatoria cuando está Escriturada). */
  fechaEscrituracion: string | null;
}

/**
 * Ventas > Escrituras (clave 630). Seguimiento de la escrituración **por propiedad**:
 * una fila por plan de pagos (`pdp`) de una nave vendida, con su estatus
 * (`pdp.escriturada`) y su fecha (`pdp.fechaEscrituracion`), ambos editables aquí.
 * Cálculos sin vistas (desde tablas base) y **excluyendo el parque de Tickets**
 * (regla del módulo). Toda mutación se audita con `comoActor(uid)` + bitácora `actividad`.
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
      .from('pdp')
      .select('idPdp, idPropiedad, escriturada, fechaEscrituracion')
      .eq('status', true)
      .eq('esTicket', false);
    if (error) {
      this.logger.error(`Error listando escrituras: ${error.message}`);
      throw new InternalServerErrorException('No se pudieron cargar las escrituras.');
    }
    const planes = data ?? [];
    if (planes.length === 0) return { filas: [], total: 0, escrituradas: 0, pendientes: 0 };

    // Propiedad → nave + inversionista.
    const idsProp = [...new Set(planes.map((p) => p.idPropiedad).filter((x): x is string => !!x))];
    const propMap = new Map<string, { idNave: string | null; idInversionista: string | null }>();
    if (idsProp.length > 0) {
      const { data: props } = await this.supabase.admin
        .from('propiedades')
        .select('idPropiedad, idNave, idInversionista')
        .in('idPropiedad', idsProp);
      for (const p of props ?? [])
        propMap.set(p.idPropiedad, { idNave: p.idNave, idInversionista: p.idInversionista });
    }

    // Nave → numNaveNAME + parque.
    const idsNave = [
      ...new Set([...propMap.values()].map((p) => p.idNave).filter((x): x is string => !!x)),
    ];
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

    // Inversionista → razón social (con respaldo a nombre + apellido).
    const idsInv = [
      ...new Set([...propMap.values()].map((p) => p.idInversionista).filter((x): x is string => !!x)),
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

    const filas: EscrituraRow[] = planes.map((pl) => {
      const prop = pl.idPropiedad ? propMap.get(pl.idPropiedad) : undefined;
      const nv = prop?.idNave ? navesMap.get(prop.idNave) : undefined;
      return {
        idPdp: pl.idPdp,
        idPropiedad: pl.idPropiedad,
        idNave: prop?.idNave ?? null,
        idInversionista: prop?.idInversionista ?? null,
        parque: nv?.idParque ? (parquesMap.get(nv.idParque) ?? null) : null,
        numNave: nv?.numNaveNAME ?? null,
        inversionista: prop?.idInversionista ? (invMap.get(prop.idInversionista) ?? null) : null,
        escriturada: pl.escriturada,
        fechaEscrituracion: pl.fechaEscrituracion,
      };
    });

    // Orden por parque → nave (numérico) → inversionista.
    filas.sort(
      (a, b) =>
        (a.parque ?? '').localeCompare(b.parque ?? '', 'es') ||
        (a.numNave ?? '').localeCompare(b.numNave ?? '', 'es', { numeric: true }) ||
        (a.inversionista ?? '').localeCompare(b.inversionista ?? '', 'es'),
    );

    const escrituradas = filas.filter((f) => f.escriturada).length;
    return { filas, total: filas.length, escrituradas, pendientes: filas.length - escrituradas };
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
