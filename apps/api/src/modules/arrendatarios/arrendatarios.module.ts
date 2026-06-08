import { Module } from '@nestjs/common';
import { ArrendatariosController } from './arrendatarios.controller.js';
import { ArrendatariosStreamController } from './arrendatarios-stream.controller.js';
import { PlanesArreService } from './planes-arre.service.js';
import { CobranzaService } from './cobranza.service.js';
import { ArrendatariosRealtimeService } from './arrendatarios-realtime.service.js';
import { SseAuthGuard } from '../cxp/sse-auth.guard.js';

/**
 * Módulo Arrendatarios. Planes de Renta (clave 20): selector arrendatario/
 * propiedad, historial de planes, corrida, Config (datos/documentos/propiedades/
 * plan). Dashboard de cobranza (clave 10): pagos, vencimientos, aplicación de
 * pagos. El motor de cálculo INPC se delega en las RPCs `arrepdp_*` existentes;
 * el SSE reutiliza `SseAuthGuard` de CxP. Reemplaza `i02_arrendatarios` de v1.
 */
@Module({
  controllers: [ArrendatariosController, ArrendatariosStreamController],
  providers: [
    PlanesArreService,
    CobranzaService,
    ArrendatariosRealtimeService,
    SseAuthGuard,
  ],
})
export class ArrendatariosModule {}
