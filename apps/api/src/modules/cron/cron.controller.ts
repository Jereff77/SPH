import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { SoporteGuard } from '../../common/auth/soporte.guard.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';
import { CronService } from './cron.service.js';
import type {
  CronEjecucionBackend,
  CronJobBd,
  CronRunBd,
  TareaBackend,
} from './cron.types.js';

/**
 * Configuraciones → Cron (monitoreo de tareas programadas).
 *
 * Acceso EXCLUSIVO de personal de soporte: `JwtAuthGuard` + `SoporteGuard`
 * (valida `catUsers.isSupport`). NO usa `@RequierePermiso` a propósito: este
 * acceso no se asigna desde la app, solo desde el backend/BD (regla del cliente).
 */
@Controller('cron')
@UseGuards(JwtAuthGuard, SoporteGuard)
export class CronController {
  constructor(private readonly cron: CronService) {}

  // --- pg_cron (base de datos) ---

  @Get('jobs')
  jobs(): Promise<CronJobBd[]> {
    return this.cron.jobsBd();
  }

  @Get('jobs/:jobid/ejecuciones')
  ejecucionesJob(
    @Param('jobid', ParseIntPipe) jobid: number,
    @Query('limit') limit?: string,
  ): Promise<CronRunBd[]> {
    return this.cron.historialBd(jobid, this.aLimite(limit));
  }

  @Get('ejecuciones')
  ejecucionesBd(@Query('limit') limit?: string): Promise<CronRunBd[]> {
    return this.cron.historialBd(undefined, this.aLimite(limit));
  }

  // --- Schedulers NestJS (backend) ---

  @Get('backend')
  backend(): TareaBackend[] {
    return this.cron.tareasBackend();
  }

  @Get('backend/:tarea/ejecuciones')
  ejecucionesBackend(
    @Param('tarea') tarea: string,
    @Query('limit') limit?: string,
  ): Promise<CronEjecucionBackend[]> {
    return this.cron.historialBackend(tarea, this.aLimite(limit));
  }

  @Post('backend/:tarea/ejecutar')
  ejecutar(
    @CurrentUser() actor: AuthUser,
    @Param('tarea') tarea: string,
  ): Promise<{ ok: true; resultado: unknown }> {
    return this.cron.ejecutarTarea(tarea, actor.uid);
  }

  private aLimite(limit?: string): number {
    const n = Number.parseInt(limit ?? '', 10);
    return Number.isFinite(n) && n > 0 ? Math.min(n, 500) : 50;
  }
}
