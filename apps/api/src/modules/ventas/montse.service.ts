import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type { Env } from '../../common/config/env.validation.js';

/** Gráfico que la IA puede adjuntar a una respuesta. */
export interface GraficoIA {
  tipo: 'bar' | 'pie' | 'line';
  titulo: string;
  labels: string[];
  datos: number[];
  formato?: 'moneda' | 'numero' | 'porcentaje';
}

export interface MensajeIA {
  tipo: 'user' | 'ai';
  texto: string;
  fc: string;
  grafico?: GraficoIA | null;
}

/**
 * Montse AI (asistente conversacional, pestaña dentro de Reportes, clave 620).
 * El backend es el **proxy**: el frontend nunca habla con Supabase. Para el chat
 * se invoca la **edge function existente `ia-chat`** (que usa el secret
 * `OPENROUTER_API_KEY`), reenviando el **JWT del usuario** para que la función lo
 * identifique (`auth.getUser()`) y registre la conversación bajo su uid. Las
 * sesiones/mensajes se leen con `service_role` filtrando por uid. Objetos de IA
 * (tablas `ia*`, RPCs `ia_*`, edge `ia-chat`) ya existen (autorizado por el usuario).
 */
@Injectable()
export class MontseService {
  private readonly logger = new Logger(MontseService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** ¿Quedan tokens para el asistente? (límite global). */
  async tokensDisponibles(): Promise<boolean> {
    const { data, error } = await this.supabase.admin.rpc('ia_tokens_disponibles', {
      p_limite: 1_000_000,
    });
    if (error) throw new InternalServerErrorException(error.message);
    return data !== false;
  }

  /** Sesiones de chat del usuario (más recientes primero). */
  async listarSesiones(uid: string) {
    const { data, error } = await this.supabase.admin
      .from('iaSesiones')
      .select('uuid, titulo, fc')
      .eq('uid_usuario', uid)
      .eq('status', true)
      .order('fc', { ascending: false })
      .limit(40);
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /** Crea una nueva sesión y devuelve su id. */
  async nuevaSesion(uid: string): Promise<{ session_id: string }> {
    const { data, error } = await this.supabase.admin.rpc('ia_nueva_sesion', {
      p_uid_usuario: uid,
    });
    if (error) throw new InternalServerErrorException(error.message);
    const d = data as unknown as { session_id?: string } | string | null;
    const sid = (typeof d === 'object' && d ? d.session_id : d) ?? '';
    return { session_id: String(sid) };
  }

  /** Mensajes de una sesión (pregunta + respuesta por registro). */
  async mensajes(uid: string, sessionId: string): Promise<MensajeIA[]> {
    const { data, error } = await this.supabase.admin
      .from('iaConversaciones')
      .select('pregunta, respuesta, fc, grafico_json')
      .eq('session_id', sessionId)
      .eq('uid_usuario', uid)
      .order('fc', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    const msgs: MensajeIA[] = [];
    for (const m of data ?? []) {
      msgs.push({ tipo: 'user', texto: m.pregunta ?? '', fc: m.fc });
      msgs.push({
        tipo: 'ai',
        texto: m.respuesta ?? '',
        fc: m.fc,
        grafico: (m.grafico_json as unknown as GraficoIA | null) ?? null,
      });
    }
    return msgs;
  }

  /**
   * Envía un mensaje al asistente: invoca la edge function `ia-chat` reenviando
   * el JWT del usuario. La función ejecuta el agente (OpenRouter + tool SQL),
   * guarda la conversación y devuelve `{ respuesta, grafico }`.
   */
  async enviar(
    userJwt: string,
    sessionId: string,
    chatInput: string,
  ): Promise<{ respuesta: string; grafico: GraficoIA | null }> {
    const url = this.config.get('SUPABASE_URL', { infer: true });
    const anon = this.config.get('SUPABASE_ANON_KEY', { infer: true });
    let res: Response;
    try {
      res = await fetch(`${url}/functions/v1/ia-chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userJwt}`,
          apikey: anon,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatInput, session_id: sessionId }),
      });
    } catch (e) {
      this.logger.error(`Error llamando ia-chat: ${e instanceof Error ? e.message : e}`);
      throw new InternalServerErrorException('No se pudo contactar al asistente.');
    }
    if (!res.ok) {
      this.logger.error(`Edge ia-chat ${res.status}: ${await res.text()}`);
      throw new InternalServerErrorException('El asistente no respondió. Intenta de nuevo.');
    }
    const data = (await res.json()) as { respuesta?: string; grafico?: GraficoIA | null };
    return { respuesta: data?.respuesta ?? 'Sin respuesta del servidor.', grafico: data?.grafico ?? null };
  }

  async renombrar(uid: string, uuid: string, titulo: string): Promise<{ ok: true }> {
    const { error } = await this.supabase.admin
      .from('iaSesiones')
      .update({ titulo: titulo.trim() })
      .eq('uuid', uuid)
      .eq('uid_usuario', uid);
    if (error) throw new InternalServerErrorException(error.message);
    return { ok: true };
  }

  async eliminar(uid: string, uuid: string): Promise<{ ok: true }> {
    const { error } = await this.supabase.admin
      .from('iaSesiones')
      .update({ status: false })
      .eq('uuid', uuid)
      .eq('uid_usuario', uid);
    if (error) throw new InternalServerErrorException(error.message);
    return { ok: true };
  }
}
