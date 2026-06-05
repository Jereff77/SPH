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
