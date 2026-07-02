import { Module } from '@nestjs/common';
import { ArrendatariosController } from './arrendatarios.controller.js';
import { ArrendatariosStreamController } from './arrendatarios-stream.controller.js';
import { IncrementosController } from './incrementos.controller.js';
import { ResponsablesController } from './responsables.controller.js';
import { PlanesArreService } from './planes-arre.service.js';
import { CobranzaService } from './cobranza.service.js';
import { ReportesArreService } from './reportes-arre.service.js';
import { ArrendatariosRealtimeService } from './arrendatarios-realtime.service.js';
import { IncrementosService } from './incrementos.service.js';
import { IncrementosNotificadorService } from './incrementos-notificador.service.js';
import { ResponsablesService } from './responsables.service.js';
import { SseAuthGuard } from '../cxp/sse-auth.guard.js';
import { InvitacionesModule } from '../invitaciones/invitaciones.module.js';

/**
 * Módulo Arrendatarios. Planes de Renta (clave 20): selector arrendatario/
 * propiedad, historial de planes, corrida, Config (datos/documentos/propiedades/
 * plan). Dashboard de cobranza (clave 10): pagos, vencimientos, aplicación de
 * pagos. Incrementos de renta por INPC (permiso 212, con bitácora reversible
 * `arre_incrementos`). El motor de cálculo INPC vive en RPCs de BD (la nueva
 * `arrepdp_aplicar_incremento_inpc` + las `arrepdp_*` heredadas); el SSE
 * reutiliza `SseAuthGuard` de CxP. Reemplaza `i02_arrendatarios` de v1.
 * IncrementosController va primero: sus rutas fijas (`incrementos/...`) deben
 * resolverse antes que los params dinámicos del controller general.
 */
@Module({
  imports: [InvitacionesModule],
  controllers: [
    IncrementosController,
    ResponsablesController,
    ArrendatariosController,
    ArrendatariosStreamController,
  ],
  providers: [
    PlanesArreService,
    CobranzaService,
    ReportesArreService,
    ArrendatariosRealtimeService,
    IncrementosService,
    IncrementosNotificadorService,
    ResponsablesService,
    SseAuthGuard,
  ],
})
export class ArrendatariosModule {}
