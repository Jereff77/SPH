import { api } from '@/lib/api';

// ----------------------------- Kardex (530) -----------------------------

export interface KardexInversionistaOpt {
  nombreInversionista: string;
  personalidad: string | null;
}

export interface KardexPropiedadOpt {
  idPropiedad: string;
  label: string;
}

export interface KardexFila {
  idFidePdpD: string;
  numMov: number | null;
  monto: number | null;
  fecini: string | null;
  fecfin: string | null;
  dias: number | null;
  rend: number | null;
  calculo: number | null;
  comsph: number | null;
  retencionIsr: number | null;
  dispersion: number | null;
  pagado: boolean;
}

export interface KardexReporte {
  info: {
    nombreInversionista: string;
    personalidad: string | null;
    idPropiedad: string | null;
    rendimientoPromedio: number;
  };
  kpis: { total: number; pagados: number; pendientes: number };
  totales: {
    calculo: number;
    comsph: number;
    retencionIsr: number;
    dispersion: number;
  };
  filas: KardexFila[];
}

// --------------------------- Dispersiones (530) ---------------------------

export interface DispersionOpciones {
  fideicomisos: { idFide: string; titulo: string | null }[];
  periodos: { noDispersion: string; fecInicio: string; fecFin: string }[];
  adhesiones: { noAdhesion: string; razonsocial: string | null }[];
}

/** Fila del resumen por adhesión (resumen_fideicomiso_completo_corregido). */
export interface DispersionResumen {
  no_adhesion: string;
  nombre_inversionista: string;
  rfc_inversionista: string;
  tipo_persona: string;
  no_dispersion: string;
  fecha_inicio_periodo: string;
  fecha_fin_periodo: string;
  total_dias_periodo: number;
  total_pagos_distintos: number;
  monto_total_pagos: number;
  tasa_promedio_rendimiento: number;
  rendimiento_bruto_total: number;
  retencion_isr_total: number;
  rendimiento_neto_total: number;
  rendimiento_sph_total: number;
  dispersion_neta_total: number;
  dias_promocion: number;
  dias_normal: number;
}

/** Fila del plan detallado (plan_dispersiones_dinamico_corregido). */
export interface DispersionPlanFila {
  no_adhesion: string;
  nombre_inversionista: string;
  razon_social: string;
  periodo_anio: number;
  periodo_mes: number;
  tipo_periodo: string;
  monto_pago: number;
  fecha_pago: string;
  fecha_inicio: string;
  fecha_fin: string;
  dias_periodo: number;
  nodispersion: string;
  tasa_rendimiento: number;
  rendimiento_bruto: number;
  retencion_isr: number;
  rendimiento_neto: number;
  rendimiento_sph: number;
  dispersion_neta: number;
}

// --------------------------- Contabilidad (540) ---------------------------

const MESES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const;
export type MesCorto = (typeof MESES)[number];
export { MESES };

export interface PivoteFila {
  tipo: string;
  concepto: string;
  subconcepto: string;
  descripcion: string;
  aplicaIVA?: boolean;
  Ene: number;
  Feb: number;
  Mar: number;
  Abr: number;
  May: number;
  Jun: number;
  Jul: number;
  Ago: number;
  Sep: number;
  Oct: number;
  Nov: number;
  Dic: number;
  Total: number;
  /** Notas por mes: { Ene: "texto", ... }. */
  notas?: Record<string, string> | null;
}

export interface ContaConcepto {
  tipo: string | null;
  concepto: string | null;
  subconcepto: string | null;
  descripcion: string | null;
  aplicaIVA: boolean;
  ordenTipo: number | null;
  ordenConcepto: number | null;
}

export interface SaldoBanco {
  mes: number;
  saldo: number;
}

/** Clave que ubica una celda/registro de contabilidad. */
export interface ClaveCelda {
  anio: number;
  mes: number;
  tipo: string;
  concepto: string;
  subconcepto: string;
  descripcion: string;
}

export interface MovimientoContaInput extends ClaveCelda {
  monto: number;
  aplicaIVA?: boolean;
  notas?: string;
  reemplazar?: boolean;
}

export interface ConceptoInput {
  tipo: string;
  concepto: string;
  subconcepto?: string;
  descripcion?: string;
  aplicaIVA?: boolean;
  ordenTipo?: number;
  ordenConcepto?: number;
}

// ----------------------- Aportaciones (510) / Adhesiones (520) -----------------------

export interface InversionistaTicketOpt {
  idInversionista: string;
  etiqueta: string;
}
export interface PropiedadTicketOpt {
  idPropiedad: string;
  nomDescriptivo: string | null;
}
export interface PagoFila {
  idPdpDet: string | null;
  numPago: number | null;
  fecha: string | null;
  fecha_pagos: string | null;
  monto: number | null;
  pagos: number | null;
  balance: number | null;
  porcentaje_avance: number | null;
  tipoPago: string | null;
  nomDescriptivo: string | null;
  nomParque: string | null;
  razonsocial: string | null;
  ultimoPago: boolean | null;
}

/** Un pago registrado contra una partida (icono $). */
export interface PagoRegistrado {
  idPago: string;
  fecha: string | null;
  tipoOperacion: number | null;
  monto: number | null;
  tipomovimiento: number | null;
  comprobante: string | null;
}

/** Comentario (bitácora) de una partida (icono 💬). */
export interface ComentarioPartida {
  fc: string;
  usuario: string | null;
  comentario: string | null;
  idPago: string | null;
}

/** Alta de un pago contra una partida del fideicomiso (ticket). */
export interface RegistrarPagoInput {
  fecha: string;
  monto: number;
  iva?: number;
  tipoOperacion?: number; // 1=Pago, 2=Descuento
  comprobante?: File | null;
}

export const TIPO_MOVIMIENTO: Record<number, string> = {
  1: 'Terreno',
  2: 'Construcción',
  3: 'Ticket',
};

/** Fecha de hoy en horario de México (yyyy-MM-dd) para defaults de captura. */
export const hoyMexico = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export interface AdhesionFila {
  idfide: string | null;
  idPropiedad: string | null;
  idInversionista: string | null;
  noAdhesion: string | null;
  razonsocial: string | null;
  nomDescriptivo: string | null;
  bloque: string | null;
  monto: number | null;
  cantpagos: number | null;
  fecha: string | null;
  rendimiento: number | null;
  Apartado: number | null;
  Medio: string | null;
  PM: string | null;
  comentarios: string | null;
}

function qs(params: Record<string, string | string[] | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    if (Array.isArray(v)) {
      for (const it of v) if (it !== '') p.append(k, it);
    } else {
      p.set(k, v);
    }
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const fideicomisoApi = {
  // Kardex
  kardexInversionistas: () =>
    api.get<KardexInversionistaOpt[]>('/fideicomiso/kardex/inversionistas'),
  kardexPropiedades: (inversionista: string) =>
    api.get<KardexPropiedadOpt[]>(`/fideicomiso/kardex/propiedades${qs({ inversionista })}`),
  kardex: (inversionista: string, propiedad?: string[]) =>
    api.get<KardexReporte>(`/fideicomiso/kardex${qs({ inversionista, propiedad })}`),

  // Dispersiones
  dispersionesOpciones: () =>
    api.get<DispersionOpciones>('/fideicomiso/dispersiones/opciones'),
  dispersionResumen: (idFide: string, noDispersion: string) =>
    api.get<DispersionResumen[]>(
      `/fideicomiso/dispersiones/resumen${qs({ idFide, noDispersion })}`,
    ),
  dispersionPlan: (idFide: string, noAdhesion: string, noDispersion?: string) =>
    api.get<DispersionPlanFila[]>(
      `/fideicomiso/dispersiones/plan${qs({ idFide, noAdhesion, noDispersion })}`,
    ),
  dispersionResumenAdhesion: (idFide: string, noAdhesion: string, noDispersion: string) =>
    api.get<DispersionResumen[]>(
      `/fideicomiso/dispersiones/resumen-adhesion${qs({ idFide, noAdhesion, noDispersion })}`,
    ),

  // Contabilidad — lecturas
  contabilidadPivote: (anio: number) =>
    api.get<PivoteFila[]>(`/fideicomiso/contabilidad/pivote${qs({ anio: String(anio) })}`),
  contabilidadTotales: (anio: number) =>
    api.get<PivoteFila[]>(`/fideicomiso/contabilidad/totales${qs({ anio: String(anio) })}`),
  contabilidadConceptos: () =>
    api.get<ContaConcepto[]>('/fideicomiso/contabilidad/conceptos'),
  contabilidadSaldos: (anio: number) =>
    api.get<SaldoBanco[]>(`/fideicomiso/contabilidad/saldos${qs({ anio: String(anio) })}`),
  // Contabilidad — escrituras
  crearMovimiento: (dto: MovimientoContaInput) =>
    api.post<{ ok: true; reemplazado: boolean }>(
      '/fideicomiso/contabilidad/movimientos',
      dto,
    ),
  editarCelda: (dto: ClaveCelda & { monto: number; aplicaIVA?: boolean }) =>
    api.patch<{ ok: true }>('/fideicomiso/contabilidad/celda', dto),
  toggleIvaCelda: (dto: ClaveCelda & { aplicaIVA: boolean }) =>
    api.patch<{ ok: true; aplicaIVA: boolean }>(
      '/fideicomiso/contabilidad/celda-iva',
      dto,
    ),
  crearConcepto: (dto: ConceptoInput) =>
    api.post<{ ok: true; id: number }>('/fideicomiso/contabilidad/conceptos', dto),
  guardarSaldo: (dto: SaldoBanco & { anio: number }) =>
    api.put<{ ok: true }>('/fideicomiso/contabilidad/saldos', dto),
  eliminarSaldo: (anio: number, mes: number) =>
    api.delete<{ ok: true }>(
      `/fideicomiso/contabilidad/saldos${qs({ anio: String(anio), mes: String(mes) })}`,
    ),

  // Aportaciones / Adhesiones
  aportacionesInversionistas: () =>
    api.get<InversionistaTicketOpt[]>('/fideicomiso/aportaciones/inversionistas'),
  aportacionesPropiedades: (inversionista: string) =>
    api.get<PropiedadTicketOpt[]>(
      `/fideicomiso/aportaciones/propiedades${qs({ inversionista })}`,
    ),
  aportacionesPagos: (propiedad: string) =>
    api.get<PagoFila[]>(`/fideicomiso/aportaciones/pagos${qs({ propiedad })}`),
  // Pagos de una partida (icono $)
  pagosDetalle: (idPdpDet: string) =>
    api.get<PagoRegistrado[]>(`/fideicomiso/aportaciones/pagos-detalle/${idPdpDet}`),
  registrarPago: (idPdpDet: string, input: RegistrarPagoInput) => {
    const fd = new FormData();
    fd.append('tipomovimiento', '3'); // Ticket (esTicket=true)
    fd.append('tipoOperacion', String(input.tipoOperacion ?? 1));
    fd.append('fecha', input.fecha);
    fd.append('monto', String(input.monto));
    if (input.iva != null) fd.append('iva', String(input.iva));
    if (input.comprobante) fd.append('comprobante', input.comprobante);
    return api.postForm<{ idPago: string }>(`/fideicomiso/aportaciones/pagos/${idPdpDet}`, fd);
  },
  eliminarPago: (idPago: string) =>
    api.delete<{ ok: true }>(`/fideicomiso/aportaciones/pagos/${idPago}`),
  // Comentarios de una partida (icono 💬)
  comentarios: (idPdpDet: string) =>
    api.get<ComentarioPartida[]>(`/fideicomiso/aportaciones/comentarios/${idPdpDet}`),
  agregarComentario: (idPdpDet: string, comentario: string) =>
    api.post<{ ok: true }>(`/fideicomiso/aportaciones/comentarios/${idPdpDet}`, { comentario }),
  // Editar Fecha Plan de la partida
  editarFechaPartida: (idPdpDet: string, fecha: string) =>
    api.patch<{ ok: true }>(`/fideicomiso/aportaciones/partida/${idPdpDet}/fecha`, { fecha }),
  adhesiones: () => api.get<AdhesionFila[]>('/fideicomiso/adhesiones'),

  // ===================== Configuración del propietario (⚙️) =====================
  cfgPropiedades: (inversionista: string) =>
    api.get<CfgPropiedadOpt[]>(`/fideicomiso/config/propiedades${qs({ inversionista })}`),
  cfgPropiedadesFide: (inversionista: string) =>
    api.get<CfgPropiedadFide[]>(`/fideicomiso/config/propiedades-fide${qs({ inversionista })}`),
  // Datos del inversionista
  cfgGetInversionista: (id: string) =>
    api.get<Record<string, unknown>>(`/fideicomiso/config/inversionista/${id}`),
  cfgActualizarInversionista: (id: string, dto: InversionistaInput) =>
    api.patch<{ ok: true }>(`/fideicomiso/config/inversionista/${id}`, dto),
  // Documentos
  cfgDocs: (inversionista: string) =>
    api.get<CfgDoc[]>(`/fideicomiso/config/docs${qs({ inversionista })}`),
  cfgSubirDoc: (idInversionista: string, titulo: string, descripcion: string, archivo: File) => {
    const fd = new FormData();
    fd.append('idInversionista', idInversionista);
    fd.append('titulo', titulo);
    fd.append('descripcion', descripcion);
    fd.append('archivo', archivo);
    return api.postForm<{ idDocumento: string }>('/fideicomiso/config/docs', fd);
  },
  cfgEliminarDoc: (idDocumento: string) =>
    api.delete<{ ok: true }>(`/fideicomiso/config/docs/${idDocumento}`),
  // Condiciones
  cfgCondiciones: (propiedad: string) =>
    api.get<CfgCondiciones | null>(`/fideicomiso/config/condiciones${qs({ propiedad })}`),
  cfgGuardarCondiciones: (dto: CondicionesInput) =>
    api.post<{ ok: true }>('/fideicomiso/config/condiciones', dto),
  // Naves / Propiedades
  cfgParques: () =>
    api.get<{ idParque: string; nomParque: string | null }[]>('/fideicomiso/config/parques'),
  cfgCrearNave: (dto: NaveTicketInput) =>
    api.post<{ idPropiedad: string }>('/fideicomiso/config/naves', dto),
  cfgEliminarPropiedad: (idPropiedad: string) =>
    api.delete<{ ok: true }>(`/fideicomiso/config/propiedades/${idPropiedad}`),
  // PDP
  cfgPdp: (propiedad: string) =>
    api.get<CfgPdp>(`/fideicomiso/config/pdp${qs({ propiedad })}`),
  cfgCrearPdp: (dto: CrearPdpInput) =>
    api.post<{ idPdp: string }>('/fideicomiso/config/pdp', dto),
  cfgEditarMontoPartida: (idPdpDet: string, monto: number) =>
    api.patch<{ ok: true }>(`/fideicomiso/config/partida/${idPdpDet}/monto`, { monto }),
  cfgEditarTipoPartida: (idPdpDet: string, tipoPago: string) =>
    api.patch<{ ok: true }>(`/fideicomiso/config/partida/${idPdpDet}/tipo`, { tipoPago }),
  cfgEditarFechaPartida: (idPdpDet: string, fecha: string) =>
    api.patch<{ ok: true }>(`/fideicomiso/config/partida/${idPdpDet}/fecha`, { fecha }),
  cfgRecalcular: (idPdp: string) =>
    api.post<{ ok: true }>(`/fideicomiso/config/pdp/${idPdp}/recalcular`),
  cfgActivarPdp: (idPropiedad: string) =>
    api.patch<{ ok: true }>(`/fideicomiso/config/pdp/${idPropiedad}/activar`),
  cfgDesactivarPdp: (idPropiedad: string) =>
    api.patch<{ ok: true }>(`/fideicomiso/config/pdp/${idPropiedad}/desactivar`),
  cfgEliminarPdp: (propiedad: string, idPdp: string) =>
    api.delete<{ ok: true }>(`/fideicomiso/config/pdp${qs({ propiedad, idPdp })}`),
};

// ----------------------------- Tipos de configuración -----------------------------

export interface CfgPropiedadOpt {
  idPropiedad: string | null;
  nomDescriptivo: string | null;
  idNave: string | null;
  idInversionista: string | null;
  tienenPdp: boolean | null;
  pdpActivo: boolean | null;
  idPdp: string | null;
}

export interface CfgPropiedadFide {
  idPropiedad: string | null;
  idInversionista: string | null;
  nominversionista: string | null;
  idNave: string | null;
  nomDescriptivo: string | null;
  fc: string | null;
  idUser: string | null;
  creadoPor: string | null;
  tienenPdp: boolean | null;
  pdpActivo: boolean | null;
  totalpdp: number | null;
  totalpagos: number | null;
  avance_porcentaje: number | null;
}

export interface CfgDoc {
  idDocumento: string;
  titulo: string | null;
  descripcion: string | null;
  urldoc: string | null;
}

export interface CfgCondiciones {
  idfideCond: string;
  idFide: string | null;
  idPropiedad: string;
  noAdhesion: string | null;
  PM: string | null;
  Medio: string | null;
  Apartado: number | null;
  rendimiento: number | null;
  comentarios: string | null;
  'Prom9%': boolean | null;
}

export interface CfgPartida {
  idPdpDet: string;
  idPdp: string | null;
  numPago: number | null;
  fecha: string | null;
  monto: number | null;
  tipoPago: string | null;
}

export interface CfgPdp {
  propiedad: {
    idPropiedad: string;
    idPdp: string | null;
    idNave: string | null;
    idInversionista: string | null;
    tienenPdp: boolean | null;
    pdpActivo: boolean | null;
  };
  pdp: { idPdp: string; monto: number | null; cantpagos: number | null; pdpactivo: boolean | null; Editable: boolean | null } | null;
  detalle: CfgPartida[];
  totales: { idPdp: string | null; monto: number | null; monto_completo: number | null; montos_son_iguales: boolean | null; diferencia_monto: number | null } | null;
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

export interface CondicionesInput {
  idPropiedad: string;
  idfideCond?: string;
  noAdhesion: string;
  pm: string;
  medio: string;
  apartado: number;
  rendimiento: number;
  prom9?: boolean;
  comentarios?: string;
}

export interface NaveTicketInput {
  idInversionista: string;
  idParque: string;
  nave: 'A' | 'B' | 'C' | 'D' | 'E';
  id: '1' | '2' | '3' | '4';
}

export interface CrearPdpInput {
  idPropiedad: string;
  fecha: string;
  cantPagos: number;
  valTicket: number;
}
