import { api } from '@/lib/api';
import type { LoginResult, PerfilUsuario, PermisoUsuario } from './types';

/** Llamadas al backend para el flujo de autenticación. */
export const authApi = {
  /** El login pide el nombre de usuario; el backend resuelve el correo. */
  login: (usuario: string, password: string) =>
    api.post<LoginResult>('/auth/login', { usuario, password }),

  /** Restaura/renueva la sesión usando la cookie httpOnly. */
  refresh: () => api.post<LoginResult>('/auth/refresh'),

  logout: () => api.post<{ ok: boolean }>('/auth/logout'),

  me: () =>
    api.get<{ usuario: PerfilUsuario; permisos: PermisoUsuario[] }>('/auth/me'),

  /** Contexto (perfil + permisos) de otro usuario para "Ver como" (solo soporte). */
  contexto: (uid: string) =>
    api.get<{ usuario: PerfilUsuario; permisos: PermisoUsuario[] }>(
      `/auth/contexto/${encodeURIComponent(uid)}`,
    ),

  cambiarContrasena: (actual: string, nueva: string) =>
    api.post<{ ok: true }>('/auth/cambiar-contrasena', { actual, nueva }),
};
