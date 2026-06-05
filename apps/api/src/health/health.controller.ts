import { Controller, Get } from '@nestjs/common';

/**
 * Endpoint público de salud (no requiere auth). Útil para readiness checks.
 * GET /api/health
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; service: string } {
    return { status: 'ok', service: 'erp-sph-api' };
  }
}
