import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subject } from 'rxjs';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../common/supabase/supabase.service.js';

export interface CambioArre {
  ts: number;
  evento: string;
}

/**
 * Escucha Supabase Realtime sobre `arrePdpDetalle` y `movbancarios` (service_role)
 * y publica un flujo de "cambios" que el endpoint SSE reenvía al Dashboard de
 * cobranza de Arrendatarios. Así la cobranza se ve en vivo (incl. pagos hechos
 * desde v1) sin que el frontend hable con Supabase. Mismo patrón que Ventas/CxP.
 */
@Injectable()
export class ArrendatariosRealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ArrendatariosRealtimeService.name);
  private readonly subject = new Subject<CambioArre>();
  private canal?: RealtimeChannel;

  readonly cambios$ = this.subject.asObservable();

  constructor(private readonly supabase: SupabaseService) {}

  onModuleInit(): void {
    try {
      this.canal = this.supabase.admin
        .channel('arrendatarios-cobranza-cambios')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'arrePdpDetalle' },
          (payload) => this.subject.next({ ts: Date.now(), evento: payload.eventType }),
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'movbancarios' },
          (payload) => this.subject.next({ ts: Date.now(), evento: payload.eventType }),
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED')
            this.logger.log('Suscrito a Realtime de cobranza (arrendatarios).');
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')
            this.logger.warn(`Realtime arrendatarios: estado ${status}.`);
        });
    } catch (e) {
      this.logger.error(`No se pudo suscribir a Realtime de cobranza: ${(e as Error).message}`);
    }
  }

  onModuleDestroy(): void {
    if (this.canal) void this.supabase.admin.removeChannel(this.canal);
  }
}
