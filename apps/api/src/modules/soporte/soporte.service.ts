import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { CuentasService } from '../correo/cuentas.service.js';
import { SmtpService } from '../correo/smtp.service.js';
import { KbService } from './kb.service.js';
import type { Env } from '../../common/config/env.validation.js';
import type { EscalarDto, MensajeDto } from './soporte.schemas.js';

/** Un mensaje del chat (para historial y para enviar al modelo). */
export interface MensajeSoporte {
  tipo: 'user' | 'ai';
  texto: string;
  fc: string;
  escalable?: boolean;
}

interface PerfilUsuario {
  uid: string;
  nombre: string;
  esSoporte: boolean;
  claves: { clave: number; nombre: string }[];
}

interface RespuestaEdge {
  respuesta?: string;
  tokens?: { entrada?: number; salida?: number } | null;
}

// Marcador que el modelo añade cuando recomienda escalar a un humano. El backend
// lo detecta (escalable=true) y lo retira del texto mostrado al usuario.
const MARCADOR_ESCALAR = '[[ESCALAR]]';

const DEFAULT_MODELO = 'openai/gpt-4o-mini';
const DEFAULT_PROMPT =
  'Eres el asistente de soporte del ERP de SPH Bienes Raíces. Ayudas a los usuarios a USAR la aplicación. Respondes SIEMPRE en español, breve y con pasos claros. Te basas EXCLUSIVAMENTE en la documentación proporcionada; si no está en ella o no estás seguro, dilo y ofrece escalar a un ticket. NUNCA inventas funciones, rutas ni permisos. NUNCA puedes modificar datos: solo informas.';

/**
 * Agente de IA de Soporte (v2). Ayuda a los usuarios a USAR la aplicación
 * (how-to, diagnóstico, contexto del usuario) y escala a ticket cuando no puede
 * resolver. Es **agente dedicado** (separado de Montse AI, que consulta datos).
 *
 * Seguridad / arquitectura:
 *  - El frontend nunca habla con Supabase ni con OpenRouter: este backend es el
 *    proxy y el orquestador del contexto.
 *  - El agente **SOLO informa, jamás modifica la BD**: TODA lectura de datos del
 *    usuario se hace con el cliente de **solo lectura** `supabase.soporteRo(uid)`
 *    (rol Postgres `v2_soporte_ro`). La persistencia del chat y los tickets son
 *    escrituras **deterministas del backend** con `comoActor(uid)` (auditadas);
 *    el modelo nunca tiene herramienta de escritura.
 *  - El secreto del proveedor (OPENROUTER_API_KEY) vive en la edge `soporte-chat`,
 *    no en este backend.
 */
@Injectable()
export class SoporteService {
  private readonly logger = new Logger(SoporteService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService<Env, true>,
    private readonly kb: KbService,
    private readonly cuentas: CuentasService,
    private readonly smtp: SmtpService,
  ) {}

  // Clientes sin tipar para las tablas NUEVAS (aún no están en database.types.ts;
  // se tiparán al regenerar los tipos tras aplicar la migración 2026-06-12).
  private get db(): SupabaseClient {
    return this.supabase.admin as unknown as SupabaseClient;
  }
  private dbActor(uid: string): SupabaseClient {
    return this.supabase.comoActor(uid) as unknown as SupabaseClient;
  }

  // --- Sesiones -------------------------------------------------------------

  async listarSesiones(uid: string) {
    const { data, error } = await this.db
      .from('v2_soporte_sesiones')
      .select('uuid, titulo, fc')
      .eq('uid_usuario', uid)
      .eq('status', true)
      .order('fc', { ascending: false })
      .limit(40);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as { uuid: string; titulo: string | null; fc: string }[];
  }

  async nuevaSesion(uid: string): Promise<{ sessionId: string }> {
    const { data, error } = await this.dbActor(uid)
      .from('v2_soporte_sesiones')
      .insert({ uid_usuario: uid })
      .select('uuid')
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return { sessionId: (data as { uuid: string }).uuid };
  }

  async mensajes(uid: string, sessionId: string): Promise<MensajeSoporte[]> {
    const { data, error } = await this.db
      .from('v2_soporte_mensajes')
      .select('pregunta, respuesta, escalable, fc')
      .eq('session_id', sessionId)
      .eq('uid_usuario', uid)
      .order('fc', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    const out: MensajeSoporte[] = [];
    for (const m of (data ?? []) as {
      pregunta: string;
      respuesta: string;
      escalable: boolean;
      fc: string;
    }[]) {
      out.push({ tipo: 'user', texto: m.pregunta, fc: m.fc });
      out.push({ tipo: 'ai', texto: m.respuesta, fc: m.fc, escalable: m.escalable });
    }
    return out;
  }

  async renombrar(uid: string, sessionId: string, titulo: string): Promise<{ ok: true }> {
    const { error } = await this.dbActor(uid)
      .from('v2_soporte_sesiones')
      .update({ titulo: titulo.trim() })
      .eq('uuid', sessionId)
      .eq('uid_usuario', uid);
    if (error) throw new InternalServerErrorException(error.message);
    return { ok: true };
  }

  async eliminar(uid: string, sessionId: string): Promise<{ ok: true }> {
    const { error } = await this.dbActor(uid)
      .from('v2_soporte_sesiones')
      .update({ status: false })
      .eq('uuid', sessionId)
      .eq('uid_usuario', uid);
    if (error) throw new InternalServerErrorException(error.message);
    return { ok: true };
  }

  // --- Conversación ---------------------------------------------------------

  /**
   * Procesa una pregunta del usuario: selecciona la KB relevante, arma el
   * contexto (perfil + glosario + docs), invoca la edge `soporte-chat`
   * (OpenRouter) y persiste la conversación. Devuelve la respuesta y si el
   * agente sugiere escalar a ticket.
   */
  async enviar(
    userJwt: string,
    uid: string,
    dto: MensajeDto,
  ): Promise<{ sessionId: string; respuesta: string; escalable: boolean; modulos: string[] }> {
    // 1) Sesión (crear si no llega).
    let sessionId = dto.sessionId;
    let esPrimerMensaje = false;
    if (!sessionId) {
      sessionId = (await this.nuevaSesion(uid)).sessionId;
      esPrimerMensaje = true;
    }

    // 2) KB relevante (router por palabras clave + ruta).
    const seleccion = this.kb.seleccionar(dto.texto, dto.rutaActual);

    // 3) Perfil del usuario (SOLO LECTURA, rol v2_soporte_ro).
    const perfil = await this.perfilUsuario(uid);

    // 4) Historial de la sesión (para continuidad).
    const historial = await this.mensajes(uid, sessionId);

    // 5) Mensajes para el modelo.
    const promptBase = await this.param('SOPORTE_IA_PROMPT', DEFAULT_PROMPT);
    const system = this.construirSystemPrompt(promptBase, seleccion.contenido, perfil, dto.rutaActual);
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: system },
    ];
    for (const m of historial.slice(-10)) {
      messages.push({ role: m.tipo === 'user' ? 'user' : 'assistant', content: m.texto });
    }
    messages.push({ role: 'user', content: dto.texto });

    // 6) Modelo configurable (SPHConfiguraciones).
    const modelo = await this.param('SOPORTE_IA_MODELO', DEFAULT_MODELO);

    // 7) Invoca la edge (OpenRouter).
    const edge = await this.invocarEdge(userJwt, messages, modelo);

    // 8) Detecta el marcador de escalación y limpia el texto.
    const bruto = edge.respuesta ?? 'No obtuve respuesta. Intenta de nuevo.';
    const escalable = bruto.includes(MARCADOR_ESCALAR);
    const respuesta = bruto.split(MARCADOR_ESCALAR).join('').trim();

    // 9) Persiste el mensaje (escritura controlada + auditada).
    await this.persistirMensaje(uid, {
      sessionId,
      pregunta: dto.texto,
      respuesta,
      modulos: seleccion.modulos,
      ruta: dto.rutaActual,
      escalable,
      tokensEntrada: edge.tokens?.entrada ?? null,
      tokensSalida: edge.tokens?.salida ?? null,
    });

    // 10) Auto-título de la sesión con el primer mensaje.
    if (esPrimerMensaje) {
      const t = dto.texto.trim();
      const titulo = t.charAt(0).toUpperCase() + t.slice(1, 52) + (t.length > 52 ? '…' : '');
      this.renombrar(uid, sessionId, titulo).catch(() => {});
    }

    return { sessionId, respuesta, escalable, modulos: seleccion.modulos };
  }

  // --- Escalación a ticket --------------------------------------------------

  /**
   * Crea un ticket de soporte (SOLO tras confirmación explícita del usuario) y
   * notifica por correo, si hay cuenta configurada. Escritura controlada del
   * backend (no del modelo).
   */
  async escalar(
    uid: string,
    dto: EscalarDto,
  ): Promise<{ ok: true; ticketId: string }> {
    const { data, error } = await this.dbActor(uid)
      .from('v2_soporte_tickets')
      .insert({
        uid_usuario: uid,
        session_id: dto.sessionId,
        modulo: dto.modulo ?? null,
        ruta: dto.rutaActual ?? null,
        asunto: dto.asunto,
        resumen: dto.resumen,
      })
      .select('uuid')
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    const ticketId = (data as { uuid: string }).uuid;

    // Notificación best-effort (un fallo de correo NO tumba la creación del ticket).
    this.notificarTicket(uid, dto, ticketId).catch((e) =>
      this.logger.warn(`No se pudo notificar el ticket ${ticketId}: ${(e as Error).message}`),
    );

    return { ok: true, ticketId };
  }

  private async notificarTicket(uid: string, dto: EscalarDto, ticketId: string): Promise<void> {
    const destino = await this.param('SOPORTE_IA_DESTINO', '');
    const destinatarios = destino
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (destinatarios.length === 0) return; // sin destino configurado: solo queda el ticket en BD

    const cuentas = await this.cuentas.activas();
    if (cuentas.length === 0) return;
    const perfil = await this.perfilUsuario(uid);

    const subject = `Ticket de soporte: ${dto.asunto}`;
    const html = `
      <p>Se generó un <strong>ticket de soporte</strong> desde el asistente de IA.</p>
      <ul>
        <li><strong>Usuario:</strong> ${perfil.nombre} (${uid})</li>
        <li><strong>Módulo:</strong> ${dto.modulo ?? '—'}</li>
        <li><strong>Pantalla:</strong> ${dto.rutaActual ?? '—'}</li>
        <li><strong>Ticket:</strong> <code>${ticketId}</code></li>
      </ul>
      <p><strong>Resumen del problema:</strong></p>
      <blockquote style="border-left:3px solid #1f2a4d;padding-left:10px;color:#374151">${this.escaparHtml(
        dto.resumen,
      )}</blockquote>
      <p style="font-size:12px;color:#6b7280">Mensaje automático del Agente de Soporte SPH.</p>`;

    await this.smtp.enviarNotificacion(cuentas[0]!, destinatarios, subject, html);
  }

  // --- Internos -------------------------------------------------------------

  /**
   * Perfil del usuario para personalizar el diagnóstico. Se lee con el cliente
   * de **solo lectura** (rol v2_soporte_ro): permisos vigentes y datos básicos.
   */
  private async perfilUsuario(uid: string): Promise<PerfilUsuario> {
    const ro = this.supabase.soporteRo(uid);
    const [permisosRes, userRes] = await Promise.all([
      ro
        .from('segModulosUsuarios')
        .select('clave, modulo, seccion')
        .eq('uid', uid)
        .eq('acceso', true),
      ro.from('catUsers').select('nombre, nomCompleto, isSupport').eq('uid', uid).maybeSingle(),
    ]);

    const claves = (permisosRes.data ?? [])
      .filter((r) => r.clave != null)
      .map((r) => ({
        clave: r.clave as number,
        nombre: [r.modulo, r.seccion].filter(Boolean).join(' › '),
      }));

    const u = userRes.data as { nombre: string | null; nomCompleto: string | null; isSupport: boolean | null } | null;
    return {
      uid,
      nombre: u?.nomCompleto ?? u?.nombre ?? 'usuario',
      esSoporte: u?.isSupport === true,
      claves,
    };
  }

  /** Construye el system prompt: rol + reglas + perfil + KB. */
  private construirSystemPrompt(
    promptBase: string,
    kbContenido: string,
    perfil: PerfilUsuario,
    ruta?: string,
  ): string {
    const glosario = this.kb.glosario();

    const clavesTxt =
      perfil.claves.length > 0
        ? perfil.claves.map((c) => `${c.clave} (${c.nombre})`).join(', ')
        : 'ninguna asignada';

    return [
      promptBase,
      '',
      'REGLAS:',
      `- Si el usuario pregunta por algo que requiere un permiso que NO tiene, explícale con claridad que necesita esa clave de permiso y que la solicite a un administrador.`,
      `- Si el problema necesita intervención humana (un dato incorrecto, algo que el sistema hizo solo, una falla), ofrece escalar a un ticket y añade en una línea aparte exactamente el marcador ${MARCADOR_ESCALAR} (el sistema lo usa para mostrar el botón de ticket; no lo expliques al usuario).`,
      '- No reveles detalles técnicos internos (SQL, nombres de funciones de base de datos, secretos).',
      '',
      `CONTEXTO DEL USUARIO QUE PREGUNTA:`,
      `- Nombre: ${perfil.nombre}${perfil.esSoporte ? ' (usuario de SOPORTE: tiene acceso total)' : ''}.`,
      `- Pantalla actual: ${ruta ?? 'desconocida'}.`,
      `- Permisos (claves): ${clavesTxt}.`,
      '',
      glosario ? `GLOSARIO (términos transversales):\n${glosario}` : '',
      '',
      kbContenido
        ? `DOCUMENTACIÓN RELEVANTE (base de conocimiento):\n${kbContenido}`
        : 'No se encontró documentación específica para esta pregunta. Si no puedes responder con certeza, ofrece escalar a un ticket.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private async persistirMensaje(
    uid: string,
    m: {
      sessionId: string;
      pregunta: string;
      respuesta: string;
      modulos: string[];
      ruta?: string;
      escalable: boolean;
      tokensEntrada: number | null;
      tokensSalida: number | null;
    },
  ): Promise<void> {
    const { error } = await this.dbActor(uid)
      .from('v2_soporte_mensajes')
      .insert({
        session_id: m.sessionId,
        uid_usuario: uid,
        pregunta: m.pregunta,
        respuesta: m.respuesta,
        modulos_detectados: m.modulos,
        ruta_origen: m.ruta ?? null,
        escalable: m.escalable,
        tokens_entrada: m.tokensEntrada,
        tokens_salida: m.tokensSalida,
      });
    if (error) this.logger.error(`No se pudo guardar el mensaje: ${error.message}`);
  }

  /** Invoca la edge function `soporte-chat` (proxy a OpenRouter). */
  private async invocarEdge(
    userJwt: string,
    messages: { role: string; content: string }[],
    modelo: string,
  ): Promise<RespuestaEdge> {
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
      this.logger.error(`Error llamando soporte-chat: ${e instanceof Error ? e.message : e}`);
      throw new InternalServerErrorException('No se pudo contactar al asistente de soporte.');
    }
    if (!res.ok) {
      this.logger.error(`Edge soporte-chat ${res.status}: ${await res.text()}`);
      throw new InternalServerErrorException('El asistente de soporte no respondió. Intenta de nuevo.');
    }
    return (await res.json()) as RespuestaEdge;
  }

  /** Lee un parámetro de SPHConfiguraciones (con valor por defecto). */
  private async param(nombre: string, porDefecto: string): Promise<string> {
    const { data } = await this.supabase.admin
      .from('SPHConfiguraciones')
      .select('valor')
      .eq('parametro', nombre)
      .eq('status', true)
      .maybeSingle();
    return data?.valor ?? porDefecto;
  }

  private escaparHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }
}
