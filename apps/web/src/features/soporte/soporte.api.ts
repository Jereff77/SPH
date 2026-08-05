import { api, type ErrorApiReciente } from '@/lib/api';

export interface SesionSoporte {
  uuid: string;
  titulo: string | null;
  fc: string;
}

export interface MensajeSoporte {
  tipo: 'user' | 'ai';
  texto: string;
  fc: string;
  escalable?: boolean;
  /** Captura de pantalla adjunta al mensaje (data URL o URL firmada), si la hubo. */
  imagen?: string;
}

export interface RespuestaSoporte {
  sessionId: string;
  respuesta: string;
  escalable: boolean;
  modulos: string[];
  /** El modelo pidió VER la pantalla (tool `request_screenshot`): el widget
   *  captura y reenvía solo, con `permitirCaptura: false` (anti-bucle). */
  pideCaptura?: boolean;
}

export interface EnviarOpciones {
  sessionId?: string;
  rutaActual?: string;
  /** Captura de pantalla adjunta (data URL JPEG). Va inline al modelo; no se persiste. */
  captura?: string;
  /** Habilita que el modelo pueda PEDIR una captura. false en el reenvío automático. */
  permitirCaptura?: boolean;
  /** Últimos errores de API vistos en el navegador (contexto del turno, máx. 3). */
  erroresRecientes?: ErrorApiReciente[];
}

export interface EscalarPayload {
  sessionId: string;
  asunto: string;
  resumen: string;
  modulo?: string;
  rutaActual?: string;
}

export interface PropuestaTicket {
  asunto: string;
  resumen: string;
  modulo: string | null;
}

/**
 * Cliente del Agente de IA de Soporte. Pasa por `lib/api.ts` (única puerta de
 * datos del frontend); nunca habla con Supabase ni con OpenRouter.
 */
export const soporteApi = {
  sesiones: () => api.get<SesionSoporte[]>('/soporte/sesiones'),
  nuevaSesion: () => api.post<{ sessionId: string }>('/soporte/sesiones', {}),
  mensajes: (id: string) => api.get<MensajeSoporte[]>(`/soporte/sesiones/${id}/mensajes`),
  enviar: (texto: string, opciones: EnviarOpciones = {}) =>
    api.post<RespuestaSoporte>('/soporte/mensaje', { texto, ...opciones }),
  renombrar: (id: string, titulo: string) =>
    api.patch<{ ok: true }>(`/soporte/sesiones/${id}`, { titulo }),
  eliminar: (id: string) => api.delete<{ ok: true }>(`/soporte/sesiones/${id}`),
  proponerTicket: (sessionId: string, rutaActual?: string) =>
    api.post<PropuestaTicket>('/soporte/escalar/proponer', { sessionId, rutaActual }),
  escalar: (dto: EscalarPayload) =>
    api.post<{ ok: true; ticketId: string }>('/soporte/escalar', dto),
};
