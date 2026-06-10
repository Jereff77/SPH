import { z } from 'zod';

/** Edición de una solicitud GUARDADA (idEstado=1). No re-sube CFDI (eso es alta). */
export const editarSolicitudSchema = z.object({
  idProveedor: z.string().trim().min(1, 'El proveedor es obligatorio.'),
  nombreProveedor: z.string().trim().max(200).optional().default(''),
  nomCFDI: z.string().trim().max(200).optional().default(''),
  idCategoria: z.string().trim().min(1, 'La cuenta es obligatoria.'),
  concepto: z.string().trim().min(1, 'El concepto es obligatorio.').max(500),
  folio: z.string().trim().max(120).optional().default(''),
  subtotal: z.coerce.number().min(0).default(0),
  total: z.coerce.number().min(0),
  moneda: z.string().trim().max(8).optional().default('MXN'),
  fecCFDI: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (yyyy-MM-dd).')
    .nullable()
    .optional(),
});

export type EditarSolicitudDto = z.infer<typeof editarSolicitudSchema>;

/** Alta de solicitud de pago (CFDI con XML). El resto de datos sale del XML. */
export const crearSolicitudSchema = z.object({
  idCategoria: z.string().trim().min(1, 'La categoría/clasificación es obligatoria.'),
  justificacion: z
    .string()
    .trim()
    .min(20, 'La justificación debe tener al menos 20 caracteres.')
    .max(100, 'La justificación no debe exceder 100 caracteres.'),
});

export type CrearSolicitudDto = z.infer<typeof crearSolicitudSchema>;

// ===================== Tipos de solicitud especiales (sin CFDI normal) =====================
// Reescriben los flujos de FlutterFlow: Urgentes (tipoOperacion=2), Línea de Captura (4),
// Devoluciones (5) y Facturas sin XML (6). Todos capturan el monto manualmente.

/** Campos comunes a los tipos especiales. */
const idProveedor = z.string().trim().min(1, 'El proveedor es obligatorio.');
const idCategoria = z.string().trim().min(1, 'La clasificación es obligatoria.');
const concepto = z
  .string()
  .trim()
  .min(1, 'El concepto es obligatorio.')
  .max(500, 'El concepto no debe exceder 500 caracteres.');
const total = z.coerce
  .number({ invalid_type_error: 'El monto debe ser numérico.' })
  .positive('El monto debe ser mayor a 0.');
const justificacion = z
  .string()
  .trim()
  .min(20, 'La justificación debe tener al menos 20 caracteres.')
  .max(100, 'La justificación no debe exceder 100 caracteres.');
const fechaIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (yyyy-MM-dd).');
/** Booleano que llega como string en multipart ('true'/'false'). */
const boolDesdeForm = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => v === true || v === 'true');

/** Urgentes (tipoOperacion=2): proveedor + concepto + monto, sin archivos. */
export const crearUrgenteSchema = z.object({
  idProveedor,
  idCategoria,
  concepto,
  total,
  justificacion,
});
export type CrearUrgenteDto = z.infer<typeof crearUrgenteSchema>;

/** Línea de Captura (tipoOperacion=4): + línea/referencia/fecha límite + PDF. */
export const crearLineaCapturaSchema = z.object({
  idProveedor,
  idCategoria,
  concepto,
  lineaCaptura: z
    .string()
    .trim()
    .min(1, 'La línea de captura es obligatoria.')
    .max(200),
  referencia: z.string().trim().min(1, 'La referencia es obligatoria.').max(200),
  fechaLimite: fechaIso,
  total,
  pagoInmediato: boolDesdeForm,
  justificacion,
});
export type CrearLineaCapturaDto = z.infer<typeof crearLineaCapturaSchema>;

/** Devoluciones (tipoOperacion=5): la contraparte es un Inversionista/Cliente. */
export const crearDevolucionSchema = z.object({
  idInversionista: z
    .string()
    .trim()
    .min(1, 'El cliente/inversionista es obligatorio.'),
  idCategoria,
  conceptoDevolucion: z
    .string()
    .trim()
    .min(1, 'El concepto de devolución es obligatorio.')
    .max(500),
  total,
  justificacion,
});
export type CrearDevolucionDto = z.infer<typeof crearDevolucionSchema>;

/** Facturas sin XML (tipoOperacion=6): + folio manual, fecha de factura, divisa + PDF. */
export const crearSinXmlSchema = z.object({
  idProveedor,
  idCategoria,
  concepto,
  folio: z.string().trim().min(1, 'El folio/referencia es obligatorio.').max(120),
  fecFactura: fechaIso,
  total,
  moneda: z.enum(['MXN', 'USD', 'EUR']).optional().default('MXN'),
  justificacion,
});
export type CrearSinXmlDto = z.infer<typeof crearSinXmlSchema>;
