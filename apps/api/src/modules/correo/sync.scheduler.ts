import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CorreoService } from './correo.service.js';
import { RegistroCronService } from '../../common/cron/registro-cron.service.js';
import { TAREA_CORREO_SYNC } from '../../common/cron/cron.tareas.js';

/** Sincroniza las cuentas de correo periódicamente (además del botón manual). */
@Injectable()
export class SyncScheduler {
  private readonly logger = new Logger(SyncScheduler.name);
  private corriendo = false;

  constructor(
    private readonly correo: CorreoService,
    private readonly registro: RegistroCronService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: TAREA_CORREO_SYNC })
  async sincronizar(): Promise<void> {
    await this.ejecutar('programada');
  }

  /**
   * Lógica de la tarea, reutilizable por el disparo manual desde la pantalla
   * Cron (Configuraciones → Cron). Registra la ejecución en la bitácora.
   * `ejecutadoPor` es el uid del usuario cuando el disparo es manual.
   */
  async ejecutar(
    origen: 'programada' | 'manual',
    ejecutadoPor?: string | null,
  ): Promise<void> {
    if (this.corriendo) return; // evita solaparse
    this.corriendo = true;
    try {
      await this.registro.ejecutarYRegistrar(
        TAREA_CORREO_SYNC,
        origen,
        () => this.correo.sincronizarTodas(),
        ejecutadoPor,
      );
    } catch (e) {
      this.logger.warn(`Sincronización programada: ${(e as Error).message}`);
      if (origen === 'manual') throw e;
    } finally {
      this.corriendo = false;
    }
  }
}
