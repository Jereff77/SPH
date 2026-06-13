import { api } from '@/lib/api';

export interface Invitacion {
  id: string;
  email: string;
  nombre: string | null;
  apellidos: string | null;
  estado: 'pendiente' | 'aceptada' | 'cancelada';
  vigente: boolean;
  agregadoACorreos: boolean;
  fecExpira: string;
  fecAcepta: string | null;
  creadoEn: string;
}

export interface ResultadoInvitar {
  id: string;
  email: string;
  enviado: boolean;
  agregadoACorreos: boolean;
}

/** Datos públicos de una invitación válida (para precargar el registro). */
export interface InvitacionValida {
  email: string;
  nombre: string | null;
  apellidos: string | null;
}

export interface AceptarInvitacion {
  token: string;
  nombre: string;
  apellidos: string;
  telefono?: string;
  password: string;
}

export const invitacionesApi = {
  // --- Gestión (módulo Usuarios) ---
  listar: () => api.get<Invitacion[]>('/invitaciones'),
  invitar: (dto: { email: string; nombre: string; apellidos: string }) =>
    api.post<ResultadoInvitar>('/invitaciones', dto),
  reenviar: (id: string) =>
    api.post<{ enviado: boolean }>(`/invitaciones/${id}/reenviar`),
  cancelar: (id: string) => api.delete<{ ok: true }>(`/invitaciones/${id}`),

  // --- Públicas (registro) ---
  validar: (token: string) =>
    api.get<InvitacionValida>(`/invitaciones/validar/${encodeURIComponent(token)}`),
  aceptar: (dto: AceptarInvitacion) =>
    api.post<{ ok: true }>('/invitaciones/aceptar', dto),
};
