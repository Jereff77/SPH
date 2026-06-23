import { api } from '@/lib/api';
import type { ComentarioCxP } from './solicitudes.api';

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
  tieneRespuestaGerente: boolean; // hay comentario del aprobador (rechazo/regreso)
}

export interface Responsable {
  uid: string;
  nombre: string;
}

export interface FiltrosPendientes {
  /** Multi-selección de años. Array vacío = todos. */
  anio?: number[];
  /** Multi-selección de meses (1-12). Array vacío = todos. */
  mes?: number[];
  /** Multi-selección de estados. Array vacío = todos. */
  idEstado?: number[];
  /** Semana única (no se convierte a multi). */
  numSem?: number;
  /** Multi-selección de gerentes (uid). Array vacío = todos. */
  uidGerente?: string[];
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
    // Arrays: query repetido (?x=a&x=b).
    for (const v of f.anio ?? []) p.append('anio', String(v));
    for (const v of f.mes ?? []) p.append('mes', String(v));
    for (const v of f.idEstado ?? []) p.append('idEstado', String(v));
    if (f.numSem) p.set('numSem', String(f.numSem));
    for (const v of f.uidGerente ?? []) p.append('uidGerente', v);
    const qs = p.toString();
    return api.get<PendienteCxP[]>(`/cxp/pendientes${qs ? `?${qs}` : ''}`);
  },
  comentarios: (idCxp: string) =>
    api.get<ComentarioCxP[]>(`/cxp/pendientes/${idCxp}/comentarios`),
  cambiarResponsable: (idCxp: string, uidGerente: string) =>
    api.patch<{ ok: true }>(`/cxp/pendientes/${idCxp}/responsable`, { uidGerente }),
  devolver: (idCxp: string) =>
    api.patch<{ ok: true }>(`/cxp/pendientes/${idCxp}/devolver`),
};
