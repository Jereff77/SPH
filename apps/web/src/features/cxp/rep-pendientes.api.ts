import { api } from '@/lib/api';

/** Nivel del REP de una parcialidad (mismo vocabulario que el backend). */
export type RepNivel =
  | 'ninguno'
  | 'pendiente'
  | 'vencido_proveedor'
  | 'vencido_usuario';

export interface RepPendiente {
  idCxp: string;
  idProveedor: string | null;
  nombreProveedor: string;
  folio: string;
  monto: number;
  fecPago: string;
  uidr: string | null;
  autorizo: string | null;
  nivel: RepNivel;
  /** Días naturales para el bloqueo del proveedor (0 = hoy, negativo = vencido). */
  diasBloqueoProveedor: number;
  diasBloqueoUsuario: number;
}

export interface MisRepResumen {
  total: number;
  comoSolicitante: number;
  comoAutorizador: number;
  vencidas: number;
  venceManana: number;
  /** Días para que se bloquee MI acceso a solicitudes; null si no aplica. */
  diasParaMiBloqueo: number | null;
}

export interface MisRepRespuesta {
  filas: RepPendiente[];
  resumen: MisRepResumen;
  config: { diaBloqueoProveedor: number; diaBloqueoUsuario: number };
}

/**
 * Complementos de pago (REP) pendientes DEL USUARIO en sesión: los que solicitó
 * y los que autorizó. El backend filtra por el uid del JWT — aquí no se manda
 * ningún identificador.
 */
export const misRepApi = {
  listar: () => api.get<MisRepRespuesta>('/cxp/mis-rep'),
};
