import { Controller, Sse, UseGuards } from '@nestjs/common';
import { interval, map, merge, of, type Observable } from 'rxjs';
import { ArrendatariosRealtimeService } from './arrendatarios-realtime.service.js';
import { SseAuthGuard } from '../cxp/sse-auth.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';

interface SseMessage {
  data: { tipo: string; ts?: number; evento?: string };
}

/**
 * Endpoint SSE del Dashboard de cobranza de Arrendatarios. El front se conecta con
 * EventSource y, ante cada cambio en `arrePdpDetalle`/`movbancarios`, recibe un
 * evento para refrescar. Autenticación por token en query (SseAuthGuard, clave 10).
 */
@Controller('arrendatarios/cobranza')
export class ArrendatariosStreamController {
  constructor(private readonly realtime: ArrendatariosRealtimeService) {}

  @Sse('stream')
  @UseGuards(SseAuthGuard)
  @RequierePermiso(10)
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
