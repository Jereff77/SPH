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
import { ParquesModule } from '../parques/parques.module.js';

/**
 * Módulo Fideicomiso. Secciones (claves de `segModulos`): Dashboard (500),
 * Aportaciones (510), Adhesiones (520), Contabilidad (520), Dispersión (530),
 * Reportes/Kardex (540). Opera sobre el esquema Supabase existente; los guards y
 * `SupabaseService` son globales (no se importan aquí).
 *
 * Reutiliza `PagosVentaService` (registrar/eliminar pago + comprobante),
 * `EscriturasService` (editar fecha de la partida) y `PlanesService` del módulo
 * Ventas, declarándolos como providers para la pantalla de Aportaciones.
 *
 * ⛔ `PlanesService` inyecta `KvasService` (candado de KVA al liberar nave), así
 * que este módulo DEBE importar `ParquesModule`: al reproveer un servicio ajeno
 * hay que traer también sus dependencias, o Nest no arranca.
 */
@Module({
  imports: [ParquesModule],
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
