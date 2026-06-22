import { api } from '@/lib/api';

export interface PagoRow {
  idCxp: string;
  folio: string | null;
  idProveedor: string;
  nombreProveedor: string | null;
  nomCFDI: string | null;
  fecCFDI: string | null;
  fecSolicitud: string | null;
  fecAutorizacion: string | null;
  rangoSemana: string | null;
  idEstado: number | null;
  estado: string | null;
  idCategoria: string;
  concepto: string | null;
  subtotal: number | null;
  total: number;
  montoAplicado: number | null;
  urlCFDI: string | null;
  urlXLM: string | null;
  idMovBancarios: string | null;
  numAnio: number | null;
  numMes: number | null;
  numSem: number | null;
  moneda: string | null;
  tdc: boolean | null;
  completada: boolean | null;
  // Enriquecidos
  cuenta: string | null;
  seccion: string | null;
  justificacion: string | null;
  solicitoNombre: string | null;
  autorizoNombre: string | null;
}

export interface TotalesPagos {
  subtotal: number;
  total: number;
  montoAplicado: number;
}

export interface ListadoPagos {
  filas: PagoRow[];
  totales: TotalesPagos;
}

export interface FiltrosPagosOpts {
  anios: number[];
  proveedores: { idProveedor: string; razonSocial: string }[];
  categorias: { idCategoria: string; cuenta: string | null; seccion: string | null }[];
}

export interface MovBancario {
  idmov: string;
  importe: number | null;
  fecOperacion: string | null;
  beneficiario: string | null;
  ordenante: string | null;
  bcoDestino: string | null;
  ctaDestino: string | null;
  referencia: string | null;
  cancepto: string | null;
  rastreo: string | null;
  imgComp: string | null;
  tipo: string | null;
}

/** Datos extraídos del comprobante por el backend (parser local o IA). */
export interface DatosComprobante {
  fecOperacion: string;
  horaOperacion: string;
  ordenante: string;
  ctaDestino: string;
  bcoDestino: string;
  beneficiario: string;
  importe: number;
  concepto: string;
  referencia: string;
  autorizacion: string;
  claveRastreo: string;
}

export interface Transferencia {
  idmov: string;
  importe: number | null;
  fecOperacion: string | null;
  horaOperacion: string | null;
  ordenante: string | null;
  ctaDestino: string | null;
  bcoDestino: string | null;
  beneficiario: string | null;
  cancepto: string | null;
  referencia: string | null;
  autorizacion: string | null;
  rastreo: string | null;
  imgComp: string | null;
  manual: boolean | null;
}

export interface ListarPagosParams {
  /** Multi-selección de años. Array vacío = sin filtro (usa default del servidor). */
  anio?: number[];
  /** Multi-selección de meses (1-12). Array vacío = sin filtro. */
  mes?: number[];
  numSem?: number;
  idEstado?: number;
  idProveedor?: string;
  cuenta?: string;
  seccion?: string;
  incluirPagados?: boolean;
}

function qs(params: ListarPagosParams): string {
  const sp = new URLSearchParams();
  // Arrays: query repetido (?anio=2024&anio=2025).
  for (const v of params.anio ?? []) sp.append('anio', String(v));
  for (const v of params.mes ?? []) sp.append('mes', String(v));
  if (params.numSem != null) sp.set('numSem', String(params.numSem));
  if (params.idEstado != null) sp.set('idEstado', String(params.idEstado));
  if (params.idProveedor) sp.set('idProveedor', params.idProveedor);
  if (params.cuenta) sp.set('cuenta', params.cuenta);
  if (params.seccion) sp.set('seccion', params.seccion);
  if (params.incluirPagados) sp.set('incluirPagados', 'true');
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const pagosApi = {
  filtros: () => api.get<FiltrosPagosOpts>('/cxp/pagos/filtros'),
  listar: (params: ListarPagosParams) =>
    api.get<ListadoPagos>(`/cxp/pagos${qs(params)}`),
  registrar: (idCxp: string, form: FormData) =>
    api.postForm<{ idmov: string }>(`/cxp/pagos/${idCxp}`, form),
  movimientos: (idCxp: string) =>
    api.get<MovBancario[]>(`/cxp/pagos/${idCxp}/movimientos`),
  asignar: (idCxp: string, idmov: string) =>
    api.post<{ ok: true }>(`/cxp/pagos/${idCxp}/asignar`, { idmov }),
  analizarComprobante: (idCxp: string, pdf: File) => {
    const fd = new FormData();
    fd.append('pdf', pdf);
    return api.postForm<{ datos: DatosComprobante; urlComprobante: string }>(
      `/cxp/pagos/${idCxp}/analizar-comprobante`,
      fd,
    );
  },
  verTransferencia: (idCxp: string) =>
    api.get<Transferencia | null>(`/cxp/pagos/${idCxp}/transferencia`),
  desaplicar: (idCxp: string) =>
    api.post<{ ok: true }>(`/cxp/pagos/${idCxp}/desaplicar`),
  aprobadosSinPago: (mes: number, anio: number) =>
    api.post<{ ok: true; data: unknown }>('/cxp/pagos/aprobados-sin-pago', {
      mes,
      anio,
    }),
};

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
