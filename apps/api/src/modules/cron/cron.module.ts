import { Module } from '@nestjs/common';
import { CorreoModule } from '../correo/correo.module.js';
import { CxpModule } from '../cxp/cxp.module.js';
import { CronController } from './cron.controller.js';
import { CronService } from './cron.service.js';

/**
 * Módulo Cron (Configuraciones → Cron). Monitorea las tareas programadas:
 *  - pg_cron (BD), vía funciones v2_cron_* de solo lectura.
 *  - schedulers NestJS @Cron, vía SchedulerRegistry + bitácora v2_cron_ejecuciones.
 *
 * Importa CorreoModule y CxpModule para poder DISPARAR manualmente sus
 * schedulers (SyncScheduler / ComplementosScheduler), que esos módulos exportan.
 * El SchedulerRegistry está disponible globalmente (ScheduleModule es @Global).
 */
@Module({
  imports: [CorreoModule, CxpModule],
  controllers: [CronController],
  providers: [CronService],
})
export class CronModule {}
