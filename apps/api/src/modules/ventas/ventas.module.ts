import { Module } from '@nestjs/common';
import { VentasController } from './ventas.controller.js';
import { VentasStreamController } from './ventas-stream.controller.js';
import { DashboardService } from './dashboard.service.js';
import { PagosVentaService } from './pagos-venta.service.js';
import { PlanesService } from './planes.service.js';
import { VentasRealtimeService } from './ventas-realtime.service.js';
import { SseAuthGuard } from '../cxp/sse-auth.guard.js';

/**
 * Módulo Ventas (Inversionistas/Propietarios). Etapa 1: Dashboard (clave 600) y
 * Planes + Configuración (clave 610). Opera sobre el esquema Supabase existente;
 * el SSE del Dashboard reutiliza `SseAuthGuard` del módulo CxP.
 */
@Module({
  controllers: [VentasController, VentasStreamController],
  providers: [
    DashboardService,
    PagosVentaService,
    PlanesService,
    VentasRealtimeService,
    SseAuthGuard,
  ],
})
export class VentasModule {}
