import { api } from '@/lib/api';
import type {
  CronEjecucionBackend,
  CronJobBd,
  CronRunBd,
  TareaBackend,
} from './types';

export const cronApi = {
  // --- pg_cron (base de datos) ---
  jobs: () => api.get<CronJobBd[]>('/cron/jobs'),
  ejecucionesJob: (jobid: number, limit = 50) =>
    api.get<CronRunBd[]>(`/cron/jobs/${jobid}/ejecuciones?limit=${limit}`),

  // --- schedulers NestJS (backend) ---
  backend: () => api.get<TareaBackend[]>('/cron/backend'),
  ejecucionesBackend: (tarea: string, limit = 50) =>
    api.get<CronEjecucionBackend[]>(
      `/cron/backend/${encodeURIComponent(tarea)}/ejecuciones?limit=${limit}`,
    ),
  ejecutar: (tarea: string) =>
    api.post<{ ok: true; resultado: unknown }>(
      `/cron/backend/${encodeURIComponent(tarea)}/ejecutar`,
    ),
};

// --- Helpers de formato (regla 7b: fecha dd/mm/aaaa) -------------------------

/** Fecha + hora en formato MX `dd/mm/aaaa hh:mm` (24 h). */
export const fechaHora = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Mexico_City',
  });
};

/** Duración legible a partir de milisegundos. */
export const duracion = (ms: number | null): string => {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m} m ${r} s`;
};
