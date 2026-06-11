import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { SyncScheduler } from '../correo/sync.scheduler.js';
import { ComplementosScheduler } from '../cxp/complementos.scheduler.js';
import {
  TAREA_CORREO_SYNC,
  TAREA_CXP_COMPLEMENTOS,
} from '../../common/cron/cron.tareas.js';
import type {
  CronEjecucionBackend,
  CronJobBd,
  CronRunBd,
  TareaBackend,
} from './cron.types.js';

/** Metadatos legibles de cada scheduler NestJS (no viven en la BD). */
const META_TAREAS: Record<string, { etiqueta: string; descripcion: string }> = {
  [TAREA_CORREO_SYNC]: {
    etiqueta: 'Sincronización de correo',
    descripcion:
      'Revisa el buzón de facturas (IMAP) y actualiza la bandeja. Cada 5 minutos.',
  },
  [TAREA_CXP_COMPLEMENTOS]: {
    etiqueta: 'Aviso de Complementos de Pago (REP)',
    descripcion:
      'Notifica por correo las parcialidades PPD pagadas sin su REP, próximas al bloqueo. Diario ~07:00 (MX).',
  },
};

/**
 * Pantalla "Cron" (Configuraciones → Cron). Solo lectura de:
 *  - Jobs de pg_cron (tareas en la BD) + su historial real (cron.job_run_details),
 *    leídos vía las funciones NUEVAS v2_cron_jobs / v2_cron_run_details.
 *  - Tareas del backend (schedulers NestJS @Cron): estado en vivo vía
 *    SchedulerRegistry + historial persistente en v2_cron_ejecuciones.
 * Y disparo manual de las tareas del backend.
 *
 * Todo el acceso a Supabase es server-side (service_role); el front nunca lo toca.
 */
@Injectable()
export class CronService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly scheduler: SchedulerRegistry,
    private readonly syncScheduler: SyncScheduler,
    private readonly complementosScheduler: ComplementosScheduler,
  ) {}

  // ---------------------------------------------------------------------------
  // pg_cron (tareas en la base de datos)
  // ---------------------------------------------------------------------------

  async jobsBd(): Promise<CronJobBd[]> {
    const { data, error } = await this.supabase.admin
      // Función nueva de v2; hasta regenerar @erp/types se llama sin tipar.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .rpc('v2_cron_jobs' as any);
    if (error) {
      throw new InternalServerErrorException(
        `No se pudieron leer los jobs de pg_cron: ${error.message}`,
      );
    }
    const filas = (data ?? []) as Array<Record<string, unknown>>;
    return filas.map((f) => ({
      jobid: Number(f.jobid),
      jobname: String(f.jobname ?? ''),
      schedule: String(f.schedule ?? ''),
      active: f.active === true,
      command: String(f.command ?? ''),
      ultimaEjecucion: (f.ultima_ejecucion as string | null) ?? null,
      ultimoEstado: (f.ultimo_estado as string | null) ?? null,
      ultimoMensaje: (f.ultimo_mensaje as string | null) ?? null,
      totalEjecuciones: Number(f.total_ejecuciones ?? 0),
    }));
  }

  async historialBd(jobid?: number, limit = 50): Promise<CronRunBd[]> {
    const { data, error } = await this.supabase.admin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .rpc('v2_cron_run_details' as any, {
        p_jobid: jobid ?? null,
        p_limit: limit,
      });
    if (error) {
      throw new InternalServerErrorException(
        `No se pudo leer el historial de pg_cron: ${error.message}`,
      );
    }
    const filas = (data ?? []) as Array<Record<string, unknown>>;
    return filas.map((f) => ({
      runid: Number(f.runid),
      jobid: Number(f.jobid),
      jobname: (f.jobname as string | null) ?? null,
      status: String(f.status ?? ''),
      returnMessage: (f.return_message as string | null) ?? null,
      startTime: (f.start_time as string | null) ?? null,
      endTime: (f.end_time as string | null) ?? null,
      duracionMs:
        f.duracion_ms == null ? null : Math.round(Number(f.duracion_ms)),
    }));
  }

  // ---------------------------------------------------------------------------
  // Schedulers NestJS (tareas en el backend)
  // ---------------------------------------------------------------------------

  /** Lista las tareas del backend con su estado en vivo (SchedulerRegistry). */
  tareasBackend(): TareaBackend[] {
    return Object.keys(META_TAREAS).map((nombre) => {
      const meta = META_TAREAS[nombre]!;
      let activa = false;
      let corriendo = false;
      let expresion: string | null = null;
      let proxima: string | null = null;
      let ultima: string | null = null;

      try {
        const job = this.scheduler.getCronJob(nombre);
        activa = true;
        corriendo = Boolean((job as { running?: boolean }).running);
        expresion = this.fuenteCron(job);
        proxima = this.aIso(this.invocar(job, 'nextDate'));
        ultima = this.aIso(this.invocar(job, 'lastDate'));
      } catch {
        // El cron no está registrado (p. ej. módulo no cargado): activa=false.
      }

      return {
        nombre,
        etiqueta: meta.etiqueta,
        descripcion: meta.descripcion,
        expresion,
        activa,
        corriendo,
        proximaEjecucion: proxima,
        ultimaEjecucionMemoria: ultima,
        manualDisponible: true,
      };
    });
  }

  /** Historial persistente de una tarea del backend (v2_cron_ejecuciones). */
  async historialBackend(
    tarea?: string,
    limit = 50,
  ): Promise<CronEjecucionBackend[]> {
    let q = this.supabase.admin
      // Tabla nueva de v2; hasta regenerar @erp/types se accede sin tipar.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('v2_cron_ejecuciones' as any)
      .select(
        'id, tarea, origen, estado, mensaje, detalle, inicio, fin, duracion_ms, ejecutado_por, creado_en',
      )
      .order('inicio', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 500));
    if (tarea) q = q.eq('tarea', tarea);

    const { data, error } = await q;
    if (error) {
      throw new InternalServerErrorException(
        `No se pudo leer el historial del backend: ${error.message}`,
      );
    }
    const filas = (data ?? []) as unknown as Array<Record<string, unknown>>;
    return filas.map((f) => ({
      id: Number(f.id),
      tarea: String(f.tarea ?? ''),
      origen: String(f.origen ?? ''),
      estado: String(f.estado ?? ''),
      mensaje: (f.mensaje as string | null) ?? null,
      detalle: f.detalle ?? null,
      inicio: String(f.inicio ?? ''),
      fin: (f.fin as string | null) ?? null,
      duracionMs: f.duracion_ms == null ? null : Number(f.duracion_ms),
      ejecutadoPor: (f.ejecutado_por as string | null) ?? null,
      creadoEn: String(f.creado_en ?? ''),
    }));
  }

  /** Dispara manualmente una tarea del backend (queda registrada como 'manual'). */
  async ejecutarTarea(
    tarea: string,
    uid: string,
  ): Promise<{ ok: true; resultado: unknown }> {
    switch (tarea) {
      case TAREA_CORREO_SYNC: {
        await this.syncScheduler.ejecutar('manual', uid);
        return { ok: true, resultado: null };
      }
      case TAREA_CXP_COMPLEMENTOS: {
        const r = await this.complementosScheduler.ejecutar('manual', uid);
        return { ok: true, resultado: r };
      }
      default:
        throw new BadRequestException(`Tarea desconocida: ${tarea}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers para el objeto CronJob (cron v3 devuelve Luxon en nextDate()).
  // ---------------------------------------------------------------------------

  private invocar(job: unknown, metodo: 'nextDate' | 'lastDate'): unknown {
    try {
      const fn = (job as Record<string, unknown>)[metodo];
      return typeof fn === 'function'
        ? (fn as () => unknown).call(job)
        : null;
    } catch {
      return null;
    }
  }

  /** Normaliza un valor de fecha (Luxon DateTime | Date | string) a ISO. */
  private aIso(valor: unknown): string | null {
    if (!valor) return null;
    try {
      // Luxon DateTime
      if (typeof (valor as { toJSDate?: unknown }).toJSDate === 'function') {
        return (valor as { toJSDate: () => Date }).toJSDate().toISOString();
      }
      if (valor instanceof Date) return valor.toISOString();
      if (typeof (valor as { toISO?: unknown }).toISO === 'function') {
        return (valor as { toISO: () => string }).toISO();
      }
      const d = new Date(valor as string);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    } catch {
      return null;
    }
  }

  private fuenteCron(job: unknown): string | null {
    try {
      const src = (job as { cronTime?: { source?: unknown } }).cronTime?.source;
      if (src == null) return null;
      return src instanceof Date ? src.toISOString() : String(src);
    } catch {
      return null;
    }
  }
}
