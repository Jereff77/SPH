import { z } from 'zod';

/** Documentos de KVA's · Fase 2 (vista previa). Todo `.strict()`; el cliente solo manda ids y cantidades. */

/** Ids de la BD: solo letras, dígitos, guion y guion bajo (B-3: nada que altere un filtro `.in()`). */
const idTexto = z.string().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Identificador inválido.');

const cantidadKva = z
  .number()
  .finite()
  .gt(0)
  .max(100_000)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Máximo 2 decimales.');

const kvaNivel = z
  .object({ nivel: z.enum(['BT', 'MT']), cantidad: cantidadKva })
  .strict();

const naveEntrada = z
  .object({
    idNave: idTexto,
    kvas: z
      .array(kvaNivel)
      .min(1)
      .max(2)
      .refine((a) => new Set(a.map((k) => k.nivel)).size === a.length, 'Niveles repetidos.'),
  })
  .strict();

export const vistaPreviaSchema = z
  .object({
    idPlantilla: z.string().uuid('Identificador de plantilla inválido.'),
    idInversionista: idTexto,
    naves: z
      .array(naveEntrada)
      .min(1)
      .max(200)
      .refine((a) => new Set(a.map((n) => n.idNave)).size === a.length, 'Nave repetida.'),
  })
  .strict();
export type VistaPreviaDto = z.infer<typeof vistaPreviaSchema>;

export const idInversionistaSchema = idTexto;
export const idNaveSchema = idTexto;
