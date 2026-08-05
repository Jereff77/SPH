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
  /** Razonamiento del agente: SQL generado y traza de herramientas (auditoría). */
  debugSql: string | null;
  debugMeta: { traza?: TrazaPaso[] } | null;
  /** URL firmada temporal de la captura de pantalla adjunta (si el turno llevó). */
  capturaUrl: string | null;
}

/** Un paso de la traza del agente: su razonamiento o una herramienta ejecutada. */
export interface TrazaPaso {
  iter: number;
  tipo?: 'pensamiento' | 'herramienta' | 'lectura_pantalla' | 'tope' | 'razonamiento_final';
  /** Razonamiento del modelo (cuando tipo = 'pensamiento'). */
  texto?: string;
  /** Herramienta ejecutada (cuando tipo = 'herramienta'). */
  tool?: string;
  args?: Record<string, unknown>;
  error?: string | null;
  total_filas?: number | null;
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

/** Una solicitud incluida en un correo de recordatorio (detalle). */
export interface SolicitudRecordatorio {
  idCxp: string;
  proveedor: string;
  total: number;
  moneda: string;
  folio: string;
}

/** Renglón del listado de recordatorios de aprobación enviados (sin el HTML). */
export interface RecordatorioEnviado {
  id: number;
  enviadoEn: string;
  uidAprobador: string;
  email: string;
  nombre: string | null;
  numPendientes: number;
  estado: 'enviado' | 'fallido';
}

/** Detalle de un recordatorio (incluye el HTML enviado y las solicitudes). */
export interface RecordatorioEnviadoDetalle extends RecordatorioEnviado {
  asunto: string;
  html: string;
  solicitudes: SolicitudRecordatorio[];
  error: string | null;
}

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

/** Configuración + capacidades del agente (GET /soporte/admin/agente). */
export interface ConfigAgente {
  modelo: string;
  modeloDefault: string;
  prompt: string;
  herramientas: { nombre: string; descripcion: string }[];
  capacidades: { nombre: string; descripcion: string }[];
}
