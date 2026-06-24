import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SoporteInquilinosService } from './soporte-inquilinos.service.js';

/**
 * Tareas programadas de Soporte a Inquilinos:
 *  - Cada 5 min: genera incidentes de los correos ya sincronizados por el cron de
 *    Correo (que sincroniza todas las cuentas activas, incluida la de soporte) y
 *    reactiva los "Detenido (auto)" cuando llega nueva actividad.
 *  - Diario: marca como "Detenido (auto)" los incidentes activos sin movimiento >7 días.
 */
@Injectable()
export class SoporteInquilinosScheduler {
  private readonly logger = new Logger(SoporteInquilinosScheduler.name);
  private corriendo = false;

  constructor(private readonly soporte: SoporteInquilinosService) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'soporte-inquilinos-generar' })
  async generar(): Promise<void> {
    if (this.corriendo) return;
    this.corriendo = true;
    try {
      const idCuenta = await this.soporte.cuentaIdSoporte();
      if (!idCuenta) return; // aún no se ha configurado la cuenta de soporte
      const creados = await this.soporte.generarIncidentes(idCuenta);
      if (creados > 0) this.logger.log(`Incidentes nuevos generados: ${creados}`);
    } catch (e) {
      this.logger.warn(`Generación de incidentes: ${(e as Error).message}`);
    } finally {
      this.corriendo = false;
    }
  }

  // 07:15 todos los días (después del cron de actividad).
  @Cron('15 7 * * *', { name: 'soporte-inquilinos-detenidos' })
  async detenidos(): Promise<void> {
    try {
      const idCuenta = await this.soporte.cuentaIdSoporte();
      if (!idCuenta) return;
      const n = await this.soporte.marcarDetenidos();
      if (n > 0) this.logger.log(`Incidentes marcados como Detenido (auto): ${n}`);
    } catch (e) {
      this.logger.warn(`Marcar detenidos: ${(e as Error).message}`);
    }
  }
}
