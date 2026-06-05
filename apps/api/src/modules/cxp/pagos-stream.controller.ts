import { Controller, Sse, UseGuards } from '@nestjs/common';
import { interval, map, merge, of, type Observable } from 'rxjs';
import { RealtimeService } from './realtime.service.js';
import { SseAuthGuard } from './sse-auth.guard.js';

interface SseMessage {
  data: { tipo: string; ts?: number; evento?: string };
}

/**
 * Endpoint SSE para el tiempo real de la pantalla de pagos. El front se conecta
 * con EventSource y, ante cada cambio en `cxp`, recibe un evento para refrescar
 * la tabla. Autenticación por token en query (SseAuthGuard, permiso 400).
 */
@Controller('cxp/pagos')
export class PagosStreamController {
  constructor(private readonly realtime: RealtimeService) {}

  @Sse('stream')
  @UseGuards(SseAuthGuard)
  stream(): Observable<SseMessage> {
    // init inmediato + heartbeat cada 25s (mantiene viva la conexión) + cambios.
    return merge(
      of<SseMessage>({ data: { tipo: 'init' } }),
      interval(25_000).pipe(map((): SseMessage => ({ data: { tipo: 'ping' } }))),
      this.realtime.cambios$.pipe(
        map((c): SseMessage => ({ data: { tipo: 'cambio', ts: c.ts, evento: c.evento } })),
      ),
    );
  }
}
