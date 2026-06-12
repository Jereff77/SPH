import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportesCxpService } from './reportes.service.js';
import {
  reporteEstadoCuentaSchema,
  type ReporteEstadoCuentaDto,
} from './reportes.schemas.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';

/**
 * CxP > Reportes (clave 460). Réplica segura del reporte HTML "Estado de Cuenta"
 * de v1. El front nunca toca Supabase; estos endpoints sirven los datos tras
 * `JwtAuthGuard` + `PermisoGuard`.
 */
@Controller('cxp/reportes')
@UseGuards(JwtAuthGuard, PermisoGuard)
@RequierePermiso(460)
export class ReportesCxpController {
  constructor(private readonly svc: ReportesCxpService) {}

  /** Combos para el panel de filtros. */
  @Get('combos')
  combos() {
    return this.svc.combos();
  }

  /** Filtros dependientes (cascada proveedor/categoría → secciones). */
  @Get('dependientes')
  dependientes(
    @Query('proveedor') proveedor?: string,
    @Query('categoria') categoria?: string,
    @Query('seccion') seccion?: string,
  ) {
    return this.svc.dependientes(proveedor, categoria, seccion);
  }

  /** Consulta principal del reporte (todos los filtros server-side). */
  @Get('estado-cuenta')
  estadoCuenta(
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('proveedor') proveedor?: string,
    @Query('tipoProveedor') tipoProveedor?: string,
    @Query('categoria') categoria?: string,
    @Query('seccion') seccion?: string,
    @Query('estados') estados?: string,
    @Query('urgente') urgente?: string,
    @Query('quienSolicito') quienSolicito?: string,
    @Query('quienAutorizo') quienAutorizo?: string,
    @Query('quienPago') quienPago?: string,
    @Query('busqueda') busqueda?: string,
  ) {
    const dto: ReporteEstadoCuentaDto = reporteEstadoCuentaSchema.parse({
      fechaInicio: fechaInicio ?? '',
      fechaFin: fechaFin ?? '',
      proveedor: proveedor ?? '',
      tipoProveedor: tipoProveedor || undefined,
      categoria: categoria ?? '',
      seccion: seccion ?? '',
      estados: estados ? estados.split(',').map((s) => s.trim()).filter(Boolean) : [],
      urgente: (urgente ?? '') as ReporteEstadoCuentaDto['urgente'],
      quienSolicito: quienSolicito ?? '',
      quienAutorizo: quienAutorizo ?? '',
      quienPago: quienPago ?? '',
      busqueda: busqueda ?? '',
    });
    return this.svc.estadoCuenta(dto);
  }
}
