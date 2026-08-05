/**
 * Cliente HTTP hacia el backend (apps/api). Es la ÚNICA puerta de datos del
 * frontend: aquí NO se importa el SDK de Supabase ni se construyen consultas SQL.
 * El backend valida el JWT y aplica la autorización (RBAC) server-side.
 *
 * Manejo de sesión:
 *  - El access token vive SOLO en memoria (no en localStorage -> mitiga XSS).
 *  - Ante un 401, se intenta UNA renovación vía /auth/refresh (cookie httpOnly)
 *    y se reintenta la petición. Si falla, se notifica "sesión expirada".
 */
import type { ApiError } from '@erp/types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

/** Base del API (para conexiones que no pasan por `request`, p. ej. SSE). */
export const API_BASE_URL = BASE_URL;

let accessToken: string | null = null;
let onSessionExpired: (() => void) | null = null;
let refreshing: Promise<boolean> | null = null;
// Modo "Ver como" (soporte): solo lectura. Bloquea cualquier mutación de negocio.
let verComoActivo = false;
// uid del usuario observado en "Ver como" (se envía en la cabecera X-Ver-Como
// para que el backend muestre SUS datos; el backend solo la respeta si quien
// pide es soporte).
let verComoUid: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Token de acceso actual (en memoria). Para SSE/EventSource que no usa headers. */
export function getAccessToken(): string | null {
  return accessToken;
}

/** Activa/desactiva el modo solo-lectura de "Ver como". */
export function setVerComoActivo(activo: boolean): void {
  verComoActivo = activo;
}

/** Fija (o limpia) el uid del usuario observado en "Ver como". */
export function setVerComoUid(uid: string | null): void {
  verComoUid = uid;
}

const METODOS_MUTANTES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function setOnSessionExpired(cb: (() => void) | null): void {
  onSessionExpired = cb;
}

/** Error reciente de API (contexto para el Agente de Soporte: "me sale un error"). */
export interface ErrorApiReciente {
  metodo: string;
  ruta: string;
  status: number;
  mensaje: string;
  fc: string;
}

const ERRORES_MAX = 3;
const erroresRecientes: ErrorApiReciente[] = [];

function registrarErrorApi(metodo: string, ruta: string, status: number, mensaje: string): void {
  // Los errores del propio agente no aportan (y meterían ruido en su contexto).
  if (ruta.startsWith('/soporte')) return;
  erroresRecientes.push({ metodo, ruta, status, mensaje, fc: new Date().toISOString() });
  if (erroresRecientes.length > ERRORES_MAX) erroresRecientes.shift();
}

/**
 * Últimos errores de respuesta del API vistos en este navegador (máx. 3). El
 * Agente de Soporte los adjunta como contexto del turno: son mensajes que el
 * usuario ya vio en pantalla (los produce nuestro propio backend, ya saneados).
 */
export function ultimosErroresApi(): ErrorApiReciente[] {
  return [...erroresRecientes];
}

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface RefreshResponse {
  accessToken: string;
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;
      const data = (await res.json()) as RefreshResponse;
      accessToken = data.accessToken;
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isRetry = false,
): Promise<T> {
  // Modo "Ver como" (solo lectura): se bloquea cualquier mutación de negocio.
  // Las operaciones de sesión (/auth/refresh, /auth/logout) siguen permitidas.
  if (
    verComoActivo &&
    METODOS_MUTANTES.has(method) &&
    !path.startsWith('/auth/')
  ) {
    throw new ApiRequestError(
      403,
      'Estás en modo «Ver como» (solo lectura). Sal del modo para realizar cambios.',
    );
  }

  const esForm = body instanceof FormData;
  const headers: Record<string, string> = {};
  // Para FormData no se fija Content-Type (el navegador añade el boundary).
  if (!esForm) headers['Content-Type'] = 'application/json';
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  // "Ver como": el backend mostrará los datos de este usuario (solo si soporte).
  if (verComoUid) headers['X-Ver-Como'] = verComoUid;

  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers,
    body: esForm
      ? (body as FormData)
      : body === undefined
        ? undefined
        : JSON.stringify(body),
    credentials: 'include',
  });

  // Renovación automática de sesión ante 401 (excepto en los propios endpoints de auth).
  const esAuthPrimitivo =
    path.startsWith('/auth/refresh') || path.startsWith('/auth/login');
  if (res.status === 401 && !isRetry && !esAuthPrimitivo) {
    const ok = await refreshAccessToken();
    if (ok) return request<T>(method, path, body, true);
    onSessionExpired?.();
    throw new ApiRequestError(401, 'Sesión expirada');
  }

  if (!res.ok) {
    let parsed: ApiError | undefined;
    try {
      parsed = (await res.json()) as ApiError;
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    const mensaje = parsed?.message ?? `Error ${res.status}`;
    registrarErrorApi(method, path, res.status, mensaje);
    throw new ApiRequestError(res.status, mensaje, parsed);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  /** POST con archivos (multipart/form-data). */
  postForm: <T>(path: string, form: FormData) => request<T>('POST', path, form),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
