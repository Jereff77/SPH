/** Un job de pg_cron (tarea programada en la base de datos). */
export interface CronJobBd {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  command: string;
  ultimaEjecucion: string | null;
  ultimoEstado: string | null;
  ultimoMensaje: string | null;
  totalEjecuciones: number;
}

/** Una ejecución de un job de pg_cron. */
export interface CronRunBd {
  runid: number;
  jobid: number;
  jobname: string | null;
  status: string;
  returnMessage: string | null;
  startTime: string | null;
  endTime: string | null;
  duracionMs: number | null;
}

/** Una tarea programada del backend (scheduler NestJS @Cron). */
export interface TareaBackend {
  nombre: string;
  etiqueta: string;
  descripcion: string;
  expresion: string | null;
  activa: boolean;
  corriendo: boolean;
  proximaEjecucion: string | null;
  ultimaEjecucionMemoria: string | null;
  manualDisponible: boolean;
}

/** Una ejecución registrada de un scheduler NestJS (v2_cron_ejecuciones). */
export interface CronEjecucionBackend {
  id: number;
  tarea: string;
  origen: string;
  estado: string;
  mensaje: string | null;
  detalle: unknown;
  inicio: string;
  fin: string | null;
  duracionMs: number | null;
  ejecutadoPor: string | null;
  creadoEn: string;
}
