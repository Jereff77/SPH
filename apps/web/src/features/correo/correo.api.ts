import { api } from '@/lib/api';

export interface CuentaCorreo {
  id: string;
  nombre: string | null;
  email: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  usuario: string;
  activo: boolean;
  fc: string;
}

export interface CuentaInput {
  nombre: string;
  email: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  usuario: string;
  password: string;
  activo: boolean;
}

export interface Conversacion {
  conversationId: string;
  subject: string | null;
  ultimoFrom: string | null;
  ultimaFecha: string | null;
  folder: string | null;
  total: number;
  noLeidos: number;
  tieneAdjuntos: boolean;
}

export interface Carpeta {
  folder: string;
  total: number;
  noLeidos: number;
}

export interface AdjuntoCorreo {
  id: string;
  filename: string | null;
  url: string | null;
  contentType: string | null;
  tamano: number | null;
}

export interface MensajeCorreo {
  id: string;
  conversationId: string | null;
  fromEmail: string | null;
  toEmail: string | null;
  cc: string | null;
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  fecha: string | null;
  tipo: string;
  folder: string | null;
  leido: boolean;
  tieneAdjuntos: boolean;
  adjuntos: AdjuntoCorreo[];
}

export interface ResultadoConexion {
  imap: boolean;
  smtp: boolean;
  mensaje: string;
}

export const correoApi = {
  cuentas: () => api.get<CuentaCorreo[]>('/correo/cuentas'),
  crearCuenta: (dto: CuentaInput) => api.post<{ id: string }>('/correo/cuentas', dto),
  editarCuenta: (id: string, dto: CuentaInput) =>
    api.patch<{ ok: true }>(`/correo/cuentas/${id}`, dto),
  setActivo: (id: string, activo: boolean) =>
    api.patch<{ ok: true }>(`/correo/cuentas/${id}/activo`, { activo }),
  probar: (dto: CuentaInput) =>
    api.post<ResultadoConexion>('/correo/cuentas/probar', dto),
  probarGuardada: (id: string, dto: CuentaInput) =>
    api.post<ResultadoConexion>(`/correo/cuentas/${id}/probar`, dto),

  sincronizar: (idCuenta: string) =>
    api.post<{ nuevos: number }>(
      `/correo/sincronizar?idCuenta=${encodeURIComponent(idCuenta)}`,
    ),
  bandeja: (idCuenta: string, folder?: string) =>
    api.get<Conversacion[]>(
      `/correo/bandeja?idCuenta=${encodeURIComponent(idCuenta)}` +
        (folder ? `&folder=${encodeURIComponent(folder)}` : ''),
    ),
  carpetas: (idCuenta: string) =>
    api.get<Carpeta[]>(`/correo/carpetas?idCuenta=${encodeURIComponent(idCuenta)}`),
  hilo: (idCuenta: string, conversationId: string) =>
    api.get<MensajeCorreo[]>(
      `/correo/hilo/${encodeURIComponent(conversationId)}?idCuenta=${encodeURIComponent(idCuenta)}`,
    ),
  responder: (idMensaje: string, form: FormData) =>
    api.postForm<{ ok: true }>(`/correo/responder/${idMensaje}`, form),
};
