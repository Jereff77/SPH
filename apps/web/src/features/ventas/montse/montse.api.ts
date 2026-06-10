import { api } from '@/lib/api';

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

export interface SesionIA {
  uuid: string;
  titulo: string | null;
  fc: string;
}

export const montseApi = {
  tokens: () => api.get<boolean>('/ventas/montse/tokens'),
  sesiones: () => api.get<SesionIA[]>('/ventas/montse/sesiones'),
  nuevaSesion: () => api.post<{ session_id: string }>('/ventas/montse/sesiones', {}),
  mensajes: (id: string) => api.get<MensajeIA[]>(`/ventas/montse/sesiones/${id}/mensajes`),
  enviar: (sessionId: string, chatInput: string) =>
    api.post<{ respuesta: string; grafico: GraficoIA | null }>('/ventas/montse/mensaje', {
      sessionId,
      chatInput,
    }),
  renombrar: (id: string, titulo: string) =>
    api.patch<{ ok: true }>(`/ventas/montse/sesiones/${id}`, { titulo }),
  eliminar: (id: string) => api.delete<{ ok: true }>(`/ventas/montse/sesiones/${id}`),
};
