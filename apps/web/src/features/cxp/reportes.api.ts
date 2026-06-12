import { api } from '@/lib/api';

/** Fila del reporte CxP "Estado de Cuenta" (idéntica a la RPC v1). */
export interface ReporteCxpRow {
  idCxp: string;
  folio: string | null;
  proveedor: string | null;
  estado: string | null;
  idEstado: number | null;
  categoria: string | null;
  seccion: string | null;
  concepto: string | null;
  fecSolicitud: string | null;
  fecCFDI: string | null;
  fecPago: string | null;
  subtotal: number | null;
  total: number | null;
  montoAplicado: number | null;
  quienSolicito: string | null;
  quienAutorizo: string | null;
  quienPago: string | null;
  esUrgente: boolean | null;
  tipoProveedor: number | null;
  anio: number | null;
  mes: number | null;
  balance: number | null;
}

export interface TotalesReporteCxp {
  totalRegistros: number;
  montoTotal: number;
  montoAplicado: number;
  balance: number;
}

export interface CombosReporte {
  proveedores: string[];
  categorias: string[];
  secciones: string[];
  solicitantes: string[];
  autorizadores: string[];
  pagadores: string[];
}

export interface DependientesReporte {
  proveedores: string[];
  categorias: string[];
  secciones: string[];
}

export interface FiltrosReporteCxp {
  fechaInicio?: string;
  fechaFin?: string;
  proveedor?: string;
  tipoProveedor?: string;
  categoria?: string;
  seccion?: string;
  /** Estados multi-selección. */
  estados?: string[];
  urgente?: '' | 'true' | 'false';
  quienSolicito?: string;
  quienAutorizo?: string;
  quienPago?: string;
  busqueda?: string;
}

function qs(f: FiltrosReporteCxp): string {
  const sp = new URLSearchParams();
  if (f.fechaInicio) sp.set('fechaInicio', f.fechaInicio);
  if (f.fechaFin) sp.set('fechaFin', f.fechaFin);
  if (f.proveedor) sp.set('proveedor', f.proveedor);
  if (f.tipoProveedor) sp.set('tipoProveedor', f.tipoProveedor);
  if (f.categoria) sp.set('categoria', f.categoria);
  if (f.seccion) sp.set('seccion', f.seccion);
  if (f.estados && f.estados.length) sp.set('estados', f.estados.join(','));
  if (f.urgente) sp.set('urgente', f.urgente);
  if (f.quienSolicito) sp.set('quienSolicito', f.quienSolicito);
  if (f.quienAutorizo) sp.set('quienAutorizo', f.quienAutorizo);
  if (f.quienPago) sp.set('quienPago', f.quienPago);
  if (f.busqueda) sp.set('busqueda', f.busqueda);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const reportesCxpApi = {
  combos: () => api.get<CombosReporte>('/cxp/reportes/combos'),
  dependientes: (p: { proveedor?: string; categoria?: string; seccion?: string }) => {
    const sp = new URLSearchParams();
    if (p.proveedor) sp.set('proveedor', p.proveedor);
    if (p.categoria) sp.set('categoria', p.categoria);
    if (p.seccion) sp.set('seccion', p.seccion);
    const s = sp.toString();
    return api.get<DependientesReporte>(`/cxp/reportes/dependientes${s ? `?${s}` : ''}`);
  },
  estadoCuenta: (f: FiltrosReporteCxp) =>
    api.get<{ filas: ReporteCxpRow[]; totales: TotalesReporteCxp }>(
      `/cxp/reportes/estado-cuenta${qs(f)}`,
    ),
};

/** Los 8 estados (idénticos a v1), para los checkboxes del filtro. */
export const ESTADOS_CXP = [
  'Guardado',
  'Enviado',
  'Rechazado',
  'Aprobado',
  'Reprogramado',
  'Pagado',
  'Pago T. Bancaria',
  'Aprobado sin pago aplicado',
];

/** Tipos de proveedor (idénticos a v1). */
export const TIPOS_PROVEEDOR = [
  { value: '1', label: 'Proveedor' },
  { value: '2', label: 'Inversionista' },
  { value: '3', label: 'Comisionista' },
];
