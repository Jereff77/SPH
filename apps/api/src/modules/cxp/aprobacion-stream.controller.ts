import { Controller, Sse, UseGuards } from '@nestjs/common';
import { interval, map, merge, of, type Observable } from 'rxjs';
import { RealtimeService } from './realtime.service.js';
import { SseAuthGuard } from './sse-auth.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';

interface SseMessage {
  data: { tipo: string; ts?: number; evento?: string };
}

/**
 * SSE para el tiempo real de la bandeja de aprobación. Reutiliza el RealtimeService
 * que escucha la tabla `cxp`. Autenticación por token en query (SseAuthGuard,
 * permiso 430).
 */
@Controller('cxp/aprobar')
export class AprobacionStreamController {
  constructor(private readonly realtime: RealtimeService) {}

  @Sse('stream')
  @UseGuards(SseAuthGuard)
  @RequierePermiso(430)
  stream(): Observable<SseMessage> {
    return merge(
      of<SseMessage>({ data: { tipo: 'init' } }),
      interval(25_000).pipe(map((): SseMessage => ({ data: { tipo: 'ping' } }))),
      this.realtime.cambios$.pipe(
        map((c): SseMessage => ({ data: { tipo: 'cambio', ts: c.ts, evento: c.evento } })),
      ),
    );
  }
}
