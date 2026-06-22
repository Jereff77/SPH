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
  /** Multi-selección: array vacío = todos. */
  proveedor?: string[];
  /** Multi-selección: valores de tipo proveedor (ej. '1','2','3'). */
  tipoProveedor?: string[];
  /** Multi-selección: array vacío = todas. */
  categoria?: string[];
  /** Multi-selección: array vacío = todas. */
  seccion?: string[];
  /** Estados multi-selección. */
  estados?: string[];
  urgente?: '' | 'true' | 'false';
  /** Multi-selección: array vacío = todos. */
  quienSolicito?: string[];
  /** Multi-selección: array vacío = todos. */
  quienAutorizo?: string[];
  /** Multi-selección: array vacío = todos. */
  quienPago?: string[];
  busqueda?: string;
}

/** Serializa params; los arreglos se mandan como query repetido (`?x=a&x=b`). */
function qs(f: FiltrosReporteCxp): string {
  const sp = new URLSearchParams();
  if (f.fechaInicio) sp.set('fechaInicio', f.fechaInicio);
  if (f.fechaFin) sp.set('fechaFin', f.fechaFin);
  for (const v of f.proveedor ?? []) sp.append('proveedor', v);
  for (const v of f.tipoProveedor ?? []) sp.append('tipoProveedor', v);
  for (const v of f.categoria ?? []) sp.append('categoria', v);
  for (const v of f.seccion ?? []) sp.append('seccion', v);
  for (const v of f.estados ?? []) sp.append('estados', v);
  if (f.urgente) sp.set('urgente', f.urgente);
  for (const v of f.quienSolicito ?? []) sp.append('quienSolicito', v);
  for (const v of f.quienAutorizo ?? []) sp.append('quienAutorizo', v);
  for (const v of f.quienPago ?? []) sp.append('quienPago', v);
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
