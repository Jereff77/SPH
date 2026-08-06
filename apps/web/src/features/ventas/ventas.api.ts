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

export interface ResumenTarjeta {
  objetivo: number;
  cobranza: number;
  balance: number;
}

export interface Tarjetas {
  /** Todo el año seleccionado. */
  anual: ResumenTarjeta;
  /** Solo el mes, por mes de vencimiento de la parcialidad. */
  mes: ResumenTarjeta;
  /** Cobranza real del mes (pagos hechos en el mes, incl. atrasados/adelantados). */
  mesReal: ResumenTarjeta;
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
  tipoOperacion: number; // 1=Pago, 2=Descuento, 3=Devolución (se guarda en negativo)
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

/**
 * Nombre a mostrar de un inversionista/propietario en los módulos de Ventas.
 * En estos módulos todo se maneja por la **razón social**; solo si está vacía
 * se recurre al nombre + apellidos como respaldo.
 */
export function nombreInversionista(i: {
  nombre?: string | null;
  apellido1?: string | null;
  apellido2?: string | null;
  razonsocial?: string | null;
}): string {
  return i.razonsocial?.trim()
    ? i.razonsocial
    : [i.nombre, i.apellido1, i.apellido2].filter(Boolean).join(' ');
}

export interface PropiedadRow {
  idPropiedad: string;
  idNave: string | null;
  idParque: string | null;
  nomParque: string | null;
  nomDescriptivo: string | null;
  tienenPdp: boolean;
  idPdp: string | null;
  pdpActivo: boolean;
  esTicket: boolean | null;
  tieneRgPdp: boolean;
  tieneRaPdp: boolean;
  nave: {
    numNave: number | null;
    numNaveNAME: string | null;
    lote: number | null;
    mza: number | null;
    terreno: number | null;
    construccion: number | null;
    precio: number | null;
    fecEntrega: string | null;
    situacion: string | null;
  } | null;
  /** KVAs asignados a la nave: `mt` = media tensión, `bt` = baja tensión. */
  kvas: { mt: number; bt: number } | null;
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

export interface ParqueOpcion {
  idParque: string;
  nomParque: string | null;
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

export interface Comentario {
  idComents: number;
  comentario: string | null;
  uid: string | null;
  origen: string;
  fc: string;
  idPago: string | null;
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

/** Cabecera del PDP (montos del plan + estado), para editar Terreno/Obra/Total. */
export interface CabeceraPdp {
  idPdp: string;
  montoterreno: number;
  montoobra: number;
  monto: number;
  cantpagos: number;
  pdpActivo: boolean;
}

/** Salida del Dashboard gráfico (clave 620). */
export interface ReporteGrafico {
  /**
   * `programado`/`cobrado`: del periodo (año + meses). `vencido`: adeudo
   * exigible **al día de hoy** (FIFO por plan, todo el historial).
   */
  kpis: { programado: number; cobrado: number; vencido: number };
  meses: { mes: number; monto: number; pagos: number; balance: number }[];
  atrasos: {
    idNave: string | null;
    /** Para abrir el plan de la nave desde el Dashboard (doble clic). */
    idPropiedad: string | null;
    idInversionista: string | null;
    nave: string | null;
    razonsocial: string | null;
    montoVencido: number;
    diasAtraso: number;
  }[];
  totalVencido: number;
}

/** Fila de la pantalla Escrituras (parcialidad con tipoPago='Escrituracion'). */
export interface EscrituraRow {
  idPdpDet: string;
  idPropiedad: string | null;
  idNave: string | null;
  idInversionista: string | null;
  tipoPago: string | null;
  nave: string | null;
  /** Parque (nomParque) — filtro independiente. */
  parque: string | null;
  /** Número de nave (numNaveNAME) — filtro independiente. */
  numNave: string | null;
  numPago: number | null;
  inversionista: string | null;
  fecha: string | null;
  monto: number | null;
  /** Estatus manual: `true` = Escriturada, `false` = Pendiente. */
  escriturada: boolean;
  /** Fecha real de escrituración. */
  fechaEscrituracion: string | null;
}

/** Respuesta del listado de Escrituras (filas + total + conteos de estatus). */
export interface EscriturasResp {
  filas: EscrituraRow[];
  total: number;
  escrituradas: number;
  pendientes: number;
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
  tabla: (anio: number, meses: number[], activo: boolean) =>
    api.get<PagoVentaRow[]>(`/ventas/dashboard/tabla${dq({ anio, meses: meses.join(','), activo: String(activo) })}`),
  tarjetas: (anio: number, meses: number[], activo: boolean) =>
    api.get<Tarjetas>(`/ventas/dashboard/tarjetas${dq({ anio, meses: meses.join(','), activo: String(activo) })}`),
  rentas: (anio: number, meses: number[], tipo: string) =>
    api.get<RentaCombinadaRow[]>(`/ventas/dashboard/rentas${dq({ anio, meses: meses.join(','), tipo })}`),
  detallePagos: (idPdpDet: string) =>
    api.get<PagoRealizado[]>(`/ventas/dashboard/pagos/${idPdpDet}`),
  eliminarPago: (idPago: string) =>
    api.delete<{ ok: true }>(`/ventas/dashboard/pagos/${idPago}`),
  /** Adjunta/reemplaza el comprobante PDF de un pago ya registrado (sin recrearlo). */
  subirComprobantePago: (idPago: string, comprobante: File) => {
    const fd = new FormData();
    fd.append('comprobante', comprobante);
    return api.postForm<{ comprobante: string }>(
      `/ventas/dashboard/pagos/${idPago}/comprobante`,
      fd,
    );
  },
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
  actualizarTipoPago: (idPdpDet: string, tipoPago: TipoPago) =>
    api.patch<{ ok: true }>(`/ventas/planes/tipo-pago/${idPdpDet}`, { tipoPago }),
  comentarios: (idPdpDet: string) =>
    api.get<Comentario[]>(`/ventas/planes/comentarios/${idPdpDet}`),
  agregarComentario: (idPdpDet: string, comentario: string) =>
    api.post<{ ok: true }>(`/ventas/planes/comentarios/${idPdpDet}`, { comentario }),

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
  parques: () => api.get<ParqueOpcion[]>('/ventas/planes/parques'),
  navesDisponibles: (idParque?: string) =>
    api.get<NaveDisponible[]>(`/ventas/planes/naves-disponibles${dq({ idParque })}`),
  vincularNave: (dto: {
    idInversionista: string;
    idNave: string;
    nomDescriptivo?: string;
    idParque?: string;
  }) => api.post<{ idPropiedad: string }>('/ventas/planes/propiedades', dto),
  desvincularNave: (idPropiedad: string, motivo?: string) =>
    api.delete<{ ok: true }>(
      `/ventas/planes/propiedades/${idPropiedad}${
        motivo ? `?motivo=${encodeURIComponent(motivo)}` : ''
      }`,
    ),
  crearPlanPagos: (dto: CrearPlanInput) =>
    api.post<{ idPdp: string }>('/ventas/planes/plan-pagos', dto),
  /** Activa/desactiva el PDP de una propiedad (`propiedades.pdpActivo`). */
  setActivoPlan: (idPropiedad: string, activo: boolean) =>
    api.patch<{ ok: true }>(`/ventas/planes/plan/${idPropiedad}/activo`, { activo }),
  /** Cabecera del PDP (montos del plan + estado); null si no tiene plan. */
  cabeceraPdp: (idPropiedad: string) =>
    api.get<CabeceraPdp | null>(`/ventas/planes/pdp/${idPropiedad}`),
  /** Edita Terreno/Obra del plan (recalcula el total). Solo plan inactivo. */
  editarMontosPlan: (idPropiedad: string, terreno: number, obra: number) =>
    api.patch<{ ok: true; monto: number }>(`/ventas/planes/plan/${idPropiedad}/montos`, {
      terreno,
      obra,
    }),
  /** Agrega una parcialidad al final del plan (monto 0). Solo plan inactivo. */
  agregarPartida: (idPropiedad: string) =>
    api.post<{ idPdpDet: string }>(`/ventas/planes/plan/${idPropiedad}/partida`, {}),
  /** Edita el monto de una parcialidad. Solo plan inactivo. */
  editarMontoPartida: (idPdpDet: string, monto: number) =>
    api.patch<{ ok: true }>(`/ventas/planes/partida/${idPdpDet}/monto`, { monto }),
  /** Edita la fecha de una parcialidad. Solo plan inactivo. */
  editarFechaPartida: (idPdpDet: string, fecha: string) =>
    api.patch<{ ok: true }>(`/ventas/planes/partida/${idPdpDet}/fecha`, { fecha }),
  /** Elimina una parcialidad (sin pagos). Solo plan inactivo. */
  eliminarPartida: (idPdpDet: string) =>
    api.delete<{ ok: true }>(`/ventas/planes/partida/${idPdpDet}`),
  /**
   * Elimina el plan de pagos COMPLETO (solo plan desactivado y sin ningún pago,
   * ni vivo ni cancelado). Libera la propiedad para desvincular o crear otro plan.
   */
  eliminarPlan: (idPropiedad: string) =>
    api.delete<{ ok: true }>(`/ventas/planes/plan/${idPropiedad}`),
  /**
   * Traslada saldo de una parcialidad a otra **futura** del mismo plan (candado:
   * clave **611**). Conserva el total del plan, por lo que NO requiere
   * desactivarlo. Registra el movimiento en ambas parcialidades (origen y destino).
   */
  trasladarSaldo: (input: {
    idPdpDetOrigen: string;
    idPdpDetDestino: string;
    monto: number;
  }) =>
    api.patch<{
      ok: true;
      origen: { idPdpDet: string; monto: number };
      destino: { idPdpDet: string; monto: number };
    }>('/ventas/planes/trasladar-saldo', input),

  // Dashboard gráfico (620)
  reporteGrafico: (anio: number, meses?: number[]) =>
    api.get<ReporteGrafico>(
      `/ventas/reporte${dq({ anio, meses: meses && meses.length ? meses.join(',') : undefined })}`,
    ),

  // Escrituras (630)
  escrituras: () => api.get<EscriturasResp>('/ventas/escrituras'),
  actualizarFechaEscritura: (idPdpDet: string, fecha: string) =>
    api.patch<{ ok: true }>(`/ventas/escrituras/${idPdpDet}/fecha`, { fecha }),
  actualizarMontoEscritura: (idPdpDet: string, monto: number) =>
    api.patch<{ ok: true }>(`/ventas/escrituras/${idPdpDet}/monto`, { monto }),
  /** Estatus manual de escrituración (Escriturada / Pendiente). */
  actualizarEstatusEscritura: (idPdpDet: string, escriturada: boolean) =>
    api.patch<{ ok: true }>(`/ventas/escrituras/${idPdpDet}/estatus`, { escriturada }),
  /** Fecha real de escrituración (`null` la limpia). */
  actualizarFechaEscrituracion: (idPdpDet: string, fecha: string | null) =>
    api.patch<{ ok: true }>(`/ventas/escrituras/${idPdpDet}/fecha-escrituracion`, { fecha }),
};

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * "Hoy" en horario de México (America/Mexico_City, GMT-6), en formato yyyy-MM-dd.
 * Evita el desfase de `toISOString()` (UTC), que por la tarde/noche ya marca el
 * día siguiente.
 */
export const hoyMexico = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());

export const TIPO_MOVIMIENTO: Record<number, string> = {
  1: 'Terreno',
  2: 'Construcción',
  3: 'Ticket',
};

/** Tipos de pago de una parcialidad (PDP), como en `editar_tipo_pago` de v1. */
export const TIPOS_PAGO = ['Anticipo', 'Parcialidad', 'Escrituracion'] as const;
export type TipoPago = (typeof TIPOS_PAGO)[number];
