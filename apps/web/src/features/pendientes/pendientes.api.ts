import { api } from '@/lib/api';
import type {
  EstadoPendiente,
  GuardarPendiente,
  ListaPendientes,
  Pendiente,
} from './types';

export const pendientesApi = {
  /** Por defecto solo lo vivo; con `incluirCerrados` trae también lo cerrado. */
  listar: (incluirCerrados: boolean) =>
    api.get<ListaPendientes>(
      `/pendientes${incluirCerrados ? '?incluirCerrados=true' : ''}`,
    ),

  /** Alta y edición comparten endpoint (con o sin `id`). */
  guardar: (dto: GuardarPendiente) => api.post<Pendiente>('/pendientes', dto),

  /** Atajo desde la propia fila del listado. */
  cambiarEstado: (id: number, estado: EstadoPendiente) =>
    api.patch<Pendiente>(`/pendientes/${id}/estado`, { estado }),

  borrar: (id: number) => api.delete<{ ok: true }>(`/pendientes/${id}`),
};
