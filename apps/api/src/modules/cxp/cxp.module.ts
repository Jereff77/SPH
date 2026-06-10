import { Module } from '@nestjs/common';
import { ProveedoresController } from './proveedores.controller.js';
import { ProveedoresService } from './proveedores.service.js';
import { BancosController } from './bancos.controller.js';
import { BancosService } from './bancos.service.js';
import { SolicitudesController } from './solicitudes.controller.js';
import { SolicitudesService } from './solicitudes.service.js';
import { PendientesController } from './pendientes.controller.js';
import { PendientesService } from './pendientes.service.js';
import { ClavesSatController } from './claves-sat.controller.js';
import { ClavesSatService } from './claves-sat.service.js';
import { PagosController } from './pagos.controller.js';
import { PagosService } from './pagos.service.js';
import { PagosStreamController } from './pagos-stream.controller.js';
import { RealtimeService } from './realtime.service.js';
import { SseAuthGuard } from './sse-auth.guard.js';
import { AprobacionController } from './aprobacion.controller.js';
import { AprobacionService } from './aprobacion.service.js';
import { AprobacionStreamController } from './aprobacion-stream.controller.js';
import { PpdController } from './ppd.controller.js';
import { PpdService } from './ppd.service.js';

/**
 * Módulo Cuentas por Pagar (CxP). Se construye por fases: Proveedores →
 * Solicitudes → Aprobación → Pago/Conciliación → Reportes. Aquí se irán
 * registrando los controllers/services de cada submódulo.
 */
@Module({
  controllers: [
    ProveedoresController,
    BancosController,
    SolicitudesController,
    PendientesController,
    ClavesSatController,
    PagosController,
    PagosStreamController,
    AprobacionController,
    AprobacionStreamController,
    PpdController,
  ],
  providers: [
    ProveedoresService,
    BancosService,
    SolicitudesService,
    PendientesService,
    ClavesSatService,
    PagosService,
    RealtimeService,
    SseAuthGuard,
    AprobacionService,
    PpdService,
  ],
})
export class CxpModule {}
