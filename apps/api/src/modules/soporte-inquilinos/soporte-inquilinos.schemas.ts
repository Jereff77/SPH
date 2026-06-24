import { z } from 'zod';

/** Estados válidos del pipeline de incidentes (alineado con el CHECK de la BD). */
export const ESTADOS_INCIDENTE = [
  'Nuevo',
  'En Proceso',
  'Resuelto',
  'Detenido',
  'Cerrado',
] as const;

/** Cuerpo de la respuesta por correo (la firma la añade el backend). */
export const responderSchema = z.object({
  body: z.string().trim().min(1, 'El mensaje no puede estar vacío.'),
});
export type ResponderDto = z.infer<typeof responderSchema>;

/** Vínculo manual del incidente con inquilino/nave/parque (que luego "aprende"). */
export const vincularSchema = z.object({
  idArrendador: z.string().uuid().nullable().optional(),
  idNavArrend: z.string().uuid().nullable().optional(),
  idNave: z.string().uuid().nullable().optional(),
  idParque: z.string().uuid().nullable().optional(),
});
export type VincularDto = z.infer<typeof vincularSchema>;

/** Cambio manual de estado del incidente. */
export const cambiarEstadoSchema = z.object({
  estado: z.enum(ESTADOS_INCIDENTE),
});
export type CambiarEstadoDto = z.infer<typeof cambiarEstadoSchema>;

/** Asignación del incidente a un agente (null = sin asignar). */
export const asignarSchema = z.object({
  asignadoA: z.string().uuid().nullable().optional(),
});
export type AsignarDto = z.infer<typeof asignarSchema>;

/** Nota interna del árbol de seguimientos (no se envía al inquilino). */
export const notaSchema = z.object({
  texto: z.string().trim().min(1, 'La nota no puede estar vacía.').max(5000),
});
export type NotaDto = z.infer<typeof notaSchema>;

/** Designar qué cuenta de correo (correo_cuentas) es la de Soporte a Inquilinos. */
export const designarCuentaSchema = z.object({
  idCuenta: z.string().uuid(),
});
export type DesignarCuentaDto = z.infer<typeof designarCuentaSchema>;

// La alta/edición de la cuenta de correo reutiliza el `cuentaSchema` del módulo
// Correo (apps/api/.../correo/correo.schemas.ts) para no divergir del contrato.
