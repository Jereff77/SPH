import { Module } from '@nestjs/common';
import { VentasController } from './ventas.controller.js';
import { VentasStreamController } from './ventas-stream.controller.js';
import { MontseController } from './montse.controller.js';
import { DashboardService } from './dashboard.service.js';
import { PagosVentaService } from './pagos-venta.service.js';
import { PlanesService } from './planes.service.js';
import { EscriturasService } from './escrituras.service.js';
import { ReportesService } from './reportes.service.js';
import { MontseService } from './montse.service.js';
import { VentasRealtimeService } from './ventas-realtime.service.js';
import { SseAuthGuard } from '../cxp/sse-auth.guard.js';

/**
 * Módulo Ventas (Inversionistas/Propietarios). Etapa 1: Dashboard (clave 600) y
 * Planes + Configuración (clave 610). Opera sobre el esquema Supabase existente;
 * el SSE del Dashboard reutiliza `SseAuthGuard` del módulo CxP.
 */
@Module({
  controllers: [VentasController, VentasStreamController, MontseController],
  providers: [
    DashboardService,
    PagosVentaService,
    PlanesService,
    EscriturasService,
    ReportesService,
    MontseService,
    VentasRealtimeService,
    SseAuthGuard,
  ],
})
export class VentasModule {}
