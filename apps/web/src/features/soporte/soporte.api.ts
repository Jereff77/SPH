import { api } from '@/lib/api';

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
}

export interface RespuestaSoporte {
  sessionId: string;
  respuesta: string;
  escalable: boolean;
  modulos: string[];
}

export interface EscalarPayload {
  sessionId: string;
  asunto: string;
  resumen: string;
  modulo?: string;
  rutaActual?: string;
}

/**
 * Cliente del Agente de IA de Soporte. Pasa por `lib/api.ts` (única puerta de
 * datos del frontend); nunca habla con Supabase ni con OpenRouter.
 */
export const soporteApi = {
  sesiones: () => api.get<SesionSoporte[]>('/soporte/sesiones'),
  nuevaSesion: () => api.post<{ sessionId: string }>('/soporte/sesiones', {}),
  mensajes: (id: string) => api.get<MensajeSoporte[]>(`/soporte/sesiones/${id}/mensajes`),
  enviar: (texto: string, sessionId?: string, rutaActual?: string) =>
    api.post<RespuestaSoporte>('/soporte/mensaje', { texto, sessionId, rutaActual }),
  renombrar: (id: string, titulo: string) =>
    api.patch<{ ok: true }>(`/soporte/sesiones/${id}`, { titulo }),
  eliminar: (id: string) => api.delete<{ ok: true }>(`/soporte/sesiones/${id}`),
  escalar: (dto: EscalarPayload) =>
    api.post<{ ok: true; ticketId: string }>('/soporte/escalar', dto),
};
