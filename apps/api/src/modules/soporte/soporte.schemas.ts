import { z } from 'zod';

/** Pregunta al agente de soporte. La sesión es opcional: si falta, se crea una. */
export const mensajeSchema = z.object({
  sessionId: z.string().trim().uuid().optional(),
  texto: z.string().trim().min(1, 'Escribe tu pregunta.').max(4000),
  // Ruta/pantalla actual del usuario (contexto para el RAG). Cosmética, no de confianza.
  rutaActual: z.string().trim().max(300).optional(),
  // Captura de pantalla adjunta (data URL JPEG generado por el widget, ≤1024px).
  // Va inline al modelo y NO se persiste. Tope 1.5 MB de data URL (≈1.1 MB de imagen).
  captura: z
    .string()
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/, 'Captura inválida.')
    .max(1_500_000)
    .optional(),
  // Habilita que el MODELO pueda pedir una captura (tool `request_screenshot`).
  // El widget manda false en el reenvío automático que ya trae la captura (anti-bucle).
  permitirCaptura: z.boolean().optional(),
  // Últimos errores de respuesta del API vistos en el navegador (contexto del turno).
  // Los produce nuestro propio backend (ya saneados); solo se acota forma/tamaño.
  erroresRecientes: z
    .array(
      z.object({
        metodo: z.string().trim().max(10),
        ruta: z.string().trim().max(300),
        status: z.number().int().min(100).max(599),
        mensaje: z.string().trim().max(300),
        fc: z.string().trim().max(40),
      }),
    )
    .max(3)
    .optional(),
});
export type MensajeDto = z.infer<typeof mensajeSchema>;

export const renombrarSchema = z.object({
  titulo: z.string().trim().min(1).max(120),
});
export type RenombrarDto = z.infer<typeof renombrarSchema>;

/** Confirmación de escalación a ticket (el usuario revisó el resumen propuesto). */
export const escalarSchema = z.object({
  sessionId: z.string().trim().uuid(),
  asunto: z.string().trim().min(3).max(160),
  resumen: z.string().trim().min(10).max(4000),
  modulo: z.string().trim().max(80).optional(),
  rutaActual: z.string().trim().max(300).optional(),
});
export type EscalarDto = z.infer<typeof escalarSchema>;

/** Solicita a la IA que redacte (asunto + resumen) un ticket desde la conversación. */
export const proponerTicketSchema = z.object({
  sessionId: z.string().trim().uuid(),
  rutaActual: z.string().trim().max(300).optional(),
});
export type ProponerTicketDto = z.infer<typeof proponerTicketSchema>;

/** Atención de un ticket por soporte: cambio de estado (bandeja de tickets). */
export const atenderTicketSchema = z.object({
  estado: z.enum(['abierto', 'en_proceso', 'cerrado']),
});
export type AtenderTicketDto = z.infer<typeof atenderTicketSchema>;

/** Configuración del agente (pestaña "Agente de Soporte", solo soporte). */
export const configAgenteSchema = z
  .object({
    // Slug de OpenRouter, p. ej. "anthropic/claude-sonnet-5". Debe soportar tools
    // (consultar_datos) y visión (captura de pantalla).
    modelo: z
      .string()
      .trim()
      .regex(/^[\w.-]+\/[\w.:-]+$/, 'Slug de modelo inválido (formato autor/modelo).')
      .max(120)
      .optional(),
    prompt: z.string().trim().min(20).max(6000).optional(),
  })
  .refine((v) => v.modelo !== undefined || v.prompt !== undefined, {
    message: 'Nada que actualizar.',
  });
export type ConfigAgenteDto = z.infer<typeof configAgenteSchema>;
