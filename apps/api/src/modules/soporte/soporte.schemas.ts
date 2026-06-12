import { z } from 'zod';

/** Pregunta al agente de soporte. La sesión es opcional: si falta, se crea una. */
export const mensajeSchema = z.object({
  sessionId: z.string().trim().uuid().optional(),
  texto: z.string().trim().min(1, 'Escribe tu pregunta.').max(4000),
  // Ruta/pantalla actual del usuario (contexto para el RAG). Cosmética, no de confianza.
  rutaActual: z.string().trim().max(300).optional(),
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
