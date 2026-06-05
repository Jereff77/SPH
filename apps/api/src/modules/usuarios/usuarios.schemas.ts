import { z } from 'zod';

export const statusSchema = z.object({ status: z.boolean() });
export type StatusDto = z.infer<typeof statusSchema>;

export const rcSchema = z.object({ esRC: z.boolean() });
export type RcDto = z.infer<typeof rcSchema>;

export const soporteSchema = z.object({ isSupport: z.boolean() });
export type SoporteDto = z.infer<typeof soporteSchema>;
