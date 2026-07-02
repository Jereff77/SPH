import { api } from '@/lib/api';

/**
 * Incrementos de renta por INPC + Responsables de parque. El flujo lo dispara
 * quien captura el INPC (permiso 212); la bitácora por plan también se lee con
 * la clave 20. Diseño: `base-conocimiento/PLAN-incrementos-inpc-automaticos.md`.
 */

export interface ConceptoPreview {
  concepto: string;
  pm2Base: number;
  pts: number;
  pm2Nuevo: number;
  montoActual: number;
  montoNuevo: number;
}

export interface PlanPreview {
  idArrePdp: string;
  empresa: string;
  parque: string;
  idParque: string;
  nave: string;
  moneda: string;
  aniversario: string;
  anioObjetivo: number;
  incrementoPct: number;
  montoActual: number;
  montoNuevo: number;
  conceptos: ConceptoPreview[];
  estatus: 'aplicable' | 'omitido' | 'manual';
  motivo?: string;
  idIncremento?: string;
  inpcAplicadoPrevio?: number;
  requiereReaplicacion?: boolean;
}

export interface PreviewIncrementos {
  inpc: { id: string; anio: number; mes: number; valor: number };
  desfaseMeses: number;
  mesAplicacion: { anio: number; mes: number };
  aplicables: PlanPreview[];
  omitidos: PlanPreview[];
  manuales: PlanPreview[];
}

export interface ResumenNotificacion {
  correosEnviados: number;
  destinatarios: string[];
  sinSmtp: boolean;
}

export interface ResultadoAplicar {
  inpc: PreviewIncrementos['inpc'];
  mesAplicacion: PreviewIncrementos['mesAplicacion'];
  aplicados: Array<{
    idArrePdp: string;
    empresa: string;
    montoActual: number;
    montoNuevo: number;
    idIncremento: string;
  }>;
  fallidos: Array<{ idArrePdp: string; empresa: string; motivo: string }>;
  rechazados: string[];
  omitidos: Array<{ idArrePdp: string; empresa: string; motivo?: string }>;
  manuales: Array<{ idArrePdp: string; empresa: string; motivo?: string }>;
  notificacion: ResumenNotificacion;
}

export interface IncrementoBitacora {
  id: string;
  idArrePdp: string;
  anioAplicado: number;
  idInpc: string;
  inpcAplicado: number;
  ptsAplicados: number;
  desfaseMeses: number | null;
  detalle: {
    montoActual?: number;
    montoNuevo?: number;
    moneda?: string;
    aniversario?: string;
    previo?: unknown[];
    conceptos?: unknown[];
    edicionesManuales?: unknown[];
  } | null;
  origen: 'automatico' | 'manual' | 'reaplicacion';
  estado: 'aplicado' | 'revertido';
  correoNotificado: string[] | null;
  fecNotificacion: string | null;
  revertidoPor: string | null;
  fecReversion: string | null;
  motivoReversion: string | null;
  uidr: string;
  fc: string;
  aplicadoPor: string;
  revertidoPorNombre: string | null;
  inpcVigente: number | null;
  inpcPeriodo: string | null;
  desactualizado: boolean;
}

export interface ResponsableParque {
  id: string;
  uid: string;
  nombre: string;
  email: string | null;
  valido: boolean;
}

export interface PanoramaResponsables {
  parques: Array<{ idParque: string; nomParque: string; responsables: ResponsableParque[] }>;
  gerente: { uid: string; nombre: string; email: string | null; valido: boolean } | null;
  parquesSinResponsable: number;
}

export interface UsuarioElegible {
  uid: string;
  nomCompleto: string | null;
  email: string | null;
}

export const incrementosApi = {
  preview: (idInpc: string) =>
    api.get<PreviewIncrementos>(
      `/arrendatarios/incrementos/preview?idInpc=${encodeURIComponent(idInpc)}`,
    ),
  aplicar: (idInpc: string, planes: string[]) =>
    api.post<ResultadoAplicar>('/arrendatarios/incrementos/aplicar', { idInpc, planes }),
  revertir: (id: string, motivo: string) =>
    api.post<{ ok: true; filasRestauradas: number }>(
      `/arrendatarios/incrementos/${id}/revertir`,
      { motivo },
    ),
  reaplicar: (id: string) =>
    api.post<ResultadoAplicar>(`/arrendatarios/incrementos/${id}/reaplicar`, {}),
  reenviarCorreo: (id: string) =>
    api.post<{ ok: true; notificacion: ResumenNotificacion }>(
      `/arrendatarios/incrementos/${id}/reenviar-correo`,
      {},
    ),
  bitacora: (filtros: { idArrePdp?: string; idInpc?: string }) => {
    const qs = new URLSearchParams();
    if (filtros.idArrePdp) qs.set('idArrePdp', filtros.idArrePdp);
    if (filtros.idInpc) qs.set('idInpc', filtros.idInpc);
    const s = qs.toString();
    return api.get<IncrementoBitacora[]>(`/arrendatarios/incrementos${s ? `?${s}` : ''}`);
  },

  // Responsables de parque + gerente
  responsables: () => api.get<PanoramaResponsables>('/arrendatarios/responsables'),
  usuariosElegibles: () =>
    api.get<UsuarioElegible[]>('/arrendatarios/responsables/usuarios'),
  agregarResponsable: (idParque: string, uid: string) =>
    api.post<{ ok: true; id: string }>('/arrendatarios/responsables', { idParque, uid }),
  quitarResponsable: (id: string) =>
    api.delete<{ ok: true }>(`/arrendatarios/responsables/${id}`),
  setGerente: (uid: string | null) =>
    api.patch<{ ok: true }>('/arrendatarios/responsables/gerente', { uid }),
};
