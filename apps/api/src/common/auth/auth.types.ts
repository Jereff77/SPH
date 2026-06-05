import type { Request } from 'express';

/** Identidad derivada del JWT verificado (nunca de datos enviados por el cliente). */
export interface AuthUser {
  uid: string;
  email: string | null;
  role: string;
}

/** Request de Express con el usuario autenticado adjunto por JwtAuthGuard. */
export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
