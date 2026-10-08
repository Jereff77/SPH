import { api } from '@/lib/api';

/** Ubicación de las notas: qué entidad de qué pantalla (espejo de `notas.schemas.ts`). */
export interface RefNotas {
  modulo: string;
  pantalla: string;
  entidadTipo: string;
  entidadId: string;
}

export type EventoNota = 'cambio_manual' | 'inpc' | 'contrato' | 'cancelacion' | 'liberacion';

export interface CambioNota {
  descripcion: string;
  concepto?: string;
  partida?: number | null;
}

export interface Nota {
  id: string;
  tipo: 'usuario' | 'sistema';
  evento: EventoNota | null;
  texto: string;
  detalle: { cambios?: CambioNota[] } & Record<string, unknown> | null;
  /** Persona autora (o quien provocó el cambio en los avisos de MontseAI). */
  autor: string | null;
  esMia: boolean;
  /** Nota propia subida HOY: la única que se puede eliminar. */
  eliminable: boolean;
  fc: string;
  fa: string;
}

const qs = (r: RefNotas) =>
  `?modulo=${encodeURIComponent(r.modulo)}&pantalla=${encodeURIComponent(r.pantalla)}` +
  `&entidadTipo=${encodeURIComponent(r.entidadTipo)}&entidadId=${encodeURIComponent(r.entidadId)}`;

export const notasApi = {
  listar: (r: RefNotas) => api.get<Nota[]>(`/notas${qs(r)}`),
  crear: (r: RefNotas, texto: string) => api.post<{ id: string }>('/notas', { ...r, texto }),
  eliminar: (id: string) => api.delete<{ ok: true }>(`/notas/${id}`),
};
