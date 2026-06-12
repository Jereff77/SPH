import { Module } from '@nestjs/common';
import { FideicomisoController } from './fideicomiso.controller.js';
import { KardexService } from './kardex.service.js';
import { DispersionesService } from './dispersiones.service.js';
import { ContabilidadService } from './contabilidad.service.js';
import { ConsultasService } from './consultas.service.js';
import { AportacionesService } from './aportaciones.service.js';
import { ConfigFideService } from './config-fide.service.js';
import { PagosVentaService } from '../ventas/pagos-venta.service.js';
import { EscriturasService } from '../ventas/escrituras.service.js';
import { PlanesService } from '../ventas/planes.service.js';

/**
 * Módulo Fideicomiso. Secciones (claves de `segModulos`): Dashboard (500),
 * Aportaciones (510), Adhesiones (520), Contabilidad (520), Dispersión (530),
 * Reportes/Kardex (540). Opera sobre el esquema Supabase existente; los guards y
 * `SupabaseService` son globales (no se importan aquí).
 *
 * Reutiliza `PagosVentaService` (registrar/eliminar pago + comprobante) y
 * `EscriturasService` (editar fecha de la partida) del módulo Ventas: ambos solo
 * dependen de `SupabaseService` (global), por lo que se declaran como providers
 * aquí para inyectarlos en la pantalla de Aportaciones (icono $ y Fecha Plan).
 */
@Module({
  controllers: [FideicomisoController],
  providers: [
    KardexService,
    DispersionesService,
    ContabilidadService,
    ConsultasService,
    AportacionesService,
    ConfigFideService,
    PagosVentaService,
    EscriturasService,
    PlanesService,
  ],
})
export class FideicomisoModule {}
