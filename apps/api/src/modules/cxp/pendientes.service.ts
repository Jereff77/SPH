import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { firmarDocumentos } from './documentos.util.js';

export interface FiltrosPendientes {
  /** Multi-selección de años. Array vacío/undefined = sin filtro. */
  anio?: number[];
  /** Multi-selección de meses (1-12). Array vacío/undefined = sin filtro. */
  mes?: number[];
  /** Multi-selección de estados. Array vacío/undefined = sin filtro. */
  idEstado?: number[];
  /** Semana única (no es multi). */
  numSem?: number;
  /** Multi-selección de gerentes (uid). Array vacío/undefined = sin filtro. */
  uidGerente?: string[];
}

/**
 * CxP > Solicitudes pendientes (dashboard de gestión, clave 450). Muestra TODAS
 * las solicitudes (no solo las del usuario) con filtros; permite cambiar el
 * responsable/aprobador por registro y devolver una solicitud a "Guardado".
 */
@Injectable()
export class PendientesService {
  private readonly logger = new Logger(PendientesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private readonly BUCKET_CFDI = 'CFDIproveedores';

  private readonly COLS =
    'idCxp, uidr, estado, nombreProveedor, nomCFDI, fecCFDI, fecSolicitud, folio, concepto, subtotal, total, montoAplicado, urlXLM, urlCFDI, numSem, numMes, numAnio, rangoSemana, idEstado, idCategoria, uidGerente, idMovBancarios, moneda';

  /** Años con solicitudes (para el filtro). */
  async anios(): Promise<number[]> {
    const { data, error } = await this.supabase.admin
      .from('cxp')
      .select('numAnio')
      .eq('status', true)
      .not('numAnio', 'is', null);
    if (error) throw new InternalServerErrorException(error.message);
    return [
      ...new Set((data ?? []).map((r) => r.numAnio).filter((a): a is number => a != null)),
    ].sort((a, b) => b - a);
  }

  /** Usuarios activos (posibles responsables/aprobadores). */
  async responsables(): Promise<{ uid: string; nombre: string }[]> {
    const { data, error } = await this.supabase.admin
      .from('catUsers')
      .select('uid, nomCompleto, nombre, apellidos')
      .eq('status', true);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? [])
      .map((u) => ({
        uid: u.uid,
        nombre:
          u.apellidos && u.nombre
            ? `${u.apellidos}, ${u.nombre}`
            : (u.nomCompleto ?? u.nombre ?? u.uid),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  async listar(f: FiltrosPendientes) {
    let q = this.supabase.admin
      .from('cxp')
      .select(this.COLS)
      .eq('status', true);
    // Arrays: usar .in() cuando hay valores; si el array está vacío/undefined, no filtrar.
    if (f.anio?.length) q = q.in('numAnio', f.anio);
    if (f.mes?.length) q = q.in('numMes', f.mes);
    if (f.idEstado?.length) q = q.in('idEstado', f.idEstado);
    if (f.uidGerente?.length) q = q.in('uidGerente', f.uidGerente);
    // numSem sigue siendo único.
    if (f.numSem) q = q.eq('numSem', f.numSem);
    q = q.order('fecSolicitud', { ascending: false, nullsFirst: false });

    const { data, error } = await q;
    if (error) throw new InternalServerErrorException(error.message);
    const filas = data ?? [];

    const cuentas = await this.resolverCuentas(filas.map((r) => r.idCategoria));
    const nombres = await this.resolverUsuarios([
      ...filas.map((r) => r.uidGerente),
      ...filas.map((r) => r.uidr),
    ]);
    const conResp = await this.resolverRespuestaGerente(
      filas.map((r) => ({ idCxp: r.idCxp, uidr: r.uidr })),
    );

    const resultado = filas.map((r) => ({
      ...r,
      cuenta: cuentas.get(r.idCategoria)?.cuenta ?? null,
      seccion: cuentas.get(r.idCategoria)?.seccion ?? null,
      nomGerente: r.uidGerente ? (nombres.get(r.uidGerente) ?? null) : null,
      nomSolicitante: r.uidr ? (nombres.get(r.uidr) ?? null) : null,
      tieneRespuestaGerente: conResp.has(r.idCxp),
    }));

    const firmadas = await firmarDocumentos(
      this.supabase.admin,
      resultado.flatMap((r) => [r.urlCFDI, r.urlXLM]),
      this.BUCKET_CFDI,
    );
    for (const r of resultado) {
      r.urlCFDI = r.urlCFDI ? (firmadas.get(r.urlCFDI) ?? null) : null;
      r.urlXLM = r.urlXLM ? (firmadas.get(r.urlXLM) ?? null) : null;
    }

    return resultado;
  }

  private async resolverCuentas(ids: (string | null)[]) {
    const unicos = [...new Set(ids.filter((x): x is string => !!x))];
    const mapa = new Map<string, { cuenta: string | null; seccion: string | null }>();
    if (unicos.length === 0) return mapa;
    const { data } = await this.supabase.admin
      .from('PresCategorias')
      .select('idCategoria, cuenta, seccion')
      .in('idCategoria', unicos);
    for (const c of data ?? []) mapa.set(c.idCategoria, { cuenta: c.cuenta, seccion: c.seccion });
    return mapa;
  }

  /**
   * Conjunto de solicitudes que tienen al menos un comentario de alguien distinto
   * al solicitante de esa misma solicitud (= respuesta del aprobador: rechazo,
   * regreso o nota al aprobar). Sirve para resaltar el icono 💬 del listado.
   */
  private async resolverRespuestaGerente(
    filas: { idCxp: string; uidr: string | null }[],
  ): Promise<Set<string>> {
    const ids = [...new Set(filas.map((f) => f.idCxp))];
    const solicitante = new Map(filas.map((f) => [f.idCxp, f.uidr]));
    const conResp = new Set<string>();
    if (ids.length === 0) return conResp;
    const { data } = await this.supabase.admin
      .from('cxpComentarios')
      .select('idCxP, uidr')
      .eq('status', true)
      .in('idCxP', ids);
    for (const c of data ?? []) {
      if (c.idCxP && c.uidr && c.uidr !== solicitante.get(c.idCxP))
        conResp.add(c.idCxP);
    }
    return conResp;
  }

  /**
   * Hilo de comentarios de una solicitud (icono 💬). Vista de gestión (clave 450):
   * NO valida pertenencia porque el gestor ve las solicitudes de todos. Marca
   * `esSolicitante` para que el front distinga los mensajes del aprobador.
   */
  async comentarios(idCxp: string) {
    const { data: sol, error: errSol } = await this.supabase.admin
      .from('cxp')
      .select('idCxp, uidr')
      .eq('idCxp', idCxp)
      .maybeSingle();
    if (errSol) throw new InternalServerErrorException(errSol.message);
    if (!sol) throw new NotFoundException('Solicitud no encontrada.');

    const { data, error } = await this.supabase.admin
      .from('cxpComentarios')
      .select('idCxpComentarios, comentario, fc, uidr')
      .eq('idCxP', idCxp)
      .eq('status', true)
      .order('fc', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    const filas = data ?? [];
    const nombres = await this.resolverUsuarios(filas.map((c) => c.uidr));
    return filas.map((c) => ({
      idCxpComentarios: c.idCxpComentarios,
      comentario: c.comentario,
      fc: c.fc,
      autor: c.uidr ? (nombres.get(c.uidr) ?? null) : null,
      esSolicitante: c.uidr === sol.uidr,
    }));
  }

  private async resolverUsuarios(uids: (string | null)[]) {
    const unicos = [...new Set(uids.filter((x): x is string => !!x))];
    const mapa = new Map<string, string>();
    if (unicos.length === 0) return mapa;
    const { data } = await this.supabase.admin
      .from('catUsers')
      .select('uid, nomCompleto, nombre, apellidos')
      .in('uid', unicos);
    for (const u of data ?? []) {
      mapa.set(
        u.uid,
        u.apellidos && u.nombre
          ? `${u.apellidos}, ${u.nombre}`
          : (u.nomCompleto ?? u.nombre ?? u.uid),
      );
    }
    return mapa;
  }

  /** Cambia el responsable/aprobador SOLO de esa solicitud (uidGerente + nomGerente). */
  async cambiarResponsable(
    idCxp: string,
    uidGerente: string,
    actorUid: string,
  ): Promise<void> {
    const { data: gerente } = await this.supabase.admin
      .from('catUsers')
      .select('uid, nomCompleto, nombre, apellidos')
      .eq('uid', uidGerente)
      .maybeSingle();
    if (!gerente) throw new BadRequestException('Responsable no válido.');
    const nomGerente =
      gerente.apellidos && gerente.nombre
        ? `${gerente.apellidos}, ${gerente.nombre}`
        : (gerente.nomCompleto ?? gerente.nombre ?? null);

    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('cxp')
      .update({ uidGerente, nomGerente })
      .eq('idCxp', idCxp);
    if (error) {
      this.logger.error(`Error cambiando responsable ${idCxp}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo cambiar el responsable.');
    }
  }

  /** Devuelve la solicitud a "Guardado" (idEstado=1). Solo desde estados 2–4. */
  async devolver(idCxp: string, actorUid: string): Promise<void> {
    const { data, error: errLeer } = await this.supabase.admin
      .from('cxp')
      .select('idCxp, idEstado')
      .eq('idCxp', idCxp)
      .maybeSingle();
    if (errLeer) throw new InternalServerErrorException(errLeer.message);
    if (!data) throw new NotFoundException('Solicitud no encontrada.');
    const e = data.idEstado ?? 0;
    if (!(e > 1 && e <= 4))
      throw new BadRequestException(
        'Solo se pueden devolver solicitudes enviadas, rechazadas o aprobadas.',
      );

    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('cxp')
      .update({ idEstado: 1 })
      .eq('idCxp', idCxp);
    if (error) {
      this.logger.error(`Error devolviendo ${idCxp}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo devolver la solicitud.');
    }
  }
}
