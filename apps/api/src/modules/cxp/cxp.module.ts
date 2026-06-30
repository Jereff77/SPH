import { Module } from '@nestjs/common';
import { CorreoModule } from '../correo/correo.module.js';
import { InvitacionesModule } from '../invitaciones/invitaciones.module.js';
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
import { BloqueoService } from './bloqueo.service.js';
import { ComplementosScheduler } from './complementos.scheduler.js';
import { RecordatorioAprobacionScheduler } from './recordatorio-aprobacion.scheduler.js';
import { ReportesCxpController } from './reportes.controller.js';
import { ReportesCxpService } from './reportes.service.js';

/**
 * Módulo Cuentas por Pagar (CxP). Se construye por fases: Proveedores →
 * Solicitudes → Aprobación → Pago/Conciliación → Reportes. Aquí se irán
 * registrando los controllers/services de cada submódulo.
 */
@Module({
  imports: [CorreoModule, InvitacionesModule],
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
    ReportesCxpController,
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
    BloqueoService,
    ComplementosScheduler,
    RecordatorioAprobacionScheduler,
    ReportesCxpService,
  ],
  exports: [ComplementosScheduler, RecordatorioAprobacionScheduler],
})
export class CxpModule {}
