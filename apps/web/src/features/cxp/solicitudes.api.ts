import { api } from '@/lib/api';

export interface SolicitudCxP {
  idCxp: string;
  folio: string | null;
  idProveedor: string;
  nombreProveedor: string | null;
  nomCFDI: string | null;
  concepto: string | null;
  idCategoria: string;
  idEstado: number | null;
  tipoOperacion: number;
  esUrgente: boolean;
  diferido: boolean;
  subtotal: number | null;
  total: number;
  moneda: string;
  fecCFDI: string | null;
  fecSolicitud: string | null;
  rangoSemana: string | null;
  urlCFDI: string | null;
  urlXLM: string | null;
  // Enriquecidos por el backend:
  categoria: string | null; // cuenta de PresCategorias
  clasificacion: string | null; // sección de PresCategorias
  justificacion: string | null; // primer comentario
  asignadoA: string | null; // responsable/aprobador
}

/** Etiqueta + color de cada estatus (idEstado), del catálogo real de la BD. */
export const ESTADOS_CXP: Record<number, { etiqueta: string; clase: string }> = {
  1: { etiqueta: 'Guardado', clase: 'bg-gray-200 text-gray-700' },
  2: { etiqueta: 'Enviado', clase: 'bg-blue-100 text-blue-700' },
  3: { etiqueta: 'Rechazado', clase: 'bg-red-100 text-red-700' },
  4: { etiqueta: 'Aprobado', clase: 'bg-[#90BF32]/30 text-[#3f5b1a]' },
  5: { etiqueta: 'Reprogramado', clase: 'bg-orange-100 text-orange-700' },
  6: { etiqueta: 'Pagado', clase: 'bg-green-100 text-green-700' },
  7: { etiqueta: 'Pago T. Bancaria', clase: 'bg-teal-100 text-teal-700' },
  99: { etiqueta: 'Aprob. sin pago', clase: 'bg-purple-100 text-purple-700' },
};

export interface CatalogoProveedor {
  idProveedor: string;
  razonSocial: string;
  tipoCuenta: string;
}
export interface CatalogoCategoria {
  idCategoria: string;
  cuenta: string | null;
  seccion: string | null;
}
export interface Catalogos {
  proveedores: CatalogoProveedor[];
  categorias: CatalogoCategoria[];
}

export interface EditarSolicitudDto {
  idProveedor: string;
  nombreProveedor: string;
  nomCFDI: string;
  idCategoria: string;
  concepto: string;
  folio: string;
  subtotal: number;
  total: number;
  moneda: string;
  fecCFDI: string | null;
}

export interface ConceptoCfdi {
  claveProdServ: string;
  descripcion: string;
  importe: number;
}

/** Resultado del análisis del CFDI (XML + PDF) antes de crear la solicitud. */
export interface CfdiAnalisis {
  proveedor: {
    idProveedor: string;
    razonSocial: string | null;
    rfc: string | null;
  };
  totalEsperado: number;
  cfdi: {
    uuid: string | null;
    folio: string | null;
    fechaCFDI: string;
    emisorRfc: string;
    emisorNombre: string;
    emisorRegimen: string;
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

export const solicitudesApi = {
  semanas: () => api.get<string[]>('/cxp/solicitudes/semanas'),
  analizar: (xml: File, pdf: File) => {
    const fd = new FormData();
    fd.append('xml', xml);
    fd.append('pdf', pdf);
    return api.postForm<CfdiAnalisis>('/cxp/solicitudes/analizar', fd);
  },
  crear: (
    xml: File,
    pdf: File,
    dto: { idCategoria: string; justificacion: string },
  ) => {
    const fd = new FormData();
    fd.append('xml', xml);
    fd.append('pdf', pdf);
    fd.append('idCategoria', dto.idCategoria);
    fd.append('justificacion', dto.justificacion);
    return api.postForm<{ idCxp: string }>('/cxp/solicitudes', fd);
  },
  catalogos: () => api.get<Catalogos>('/cxp/solicitudes/catalogos'),
  listar: (rangoSemana?: string) =>
    api.get<SolicitudCxP[]>(
      `/cxp/solicitudes${rangoSemana ? `?rangoSemana=${encodeURIComponent(rangoSemana)}` : ''}`,
    ),
  enviar: (idCxp: string) =>
    api.post<{ ok: true }>(`/cxp/solicitudes/${idCxp}/enviar`),
  editar: (idCxp: string, dto: EditarSolicitudDto) =>
    api.patch<{ ok: true }>(`/cxp/solicitudes/${idCxp}`, dto),
  eliminar: (idCxp: string) =>
    api.delete<{ ok: true }>(`/cxp/solicitudes/${idCxp}`),
};
