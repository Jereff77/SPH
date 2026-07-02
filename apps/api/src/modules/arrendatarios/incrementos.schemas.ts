import { z } from 'zod';

/**
 * Incrementos de renta por INPC (Arrendatarios). Ver
 * `base-conocimiento/PLAN-incrementos-inpc-automaticos.md`.
 */

/** Vista previa de una captura de INPC: qué planes recibirían incremento. */
export const previewIncrementosSchema = z.object({
  idInpc: z.string().trim().min(1, 'Falta el registro de INPC.').max(60),
});
export type PreviewIncrementosDto = z.infer<typeof previewIncrementosSchema>;

/**
 * Aplicar los incrementos de una captura. `planes` acota a un subconjunto de
 * los aplicables (la selección de la vista previa); el backend SIEMPRE
 * recalcula la clasificación server-side — un plan no aplicable se rechaza
 * aunque venga en la lista.
 */
export const aplicarIncrementosSchema = z.object({
  idInpc: z.string().trim().min(1, 'Falta el registro de INPC.').max(60),
  planes: z.array(z.string().trim().min(1).max(60)).min(1, 'Selecciona al menos un plan.').max(500),
});
export type AplicarIncrementosDto = z.infer<typeof aplicarIncrementosSchema>;

/** Revertir un incremento aplicado (contingencia / corrección). */
export const revertirIncrementoSchema = z.object({
  motivo: z.string().trim().min(5, 'Describe el motivo de la reversión.').max(500),
});
export type RevertirIncrementoDto = z.infer<typeof revertirIncrementoSchema>;
