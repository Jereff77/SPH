import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Subject } from 'rxjs';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../common/supabase/supabase.service.js';

export interface CambioVenta {
  ts: number;
  evento: string;
}

/**
 * Escucha Supabase Realtime sobre la tabla `pagos` (service_role) y publica un
 * flujo interno de "cambios" que el endpoint SSE reenvía al Dashboard de Ventas.
 * Así la cobranza se ve en vivo (incluidos los pagos hechos desde v1) sin que el
 * frontend hable con Supabase. Mismo patrón que `RealtimeService` de CxP.
 */
@Injectable()
export class VentasRealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VentasRealtimeService.name);
  private readonly subject = new Subject<CambioVenta>();
  private canal?: RealtimeChannel;

  readonly cambios$ = this.subject.asObservable();

  constructor(private readonly supabase: SupabaseService) {}

  onModuleInit(): void {
    try {
      this.canal = this.supabase.admin
        .channel('ventas-pagos-cambios')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pagos' },
          (payload) => {
            this.subject.next({ ts: Date.now(), evento: payload.eventType });
          },
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED')
            this.logger.log('Suscrito a Realtime de pagos (ventas).');
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')
            this.logger.warn(`Realtime ventas: estado ${status}.`);
        });
    } catch (e) {
      this.logger.error(`No se pudo suscribir a Realtime de pagos: ${(e as Error).message}`);
    }
  }

  onModuleDestroy(): void {
    if (this.canal) void this.supabase.admin.removeChannel(this.canal);
  }
}
