import { z } from 'zod';

/**
 * Filtros del reporte CxP "Estado de Cuenta" (réplica del reporte HTML de v1,
 * clave 460). A diferencia de v1 (que filtraba fechas/estados/búsqueda en el
 * navegador trayendo TODO), aquí TODO se filtra server-side.
 */
/** Normaliza un query param que puede llegar como string único o array. */
const arrStr = z
  .preprocess(
    (v) => (v == null ? [] : Array.isArray(v) ? v : [v]),
    z.array(z.string().trim().max(200)).default([]),
  );

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
  /** Multi-selección: array vacío = sin filtro. */
  proveedor: arrStr,
  /** Multi-selección de tipos de proveedor ('1','2','3'). */
  tipoProveedor: arrStr,
  /** Multi-selección: array vacío = sin filtro. */
  categoria: arrStr,
  /** Multi-selección: array vacío = sin filtro. */
  seccion: arrStr,
  /** Estados (multi-selección). Query repetido (`?estados=X&estados=Y`). */
  estados: arrStr,
  /** '' = todos, true = urgente, false = no urgente. */
  urgente: z.enum(['', 'true', 'false']).optional(),
  /** Multi-selección: array vacío = sin filtro. */
  quienSolicito: arrStr,
  /** Multi-selección: array vacío = sin filtro. */
  quienAutorizo: arrStr,
  /** Multi-selección: array vacío = sin filtro. */
  quienPago: arrStr,
  /** Búsqueda REAL por folio / concepto / proveedor (corrige el bug de v1). */
  busqueda: z.string().trim().max(200).optional().or(z.literal('')),
});

export type ReporteEstadoCuentaDto = z.infer<typeof reporteEstadoCuentaSchema>;
