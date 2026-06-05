import { api } from '@/lib/api';

export interface InpcItem {
  consecutivo: number;
  id: string;
  anio: number;
  mes: number;
  inpc: number;
  nota: string | null;
  fum: string | null;
}

export interface CuentaItem {
  idCategoria: string;
  cuenta: string | null;
  seccion: string | null;
  descripcion: string | null;
  presupuestoAnual: number;
  consumido: number;
  comprometido: number;
  uidResponsable: string | null;
  nombreResponsable: string | null;
  idPresupuesto: string | null;
  presupuestable: boolean | null;
  status: boolean | null;
}

export interface Responsable {
  uid: string;
  nombre: string;
}

export interface MesPresupuesto {
  id: number;
  mes: number;
  monto: number;
}

export interface FechaCxp {
  fecha: string;
  dia_semana: string | null;
  mes_anio: string | null;
  cfdi: boolean;
  autorizar: boolean;
}

export const parametrosApi = {
  // INPC
  listarInpc: () => api.get<InpcItem[]>('/parametros/inpc'),
  crearInpc: (dto: { anio: number; mes: number; inpc: number; nota: string }) =>
    api.post<{ ok: true }>('/parametros/inpc', dto),
  editarInpc: (consecutivo: number, dto: { inpc: number; nota: string }) =>
    api.patch<{ ok: true }>(`/parametros/inpc/${consecutivo}`, dto),
  eliminarInpc: (consecutivo: number) =>
    api.delete<{ ok: true }>(`/parametros/inpc/${consecutivo}`),

  // Cuentas
  listarCuentas: (cuenta?: string, seccion?: string) => {
    const qs = new URLSearchParams();
    if (cuenta) qs.set('cuenta', cuenta);
    if (seccion) qs.set('seccion', seccion);
    const s = qs.toString();
    return api.get<CuentaItem[]>(`/parametros/cuentas${s ? `?${s}` : ''}`);
  },
  listarResponsables: () => api.get<Responsable[]>('/parametros/responsables'),
  crearCuenta: (dto: {
    idCategoria: string;
    cuenta: string;
    seccion: string;
    descripcion: string;
    uidResponsable: string;
  }) => api.post<{ ok: true }>('/parametros/cuentas', dto),
  editarCuenta: (
    idCategoria: string,
    dto: {
      cuenta: string;
      seccion: string;
      descripcion: string;
      uidResponsable: string;
    },
  ) =>
    api.patch<{ ok: true }>(
      `/parametros/cuentas/${encodeURIComponent(idCategoria)}`,
      dto,
    ),
  cambiarResponsable: (idCategoria: string, uidResponsable: string) =>
    api.patch<{ ok: true }>(
      `/parametros/cuentas/${encodeURIComponent(idCategoria)}/responsable`,
      { uidResponsable },
    ),
  setPresupuestable: (idCategoria: string, valor: boolean) =>
    api.patch<{ ok: true }>(
      `/parametros/cuentas/${encodeURIComponent(idCategoria)}/presupuestable`,
      { valor },
    ),
  setStatusCuenta: (idCategoria: string, valor: boolean) =>
    api.patch<{ ok: true }>(
      `/parametros/cuentas/${encodeURIComponent(idCategoria)}/status`,
      { valor },
    ),
  eliminarCuenta: (idCategoria: string) =>
    api.delete<{ ok: true }>(
      `/parametros/cuentas/${encodeURIComponent(idCategoria)}`,
    ),
  obtenerPresupuestoMensual: (idCategoria: string, idPresupuesto: string) =>
    api.get<MesPresupuesto[]>(
      `/parametros/cuentas/${encodeURIComponent(idCategoria)}/presupuesto-mensual?idPresupuesto=${encodeURIComponent(idPresupuesto)}`,
    ),
  guardarPresupuestoMensual: (
    idCategoria: string,
    idPresupuesto: string,
    meses: { mes: number; monto: number }[],
  ) =>
    api.put<{ ok: true }>(
      `/parametros/cuentas/${encodeURIComponent(idCategoria)}/presupuesto-mensual`,
      { idPresupuesto, meses },
    ),

  // Fechas CxP
  listarPeriodos: () => api.get<string[]>('/parametros/fechas-cxp/periodos'),
  listarFechas: (periodo?: string) =>
    api.get<FechaCxp[]>(
      `/parametros/fechas-cxp${periodo ? `?periodo=${encodeURIComponent(periodo)}` : ''}`,
    ),
  crearFecha: (dto: { fecha: string; cfdi?: boolean; autorizar?: boolean }) =>
    api.post<{ ok: true }>('/parametros/fechas-cxp', dto),
  toggleFecha: (fecha: string, dto: { cfdi?: boolean; autorizar?: boolean }) =>
    api.patch<{ ok: true }>(`/parametros/fechas-cxp/${fecha}`, dto),
  eliminarFecha: (fecha: string) =>
    api.delete<{ ok: true }>(`/parametros/fechas-cxp/${fecha}`),
};
