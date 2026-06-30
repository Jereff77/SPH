import { api } from '@/lib/api';
import type { ConceptoCfdi, ComentarioCxP } from './solicitudes.api';

/** Saldo de una factura PPD (todo en su moneda). */
export interface SaldoPpd {
  total: number;
  solicitado: number; // comprometido (parciales no rechazadas)
  pagado: number; // realmente pagado (idEstado 6/7)
  disponible: number; // total − solicitado
}

/** Fila del estado de cuenta (una factura PPD). */
export interface FacturaPpd {
  idCxpPPD: string;
  folio: string;
  idProveedor: string | null;
  nombreProveedor: string | null;
  nomCFDI: string;
  concepto: string | null;
  total: number | null;
  subtotal: number | null;
  fecCFDI: string | null;
  fecInicio: string;
  fecSolicitud: string | null;
  idCategoria: string;
  moneda: string;
  solicitado: number;
  pagado: number;
  disponible: number;
  numParcialidades: number;
  avance: number; // % pagado del total
  repNivel: RepNivel; // estado del REP de la factura (nivel "peor" de sus parcialidades)
}

/**
 * Nivel del Complemento de Pago (REP) de una parcialidad/factura, anclado a
 * fechas de calendario del mes de pago:
 *  - 'pendiente' → ámbar: pagada sin REP, aún en plazo.
 *  - 'vencido_proveedor' → rojo tenue (rosado): venció el día 6 del mes
 *    siguiente; el proveedor queda bloqueado.
 *  - 'vencido_usuario' → rojo fuerte: venció el día 21; el usuario queda
 *    bloqueado para cualquier solicitud.
 */
export type RepNivel =
  | 'ninguno'
  | 'pendiente'
  | 'vencido_proveedor'
  | 'vencido_usuario';

/** Una solicitud parcial (abono) de una factura PPD. */
export interface ParcialidadPpd {
  idCxp: string;
  total: number;
  montoAplicado: number;
  idEstado: number | null;
  estado: string | null;
  moneda: string;
  fecSolicitud: string | null;
  fecPago: string | null;
  idCategoria: string;
  ultimoComentario: string | null;
  nomGerente: string | null;
  categoria: string | null;
  clasificacion: string | null;
  // Estado del Complemento de Pago (REP):
  uuidComplemento: string | null;
  fecComplemento: string | null;
  urlComplementoXml: string | null; // URL firmada (1 h) o null
  urlComplementoPdf: string | null;
  repPendiente: boolean; // pagada, sin REP y sin dispensa
  repNivel: RepNivel; // nivel por fechas (ámbar / rosado / rojo)
  diasDesdePago: number | null;
  // Dispensa por excepción:
  complementoExento: boolean;
  complementoExentoMotivo: string | null;
  fecComplementoExento: string | null;
  dispensadoPorNombre: string | null;
  tieneRespuestaGerente: boolean; // hay comentario del aprobador (rechazo/regreso)
}

export interface DetallePpd {
  maestro: {
    idCxpPPD: string;
    folio: string;
    idProveedor: string | null;
    nombreProveedor: string | null;
    nomCFDI: string;
    concepto: string | null;
    total: number | null;
    subtotal: number | null;
    fecCFDI: string | null;
    fecInicio: string;
    fecSolicitud: string | null;
    idCategoria: string;
    urlCFDI: string | null;
    urlXLM: string | null;
    categoria: string | null;
    clasificacion: string | null;
  };
  saldo: SaldoPpd;
  parcialidades: ParcialidadPpd[];
}

/** Resultado del análisis del CFDI PPD (XML + PDF). */
export interface AnalisisPpd {
  proveedor: { idProveedor: string; razonSocial: string | null; rfc: string | null };
  yaRegistrada: boolean;
  idCxpPPD: string | null;
  saldo: SaldoPpd | null;
  cfdi: {
    uuid: string | null;
    folio: string | null;
    fechaCFDI: string;
    emisorRfc: string;
    emisorNombre: string;
    receptorRfc: string;
    moneda: string;
    metodoPago: string | null;
    subtotal: number;
    total: number;
    conceptoResumen: string;
    conceptos: ConceptoCfdi[];
    impuestos: { traslIVA: number; retIVA: number; retISR: number };
  };
}

export const ppdApi = {
  /** Estado de cuenta: facturas PPD con sus saldos. */
  listar: () => api.get<FacturaPpd[]>('/cxp/ppd'),
  /** Detalle de una factura PPD + sus parcialidades. */
  detalle: (idCxpPPD: string) => api.get<DetallePpd>(`/cxp/ppd/${idCxpPPD}`),
  /** Hilo de comentarios de una parcialidad PPD (motivos de rechazo/regreso). */
  comentarios: (idCxp: string) =>
    api.get<ComentarioCxP[]>(`/cxp/ppd/parcial/${idCxp}/comentarios`),
  /** Analiza el CFDI PPD (XML + PDF). */
  analizar: (xml: File, pdf: File) => {
    const fd = new FormData();
    fd.append('xml', xml);
    fd.append('pdf', pdf);
    return api.postForm<AnalisisPpd>('/cxp/ppd/analizar', fd);
  },
  /** Registra la factura PPD + su primera solicitud parcial. */
  crear: (
    xml: File,
    pdf: File,
    dto: { idCategoria: string; justificacion: string; monto: number },
  ) => {
    const fd = new FormData();
    fd.append('xml', xml);
    fd.append('pdf', pdf);
    fd.append('idCategoria', dto.idCategoria);
    fd.append('justificacion', dto.justificacion);
    fd.append('monto', String(dto.monto));
    return api.postForm<{ idCxpPPD: string; idCxp: string }>('/cxp/ppd', fd);
  },
  /** Nueva solicitud parcial sobre una factura PPD existente. */
  nuevaParcial: (
    idCxpPPD: string,
    dto: { idCategoria: string; justificacion: string; monto: number },
  ) => api.post<{ idCxp: string }>(`/cxp/ppd/${idCxpPPD}/parcial`, dto),
  /** Sube el Complemento de Pago (REP) de una parcialidad pagada. */
  subirComplemento: (idCxp: string, xml: File, pdf: File | null) => {
    const fd = new FormData();
    fd.append('xml', xml);
    if (pdf) fd.append('pdf', pdf);
    return api.postForm<{ uuid: string }>(`/cxp/ppd/parcial/${idCxp}/complemento`, fd);
  },
  /** Dispensa el complemento de una parcialidad por excepción (permiso 403). */
  dispensarComplemento: (idCxp: string, motivo: string) =>
    api.post<{ ok: true }>(`/cxp/ppd/parcial/${idCxp}/dispensar-complemento`, { motivo }),
};
