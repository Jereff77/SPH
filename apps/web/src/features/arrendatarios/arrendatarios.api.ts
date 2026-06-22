import { api } from '@/lib/api';

// ============================ Planes de Renta ============================

export interface ArrendatarioOpt {
  idInversionista: string;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  razonsocial: string | null;
}

/**
 * Nombre a mostrar de un arrendatario. Igual que en Ventas: se prioriza la razón
 * social; si está vacía, se arma con nombre + apellidos. (Gotcha del módulo:
 * el "arrendador" es un registro de `inversionista`.)
 */
export function nombreArrendatario(a: {
  nombre?: string | null;
  apellido1?: string | null;
  apellido2?: string | null;
  razonsocial?: string | null;
}): string {
  return a.razonsocial?.trim()
    ? a.razonsocial
    : [a.nombre, a.apellido1, a.apellido2].filter(Boolean).join(' ');
}

/** Nave arrendada (vista `v_arrendadasNaves`). */
export interface PropiedadArrendada {
  idNavArrend: string;
  idArrendadoPdp: string | null;
  nomDescriptivo: string | null;
  idParque: string | null;
  idNave: string | null;
  nomParque: string | null;
  numNave: number | null;
  numNaveNAME: string | null;
  tienePdp: boolean | null;
  pdpActivo: boolean | null;
}

export type ArrePdpVigente = 'Si' | '3 Meses' | '2 Meses' | '1 Mes' | 'No';

/** Cabecera de un plan de pago de renta (`arrePdp`). */
export interface PlanRenta {
  idArrePdp: string;
  idNavArrend: string | null;
  idArrendador: string | null;
  fecInicio: string | null;
  fecFin: string | null;
  plazo: number | null;
  deposito: number | null;
  precioM2: number | null;
  construccionM2: number | null;
  rtaBase: number | null;
  INPC: number | null;
  INPCPlus: number | null;
  pm2Admin: number | null;
  pm2Mtto: number | null;
  pm2Vig: number | null;
  Moneda: string | null;
  vigente: boolean | null;
  arrePdpVigente: ArrePdpVigente | null;
}

/** Fila de la corrida resumida (RPC `arrepdpdetalle_obtener_resumen_por_plan`). */
export interface ResumenPartida {
  numPartida: number;
  anio: number;
  fecha: string;
  pm2: number;
  constM2: number;
  INPC: number;
  ptsINPC: number;
  totalINPC: number;
  ciclo: number;
  total_cantidad: number;
  idArrePdp: string;
  pdpactivo: boolean;
}

export type MesGratis = 'No' | 'Si' | 'Medio';

/** Partida del detalle (`arrePdpDetalle`) — incluye flag de cortesía. */
export interface DetallePartida {
  idArrePdpDet: string;
  idArrePdp: string;
  numPartida: number | null;
  anio: number | null;
  ciclo: number | null;
  concepto: string | null;
  fecha: string | null;
  pm2: number | null;
  constM2: number | null;
  INPC: number | null;
  ptsINPC: number | null;
  inpcTotal: number | null;
  cantidad: number | null;
  cantidadAplicada: number | null;
  tieneMesGratis: MesGratis | null;
  comprobantePago: string | null;
  fecPago: string | null;
  moneda: string | null;
}

export interface InpcRow {
  id: string;
  anio: number | null;
  mes: number | null;
  inpc: number | null;
}

export interface DatosGeneralesArre {
  idInversionista: string;
  personalidad: string | null;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  razonsocial: string | null;
  fecNacimiento: string | null;
  telefono: string | null;
  correo: string | null;
  RFC: string | null;
  CURP: string | null;
}

export interface DocArreRow {
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
  numNave: number | null;
  numNaveNAME: string | null;
  lote: number | null;
  mza: number | null;
  terreno: number | null;
  construccion: number | null;
  precio: number | null;
}

export interface CrearPlanRentaInput {
  idArrendador: string;
  fecInicio: string;
  plazo: number;
  m2Construccion: number;
  deposito: number;
  precioM2: number;
  pm2Admin: number;
  pm2Mtto: number;
  pm2Vig: number;
  inpcPlus: number;
  moneda: 'MXN' | 'USD';
  cortesiaRenta: number;
  cortesiaAdmin: number;
  cortesiaMtto: number;
  cortesiaVig: number;
}

export interface EditarCampoInput {
  anioDesde: number;
  concepto: string;
  campo: 'pm2' | 'constM2' | 'INPC' | 'ptsINPC';
  valor: number;
}

export interface ConceptoInput {
  concepto: string;
  monto: number;
  mesInicio: number;
  periodo: number;
  dividir: boolean;
}

/** Datos para precargar el formulario de renovación (último mes del plan anterior). */
export interface RenovacionPrecarga {
  idArrePdp: string;
  fecInicio: string;
  fecFinActual: string | null;
  arrePdpVigente: ArrePdpVigente | null;
  plazo: number;
  m2Construccion: number;
  deposito: number;
  precioM2: number;
  pm2Admin: number;
  pm2Mtto: number;
  pm2Vig: number;
  inpcPlus: number;
  moneda: 'MXN' | 'USD';
}

export interface RenovarInput {
  plazo: number;
  m2Construccion: number;
  deposito: number;
  precioM2: number;
  pm2Admin: number;
  pm2Mtto: number;
  pm2Vig: number;
  inpcPlus: number;
  moneda: 'MXN' | 'USD';
  cortesiaRenta: number;
  cortesiaAdmin: number;
  cortesiaMtto: number;
  cortesiaVig: number;
}

/** Partida candidata a cancelación (mes de la corrida). */
export interface CancelacionPartida {
  numPartida: number;
  fecha: string;
  monto: number;
  pagada: boolean;
}

/** Precarga del modal de cancelación anticipada. */
export interface CancelacionPrecarga {
  /** Primera partida cancelable (último mes pagado + 1). */
  primerCancelable: number;
  partidas: CancelacionPartida[];
}

export interface CancelarAnticipadoInput {
  /** Primera partida que YA NO se cobra; se conservan las anteriores. */
  numPartidaCorte: number;
  motivo: string;
}

/** Fila del reporte de Cancelaciones Anticipadas. */
export interface CancelacionReporteRow {
  idArrePdp: string;
  arrendatario: string;
  parque: string | null;
  nave: string | null;
  fecInicio: string | null;
  fecFin: string | null;
  fecCancelacion: string | null;
  motivo: string | null;
  cancelo: string | null;
  moneda: string | null;
}

/** Fila del reporte de Vencimientos: contrato activo vencido o por vencer. */
export interface VencimientoReporteRow {
  idArrePdp: string;
  idNavArrend: string;
  arrendatario: string;
  parque: string | null;
  nave: string | null;
  fecInicio: string | null;
  fecFin: string | null;
  /** 'No' (vencido) | '1 Mes' | '2 Meses' | '3 Meses'. */
  estado: string;
  rentaBase: number;
  moneda: string | null;
}

/** Plan (arrePdp) de una nave para el selector del estado de cuenta. */
export interface EstadoCuentaPlanOpcion {
  idArrePdp: string;
  fecInicio: string | null;
  fecFin: string | null;
  plazo: number | null;
  moneda: string | null;
  vigencia: string | null;
}

/** Nave arrendada con sus planes (selectores Parque → Nave → Plan). */
export interface EstadoCuentaNave {
  idNavArrend: string;
  idParque: string;
  parque: string;
  nave: string;
  arrendatario: string;
  planes: EstadoCuentaPlanOpcion[];
}

/** Cabecera del estado de cuenta (datos del plan arrePdp). */
export interface EstadoCuentaCabecera {
  idArrePdp: string;
  arrendatario: string;
  parque: string;
  nave: string;
  moneda: string;
  estado: 'VIGENTE' | 'TERMINADO' | 'CANCELADO';
  fecInicio: string | null;
  fecFin: string | null;
  plazo: number | null;
  deposito: number;
  vigencia: string | null;
  precioM2: number;
  construccionM2: number;
  pm2Admin: number;
  pm2Mtto: number;
  pm2Vig: number;
  inpcPlus: number;
}

/** Partida (mes) de la corrida desglosada por concepto. */
export interface EstadoCuentaPartida {
  numPartida: number;
  anio: number | null;
  ciclo: number | null;
  fecha: string | null;
  pm2: number;
  constM2: number;
  inpc: number;
  inpcTotal: number;
  renta: number;
  admin: number;
  mtto: number;
  vig: number;
  otros: number;
  nota: string;
  total: number;
  montoPagado: number;
  fecPago: string | null;
  pagado: boolean;
}

/** Estado de cuenta de un plan: cabecera + corrida. */
export interface EstadoCuentaCorrida {
  cabecera: EstadoCuentaCabecera;
  partidas: EstadoCuentaPartida[];
}

// ============================ Cobranza ============================

export interface FiltrosCobranza {
  anios: number[];
  parques: ParqueOpcion[];
}

/** Fila del tablero (RPC `pagos_arrendatarios`). */
export interface PagoArreRow {
  id_detalle: string;
  fecha: string | null;
  nave: string | null;
  parque: string | null;
  razon_social: string | null;
  concepto: string | null;
  /** Monto **con IVA incluido** (`base + iva`); es el que cuadra con la transferencia. */
  monto: number | null;
  /** Monto sin IVA (cantidad de la partida). */
  base?: number | null;
  /** IVA de la partida (0 para Depósito Garantía). */
  iva?: number | null;
  divisa: string | null;
  fec_pago: string | null;
  id_arrepdp: string | null;
  num_partida: number | null;
}

export interface ContratoPorVencer {
  nave: string | null;
  parque: string | null;
  razon_social: string | null;
  fec_fin: string | null;
  moneda: string | null;
}

export interface ContratoVencido extends ContratoPorVencer {
  dias_vencido: number | null;
}

export interface DepositoSinAplicar {
  idmov: string;
  fec_operacion: string | null;
  ordenante: string | null;
  importe: number | null;
  rastreo: string | null;
  moneda: string | null;
  /** Concepto del depósito (ayuda a identificar a quién corresponde). */
  concepto?: string | null;
  /** true si el ordenante ya pagó antes a este arrendatario (mapeo aprendido). */
  sugerido?: boolean;
}

export interface AplicarPagoInput {
  idmov: string;
  idsDetalle: string[];
  fecPago: string;
}

/** Entrada del registro de movimientos (una aplicación de pago agrupada por uidPago). */
export interface MovimientoPago {
  uidPago: string;
  idmov: string;
  idArrendador: string | null;
  fecPago: string;
  uid: string | null;
  /** 'aplicado' | 'desaplicado'. */
  estado: string;
  aplicadoEn: string;
  desaplicadoPor: string | null;
  desaplicadoEn: string | null;
  motivo: string | null;
  monto: number;
  partidas: number;
  ordenante?: string | null;
  razonSocial?: string | null;
}

/** Fila nueva registrada al importar un estado de cuenta. */
export interface MovimientoImportado {
  fecOperacion: string | null;
  ordenante: string | null;
  bancoEmisor: string | null;
  cancepto: string | null;
  importe: number;
  rastreo: string | null;
}

/** Resumen de la importación de un estado de cuenta (BanBajío). */
export interface ImportarEstadoCuentaResultado {
  leidos: number;
  totalSpei: number;
  nuevos: number;
  yaExistian: number;
  montoNuevos: number;
  filas: MovimientoImportado[];
}

function dq(
  params: Record<string, string | number | boolean | (string | number)[] | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    if (Array.isArray(v)) {
      for (const it of v) if (it !== undefined && it !== '') sp.append(k, String(it));
    } else {
      sp.set(k, String(v));
    }
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const arrendatariosApi = {
  // Planes de Renta
  lista: () => api.get<ArrendatarioOpt[]>('/arrendatarios/lista'),
  propiedades: (idArrendador: string) =>
    api.get<PropiedadArrendada[]>(`/arrendatarios/${idArrendador}/propiedades`),
  planes: (idNavArrend: string, idArrendador: string) =>
    api.get<PlanRenta[]>(`/arrendatarios/propiedades/${idNavArrend}/planes${dq({ idArrendador })}`),
  resumen: (idArrePdp: string) =>
    api.get<ResumenPartida[]>(`/arrendatarios/planes/${idArrePdp}/resumen`),
  detalle: (idArrePdp: string, numPartida?: number) =>
    api.get<DetallePartida[]>(`/arrendatarios/planes/${idArrePdp}/detalle${dq({ numPartida })}`),
  crearPlan: (idNavArrend: string, dto: CrearPlanRentaInput) =>
    api.post<{ idArrePdp: string; mensaje: string }>(
      `/arrendatarios/propiedades/${idNavArrend}/planes`,
      dto,
    ),
  editarCampo: (idArrePdp: string, dto: EditarCampoInput) =>
    api.patch<{ ok: true }>(`/arrendatarios/planes/${idArrePdp}/detalle`, dto),
  agregarConcepto: (idArrePdp: string, dto: ConceptoInput) =>
    api.post<{ ok: true }>(`/arrendatarios/planes/${idArrePdp}/conceptos`, dto),
  eliminarConcepto: (idArrePdp: string, concepto: string) =>
    api.delete<{ ok: true }>(
      `/arrendatarios/planes/${idArrePdp}/conceptos/${encodeURIComponent(concepto)}`,
    ),
  activar: (idArrePdp: string, idNavArrend: string) =>
    api.post<{ ok: true }>(`/arrendatarios/planes/${idArrePdp}/activar${dq({ idNavArrend })}`, {}),
  desactivar: (idArrePdp: string, idNavArrend: string) =>
    api.post<{ ok: true }>(`/arrendatarios/planes/${idArrePdp}/desactivar${dq({ idNavArrend })}`, {}),
  eliminarPlan: (idArrePdp: string) =>
    api.delete<{ mensaje: string }>(`/arrendatarios/planes/${idArrePdp}`),
  renovacionPrecarga: (idArrePdp: string) =>
    api.get<RenovacionPrecarga>(`/arrendatarios/planes/${idArrePdp}/renovacion-precarga`),
  renovar: (idArrePdp: string, dto: RenovarInput) =>
    api.post<{ idArrePdp: string; mensaje: string }>(
      `/arrendatarios/planes/${idArrePdp}/renovar`,
      dto,
    ),
  cancelacionPrecarga: (idArrePdp: string) =>
    api.get<CancelacionPrecarga>(`/arrendatarios/planes/${idArrePdp}/cancelacion-precarga`),
  cancelarAnticipado: (idArrePdp: string, dto: CancelarAnticipadoInput) =>
    api.post<{ mensaje: string; fecCancelacion: string | null }>(
      `/arrendatarios/planes/${idArrePdp}/cancelar`,
      dto,
    ),

  // Reportes
  reporteCancelaciones: (f: { anio?: number; parque?: string; busqueda?: string }) =>
    api.get<CancelacionReporteRow[]>(`/arrendatarios/reportes/cancelaciones${dq(f)}`),
  reporteVencimientos: () =>
    api.get<VencimientoReporteRow[]>('/arrendatarios/reportes/vencimientos'),
  estadoCuentaOpciones: () =>
    api.get<EstadoCuentaNave[]>('/arrendatarios/reportes/estado-cuenta/opciones'),
  estadoCuentaCorrida: (idArrePdp: string) =>
    api.get<EstadoCuentaCorrida>(`/arrendatarios/reportes/estado-cuenta/${idArrePdp}`),

  // Config
  datos: (id: string) => api.get<DatosGeneralesArre>(`/arrendatarios/${id}/datos`),
  docs: (id: string) => api.get<DocArreRow[]>(`/arrendatarios/${id}/documentos`),
  subirDoc: (idInversionista: string, titulo: string, descripcion: string, archivo: File) => {
    const fd = new FormData();
    fd.append('idInversionista', idInversionista);
    fd.append('titulo', titulo);
    fd.append('descripcion', descripcion);
    fd.append('archivo', archivo);
    return api.postForm<{ idDocumento: string }>('/arrendatarios/documentos', fd);
  },
  eliminarDoc: (idDocumento: string) =>
    api.delete<{ ok: true }>(`/arrendatarios/documentos/${idDocumento}`),
  parques: () => api.get<ParqueOpcion[]>('/arrendatarios/parques'),
  navesDisponibles: (idParque?: string) =>
    api.get<NaveDisponible[]>(`/arrendatarios/naves-disponibles${dq({ idParque })}`),
  vincularNave: (dto: { idArrendador: string; idNave: string; idParque?: string }) =>
    api.post<{ idNavArrend: string }>('/arrendatarios/propiedades', dto),
  liberarNave: (idNavArrend: string) =>
    api.post<{ ok: true }>(`/arrendatarios/propiedades/${idNavArrend}/liberar`, {}),
  inpc: () => api.get<InpcRow[]>('/arrendatarios/inpc'),

  // Cobranza
  filtrosCobranza: () => api.get<FiltrosCobranza>('/arrendatarios/cobranza/filtros'),
  cobranza: (p: {
    anios?: number[];
    meses?: number[];
    parque?: string;
    arrendatario?: string;
    soloPendientes?: boolean;
  }) =>
    api.get<PagoArreRow[]>(
      `/arrendatarios/cobranza/pagos${dq({
        anio: p.anios,
        mes: p.meses,
        parque: p.parque,
        arrendatario: p.arrendatario,
        soloPendientes: p.soloPendientes,
      })}`,
    ),
  contratosPorVencer: (desde?: string, hasta?: string) =>
    api.get<ContratoPorVencer[]>(`/arrendatarios/cobranza/contratos-por-vencer${dq({ desde, hasta })}`),
  contratosVencidos: () =>
    api.get<ContratoVencido[]>('/arrendatarios/cobranza/contratos-vencidos'),
  depositosSinAplicar: (busqueda?: string, anio?: number, mes?: number, idArrePdp?: string) =>
    api.get<DepositoSinAplicar[]>(
      `/arrendatarios/cobranza/depositos-sin-aplicar${dq({ busqueda, anio, mes, idArrePdp })}`,
    ),
  aplicarPago: (dto: AplicarPagoInput) =>
    api.post<{ estado: 'Exacto'; importe: number; total: number }>(
      '/arrendatarios/cobranza/aplicar-pago',
      dto,
    ),
  desaplicarPago: (uidPago: string, motivo?: string) =>
    api.post<{ ok: true; partidas: number; idmov: string }>(
      '/arrendatarios/cobranza/desaplicar-pago',
      { uidPago, motivo },
    ),
  historialPagos: (p: { idArrendador?: string; idArrePdp?: string; limite?: number } = {}) =>
    api.get<MovimientoPago[]>(`/arrendatarios/cobranza/historial-pagos${dq(p)}`),
  importarEstadoCuenta: (archivo: File) => {
    const fd = new FormData();
    fd.append('archivo', archivo);
    return api.postForm<ImportarEstadoCuentaResultado>(
      '/arrendatarios/cobranza/importar-estado-cuenta',
      fd,
    );
  },
};

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** "Hoy" en horario de México (yyyy-MM-dd), igual que en Ventas. */
export const hoyMexico = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());

/** Moneda según divisa (MXN/USD); nunca mezcla divisas. */
export const moneda = (n: number | null | undefined, divisa: string = 'MXN'): string =>
  (n ?? 0).toLocaleString('es-MX', {
    style: 'currency',
    currency: divisa === 'USD' ? 'USD' : 'MXN',
  });

export const num = (n: number | null | undefined): string =>
  (n ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fechaCorta = (iso: string | null): string => {
  if (!iso) return '—';
  const p = (iso.split('T')[0] ?? iso).split('-');
  return p.length === 3 ? `${Number(p[2])}/${Number(p[1])}/${p[0]}` : iso;
};
