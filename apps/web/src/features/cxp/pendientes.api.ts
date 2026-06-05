import { api } from '@/lib/api';

export interface PendienteCxP {
  idCxp: string;
  uidr: string | null;
  estado: string | null;
  nombreProveedor: string | null;
  nomCFDI: string | null;
  fecCFDI: string | null;
  fecSolicitud: string | null;
  folio: string | null;
  concepto: string | null;
  subtotal: number | null;
  total: number;
  montoAplicado: number;
  urlXLM: string | null;
  urlCFDI: string | null;
  numSem: number | null;
  rangoSemana: string | null;
  idEstado: number | null;
  idCategoria: string;
  uidGerente: string | null;
  moneda: string;
  cuenta: string | null;
  seccion: string | null;
  nomGerente: string | null;
  nomSolicitante: string | null;
}

export interface Responsable {
  uid: string;
  nombre: string;
}

export interface FiltrosPendientes {
  anio?: number;
  mes?: number;
  idEstado?: number;
  numSem?: number;
  uidGerente?: string;
}

/** Opciones del filtro de estado (incluye "Sin factura" = 0). */
export const ESTADOS_FILTRO: { id: number; etiqueta: string }[] = [
  { id: 0, etiqueta: 'Sin factura' },
  { id: 1, etiqueta: 'Guardadas' },
  { id: 2, etiqueta: 'Enviados' },
  { id: 3, etiqueta: 'Rechazada' },
  { id: 4, etiqueta: 'Aprobada' },
  { id: 5, etiqueta: 'Reprogramada' },
  { id: 6, etiqueta: 'Pagada' },
  { id: 99, etiqueta: 'Aprobado sin pago' },
];

export const pendientesApi = {
  anios: () => api.get<number[]>('/cxp/pendientes/anios'),
  responsables: () => api.get<Responsable[]>('/cxp/pendientes/responsables'),
  listar: (f: FiltrosPendientes) => {
    const p = new URLSearchParams();
    if (f.anio) p.set('anio', String(f.anio));
    if (f.mes) p.set('mes', String(f.mes));
    if (f.idEstado != null) p.set('idEstado', String(f.idEstado));
    if (f.numSem) p.set('numSem', String(f.numSem));
    if (f.uidGerente) p.set('uidGerente', f.uidGerente);
    const qs = p.toString();
    return api.get<PendienteCxP[]>(`/cxp/pendientes${qs ? `?${qs}` : ''}`);
  },
  cambiarResponsable: (idCxp: string, uidGerente: string) =>
    api.patch<{ ok: true }>(`/cxp/pendientes/${idCxp}/responsable`, { uidGerente }),
  devolver: (idCxp: string) =>
    api.patch<{ ok: true }>(`/cxp/pendientes/${idCxp}/devolver`),
};
