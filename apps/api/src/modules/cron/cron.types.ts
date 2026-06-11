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

/** Una ejecución de un job de pg_cron (de cron.job_run_details). */
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

/** Una tarea programada del backend (scheduler NestJS @Cron), estado en vivo. */
export interface TareaBackend {
  /** Id canónico (TAREA_*), usado para el disparo manual. */
  nombre: string;
  /** Etiqueta legible para la UI. */
  etiqueta: string;
  descripcion: string;
  /** Expresión cron (origen del CronTime). */
  expresion: string | null;
  /** ¿Está activa/registrada en el SchedulerRegistry? */
  activa: boolean;
  /** ¿Corriendo en este instante? */
  corriendo: boolean;
  /** Próxima ejecución (ISO) según el SchedulerRegistry. */
  proximaEjecucion: string | null;
  /** Última ejecución vista por el proceso (ISO; se reinicia al reiniciar el backend). */
  ultimaEjecucionMemoria: string | null;
  /** Permite disparo manual desde la pantalla. */
  manualDisponible: boolean;
}

/** Una ejecución registrada de un scheduler NestJS (de v2_cron_ejecuciones). */
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
