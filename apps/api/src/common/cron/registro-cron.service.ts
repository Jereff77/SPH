import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';

export type OrigenEjecucion = 'programada' | 'manual';

/** Datos para registrar una ejecución de un scheduler NestJS. */
export interface RegistroEjecucion {
  tarea: string;
  origen: OrigenEjecucion;
  estado: 'exito' | 'error';
  mensaje?: string | null;
  detalle?: unknown;
  inicio: Date;
  fin: Date;
  ejecutadoPor?: string | null;
}

/**
 * Persiste el historial de ejecuciones de los schedulers NestJS (`@Cron`) en la
 * tabla NUEVA de v2 `v2_cron_ejecuciones` (telemetría del sistema; objeto propio,
 * no toca nada del sistema viejo). A diferencia de pg_cron —que ya guarda su
 * historial en `cron.job_run_details`—, las tareas del backend no tenían rastro
 * persistente; este servicio lo aporta.
 *
 * Es @Global para que cualquier scheduler (en correo, cxp, …) pueda inyectarlo
 * sin crear dependencias circulares con el módulo Cron.
 */
@Injectable()
export class RegistroCronService {
  private readonly logger = new Logger(RegistroCronService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Ejecuta `fn` midiendo el tiempo, captura el resultado o el error y registra
   * la corrida en la bitácora. Re-lanza el error tras registrarlo (para que el
   * disparo manual pueda informar el fallo al usuario).
   */
  async ejecutarYRegistrar<T>(
    tarea: string,
    origen: OrigenEjecucion,
    fn: () => Promise<T>,
    ejecutadoPor?: string | null,
  ): Promise<T> {
    const inicio = new Date();
    try {
      const resultado = await fn();
      await this.registrar({
        tarea,
        origen,
        estado: 'exito',
        mensaje: this.resumir(resultado),
        detalle: resultado ?? null,
        inicio,
        fin: new Date(),
        ejecutadoPor,
      });
      return resultado;
    } catch (e) {
      await this.registrar({
        tarea,
        origen,
        estado: 'error',
        mensaje: (e as Error).message,
        detalle: null,
        inicio,
        fin: new Date(),
        ejecutadoPor,
      });
      throw e;
    }
  }

  /** Inserta una fila en la bitácora. Nunca lanza: si falla, solo lo loguea. */
  async registrar(r: RegistroEjecucion): Promise<void> {
    const duracionMs = r.fin.getTime() - r.inicio.getTime();
    const { error } = await this.supabase.admin
      // Tabla nueva de v2; hasta regenerar @erp/types se accede sin tipar.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('v2_cron_ejecuciones' as any)
      .insert({
        tarea: r.tarea,
        origen: r.origen,
        estado: r.estado,
        mensaje: r.mensaje ?? null,
        detalle: (r.detalle as Record<string, unknown> | null) ?? null,
        inicio: r.inicio.toISOString(),
        fin: r.fin.toISOString(),
        duracion_ms: duracionMs,
        ejecutado_por: r.ejecutadoPor ?? null,
      });
    if (error) {
      this.logger.warn(
        `No se pudo registrar la ejecución de "${r.tarea}": ${error.message}`,
      );
    }
  }

  /** Resumen legible de un resultado para la columna `mensaje`. */
  private resumir(resultado: unknown): string | null {
    if (resultado == null) return null;
    if (typeof resultado === 'object') {
      try {
        return JSON.stringify(resultado);
      } catch {
        return null;
      }
    }
    return String(resultado);
  }
}
