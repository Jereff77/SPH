import { z } from 'zod';

/**
 * Filtros del reporte CxP "Estado de Cuenta" (réplica del reporte HTML de v1,
 * clave 460). A diferencia de v1 (que filtraba fechas/estados/búsqueda en el
 * navegador trayendo TODO), aquí TODO se filtra server-side.
 */
export const reporteEstadoCuentaSchema = z.object({
  /** Rango de fechas sobre `fecSolicitud` (yyyy-MM-dd). */
  fechaInicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inicio inválida (yyyy-MM-dd).')
    .optional()
    .or(z.literal('')),
  fechaFin: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha fin inválida (yyyy-MM-dd).')
    .optional()
    .or(z.literal('')),
  proveedor: z.string().trim().max(200).optional().or(z.literal('')),
  /** 1=Proveedor, 2=Inversionista, 3=Comisionista. */
  tipoProveedor: z.coerce.number().int().optional(),
  categoria: z.string().trim().max(200).optional().or(z.literal('')),
  seccion: z.string().trim().max(200).optional().or(z.literal('')),
  /** Estados (multi-selección). CSV en el query → array. */
  estados: z.array(z.string().trim()).optional().default([]),
  /** '' = todos, true = urgente, false = no urgente. */
  urgente: z.enum(['', 'true', 'false']).optional(),
  quienSolicito: z.string().trim().max(200).optional().or(z.literal('')),
  quienAutorizo: z.string().trim().max(200).optional().or(z.literal('')),
  quienPago: z.string().trim().max(200).optional().or(z.literal('')),
  /** Búsqueda REAL por folio / concepto / proveedor (corrige el bug de v1). */
  busqueda: z.string().trim().max(200).optional().or(z.literal('')),
});

export type ReporteEstadoCuentaDto = z.infer<typeof reporteEstadoCuentaSchema>;
