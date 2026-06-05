import { z } from 'zod';

// ----- INPC -----
export const inpcCrearSchema = z.object({
  anio: z.number().int().min(2000).max(2100),
  mes: z.number().int().min(1).max(12),
  inpc: z.number(),
  nota: z.string().max(500).optional().default(''),
});
export type InpcCrearDto = z.infer<typeof inpcCrearSchema>;

export const inpcEditarSchema = z.object({
  inpc: z.number(),
  nota: z.string().max(500).optional().default(''),
});
export type InpcEditarDto = z.infer<typeof inpcEditarSchema>;

// ----- Cuentas (PresCategorias) -----
export const cuentaCrearSchema = z.object({
  idCategoria: z.string().trim().min(1, 'El ID es obligatorio').max(50),
  cuenta: z.string().trim().min(1, 'La cuenta es obligatoria').max(200),
  seccion: z.string().trim().max(200).optional().default(''),
  descripcion: z.string().trim().max(500).optional().default(''),
  uidResponsable: z.string().uuid('Responsable inválido'),
});
export type CuentaCrearDto = z.infer<typeof cuentaCrearSchema>;

export const cuentaEditarSchema = z.object({
  cuenta: z.string().trim().min(1).max(200),
  seccion: z.string().trim().max(200).optional().default(''),
  descripcion: z.string().trim().max(500).optional().default(''),
  uidResponsable: z.string().uuid(),
});
export type CuentaEditarDto = z.infer<typeof cuentaEditarSchema>;

/** Cambiar responsable de una cuenta (inline). */
export const responsableSchema = z.object({
  uidResponsable: z.string().uuid('Responsable inválido'),
});
export type ResponsableDto = z.infer<typeof responsableSchema>;

/** Toggle booleano (presupuestable / status). */
export const valorBoolSchema = z.object({ valor: z.boolean() });
export type ValorBoolDto = z.infer<typeof valorBoolSchema>;

/** Guardar el presupuesto mensual completo (12 meses) de una cuenta. */
export const guardarMensualSchema = z.object({
  idPresupuesto: z.string().uuid(),
  meses: z
    .array(
      z.object({
        mes: z.number().int().min(1).max(12),
        monto: z.number(),
      }),
    )
    .length(12, 'Se requieren los 12 meses'),
});
export type GuardarMensualDto = z.infer<typeof guardarMensualSchema>;

// ----- Fechas CxP (cxp_fechas_habilitadas) -----
export const fechaCxpCrearSchema = z.object({
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)'),
  cfdi: z.boolean().optional().default(false),
  autorizar: z.boolean().optional().default(true),
});
export type FechaCxpCrearDto = z.infer<typeof fechaCxpCrearSchema>;

export const fechaCxpToggleSchema = z
  .object({
    cfdi: z.boolean().optional(),
    autorizar: z.boolean().optional(),
  })
  .refine((d) => d.cfdi !== undefined || d.autorizar !== undefined, {
    message: 'Indica al menos un campo (cfdi o autorizar).',
  });
export type FechaCxpToggleDto = z.infer<typeof fechaCxpToggleSchema>;
