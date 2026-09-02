import { z } from 'zod';
import { ESTADOS, TIPOS, URGENCIAS } from './pendientes.types.js';

/**
 * Validación del tablero de pendientes.
 *
 * ⛔ Los enums salen de los catálogos de `pendientes.types.ts`, que a su vez
 * deben coincidir con los CHECK de `dev_pendientes`. Una sola fuente: si se
 * agrega un valor hay que tocar la BD, el catálogo y nada más.
 */

const claves = <T extends Record<string, string>>(cat: T) =>
  Object.keys(cat) as [keyof T & string, ...(keyof T & string)[]];

const tipo = z.enum(claves(TIPOS));
const urgencia = z.enum(claves(URGENCIAS));
const estado = z.enum(claves(ESTADOS));

/** Texto largo opcional: '' del formulario se guarda como NULL, no como cadena vacía. */
const textoLargo = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

/**
 * Alta y edición comparten esquema: lo ÚNICO obligatorio es el título.
 * Capturar tiene que ser barato o los pendientes no se capturan.
 */
export const guardarPendienteSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  titulo: z
    .string()
    .trim()
    .min(1, 'El título es obligatorio.')
    .max(300, 'El título no puede pasar de 300 caracteres.'),
  descripcion: textoLargo(20_000),
  notas: textoLargo(20_000),
  origen: textoLargo(500),
  modulo: textoLargo(120),
  versionResuelto: textoLargo(20),
  tipo: tipo.default('deuda_tecnica'),
  urgencia: urgencia.default('p2'),
  estado: estado.default('propuesto'),
});

/** Atajo desde la propia fila: si mover algo exige abrir un diálogo, nadie lo mueve. */
export const cambiarEstadoSchema = z.object({
  estado,
});

export const listarPendientesSchema = z.object({
  /** Por defecto solo se ve lo vivo; el interruptor trae también lo cerrado. */
  incluirCerrados: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
});

export type GuardarPendienteDto = z.infer<typeof guardarPendienteSchema>;
export type CambiarEstadoDto = z.infer<typeof cambiarEstadoSchema>;
export type ListarPendientesDto = z.infer<typeof listarPendientesSchema>;
