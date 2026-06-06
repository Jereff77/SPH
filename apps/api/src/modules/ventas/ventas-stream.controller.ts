import { Controller, Sse, UseGuards } from '@nestjs/common';
import { interval, map, merge, of, type Observable } from 'rxjs';
import { VentasRealtimeService } from './ventas-realtime.service.js';
import { SseAuthGuard } from '../cxp/sse-auth.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';

interface SseMessage {
  data: { tipo: string; ts?: number; evento?: string };
}

/**
 * Endpoint SSE del Dashboard de Ventas. El front se conecta con EventSource y,
 * ante cada cambio en `pagos`, recibe un evento para refrescar la cobranza.
 * Autenticación por token en query (SseAuthGuard, permiso 600).
 */
@Controller('ventas/dashboard')
export class VentasStreamController {
  constructor(private readonly realtime: VentasRealtimeService) {}

  @Sse('stream')
  @UseGuards(SseAuthGuard)
  @RequierePermiso(600)
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
