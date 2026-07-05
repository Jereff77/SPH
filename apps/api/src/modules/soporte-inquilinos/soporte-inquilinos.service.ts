import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TablesUpdate } from '@erp/types';
import type { Env } from '../../common/config/env.validation.js';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { ConfiguracionService } from '../configuracion/configuracion.service.js';
import { CuentasService } from '../correo/cuentas.service.js';
import { CorreoService } from '../correo/correo.service.js';
import { SmtpService, type AdjuntoSalida } from '../correo/smtp.service.js';
import { construirFirmaHtml } from './firma.builder.js';
import type { VincularDto } from './soporte-inquilinos.schemas.js';

/** Parámetro en SPHConfiguraciones que designa la cuenta de correo de soporte. */
const PARAM_CUENTA = 'SOPORTE_INQUILINOS_CUENTA_ID';
/** Días sin actividad tras los cuales un incidente activo pasa a "Detenido" (auto). */
const DIAS_DETENIDO = 7;

/** Extrae la dirección de correo de un encabezado "Nombre <correo>" y la normaliza. */
function emailNormalizado(from: string | null | undefined): string | null {
  if (!from) return null;
  const m = from.match(/<([^>]+)>/);
  const dir = (m?.[1] ?? from).trim().toLowerCase();
  return /\S+@\S+/.test(dir) ? dir : null;
}

/** Lee el folio anclado en el asunto, p. ej. "[INC-00001]" -> "INC-00001". */
function extraerFolio(subject: string | null | undefined): string | null {
  if (!subject) return null;
  const m = subject.match(/\[(INC-\d+)\]/i);
  return m ? m[1]!.toUpperCase() : null;
}

/** Asegura que el asunto lleve el folio anclado ("[INC-00001] ..."). */
function anclarFolio(subject: string | null | undefined, folio: string): string {
  const base = subject ?? '';
  if (extraerFolio(base) === folio) return base; // ya lo lleva
  // Si trae otro token (raro), igual prefijamos el correcto.
  return `[${folio}] ${base}`.trim();
}

@Injectable()
export class SoporteInquilinosService {
  private readonly logger = new Logger(SoporteInquilinosService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly configuracion: ConfiguracionService,
    private readonly cuentas: CuentasService,
    private readonly correo: CorreoService,
    private readonly smtp: SmtpService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ===========================================================================
  // RBAC de visibilidad + seguimientos (árbol)
  // ===========================================================================

  /** uid efectivo respetando "Ver como" (solo si el actor real es soporte). */
  async uidObservado(actorUid: string, verComo?: string): Promise<string> {
    return this.supabase.uidEfectivo(actorUid, verComo);
  }

  /**
   * ¿El usuario puede ver TODOS los incidentes (gerencia)? `isSupport` o clave 36.
   * Quien no, solo ve los incidentes donde es el **asignado**. Mismo patrón que
   * `PpdService.puedeVerTodas`.
   */
  async puedeVerTodos(uid: string): Promise<boolean> {
    const { data: perfil } = await this.supabase.admin
      .from('catUsers')
      .select('isSupport')
      .eq('uid', uid)
      .maybeSingle();
    if (perfil?.isSupport === true) return true;
    const { data } = await this.supabase.admin
      .from('segModulosUsuarios')
      .select('acceso')
      .eq('uid', uid)
      .eq('clave', 36)
      .maybeSingle();
    return data?.acceso === true;
  }

  /** Registra un seguimiento del incidente (evento del sistema o nota del agente). */
  private async registrarSeguimiento(
    idIncidente: string,
    texto: string,
    opts: { tipo?: 'evento' | 'nota'; uid?: string | null; detalle?: unknown } = {},
  ): Promise<void> {
    const cliente = opts.uid ? this.supabase.comoActor(opts.uid) : this.supabase.admin;
    const { error } = await cliente.from('incidentes_seguimientos').insert({
      idIncidente,
      tipo: opts.tipo ?? 'evento',
      texto,
      uid: opts.uid ?? null,
      detalle: (opts.detalle as never) ?? null,
    });
    if (error) this.logger.warn(`Seguimiento (${idIncidente}): ${error.message}`);
  }

  // ===========================================================================
  // Cuenta de correo designada (SPHConfiguraciones)
  // ===========================================================================

  /** ID de la cuenta de correo de Soporte a Inquilinos (o null si no se designó). */
  async cuentaIdSoporte(): Promise<string | null> {
    return this.configuracion.obtenerParametro(PARAM_CUENTA);
  }

  /** Designa qué cuenta de `correo_cuentas` es la de soporte (auditado). */
  async designarCuenta(idCuenta: string, actorUid: string): Promise<void> {
    // Verifica que la cuenta exista.
    await this.cuentas.credencialesDe(idCuenta);
    const { data: existe } = await this.supabase.admin
      .from('SPHConfiguraciones')
      .select('id')
      .eq('parametro', PARAM_CUENTA)
      .limit(1)
      .maybeSingle();
    const actor = this.supabase.comoActor(actorUid);
    if (existe) {
      const { error } = await actor
        .from('SPHConfiguraciones')
        .update({ valor: idCuenta, status: true })
        .eq('parametro', PARAM_CUENTA);
      if (error) throw new InternalServerErrorException(error.message);
    } else {
      const { error } = await actor.from('SPHConfiguraciones').insert({
        parametro: PARAM_CUENTA,
        valor: idCuenta,
        detalle: 'Cuenta de correo de Soporte a Inquilinos (v2)',
        tipo: 1,
        status: true,
      });
      if (error) throw new InternalServerErrorException(error.message);
    }
  }

  /** Datos públicos de la cuenta de soporte (sin contraseña) o null. */
  async cuentaSoporte() {
    const id = await this.cuentaIdSoporte();
    if (!id) return null;
    const cuentas = await this.cuentas.listar();
    return cuentas.find((c) => c.id === id) ?? null;
  }

  /** Todas las cuentas de correo (para designar una existente como la de soporte). */
  async cuentasDisponibles() {
    return this.cuentas.listar();
  }

  private async exigirCuenta(): Promise<string> {
    const id = await this.cuentaIdSoporte();
    if (!id)
      throw new NotFoundException(
        'No hay una cuenta de correo de soporte configurada. Configúrala en la pestaña Cuenta.',
      );
    return id;
  }

  // ===========================================================================
  // Sincronización + generación de incidentes
  // ===========================================================================

  /** Sincroniza el buzón de soporte y genera/actualiza incidentes. */
  async sincronizar(): Promise<{ nuevos: number; incidentesNuevos: number }> {
    const idCuenta = await this.exigirCuenta();
    const { nuevos } = await this.correo.sincronizar(idCuenta);
    const incidentesNuevos = await this.generarIncidentes(idCuenta);
    return { nuevos, incidentesNuevos };
  }

  /**
   * Crea un incidente por cada HILO entrante nuevo de la cuenta y actualiza la
   * actividad de los existentes. Pre-vincula por `incidentes_remitentes` (aprendido).
   * Devuelve cuántos incidentes nuevos se crearon. Idempotente.
   */
  async generarIncidentes(idCuenta: string): Promise<number> {
    // Mensajes recibidos de la cuenta (para detectar hilos y su actividad).
    const { data: msgs, error } = await this.supabase.admin
      .from('correo_mensajes')
      .select('conversationId, fromEmail, subject, fecha, tipo')
      .eq('idCuenta', idCuenta)
      .eq('tipo', 'received')
      .limit(20000);
    if (error) throw new InternalServerErrorException(error.message);

    // Agrupa por hilo: primer remitente/asunto + última fecha + folio detectado en el asunto.
    type Hilo = {
      conversationId: string;
      fromEmail: string | null;
      subject: string | null;
      ultimaFecha: string | null;
      folio: string | null; // folio detectado en el asunto ([INC-00001]) de cualquier mensaje
    };
    const hilos = new Map<string, Hilo>();
    for (const m of msgs ?? []) {
      const cid = m.conversationId;
      if (!cid) continue;
      const folioMsg = extraerFolio(m.subject);
      const h = hilos.get(cid);
      if (!h) {
        hilos.set(cid, {
          conversationId: cid,
          fromEmail: m.fromEmail,
          subject: m.subject,
          ultimaFecha: m.fecha,
          folio: folioMsg,
        });
      } else {
        if (m.fecha && (!h.ultimaFecha || m.fecha > h.ultimaFecha)) h.ultimaFecha = m.fecha;
        if (!h.subject && m.subject) h.subject = m.subject;
        if (!h.fromEmail && m.fromEmail) h.fromEmail = m.fromEmail;
        if (!h.folio && folioMsg) h.folio = folioMsg;
      }
    }
    if (hilos.size === 0) return 0;

    // Incidentes ya existentes de esta cuenta (indexados por conversationId Y por folio).
    const { data: existentes, error: exErr } = await this.supabase.admin
      .from('incidentes')
      .select('id, conversationId, folio, estado, detenidoOrigen, ultimaActividad')
      .eq('idCuenta', idCuenta);
    if (exErr) throw new InternalServerErrorException(exErr.message);
    const porConv = new Map((existentes ?? []).map((i) => [i.conversationId, i] as const));
    const porFolio = new Map((existentes ?? []).map((i) => [i.folio, i] as const));

    // Mapeo aprendido remitente -> inquilino/nave (para pre-vincular nuevos).
    const { data: remitentes } = await this.supabase.admin
      .from('incidentes_remitentes')
      .select('email, idArrendador, idNavArrend, idNave, idParque');
    const mapaRemitentes = new Map((remitentes ?? []).map((r) => [r.email, r] as const));

    let creados = 0;
    for (const h of hilos.values()) {
      // Resolver el incidente destino: 1º por conversationId, 2º por el folio del asunto.
      // El folio en el asunto ([INC-00001]) ancla TODA la cadena aunque la respuesta del
      // inquilino llegue con References/conversationId distintos (correo mal "hilado").
      const destino =
        porConv.get(h.conversationId) ?? (h.folio ? porFolio.get(h.folio) : undefined);

      if (destino) {
        await this.actualizarActividad(destino, h.ultimaFecha);
        continue;
      }

      // Nuevo incidente. Pre-vincular si el remitente ya se conoce.
      const email = emailNormalizado(h.fromEmail);
      const prev = email ? mapaRemitentes.get(email) : undefined;
      const { data: nuevo, error: insErr } = await this.supabase.admin
        .from('incidentes')
        .insert({
          idCuenta,
          conversationId: h.conversationId,
          asunto: h.subject ?? null,
          estado: 'Nuevo',
          ultimaActividad: h.ultimaFecha ?? new Date().toISOString(),
          idArrendador: prev?.idArrendador ?? null,
          idNavArrend: prev?.idNavArrend ?? null,
          idNave: prev?.idNave ?? null,
          idParque: prev?.idParque ?? null,
        })
        .select('id, folio')
        .single();
      if (insErr) {
        // 23505 = carrera con otra ejecución del scheduler; se ignora.
        if (insErr.code !== '23505')
          this.logger.warn(`Crear incidente (${h.conversationId}): ${insErr.message}`);
      } else {
        creados++;
        // Indexa el recién creado para que otro hilo del mismo lote no lo duplique.
        porConv.set(h.conversationId, nuevo as never);
        porFolio.set(nuevo.folio, nuevo as never);
        await this.registrarSeguimiento(
          nuevo.id,
          prev?.idArrendador
            ? 'Incidente creado desde un correo (remitente reconocido, pre-vinculado).'
            : 'Incidente creado desde un correo entrante.',
        );
      }
    }
    return creados;
  }

  /** Actualiza la actividad de un incidente y reactiva los "Detenido (auto)". */
  private async actualizarActividad(
    incidente: { id: string; estado: string; detenidoOrigen: string | null; ultimaActividad: string | null },
    ultimaFecha: string | null,
  ): Promise<void> {
    const hayNuevaActividad =
      !!ultimaFecha && (!incidente.ultimaActividad || ultimaFecha > incidente.ultimaActividad);
    if (!hayNuevaActividad) return;
    const cambios: TablesUpdate<'incidentes'> = { ultimaActividad: ultimaFecha! };
    const reactiva = incidente.estado === 'Detenido' && incidente.detenidoOrigen === 'auto';
    if (reactiva) {
      cambios.estado = 'En Proceso';
      cambios.detenidoOrigen = null;
    }
    const { error } = await this.supabase.admin
      .from('incidentes')
      .update(cambios)
      .eq('id', incidente.id);
    if (error) this.logger.warn(`Actualizar incidente ${incidente.id}: ${error.message}`);
    else if (reactiva)
      await this.registrarSeguimiento(
        incidente.id,
        'Reactivado a "En Proceso" por nueva respuesta del inquilino.',
      );
  }

  /**
   * Marca como "Detenido" (origen auto) los incidentes activos (Nuevo/En Proceso)
   * sin actividad por más de DIAS_DETENIDO. Pensado para un cron diario.
   */
  async marcarDetenidos(): Promise<number> {
    const corte = new Date(Date.now() - DIAS_DETENIDO * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.supabase.admin
      .from('incidentes')
      .update({ estado: 'Detenido', detenidoOrigen: 'auto' })
      .eq('status', true)
      .in('estado', ['Nuevo', 'En Proceso'])
      .lt('ultimaActividad', corte)
      .select('id');
    if (error) throw new InternalServerErrorException(error.message);
    for (const r of data ?? [])
      await this.registrarSeguimiento(
        r.id,
        `Marcado "Detenido" automáticamente (sin avance > ${DIAS_DETENIDO} días).`,
      );
    return data?.length ?? 0;
  }

  // ===========================================================================
  // Listado y detalle de incidentes
  // ===========================================================================

  /** Lista los incidentes (enriquecidos con inquilino/nave/parque, remitente y asignado). */
  async listarIncidentes(
    filtros: { estado?: string; q?: string },
    actorUid: string,
    verComo?: string,
  ) {
    const idCuenta = await this.exigirCuenta();
    // Respeta "Ver como": si el actor real es soporte y observa a otro usuario, la
    // visibilidad se evalúa con el uid OBSERVADO (uidEfectivo), no con el de soporte.
    const uid = await this.supabase.uidEfectivo(actorUid, verComo);
    const verTodos = await this.puedeVerTodos(uid);
    let consulta = this.supabase.admin
      .from('incidentes')
      .select(
        'id, folio, conversationId, asunto, estado, detenidoOrigen, categoria, prioridad, idArrendador, idNavArrend, idNave, idParque, asignadoA, ultimaActividad, creadoEn',
      )
      .eq('idCuenta', idCuenta)
      .eq('status', true);
    // Visibilidad: quien no ve todos, solo sus incidentes asignados (uid observado).
    if (!verTodos) consulta = consulta.eq('asignadoA', uid);
    if (filtros.estado) consulta = consulta.eq('estado', filtros.estado);
    const { data: incidentes, error } = await consulta
      .order('ultimaActividad', { ascending: false, nullsFirst: false })
      .limit(2000);
    if (error) throw new InternalServerErrorException(error.message);
    const filas = incidentes ?? [];
    if (filas.length === 0) return [];

    // Remitente (último recibido) por hilo.
    const convs = filas.map((i) => i.conversationId);
    const { data: msgs } = await this.supabase.admin
      .from('correo_mensajes')
      .select('conversationId, fromEmail, fecha')
      .eq('idCuenta', idCuenta)
      .eq('tipo', 'received')
      .in('conversationId', convs);
    const remitentePorConv = new Map<string, string | null>();
    const fechaPorConv = new Map<string, string | null>();
    for (const m of msgs ?? []) {
      if (!m.conversationId) continue;
      const f = fechaPorConv.get(m.conversationId);
      if (!f || (m.fecha && m.fecha > f)) {
        fechaPorConv.set(m.conversationId, m.fecha);
        remitentePorConv.set(m.conversationId, m.fromEmail);
      }
    }

    // Nombres de inquilino / parque / nave (en lote).
    const idsArr = [...new Set(filas.map((i) => i.idArrendador).filter(Boolean))] as string[];
    const idsParque = [...new Set(filas.map((i) => i.idParque).filter(Boolean))] as string[];
    const idsNave = [...new Set(filas.map((i) => i.idNave).filter(Boolean))] as string[];
    const idsAsig = [...new Set(filas.map((i) => i.asignadoA).filter(Boolean))] as string[];

    const [arrend, parques, naves, asignados] = await Promise.all([
      idsArr.length
        ? this.supabase.admin
            .from('inversionista')
            .select('idInversionista, razonsocial, nombre, apellido1, apellido2')
            .in('idInversionista', idsArr)
        : Promise.resolve({ data: [] as never[] }),
      idsParque.length
        ? this.supabase.admin
            .from('parques')
            .select('idParque, nomParque')
            .in('idParque', idsParque)
        : Promise.resolve({ data: [] as never[] }),
      idsNave.length
        ? this.supabase.admin
            .from('naves')
            .select('idNave, numNaveNAME, numNave')
            .in('idNave', idsNave)
        : Promise.resolve({ data: [] as never[] }),
      idsAsig.length
        ? this.supabase.admin
            .from('catUsers')
            .select('uid, nomCompleto, nombre, apellidos')
            .in('uid', idsAsig)
        : Promise.resolve({ data: [] as never[] }),
    ]);
    const nombreArr = new Map(
      (arrend.data ?? []).map((a) => [
        a.idInversionista,
        a.razonsocial ||
          [a.nombre, a.apellido1, a.apellido2].filter(Boolean).join(' ') ||
          '—',
      ]),
    );
    const nombreParque = new Map((parques.data ?? []).map((p) => [p.idParque, p.nomParque]));
    const nombreNave = new Map(
      (naves.data ?? []).map((n) => [n.idNave, n.numNaveNAME || n.numNave || '—']),
    );
    const nombreAsig = new Map(
      (asignados.data ?? []).map((u) => [
        u.uid,
        u.nomCompleto || [u.nombre, u.apellidos].filter(Boolean).join(' ') || '—',
      ]),
    );

    const enriquecidas = filas.map((i) => ({
      ...i,
      remitente: remitentePorConv.get(i.conversationId) ?? null,
      inquilino: i.idArrendador ? (nombreArr.get(i.idArrendador) ?? null) : null,
      parque: i.idParque ? (nombreParque.get(i.idParque) ?? null) : null,
      nave: i.idNave ? (nombreNave.get(i.idNave) ?? null) : null,
      asignado: i.asignadoA ? (nombreAsig.get(i.asignadoA) ?? null) : null,
    }));

    const q = filtros.q?.trim().toLowerCase();
    if (!q) return enriquecidas;
    return enriquecidas.filter((r) =>
      [r.folio, r.asunto, r.remitente, r.inquilino, r.parque, r.nave, r.asignado]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }

  /** Carga un incidente, su hilo de correo, vínculo, asignado y seguimientos. */
  async detalle(id: string, actorUid: string, verComo?: string) {
    const incidente = await this.cargarIncidente(id);
    // Visibilidad (respeta "Ver como"): si no ve todos y no es el asignado, se rechaza.
    const uid = await this.supabase.uidEfectivo(actorUid, verComo);
    if (!(await this.puedeVerTodos(uid)) && incidente.asignadoA !== uid)
      throw new ForbiddenException('Este incidente no está asignado a ti.');

    const hilo = await this.hiloIncidente(incidente);
    let inquilino: string | null = null;
    if (incidente.idArrendador) {
      const { data } = await this.supabase.admin
        .from('inversionista')
        .select('razonsocial, nombre, apellido1, apellido2')
        .eq('idInversionista', incidente.idArrendador)
        .maybeSingle();
      if (data)
        inquilino =
          data.razonsocial ||
          [data.nombre, data.apellido1, data.apellido2].filter(Boolean).join(' ') ||
          null;
    }
    let asignado: string | null = null;
    if (incidente.asignadoA) {
      const { data } = await this.supabase.admin
        .from('catUsers')
        .select('nomCompleto, nombre, apellidos')
        .eq('uid', incidente.asignadoA)
        .maybeSingle();
      if (data)
        asignado =
          data.nomCompleto || [data.nombre, data.apellidos].filter(Boolean).join(' ') || null;
    }
    const seguimientos = await this.listarSeguimientos(id);
    return { incidente, hilo, inquilino, asignado, seguimientos };
  }

  /** Seguimientos (árbol) de un incidente, con el nombre del autor. */
  async listarSeguimientos(idIncidente: string) {
    const { data, error } = await this.supabase.admin
      .from('incidentes_seguimientos')
      .select('id, tipo, texto, uid, fc')
      .eq('idIncidente', idIncidente)
      .order('fc', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    const filas = data ?? [];
    const uids = [...new Set(filas.map((s) => s.uid).filter(Boolean))] as string[];
    const nombres = new Map<string, string>();
    if (uids.length) {
      const { data: us } = await this.supabase.admin
        .from('catUsers')
        .select('uid, nomCompleto, nombre, apellidos')
        .in('uid', uids);
      for (const u of us ?? [])
        nombres.set(
          u.uid,
          u.nomCompleto || [u.nombre, u.apellidos].filter(Boolean).join(' ') || '—',
        );
    }
    return filas.map((s) => ({
      ...s,
      autor: s.uid ? (nombres.get(s.uid) ?? null) : 'Sistema',
    }));
  }

  /**
   * Hilo COMPLETO del incidente: mensajes cuyo conversationId coincide **o** cuyo
   * asunto lleva el folio anclado ([INC-00001]). Así la cadena se ve unificada aunque
   * una respuesta del inquilino haya llegado con otro conversationId. Marca leídos.
   */
  private async hiloIncidente(incidente: {
    idCuenta: string;
    conversationId: string;
    folio: string;
  }) {
    const cols =
      'id, conversationId, fromEmail, toEmail, cc, subject, bodyText, bodyHtml, fecha, tipo, leido, tieneAdjuntos, folder';
    const [resConv, resTok] = await Promise.all([
      this.supabase.admin
        .from('correo_mensajes')
        .select(cols)
        .eq('idCuenta', incidente.idCuenta)
        .eq('conversationId', incidente.conversationId),
      this.supabase.admin
        .from('correo_mensajes')
        .select(cols)
        .eq('idCuenta', incidente.idCuenta)
        .ilike('subject', `%[${incidente.folio}]%`),
    ]);
    if (resConv.error) throw new InternalServerErrorException(resConv.error.message);
    if (resTok.error) throw new InternalServerErrorException(resTok.error.message);

    const porId = new Map<string, (typeof resConv.data)[number]>();
    for (const m of [...(resConv.data ?? []), ...(resTok.data ?? [])]) porId.set(m.id, m);
    const filas = [...porId.values()].sort((a, b) =>
      (a.fecha ?? '').localeCompare(b.fecha ?? ''),
    );

    const ids = filas.map((m) => m.id);
    const adjPorMsg = new Map<string, unknown[]>();
    if (ids.length > 0) {
      const { data: adj } = await this.supabase.admin
        .from('correo_adjuntos')
        .select('id, idMensaje, filename, url, contentType, tamano')
        .in('idMensaje', ids);
      for (const a of adj ?? []) {
        const arr = adjPorMsg.get(a.idMensaje) ?? [];
        arr.push(a);
        adjPorMsg.set(a.idMensaje, arr);
      }
    }

    const noLeidos = filas
      .filter((m) => m.tipo === 'received' && !m.leido)
      .map((m) => m.id);
    if (noLeidos.length > 0)
      await this.supabase.admin
        .from('correo_mensajes')
        .update({ leido: true })
        .in('id', noLeidos);

    return filas.map((m) => ({ ...m, adjuntos: adjPorMsg.get(m.id) ?? [] }));
  }

  private async cargarIncidente(id: string) {
    const { data, error } = await this.supabase.admin
      .from('incidentes')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Incidente no encontrado.');
    return data;
  }

  // ===========================================================================
  // Acciones sobre un incidente
  // ===========================================================================

  /** Responde por correo (con firma corporativa) y avanza el incidente. */
  async responder(
    id: string,
    body: string,
    adjuntos: AdjuntoSalida[],
    actorUid: string,
    destinatarios: string[] = [],
    cc: string[] = [],
  ): Promise<void> {
    const incidente = await this.cargarIncidente(id);

    // Último correo recibido del hilo (para los encabezados de respuesta).
    const { data: original, error } = await this.supabase.admin
      .from('correo_mensajes')
      .select('fromEmail, subject, messageId, conversationId, toEmail')
      .eq('idCuenta', incidente.idCuenta)
      .eq('conversationId', incidente.conversationId)
      .eq('tipo', 'received')
      .order('fecha', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!original)
      throw new NotFoundException('No se encontró el correo del inquilino para responder.');

    // Ancla el folio en el asunto para que TODA la cadena (respuestas del inquilino
    // incluidas) quede ligada a este incidente aunque el cliente de correo no hile bien.
    original.subject = anclarFolio(original.subject, incidente.folio);

    const cred = await this.cuentas.credencialesDe(incidente.idCuenta);
    const firma = await this.construirFirma(actorUid, cred.email);
    await this.smtp.responder(cred, original, body, adjuntos, firma, {
      para: destinatarios,
      cc,
    });

    // Avanzar el incidente: responder es actividad. Nuevo/Detenido -> En Proceso.
    const cambios: TablesUpdate<'incidentes'> = {
      ultimaActividad: new Date().toISOString(),
      fum: new Date().toISOString(),
      fumUser: actorUid,
    };
    if (incidente.estado === 'Nuevo' || incidente.estado === 'Detenido') {
      cambios.estado = 'En Proceso';
      cambios.detenidoOrigen = null;
    }
    // Autoasignación: si NO está asignado a nadie, queda con quien responde. Si ya
    // tiene asignado (aunque responda otro), se conserva el actual.
    const autoasignado = !incidente.asignadoA;
    if (autoasignado) cambios.asignadoA = actorUid;

    await this.supabase.comoActor(actorUid).from('incidentes').update(cambios).eq('id', id);
    await this.registrarSeguimiento(id, 'Respondió al inquilino por correo.', {
      tipo: 'evento',
      uid: actorUid,
    });
    if (autoasignado)
      await this.registrarSeguimiento(id, 'Asignado automáticamente al responder.', {
        tipo: 'evento',
        uid: actorUid,
      });
  }

  private async construirFirma(actorUid: string, correoContacto: string): Promise<string> {
    const { data: usuario } = await this.supabase.admin
      .from('catUsers')
      .select('nomCompleto, nombre, apellidos, rol')
      .eq('uid', actorUid)
      .maybeSingle();
    let logoUrl: string | null = null;
    try {
      const logos = await this.configuracion.obtenerLogos();
      logoUrl = logos.claro.url ?? logos.oscuro.url ?? null;
    } catch {
      /* el logo es opcional para la firma */
    }
    const nombre =
      usuario?.nomCompleto ||
      [usuario?.nombre, usuario?.apellidos].filter(Boolean).join(' ') ||
      null;
    return construirFirmaHtml({
      nombre,
      cargo: usuario?.rol ?? null,
      correoContacto,
      logoUrl,
    });
  }

  /** Vincula manualmente el incidente con inquilino/nave/parque y APRENDE el mapeo. */
  async vincular(id: string, dto: VincularDto, actorUid: string): Promise<void> {
    const incidente = await this.cargarIncidente(id);
    const cambios = {
      idArrendador: dto.idArrendador ?? null,
      idNavArrend: dto.idNavArrend ?? null,
      idNave: dto.idNave ?? null,
      idParque: dto.idParque ?? null,
      fum: new Date().toISOString(),
      fumUser: actorUid,
    };
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('incidentes')
      .update(cambios)
      .eq('id', id);
    if (error) throw new InternalServerErrorException(error.message);
    await this.registrarSeguimiento(
      id,
      dto.idArrendador ? 'Vinculado a un inquilino/nave.' : 'Vínculo de inquilino/nave removido.',
      { tipo: 'evento', uid: actorUid },
    );

    // Aprender: guardar el mapeo remitente -> inquilino/nave para futuros correos.
    if (dto.idArrendador) {
      const { data: original } = await this.supabase.admin
        .from('correo_mensajes')
        .select('fromEmail')
        .eq('idCuenta', incidente.idCuenta)
        .eq('conversationId', incidente.conversationId)
        .eq('tipo', 'received')
        .order('fecha', { ascending: true, nullsFirst: true })
        .limit(1)
        .maybeSingle();
      const email = emailNormalizado(original?.fromEmail);
      if (email) await this.aprenderRemitente(email, dto, actorUid);
    }
  }

  private async aprenderRemitente(
    email: string,
    dto: VincularDto,
    actorUid: string,
  ): Promise<void> {
    const actor = this.supabase.comoActor(actorUid);
    const { data: existe } = await this.supabase.admin
      .from('incidentes_remitentes')
      .select('id, veces')
      .eq('email', email)
      .maybeSingle();
    const ahora = new Date().toISOString();
    if (existe) {
      await actor
        .from('incidentes_remitentes')
        .update({
          idArrendador: dto.idArrendador ?? null,
          idNavArrend: dto.idNavArrend ?? null,
          idNave: dto.idNave ?? null,
          idParque: dto.idParque ?? null,
          veces: (existe.veces ?? 0) + 1,
          ultimaVez: ahora,
        })
        .eq('id', existe.id);
    } else {
      await actor.from('incidentes_remitentes').insert({
        email,
        idArrendador: dto.idArrendador ?? null,
        idNavArrend: dto.idNavArrend ?? null,
        idNave: dto.idNave ?? null,
        idParque: dto.idParque ?? null,
        veces: 1,
        primeraVez: ahora,
        ultimaVez: ahora,
      });
    }
  }

  /** Cambia el estado del incidente (manual). "Detenido" manual no se auto-reactiva. */
  async cambiarEstado(id: string, estado: string, actorUid: string): Promise<void> {
    await this.cargarIncidente(id);
    const cambios: TablesUpdate<'incidentes'> = {
      estado,
      fum: new Date().toISOString(),
      fumUser: actorUid,
    };
    if (estado === 'Detenido') {
      cambios.detenidoOrigen = 'manual';
    } else {
      cambios.detenidoOrigen = null;
      // Cualquier otro cambio de estado cuenta como actividad reciente.
      cambios.ultimaActividad = new Date().toISOString();
    }
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('incidentes')
      .update(cambios)
      .eq('id', id);
    if (error) throw new InternalServerErrorException(error.message);
    await this.registrarSeguimiento(id, `Estado cambiado a "${estado}".`, {
      tipo: 'evento',
      uid: actorUid,
    });
  }

  /** Asigna el incidente a un agente (clave 35). Registra el evento. */
  async asignar(id: string, asignadoA: string | null, actorUid: string): Promise<void> {
    await this.cargarIncidente(id);
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('incidentes')
      .update({ asignadoA, fum: new Date().toISOString(), fumUser: actorUid })
      .eq('id', id);
    if (error) throw new InternalServerErrorException(error.message);
    let texto = 'Incidente sin asignar.';
    if (asignadoA) {
      const { data } = await this.supabase.admin
        .from('catUsers')
        .select('nomCompleto, nombre, apellidos')
        .eq('uid', asignadoA)
        .maybeSingle();
      const nombre =
        data?.nomCompleto ||
        [data?.nombre, data?.apellidos].filter(Boolean).join(' ') ||
        'un agente';
      texto = `Asignado a ${nombre}.`;
    }
    await this.registrarSeguimiento(id, texto, { tipo: 'evento', uid: actorUid });
  }

  /** Agrega una NOTA interna (no se envía al inquilino) al árbol de seguimientos. */
  async agregarNota(id: string, texto: string, actorUid: string): Promise<void> {
    await this.cargarIncidente(id);
    await this.registrarSeguimiento(id, texto, { tipo: 'nota', uid: actorUid });
  }

  /** Agentes candidatos para asignar: usuarios con acceso al módulo (clave 31) o soporte. */
  async agentes() {
    const [{ data: conClave }, { data: soporte }] = await Promise.all([
      this.supabase.admin
        .from('segModulosUsuarios')
        .select('uid')
        .eq('clave', 31)
        .eq('acceso', true),
      this.supabase.admin.from('catUsers').select('uid').eq('isSupport', true).eq('status', true),
    ]);
    const uids = [
      ...new Set([
        ...(conClave ?? []).map((r) => r.uid),
        ...(soporte ?? []).map((r) => r.uid),
      ]),
    ];
    if (uids.length === 0) return [];
    const { data, error } = await this.supabase.admin
      .from('catUsers')
      .select('uid, nomCompleto, nombre, apellidos')
      .in('uid', uids)
      .eq('status', true)
      .order('nomCompleto', { ascending: true, nullsFirst: false });
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []).map((u) => ({
      uid: u.uid,
      nombre: u.nomCompleto || [u.nombre, u.apellidos].filter(Boolean).join(' ') || u.uid,
    }));
  }

  // ===========================================================================
  // Clasificación por IA (F4) — categoría + prioridad vía OpenRouter (edge)
  // ===========================================================================

  /** Categorías por defecto si no hay `SOPORTE_INQUILINOS_IA_CATEGORIAS` en config. */
  private static readonly CATEGORIAS_DEFAULT =
    'Plomería,Eléctrico,Mantenimiento general,Limpieza,Seguridad,Climatización,Estructura/Obra,Administrativo,Otro';

  private async paramConfig(nombre: string, porDefecto: string): Promise<string> {
    const { data } = await this.supabase.admin
      .from('SPHConfiguraciones')
      .select('valor')
      .eq('parametro', nombre)
      .eq('status', true)
      .maybeSingle();
    return data?.valor ?? porDefecto;
  }

  /**
   * Clasifica un incidente con IA (categoría + prioridad) a partir del primer correo
   * del inquilino. Reutiliza la edge `soporte-chat` (OpenRouter) reenviando el JWT del
   * usuario. Guarda el resultado en el incidente y deja un seguimiento.
   */
  async clasificar(
    id: string,
    userJwt: string,
    actorUid: string,
  ): Promise<{ categoria: string; prioridad: string; motivo: string }> {
    const incidente = await this.cargarIncidente(id);
    // Primer correo recibido del hilo (el reporte original del inquilino).
    const { data: primero } = await this.supabase.admin
      .from('correo_mensajes')
      .select('subject, bodyText')
      .eq('idCuenta', incidente.idCuenta)
      .eq('conversationId', incidente.conversationId)
      .eq('tipo', 'received')
      .order('fecha', { ascending: true, nullsFirst: true })
      .limit(1)
      .maybeSingle();

    const categorias = (
      await this.paramConfig(
        'SOPORTE_INQUILINOS_IA_CATEGORIAS',
        SoporteInquilinosService.CATEGORIAS_DEFAULT,
      )
    )
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    const modelo = await this.paramConfig('SOPORTE_INQUILINOS_IA_MODELO', 'openai/gpt-4o-mini');

    const sistema =
      'Eres un clasificador de incidentes de mantenimiento inmobiliario de SPH Bienes Raíces. ' +
      'Clasifica el reporte del inquilino. Responde EXCLUSIVAMENTE un JSON válido con las claves ' +
      '"categoria" (una EXACTA de esta lista: ' +
      categorias.join(', ') +
      '), "prioridad" (una de: Alta, Media, Baja) y "motivo" (máx 140 caracteres, en español). ' +
      'No agregues texto fuera del JSON.';
    const contenido = `Asunto: ${incidente.asunto ?? primero?.subject ?? '(sin asunto)'}\n\nMensaje:\n${
      primero?.bodyText ?? '(sin contenido)'
    }`.slice(0, 6000);

    const edge = await this.invocarEdgeIA(
      userJwt,
      [
        { role: 'system', content: sistema },
        { role: 'user', content: contenido },
      ],
      modelo,
    );
    const parsed = this.parsearClasificacion(edge, categorias);

    await this.supabase
      .comoActor(actorUid)
      .from('incidentes')
      .update({
        categoria: parsed.categoria,
        prioridad: parsed.prioridad,
        fum: new Date().toISOString(),
        fumUser: actorUid,
      })
      .eq('id', id);
    await this.registrarSeguimiento(
      id,
      `Clasificado por IA: ${parsed.categoria} · prioridad ${parsed.prioridad}. ${parsed.motivo}`.trim(),
      { tipo: 'evento', uid: actorUid },
    );
    return parsed;
  }

  /** Invoca la edge `soporte-chat` (proxy a OpenRouter), reenviando el JWT del usuario. */
  private async invocarEdgeIA(
    userJwt: string,
    messages: { role: string; content: string }[],
    modelo: string,
  ): Promise<string> {
    const url = this.config.get('SUPABASE_URL', { infer: true });
    const anon = this.config.get('SUPABASE_ANON_KEY', { infer: true });
    let res: Response;
    try {
      res = await fetch(`${url}/functions/v1/soporte-chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userJwt}`,
          apikey: anon,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages, model: modelo }),
      });
    } catch (e) {
      this.logger.error(`Error llamando soporte-chat: ${(e as Error).message}`);
      throw new InternalServerErrorException('No se pudo contactar al clasificador de IA.');
    }
    if (!res.ok) {
      this.logger.error(`Edge soporte-chat ${res.status}: ${await res.text()}`);
      throw new InternalServerErrorException(
        'El clasificador de IA no respondió (revisa la clave/créditos de OpenRouter).',
      );
    }
    const json = (await res.json()) as { respuesta?: string };
    return json.respuesta ?? '';
  }

  /** Parsea el JSON de la IA (tolerante a ```fences```) y valida contra las categorías. */
  private parsearClasificacion(
    bruto: string,
    categorias: string[],
  ): { categoria: string; prioridad: string; motivo: string } {
    let texto = bruto.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    const ini = texto.indexOf('{');
    const fin = texto.lastIndexOf('}');
    if (ini >= 0 && fin > ini) texto = texto.slice(ini, fin + 1);
    let obj: { categoria?: string; prioridad?: string; motivo?: string } = {};
    try {
      obj = JSON.parse(texto);
    } catch {
      /* respuesta no-JSON: cae a valores por defecto abajo */
    }
    const catBuscada = (obj.categoria ?? '').trim().toLowerCase();
    const categoria =
      categorias.find((c) => c.toLowerCase() === catBuscada) ??
      categorias[categorias.length - 1] ??
      'Otro';
    const prioBuscada = (obj.prioridad ?? '').trim().toLowerCase();
    const prioridad =
      ['alta', 'media', 'baja'].find((p) => p === prioBuscada) === 'alta'
        ? 'Alta'
        : prioBuscada === 'baja'
          ? 'Baja'
          : 'Media';
    const motivo = (obj.motivo ?? '').trim().slice(0, 140);
    return { categoria, prioridad, motivo };
  }

  // ===========================================================================
  // Selectores para vincular (inquilino -> naves)
  // ===========================================================================

  /** Arrendatarios (inquilinos) activos, excluyendo la papelera (`pruebas=false`). */
  async inquilinos() {
    const { data, error } = await this.supabase.admin
      .from('inversionista')
      .select('idInversionista, razonsocial, nombre, apellido1, apellido2')
      .eq('status', true)
      .eq('pruebas', false)
      .or('arrendatario.eq.true,usuarioFinal.eq.true')
      .order('razonsocial', { ascending: true, nullsFirst: false });
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []).map((a) => ({
      idArrendador: a.idInversionista,
      nombre:
        a.razonsocial ||
        [a.nombre, a.apellido1, a.apellido2].filter(Boolean).join(' ') ||
        '—',
    }));
  }

  /** Naves arrendadas de un inquilino (vínculos activos), para el selector. */
  async navesDe(idArrendador: string) {
    const [{ data, error }, { data: activos }] = await Promise.all([
      this.supabase.admin
        .from('v_arrendadasNaves')
        .select('idNavArrend, idParque, idNave, nomParque, numNaveNAME, nomDescriptivo')
        .eq('idArrendatario', idArrendador)
        .eq('esTicket', false)
        .order('nomDescriptivo', { ascending: true, nullsFirst: false }),
      this.supabase.admin
        .from('arrenPropiedades')
        .select('idNavArrend')
        .eq('idArrendador', idArrendador)
        .eq('status', true),
    ]);
    if (error) throw new InternalServerErrorException(error.message);
    const activosSet = new Set((activos ?? []).map((a) => a.idNavArrend));
    return (data ?? []).filter((r) => !!r.idNavArrend && activosSet.has(r.idNavArrend));
  }
}
