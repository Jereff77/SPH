import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CorreoService } from './correo.service.js';

/** Sincroniza las cuentas de correo periódicamente (además del botón manual). */
@Injectable()
export class SyncScheduler {
  private readonly logger = new Logger(SyncScheduler.name);
  private corriendo = false;

  constructor(private readonly correo: CorreoService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sincronizar(): Promise<void> {
    if (this.corriendo) return; // evita solaparse
    this.corriendo = true;
    try {
      await this.correo.sincronizarTodas();
    } catch (e) {
      this.logger.warn(`Sincronización programada: ${(e as Error).message}`);
    } finally {
      this.corriendo = false;
    }
  }
}
