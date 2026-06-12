/** Una sesión de chat (hilo) para el listado de auditoría. */
export interface SesionAdmin {
  uuid: string;
  uidUsuario: string;
  usuario: string;
  correo: string | null;
  titulo: string | null;
  fc: string;
  activa: boolean;
  mensajes: number;
  ultimaActividad: string | null;
  tieneEscalacion: boolean;
}

/** Un par pregunta/respuesta dentro de una conversación. */
export interface MensajeAdmin {
  uuid: string;
  pregunta: string;
  respuesta: string;
  escalable: boolean;
  modulos: string[];
  ruta: string | null;
  tokensEntrada: number | null;
  tokensSalida: number | null;
  fc: string;
}

/** Conversación completa (cabecera + mensajes). */
export interface ConversacionAdmin {
  sesion: {
    uuid: string;
    uidUsuario: string;
    usuario: string;
    correo: string | null;
    titulo: string | null;
    fc: string;
    activa: boolean;
  };
  mensajes: MensajeAdmin[];
}

export type EstadoTicket = 'abierto' | 'en_proceso' | 'cerrado';

/** Un ticket de soporte enriquecido para la bandeja de atención. */
export interface TicketAdmin {
  uuid: string;
  uidUsuario: string;
  usuario: string;
  correo: string | null;
  sessionId: string | null;
  modulo: string | null;
  ruta: string | null;
  asunto: string;
  resumen: string;
  estado: EstadoTicket;
  fc: string;
  fum: string | null;
  atendidoPor: string | null;
  atendidoPorNombre: string | null;
}
