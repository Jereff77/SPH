import { z } from 'zod';

/**
 * Esquemas de validación (Zod) del módulo Fideicomiso. Toda entrada del cliente
 * se valida en el backend antes de tocar la BD (regla de frontera de confianza).
 */

const anioActual = new Date().getFullYear();

/** Año contable: obligatorio y en rango razonable (sin el default 2026 de v1). */
export const anioSchema = z.coerce
  .number()
  .int()
  .min(2000, 'Año fuera de rango.')
  .max(anioActual + 5, 'Año fuera de rango.');

const mesSchema = z.coerce.number().int().min(1, 'Mes inválido.').max(12, 'Mes inválido.');

/**
 * Subconcepto/descripción: el front envía '-' cuando están vacíos (igual que v1,
 * que almacena '-' para los huecos). Aquí se exige no vacío para que la clave de
 * localización del registro sea consistente con la agregación del pivote.
 */
const subDesc = z.string().trim().min(1, 'Valor requerido.');

/** Clave que identifica una celda/registro de contabilidad (tipo→…→mes/año). */
const claveCelda = {
  anio: anioSchema,
  mes: mesSchema,
  tipo: z.string().trim().min(1, 'Falta el tipo.'),
  concepto: z.string().trim().min(1, 'Falta el concepto.'),
  subconcepto: subDesc,
  descripcion: subDesc,
};

/**
 * Alta/edición de un movimiento de contabilidad (`fideContabilidad`) desde el
 * modal "Nuevo". `reemplazar` permite sobrescribir un registro existente (la
 * confirmación que en v1 era un `confirm()` del navegador).
 */
export const movimientoContaSchema = z.object({
  ...claveCelda,
  monto: z.coerce.number().finite('Monto inválido.'),
  aplicaIVA: z.coerce.boolean().optional().default(false),
  notas: z.string().trim().optional(),
  reemplazar: z.coerce.boolean().optional().default(false),
});
export type MovimientoContaDto = z.infer<typeof movimientoContaSchema>;

/**
 * Edición inline de una celda (mes) de la tabla pivote. `aplicaIVA` es opcional:
 * el front envía el IVA de la fila para que, al crear una celda nueva en un mes
 * sin registro, herede el mismo IVA del concepto y la fila del pivote no se parta.
 */
export const celdaSchema = z.object({
  ...claveCelda,
  monto: z.coerce.number().finite('Monto inválido.'),
  aplicaIVA: z.coerce.boolean().optional(),
});
export type CeldaDto = z.infer<typeof celdaSchema>;

/** Toggle de "Aplica IVA" de una celda/registro. */
export const ivaSchema = z.object({
  ...claveCelda,
  aplicaIVA: z.coerce.boolean(),
});
export type IvaDto = z.infer<typeof ivaSchema>;

/** Saldo del estado de cuenta (banco) de un mes. */
export const saldoSchema = z.object({
  anio: anioSchema,
  mes: mesSchema,
  saldo: z.coerce.number().finite('Saldo inválido.'),
});
export type SaldoDto = z.infer<typeof saldoSchema>;

// ===================== Configuración del propietario (engrane ⚙️) =====================

const FECHA_ISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (yyyy-MM-dd).');

/**
 * Condiciones del fideicomiso de una propiedad (`fideCondiciones`). Si llega
 * `idfideCond` se actualiza; si no, se crea. Rendimiento 1–12 (regla de v1),
 * apartado numérico ≥ 0.
 */
export const condicionesSchema = z.object({
  idPropiedad: z.string().trim().min(1, 'Falta la propiedad.'),
  idfideCond: z.string().trim().optional(),
  noAdhesion: z.string().trim().min(1, 'Falta el número de adhesión.'),
  pm: z.string().trim().min(1, 'Falta el PM.'),
  medio: z.string().trim().min(1, 'Falta el medio.'),
  apartado: z.coerce.number().min(0, 'Apartado inválido.'),
  rendimiento: z.coerce
    .number()
    .min(1, 'El rendimiento debe estar entre 1 y 12.')
    .max(12, 'El rendimiento debe estar entre 1 y 12.'),
  prom9: z.coerce.boolean().optional().default(false),
  comentarios: z.string().trim().optional(),
});
export type CondicionesDto = z.infer<typeof condicionesSchema>;

/** Alta de nave + propiedad (ticket) desde la pestaña Propiedades. */
export const naveTicketSchema = z.object({
  idInversionista: z.string().trim().min(1, 'Falta el inversionista.'),
  idParque: z.string().trim().min(1, 'Falta el parque.'),
  nave: z.enum(['A', 'B', 'C', 'D', 'E']),
  id: z.enum(['1', '2', '3', '4']),
});
export type NaveTicketDto = z.infer<typeof naveTicketSchema>;

/** Generación del Plan de Pagos (PDP) de un ticket. */
export const crearPdpSchema = z.object({
  idPropiedad: z.string().trim().min(1, 'Falta la propiedad.'),
  fecha: FECHA_ISO,
  cantPagos: z.coerce.number().int().min(1, 'Cantidad de pagos inválida.').max(360),
  valTicket: z.coerce.number().positive('El valor del ticket debe ser mayor a 0.'),
});
export type CrearPdpDto = z.infer<typeof crearPdpSchema>;

/** Edición del monto de una partida del PDP. */
export const montoPartidaSchema = z.object({
  monto: z.coerce.number().positive('El monto debe ser mayor a 0.'),
});
export type MontoPartidaDto = z.infer<typeof montoPartidaSchema>;

/** Edición del tipo de pago de una partida (producto=Fideicomiso). */
export const tipoPartidaSchema = z.object({
  tipoPago: z.enum(['Enganche', 'Parcialidad', 'Escrituracion']),
});
export type TipoPartidaDto = z.infer<typeof tipoPartidaSchema>;

/** Alta de un concepto del catálogo (`fideContaConceptos`). */
export const conceptoSchema = z.object({
  tipo: z.string().trim().min(1, 'Falta el tipo.'),
  concepto: z.string().trim().min(1, 'Falta el concepto.'),
  subconcepto: z.string().trim().optional(),
  descripcion: z.string().trim().optional(),
  aplicaIVA: z.coerce.boolean().optional().default(false),
  ordenTipo: z.coerce.number().int().min(0).max(999).optional().default(99),
  ordenConcepto: z.coerce.number().int().min(0).max(999).optional().default(99),
});
export type ConceptoDto = z.infer<typeof conceptoSchema>;
