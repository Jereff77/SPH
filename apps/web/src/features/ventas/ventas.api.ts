import { api } from '@/lib/api';

// ============================ Dashboard ============================

/** Fila de la vista `v_pagos` (tabla principal del Dashboard). */
export interface PagoVentaRow {
  idPdpDet: string;
  idPdp: string | null;
  numPago: number | null;
  fecha: string | null;
  mes: number | null;
  anio: number | null;
  monto: number | null;
  montototal: number | null;
  idPropiedad: string | null;
  nomParque: string | null;
  idNave: string | null;
  idInversionista: string | null;
  pagos_terreno: number | null;
  pagos_construccion: number | null;
  pagos_ticket: number | null;
  descuentos: number | null;
  pagos: number | null;
  balance: number | null;
  pagos_acumulados: number | null;
  porcentaje_avance: number | null;
  tipoPago: string | null;
  fecha_pagos: string | null;
  razonsocial: string | null;
  pdpActivo: boolean | null;
  nomDescriptivo: string | null;
  ultimoPago: boolean | null;
}

export interface Tarjetas {
  anual: { objetivo: number; cobranza: number; balance: number };
  mes: {
    objetivo: number;
    terreno: number;
    construccion: number;
    ticket: number;
    cobranza: number;
    descuentos: number;
    balance: number;
  };
}

/** Fila de la vista `v_rentasCombinadas` (Renta Garantizada & Administrada). */
export interface RentaCombinadaRow {
  idPropiedad: string | null;
  nomDescriptivo: string | null;
  razonsocial: string | null;
  monto: number | null;
  subtotalFactura: number | null;
  subtotalComprobante: number | null;
  sumatoriaMeses: number | null;
  sumatoriaPagos: number | null;
  balance: number | null;
  balanceMes: number | null;
  fechaPago: string | null;
  yearExtraido: number | null;
  mes: number | null;
  tipo_renta: string | null;
  numPago: number | null;
}

/** Fila de la tabla `pagos` (detalle de pagos realizados). */
export interface PagoRealizado {
  idPago: string;
  fecha: string | null;
  monto: number | null;
  iva: number | null;
  montosiniva: number | null;
  tipomovimiento: number | null;
  tipoOperacion: number | null;
  numPago: number | null;
  comprobante: string | null;
}

export interface RegistrarPagoVentaInput {
  tipomovimiento: number; // 1=Terreno, 2=Construcción, 3=Ticket
  tipoOperacion: number; // 1=Pago, 2=Descuento
  fecha: string;
  monto: number;
  iva?: number;
  comprobante?: File | null;
}

// ============================ Planes ============================

export interface InversionistaOpt {
  idInversionista: string;
  nombre: string;
  apellido1: string | null;
  apellido2: string | null;
  razonsocial: string | null;
}

export interface PropiedadRow {
  idPropiedad: string;
  idNave: string | null;
  idParque: string | null;
  nomDescriptivo: string | null;
  tienenPdp: boolean;
  idPdp: string | null;
  pdpActivo: boolean;
  esTicket: boolean | null;
  tieneRgPdp: boolean;
  tieneRaPdp: boolean;
  nave: { numNaveNAME: string | null; lote: number; mza: number } | null;
}

export interface Inversionista {
  idInversionista: string;
  nombre: string;
  apellido1: string | null;
  apellido2: string | null;
  fecNacimiento: string | null;
  telefono: string | null;
  correo: string | null;
  RFC: string | null;
  CURP: string | null;
  razonsocial: string | null;
  personalidad: string | null;
  NomComercial: string | null;
  tipoCliente: string | null;
}

export interface DocRow {
  idDocumento: string;
  titulo: string | null;
  descripcion: string | null;
  urldoc: string | null;
}

export interface NaveDisponible {
  idNave: string;
  idParque: string | null;
  numNaveNAME: string | null;
  lote: number;
  mza: number;
  terreno: number;
  construccion: number;
  precio: number;
  situacion: string | null;
}

export interface RentaGarantizadaRow {
  idRGdet: string;
  numPago: number | null;
  concepto: string | null;
  fecha: string | null;
  subtotal: number | null;
  statusPago: boolean | null;
  subtotalFactura: number | null;
  subtotalComprobante: number | null;
  fechaPago: string | null;
}

export interface RentaAdministradaRow {
  idRAdet: string;
  numPago: number | null;
  concepto: string | null;
  fecha: string | null;
  monto: number | null;
  subtotal: number | null;
  total: number | null;
  statusPago: boolean | null;
  subtotalFactura: number | null;
  subtotalComprobante: number | null;
  fechaPago: string | null;
}

export interface InversionistaInput {
  nombre: string;
  apellido1?: string;
  apellido2?: string;
  fecNacimiento?: string;
  telefono?: string;
  correo?: string;
  RFC?: string;
  CURP?: string;
  razonsocial?: string;
  personalidad?: string;
  NomComercial?: string;
  tipoCliente?: string;
}

export interface CrearPlanInput {
  idPropiedad: string;
  idNave: string;
  idInversionista: string;
  terreno: number;
  obra: number;
  cantPagos: number;
  fechaPrimerPago: string;
  idVendedor?: string;
}

function dq(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const ventasApi = {
  // Dashboard
  filtros: () => api.get<{ anios: number[] }>('/ventas/dashboard/filtros'),
  tabla: (anio: number, mes: number, activo: boolean) =>
    api.get<PagoVentaRow[]>(`/ventas/dashboard/tabla${dq({ anio, mes, activo: String(activo) })}`),
  tarjetas: (anio: number, mes: number) =>
    api.get<Tarjetas>(`/ventas/dashboard/tarjetas${dq({ anio, mes })}`),
  rentas: (anio: number, mes: number, tipo: string) =>
    api.get<RentaCombinadaRow[]>(`/ventas/dashboard/rentas${dq({ anio, mes, tipo })}`),
  detallePagos: (idPdpDet: string) =>
    api.get<PagoRealizado[]>(`/ventas/dashboard/pagos/${idPdpDet}`),
  registrarPago: (idPdpDet: string, input: RegistrarPagoVentaInput) => {
    const fd = new FormData();
    fd.append('tipomovimiento', String(input.tipomovimiento));
    fd.append('tipoOperacion', String(input.tipoOperacion));
    fd.append('fecha', input.fecha);
    fd.append('monto', String(input.monto));
    if (input.iva != null) fd.append('iva', String(input.iva));
    if (input.comprobante) fd.append('comprobante', input.comprobante);
    return api.postForm<{ idPago: string }>(`/ventas/dashboard/pagos/${idPdpDet}`, fd);
  },

  // Planes
  inversionistas: () => api.get<InversionistaOpt[]>('/ventas/planes/inversionistas'),
  propiedades: (idInversionista: string) =>
    api.get<PropiedadRow[]>(`/ventas/planes/propiedades${dq({ idInversionista })}`),
  plan: (idPropiedad: string) => api.get<PagoVentaRow[]>(`/ventas/planes/plan/${idPropiedad}`),
  rentaGarantizada: (idPropiedad: string) =>
    api.get<RentaGarantizadaRow[]>(`/ventas/planes/renta-garantizada/${idPropiedad}`),
  rentaAdministrada: (idPropiedad: string) =>
    api.get<RentaAdministradaRow[]>(`/ventas/planes/renta-administrada/${idPropiedad}`),

  // Config
  getInversionista: (id: string) => api.get<Inversionista>(`/ventas/planes/inversionista/${id}`),
  actualizarInversionista: (id: string, dto: InversionistaInput) =>
    api.patch<{ ok: true }>(`/ventas/planes/inversionista/${id}`, dto),
  docs: (idInversionista: string) =>
    api.get<DocRow[]>(`/ventas/planes/docs${dq({ idInversionista })}`),
  subirDoc: (idInversionista: string, titulo: string, descripcion: string, archivo: File) => {
    const fd = new FormData();
    fd.append('idInversionista', idInversionista);
    fd.append('titulo', titulo);
    fd.append('descripcion', descripcion);
    fd.append('archivo', archivo);
    return api.postForm<{ idDocumento: string }>('/ventas/planes/docs', fd);
  },
  eliminarDoc: (idDocumento: string) =>
    api.delete<{ ok: true }>(`/ventas/planes/docs/${idDocumento}`),
  navesDisponibles: (idParque?: string) =>
    api.get<NaveDisponible[]>(`/ventas/planes/naves-disponibles${dq({ idParque })}`),
  vincularNave: (dto: {
    idInversionista: string;
    idNave: string;
    nomDescriptivo?: string;
    idParque?: string;
  }) => api.post<{ idPropiedad: string }>('/ventas/planes/propiedades', dto),
  crearPlanPagos: (dto: CrearPlanInput) =>
    api.post<{ idPdp: string }>('/ventas/planes/plan-pagos', dto),
};

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const TIPO_MOVIMIENTO: Record<number, string> = {
  1: 'Terreno',
  2: 'Construcción',
  3: 'Ticket',
};
