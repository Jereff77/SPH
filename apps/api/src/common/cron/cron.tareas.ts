/**
 * Identificadores canónicos de las tareas programadas del backend (schedulers
 * NestJS `@Cron`). Se usan como `name` del cron, como `tarea` en la bitácora
 * `v2_cron_ejecuciones` y como id para el disparo manual desde la pantalla Cron.
 */
export const TAREA_CORREO_SYNC = 'correo-sync';
export const TAREA_CXP_COMPLEMENTOS = 'cxp-aviso-complementos';
export const TAREA_CXP_RECORDATORIO_APROBACION = 'cxp-recordatorio-aprobacion';
export const TAREA_KVAS_COMPROMISOS = 'kvas-compromisos';
