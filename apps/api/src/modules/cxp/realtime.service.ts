import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Subject } from 'rxjs';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../common/supabase/supabase.service.js';

export interface CambioCxp {
  ts: number;
  evento: string;
}

/**
 * Escucha Supabase Realtime sobre la tabla `cxp` (service_role) y publica un
 * flujo interno de "cambios" que el endpoint SSE reenvía al frontend. Así el
 * front se entera en vivo de cualquier cambio (incluidos los hechos desde v1)
 * sin hablar directamente con Supabase (respeta la frontera de confianza).
 */
@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly subject = new Subject<CambioCxp>();
  private canal?: RealtimeChannel;

  /** Flujo de cambios de cxp (lo consume el endpoint SSE). */
  readonly cambios$ = this.subject.asObservable();

  constructor(private readonly supabase: SupabaseService) {}

  onModuleInit(): void {
    try {
      this.canal = this.supabase.admin
        .channel('cxp-cambios')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'cxp' },
          (payload) => {
            this.subject.next({ ts: Date.now(), evento: payload.eventType });
          },
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED')
            this.logger.log('Suscrito a Realtime de cxp.');
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')
            this.logger.warn(`Realtime cxp: estado ${status}.`);
        });
    } catch (e) {
      this.logger.error(`No se pudo suscribir a Realtime de cxp: ${(e as Error).message}`);
    }
  }

  onModuleDestroy(): void {
    if (this.canal) void this.supabase.admin.removeChannel(this.canal);
  }
}
