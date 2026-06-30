import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type { AtenderTicketDto } from './soporte.schemas.js';

/** Datos de una sesión de chat para el listado de auditoría. */
export interface SesionAdmin {
  uuid: string;
  uidUsuario: string;
  usuario: string;
  correo: string | null;
  titulo: string | null;
  fc: string;
  activa: boolean;
  mensajes: number;
  ultimaActividad: string | null;
  tieneEscalacion: boolean;
}

/** Un par pregunta/respuesta dentro de una conversación. */
export interface MensajeAdmin {
  uuid: string;
  pregunta: string;
  respuesta: string;
  escalable: boolean;
  modulos: string[];
  ruta: string | null;
  tokensEntrada: number | null;
  tokensSalida: number | null;
  fc: string;
  /** Razonamiento del agente (auditoría): SQL generado y traza de herramientas. */
  debugSql: string | null;
  debugMeta: unknown;
}

/** Conversación completa (cabecera + mensajes) para revisión. */
export interface ConversacionAdmin {
  sesion: {
    uuid: string;
    uidUsuario: string;
    usuario: string;
    correo: string | null;
    titulo: string | null;
    fc: string;
    activa: boolean;
  };
  mensajes: MensajeAdmin[];
}

/** Un ticket de soporte enriquecido para la bandeja de atención. */
export interface TicketAdmin {
  uuid: string;
  uidUsuario: string;
  usuario: string;
  correo: string | null;
  sessionId: string | null;
  modulo: string | null;
  ruta: string | null;
  asunto: string;
  resumen: string;
  estado: 'abierto' | 'en_proceso' | 'cerrado';
  fc: string;
  fum: string | null;
  atendidoPor: string | null;
  atendidoPorNombre: string | null;
}

/** Una solicitud incluida en un correo de recordatorio (detalle). */
export interface SolicitudRecordatorio {
  idCxp: string;
  proveedor: string;
  total: number;
  moneda: string;
  folio: string;
}

/** Renglón del listado de recordatorios de aprobación enviados (sin el HTML). */
export interface RecordatorioEnviado {
  id: number;
  enviadoEn: string;
  uidAprobador: string;
  email: string;
  nombre: string | null;
  numPendientes: number;
  estado: 'enviado' | 'fallido';
}

/** Detalle de un recordatorio (incluye el HTML enviado y las solicitudes). */
export interface RecordatorioEnviadoDetalle extends RecordatorioEnviado {
  asunto: string;
  html: string;
  solicitudes: SolicitudRecordatorio[];
  error: string | null;
}

/**
 * Administración / auditoría del Agente de IA de Soporte (Configuraciones →
 * Soporte). Permite a **personal de soporte** (validado por `SoporteGuard` en el
 * controlador) revisar TODAS las conversaciones que el agente ha tenido con los
 * usuarios y atender los tickets levantados.
 *
 * Las lecturas usan `admin` (service_role); la actualización de estado de un
 * ticket usa `comoActor(uid)` para que el trigger de auditoría capture QUIÉN lo
 * atendió. Las tablas `v2_soporte_*` aún no están en `database.types.ts` (se
 * tiparán al regenerar tras la migración), por eso se usan clientes sin tipar.
 */
@Injectable()
export class SoporteAdminService {
  constructor(private readonly supabase: SupabaseService) {}

  private get db(): SupabaseClient {
    return this.supabase.admin as unknown as SupabaseClient;
  }
  private dbActor(uid: string): SupabaseClient {
    return this.supabase.comoActor(uid) as unknown as SupabaseClient;
  }

  // --- Conversaciones (auditoría) ------------------------------------------

  /**
   * Lista las sesiones de chat de TODOS los usuarios (las más recientes),
   * enriquecidas con el nombre del usuario, el número de mensajes, la última
   * actividad y si alguna respuesta sugirió escalar a ticket.
   */
  async listarSesiones(incluirEliminadas: boolean): Promise<SesionAdmin[]> {
    let query = this.db
      .from('v2_soporte_sesiones')
      .select('uuid, uid_usuario, titulo, fc, status')
      .order('fc', { ascending: false })
      .limit(300);
    if (!incluirEliminadas) query = query.eq('status', true);

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    const sesiones = (data ?? []) as {
      uuid: string;
      uid_usuario: string;
      titulo: string | null;
      fc: string;
      status: boolean;
    }[];
    if (sesiones.length === 0) return [];

    const ids = sesiones.map((s) => s.uuid);
    const nombres = await this.nombres(sesiones.map((s) => s.uid_usuario));

    // Métricas por sesión en una sola consulta (se agregan en memoria).
    const { data: msgs, error: errMsgs } = await this.db
      .from('v2_soporte_mensajes')
      .select('session_id, escalable, fc')
      .in('session_id', ids);
    if (errMsgs) throw new InternalServerErrorException(errMsgs.message);

    const metricas = new Map<
      string,
      { total: number; ultima: string | null; escalable: boolean }
    >();
    for (const m of (msgs ?? []) as {
      session_id: string;
      escalable: boolean;
      fc: string;
    }[]) {
      const acc = metricas.get(m.session_id) ?? {
        total: 0,
        ultima: null,
        escalable: false,
      };
      acc.total += 1;
      if (!acc.ultima || m.fc > acc.ultima) acc.ultima = m.fc;
      if (m.escalable) acc.escalable = true;
      metricas.set(m.session_id, acc);
    }

    return sesiones.map((s) => {
      const u = nombres.get(s.uid_usuario);
      const met = metricas.get(s.uuid);
      return {
        uuid: s.uuid,
        uidUsuario: s.uid_usuario,
        usuario: u?.nombre ?? 'Usuario',
        correo: u?.correo ?? null,
        titulo: s.titulo,
        fc: s.fc,
        activa: s.status,
        mensajes: met?.total ?? 0,
        ultimaActividad: met?.ultima ?? null,
        tieneEscalacion: met?.escalable ?? false,
      };
    });
  }

  /** Devuelve la conversación completa de una sesión (de cualquier usuario). */
  async conversacion(sessionId: string): Promise<ConversacionAdmin> {
    const { data: ses, error: errSes } = await this.db
      .from('v2_soporte_sesiones')
      .select('uuid, uid_usuario, titulo, fc, status')
      .eq('uuid', sessionId)
      .maybeSingle();
    if (errSes) throw new InternalServerErrorException(errSes.message);
    const sesion = ses as {
      uuid: string;
      uid_usuario: string;
      titulo: string | null;
      fc: string;
      status: boolean;
    } | null;
    if (!sesion) {
      throw new InternalServerErrorException('La conversación no existe.');
    }

    const nombres = await this.nombres([sesion.uid_usuario]);
    const u = nombres.get(sesion.uid_usuario);

    const { data, error } = await this.db
      .from('v2_soporte_mensajes')
      .select(
        'uuid, pregunta, respuesta, escalable, modulos_detectados, ruta_origen, tokens_entrada, tokens_salida, fc, debug_sql, debug_meta',
      )
      .eq('session_id', sessionId)
      .order('fc', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);

    const mensajes: MensajeAdmin[] = (
      (data ?? []) as {
        uuid: string;
        pregunta: string;
        respuesta: string;
        escalable: boolean;
        modulos_detectados: string[] | null;
        ruta_origen: string | null;
        tokens_entrada: number | null;
        tokens_salida: number | null;
        fc: string;
        debug_sql: string | null;
        debug_meta: unknown;
      }[]
    ).map((m) => ({
      uuid: m.uuid,
      pregunta: m.pregunta,
      respuesta: m.respuesta,
      escalable: m.escalable,
      modulos: m.modulos_detectados ?? [],
      ruta: m.ruta_origen,
      tokensEntrada: m.tokens_entrada,
      tokensSalida: m.tokens_salida,
      fc: m.fc,
      debugSql: m.debug_sql ?? null,
      debugMeta: m.debug_meta ?? null,
    }));

    return {
      sesion: {
        uuid: sesion.uuid,
        uidUsuario: sesion.uid_usuario,
        usuario: u?.nombre ?? 'Usuario',
        correo: u?.correo ?? null,
        titulo: sesion.titulo,
        fc: sesion.fc,
        activa: sesion.status,
      },
      mensajes,
    };
  }

  // --- Tickets (atención) ---------------------------------------------------

  /** Lista los tickets levantados (opcionalmente filtrados por estado). */
  async listarTickets(estado?: string): Promise<TicketAdmin[]> {
    let query = this.db
      .from('v2_soporte_tickets')
      .select(
        'uuid, uid_usuario, session_id, modulo, ruta, asunto, resumen, estado, fc, fum, fumUser',
      )
      .order('fc', { ascending: false })
      .limit(300);
    if (estado) query = query.eq('estado', estado);

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    const tickets = (data ?? []) as {
      uuid: string;
      uid_usuario: string;
      session_id: string | null;
      modulo: string | null;
      ruta: string | null;
      asunto: string;
      resumen: string;
      estado: 'abierto' | 'en_proceso' | 'cerrado';
      fc: string;
      fum: string | null;
      fumUser: string | null;
    }[];
    if (tickets.length === 0) return [];

    const uids = [
      ...tickets.map((t) => t.uid_usuario),
      ...tickets.map((t) => t.fumUser).filter((x): x is string => !!x),
    ];
    const nombres = await this.nombres(uids);

    return tickets.map((t) => {
      const u = nombres.get(t.uid_usuario);
      const at = t.fumUser ? nombres.get(t.fumUser) : undefined;
      return {
        uuid: t.uuid,
        uidUsuario: t.uid_usuario,
        usuario: u?.nombre ?? 'Usuario',
        correo: u?.correo ?? null,
        sessionId: t.session_id,
        modulo: t.modulo,
        ruta: t.ruta,
        asunto: t.asunto,
        resumen: t.resumen,
        estado: t.estado,
        fc: t.fc,
        fum: t.fum,
        atendidoPor: t.fumUser,
        atendidoPorNombre: at?.nombre ?? null,
      };
    });
  }

  /**
   * Atiende un ticket: cambia su estado y registra QUIÉN y CUÁNDO
   * (`fum`/`fumUser`). Escritura controlada del backend con `comoActor` (el
   * trigger de auditoría guarda el antes/después).
   */
  async atenderTicket(
    uid: string,
    ticketId: string,
    dto: AtenderTicketDto,
  ): Promise<{ ok: true }> {
    const { error } = await this.dbActor(uid)
      .from('v2_soporte_tickets')
      .update({
        estado: dto.estado,
        fum: new Date().toISOString(),
        fumUser: uid,
      })
      .eq('uuid', ticketId);
    if (error) throw new InternalServerErrorException(error.message);
    return { ok: true };
  }

  // --- Recordatorios de aprobación CxP (correos enviados) -------------------

  /**
   * Lista los correos de recordatorio de aprobación enviados (los más recientes).
   * Devuelve un resumen liviano (sin el HTML). Filtro opcional `q` por
   * destinatario (correo o nombre), aplicado en memoria para no exponer la cadena
   * del usuario a un filtro PostgREST.
   */
  async recordatoriosAprobacion(
    limit = 100,
    q?: string,
  ): Promise<RecordatorioEnviado[]> {
    const { data, error } = await this.db
      .from('mail_recordatorios_aprobacion')
      .select('id, enviado_en, uid_aprobador, email, nombre, num_pendientes, estado')
      .order('enviado_en', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 500));
    if (error) throw new InternalServerErrorException(error.message);

    const filas = (data ?? []) as {
      id: number;
      enviado_en: string;
      uid_aprobador: string;
      email: string;
      nombre: string | null;
      num_pendientes: number;
      estado: 'enviado' | 'fallido';
    }[];

    const t = (q ?? '').trim().toLowerCase();
    const filtradas = t
      ? filas.filter(
          (f) =>
            f.email.toLowerCase().includes(t) ||
            (f.nombre ?? '').toLowerCase().includes(t),
        )
      : filas;

    return filtradas.map((f) => ({
      id: f.id,
      enviadoEn: f.enviado_en,
      uidAprobador: f.uid_aprobador,
      email: f.email,
      nombre: f.nombre,
      numPendientes: f.num_pendientes,
      estado: f.estado,
    }));
  }

  /** Detalle de un recordatorio (incluye el HTML enviado y las solicitudes). */
  async recordatorioAprobacion(id: number): Promise<RecordatorioEnviadoDetalle> {
    const { data, error } = await this.db
      .from('mail_recordatorios_aprobacion')
      .select(
        'id, enviado_en, uid_aprobador, email, nombre, num_pendientes, estado, asunto, html, solicitudes, error',
      )
      .eq('id', id)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('El recordatorio no existe.');

    const r = data as {
      id: number;
      enviado_en: string;
      uid_aprobador: string;
      email: string;
      nombre: string | null;
      num_pendientes: number;
      estado: 'enviado' | 'fallido';
      asunto: string;
      html: string;
      solicitudes: SolicitudRecordatorio[] | null;
      error: string | null;
    };
    return {
      id: r.id,
      enviadoEn: r.enviado_en,
      uidAprobador: r.uid_aprobador,
      email: r.email,
      nombre: r.nombre,
      numPendientes: r.num_pendientes,
      estado: r.estado,
      asunto: r.asunto,
      html: r.html,
      solicitudes: r.solicitudes ?? [],
      error: r.error,
    };
  }

  // --- Internos -------------------------------------------------------------

  /** Mapa uid → {nombre, correo} para mostrar quién es cada usuario. */
  private async nombres(
    uids: string[],
  ): Promise<Map<string, { nombre: string; correo: string | null }>> {
    const unicos = [...new Set(uids.filter(Boolean))];
    const mapa = new Map<string, { nombre: string; correo: string | null }>();
    if (unicos.length === 0) return mapa;

    const { data } = await this.supabase.admin
      .from('catUsers')
      .select('uid, nombre, nomCompleto, email')
      .in('uid', unicos);

    for (const u of data ?? []) {
      mapa.set(u.uid, {
        nombre: u.nomCompleto ?? u.nombre ?? 'Usuario',
        correo: u.email ?? null,
      });
    }
    return mapa;
  }
}
