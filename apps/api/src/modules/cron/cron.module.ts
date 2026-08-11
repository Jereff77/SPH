import { Module } from '@nestjs/common';
import { CorreoModule } from '../correo/correo.module.js';
import { CxpModule } from '../cxp/cxp.module.js';
import { ParquesModule } from '../parques/parques.module.js';
import { CronController } from './cron.controller.js';
import { CronService } from './cron.service.js';

/**
 * Módulo Cron (Configuraciones → Cron). Monitorea las tareas programadas:
 *  - pg_cron (BD), vía funciones v2_cron_* de solo lectura.
 *  - schedulers NestJS @Cron, vía SchedulerRegistry + bitácora v2_cron_ejecuciones.
 *
 * Importa los módulos cuyos schedulers puede DISPARAR a mano; cada uno exporta
 * el suyo (SyncScheduler, ComplementosScheduler, RecordatorioAprobacionScheduler,
 * KvasCompromisosScheduler). El SchedulerRegistry es global (ScheduleModule).
 *
 * ⛔ Regla que ya costó un día de producción: al inyectar un scheduler ajeno hay
 * que importar SU módulo aquí. Es un fallo de inyección en runtime — `tsc` y
 * `nest build` pasan en verde y el contenedor muere al arrancar.
 */
@Module({
  imports: [CorreoModule, CxpModule, ParquesModule],
  controllers: [CronController],
  providers: [CronService],
})
export class CronModule {}
