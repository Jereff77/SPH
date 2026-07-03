import { api } from '@/lib/api';

export interface SolicitudAprobar {
  idCxp: string;
  folio: string | null;
  nomCFDI: string | null;
  fecCFDI: string | null;
  idEstado: number | null;
  estado: string | null;
  idProveedor: string;
  nombreProveedor: string | null;
  concepto: string | null;
  ultimoComentario: string | null;
  subtotal: number | null;
  total: number;
  idCategoria: string;
  urlCFDI: string | null;
  urlXLM: string | null;
  autorizadoFP: boolean | null;
  // Enriquecidos
  cuenta: string | null;
  seccion: string | null;
  justificacion: string | null;
  solicitadoPor: string | null;
}

export interface PresupuestoAprobacion {
  idCategoria: string;
  subtotal: number;
  presupuestable: boolean;
  presupuestoAcumulado: number;
  subtotalGastado: number;
  subtotalComprometido: number;
  totalGastadoComprometido: number;
  avanceTotal: number;
  dentroPresupuesto: boolean;
  gasto: number;
  fuera: boolean;
  esAprobadorFP: boolean;
  puedeReasignar: boolean;
  hayAprobadorFP: boolean;
}

export interface ResultadoAprobacion {
  autorizado: boolean;
  mensaje: string;
}

export const aprobarApi = {
  listar: (idEstado: number) =>
    api.get<SolicitudAprobar[]>(`/cxp/aprobar?idEstado=${idEstado}`),
  presupuesto: (idCxp: string) =>
    api.get<PresupuestoAprobacion>(`/cxp/aprobar/${idCxp}/presupuesto`),
  regresar: (idCxp: string, comentario: string) =>
    api.post<{ ok: true }>(`/cxp/aprobar/${idCxp}/regresar`, { comentario }),
  rechazar: (idCxp: string, comentario: string) =>
    api.post<{ ok: true }>(`/cxp/aprobar/${idCxp}/rechazar`, { comentario }),
  aprobar: (idCxp: string, comentario: string) =>
    api.post<ResultadoAprobacion>(`/cxp/aprobar/${idCxp}/aprobar`, { comentario }),
  fueraPresupuesto: (idCxp: string) =>
    api.post<{ ok: true }>(`/cxp/aprobar/${idCxp}/fuera-presupuesto`),
  conteoPendientes: () =>
    api.get<{ total: number }>('/cxp/aprobar/pendientes/conteo'),
};

/** Estados visibles/filtrables en la bandeja de aprobación. */
export const ESTADOS_APROBAR = [
  { value: 2, label: 'Enviado' },
  { value: 3, label: 'Rechazado' },
  { value: 4, label: 'Aprobado' },
];
