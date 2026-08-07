import { z } from 'zod';

/**
 * Validación de la administración de KVA's.
 *
 * Nomenclatura del negocio (ver `base-conocimiento/PLAN-administracion-kvas.md`):
 *   nivel  → MT = media tensión · BT = baja tensión (dos bolsas INDEPENDIENTES,
 *            cada una negociada por separado con CFE).
 *   figura → VENTA (el KVA se va con la nave; solo regresa al parque con una
 *            devolución acreditada) · RENTA (regresa al cerrar el vínculo).
 *   etapa  → POR_ASIGNAR · COMPROMETIDO · ASIGNADO (ya hay contrato con CFE).
 */
export const NIVELES = ['MT', 'BT'] as const;
export const FIGURAS = ['VENTA', 'RENTA'] as const;
export const ETAPAS = ['POR_ASIGNAR', 'COMPROMETIDO', 'ASIGNADO'] as const;

/** Cantidad de KVA: admite decimales (el control real usa .5). */
const cantidadKva = z.coerce.number().min(0).max(1_000_000);

export const crearAsignacionSchema = z
  .object({
    idNave: z.string().trim().min(1, 'La nave es obligatoria.').max(40),
    nivel: z.enum(NIVELES),
    figura: z.enum(FIGURAS),
    etapa: z.enum(ETAPAS).default('POR_ASIGNAR'),
    cantKvas: cantidadKva.refine((v) => v > 0, 'La cantidad debe ser mayor a 0.'),
    contratoCfe: z.string().trim().max(80).optional().nullable(),
    fechaContratoCfe: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (yyyy-MM-dd).')
      .optional()
      .nullable(),
    idPropiedad: z.string().trim().max(40).optional().nullable(),
    idNavArrend: z.string().trim().max(40).optional().nullable(),
  })
  // La etapa ASIGNADO significa "ya hay contrato con CFE": exigir el dato que
  // la hace real evita que el tablero muestre trámites cerrados sin respaldo.
  .refine((d) => d.etapa !== 'ASIGNADO' || !!d.contratoCfe, {
    message: 'Para marcar «Asignado» hay que capturar el contrato de CFE.',
    path: ['contratoCfe'],
  });

export const editarAsignacionSchema = z
  .object({
    nivel: z.enum(NIVELES),
    figura: z.enum(FIGURAS),
    etapa: z.enum(ETAPAS),
    cantKvas: cantidadKva,
    contratoCfe: z.string().trim().max(80).optional().nullable(),
    fechaContratoCfe: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (yyyy-MM-dd).')
      .optional()
      .nullable(),
    idPropiedad: z.string().trim().max(40).optional().nullable(),
    idNavArrend: z.string().trim().max(40).optional().nullable(),
  })
  .refine((d) => d.etapa !== 'ASIGNADO' || !!d.contratoCfe, {
    message: 'Para marcar «Asignado» hay que capturar el contrato de CFE.',
    path: ['contratoCfe'],
  });

export const cancelarAsignacionSchema = z.object({
  motivo: z.string().trim().min(1, 'El motivo es obligatorio.').max(400),
});

/** Devolución de KVA vendidos (el documento va aparte, como archivo). */
export const devolucionSchema = z.object({
  cantidad: cantidadKva.refine((v) => v > 0, 'La cantidad debe ser mayor a 0.'),
  fechaDevolucion: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (yyyy-MM-dd).'),
  documento: z
    .string()
    .trim()
    .min(1, 'Captura el folio o número del documento.')
    .max(120),
  observaciones: z.string().trim().max(400).optional().nullable(),
});

/**
 * Documento del expediente de KVA de una nave (contrato, carta de compra de
 * KVA…). Sin catálogo de tipos por decisión de Jereff: título y descripción
 * libres, igual que el resto de los `*_docs` del ERP.
 */
export const documentoNaveSchema = z.object({
  titulo: z.string().trim().min(1, 'El título es obligatorio.').max(150),
  descripcion: z.string().trim().max(600).optional().nullable(),
});

export const bajaDocumentoSchema = z.object({
  motivo: z.string().trim().min(1, 'El motivo es obligatorio.').max(400),
});

export const acometidaSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio.').max(150),
  tensionKv: z.coerce.number().min(0).max(1000).optional().nullable(),
  capacidadMt: cantidadKva.default(0),
  capacidadBt: cantidadKva.default(0),
  folioCfe: z.string().trim().max(80).optional().nullable(),
  notas: z.string().trim().max(400).optional().nullable(),
});

export type CrearAsignacionDto = z.infer<typeof crearAsignacionSchema>;
export type EditarAsignacionDto = z.infer<typeof editarAsignacionSchema>;
export type CancelarAsignacionDto = z.infer<typeof cancelarAsignacionSchema>;
export type DevolucionDto = z.infer<typeof devolucionSchema>;
export type DocumentoNaveDto = z.infer<typeof documentoNaveSchema>;
export type BajaDocumentoDto = z.infer<typeof bajaDocumentoSchema>;
export type AcometidaDto = z.infer<typeof acometidaSchema>;
