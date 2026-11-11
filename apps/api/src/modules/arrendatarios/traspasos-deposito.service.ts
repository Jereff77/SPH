import { type HttpException, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { exigirPermiso } from '../../common/auth/exigir-permiso.js';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type { RevertirTraspasoDto, TraspasarDepositoDto } from './arrendatarios.schemas.js';
import {
  aMicro,
  calcularDeposito,
  deMicro,
  diaSiguiente,
  esConceptoDeposito,
  excepcionConCodigo,
  fmtFechaCorta,
  fmtMonto,
  navePorPlan,
  num,
  rpcSinTipar,
  sumarTraspasos,
  type RpcPaquete,
  type TraspasoRow,
} from './deposito.util.js';
import { monedaEfectiva, monedaValida } from './moneda.util.js';

/**
 * Traspaso de depósito de garantía (00 v2.1, D1–D17). La BD es la AUTORIDAD de las
 * reglas (funciones `arre_traspasar_deposito`, `arre_revertir_traspaso`,
 * `arre_traspaso_candidatos`): aquí solo se valida la forma (zod, en el controlador),
 * se exigen permisos, se llaman las funciones SIEMPRE con `comoActor(uid)` (leen
 * `auth.uid()`) y se traducen los códigos a HTTP + texto escrito a mano.
 *
 * ⛔ Regla 4b: jamás se reenvía el `mensaje` de la RPC ni `error.message`; los
 * imprevistos (`ERROR_INTERNO`, `SIN_ACTOR`, códigos desconocidos) van al log y al
 * cliente un genérico.
 */

const MSG_GENERICO = 'No se pudo completar la operación. Inténtalo de nuevo.';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COLS_TRASPASO =
  'id, idArrePdpOrigen, idArrePdpDestino, idDetOrigen, idDetDestino, moneda, monto, marcoPagada, fecTraspaso, nota, estado, claveIdempotencia, uid, fc, revertidoPor, fecReversion, motivoReversion';

// ----------------------------- Textos (escritos a mano) -----------------------------

type Detalles = Record<string, unknown>;

/**
 * Motivos por los que un candidato a origen sale bloqueado (`arre_traspaso_candidatos.bloqueo`
 * y `detalles.bloq` de `ORIGEN_BLOQUEADO`): MONEDA_DISTINTA, DEPOSITO_EN_CERO, YA_TRASPASADO,
 * DEPOSITO_NO_ESTANDAR, DEPOSITO_AMBIGUO, INCLUIDO_EN_SIGUIENTE, SUCESOR_SIN_DEPOSITO. Cada uno
 * con su texto escrito a mano (mapa de mensajes de bloqueo del traspaso).
 */
export function textoBloqueo(
  bloqueo: string,
  d: { moneda?: string | null; depositoPlan?: number | null } = {},
): string {
  switch (bloqueo) {
    case 'DEPOSITO_AMBIGUO':
      return 'Este plan tiene más de una partida de depósito; pide apoyo a soporte.';
    case 'MONEDA_DISTINTA':
      return `Está en otra moneda${d.moneda ? ` (${d.moneda})` : ''}; no se puede traspasar sin tipo de cambio.`;
    case 'DEPOSITO_NO_ESTANDAR':
      return 'Su depósito tiene una estructura no estándar; no se puede traspasar.';
    case 'DEPOSITO_EN_CERO':
      return `Su depósito está en 0 en la corrida, pero el contrato dice ${fmtMonto(d.depositoPlan)}; no se puede traspasar hasta registrar el depósito recibido.`;
    case 'YA_TRASPASADO':
      return 'Su depósito ya fue traspasado a otro contrato.';
    case 'INCLUIDO_EN_SIGUIENTE':
      return 'Su depósito ya está incluido en el contrato siguiente de esta nave. Para limpiar el historial, traspásalo desde ese contrato.';
    case 'SUCESOR_SIN_DEPOSITO':
      return 'El contrato siguiente de esta nave tiene depósito en 0; probablemente se consolidó en otra nave del mismo arrendatario. Revisa los planes.';
    default:
      return 'No disponible para traspasar.';
  }
}

interface RespuestaCodigo {
  status: 400 | 404 | 409;
  mensaje: string;
}

/**
 * Código de negocio de la BD → HTTP + texto. `null` = imprevisto (ERROR_INTERNO,
 * SIN_ACTOR o desconocido): el llamador lo registra y responde un genérico.
 * Las cifras salen de `detalles` y se formatean con 2–4 decimales.
 */
export function respuestaDeCodigo(codigo: string, d: Detalles = {}): RespuestaCodigo | null {
  const t = (status: 400 | 404 | 409, mensaje: string): RespuestaCodigo => ({ status, mensaje });
  switch (codigo) {
    // 400 — dato faltante o inválido
    case 'CONFIRMACION_REQUERIDA':
      return t(400, 'Debes confirmar que el depósito del contrato anterior fue recibido.');
    case 'NOTA_INVALIDA':
      return t(400, 'La nota debe tener entre 10 y 400 caracteres (por ejemplo, el folio del contrato anterior).');
    case 'FECHA_INVALIDA':
      return t(400, 'La fecha del traspaso es obligatoria, no puede ser futura ni anterior al 01/01/2020.');
    case 'PARAMETRO_INVALIDO':
      return t(400, 'Los datos del traspaso están incompletos o repetidos. Revisa los contratos de origen elegidos.');
    case 'MOTIVO_INVALIDO':
      return t(400, 'El motivo debe tener entre 5 y 400 caracteres.');
    case 'ORIGEN_ES_DESTINO':
      return t(400, 'Un contrato no puede traspasar su depósito a sí mismo.');
    case 'ORIGEN_NO_VALIDO':
      return t(400, 'Alguno de los contratos elegidos no es un origen válido para este destino. Actualiza la lista de candidatos.');
    // 409 — el destino/origen no admite la operación
    case 'ORIGEN_BLOQUEADO': {
      const motivo = typeof d.bloq === 'string' ? d.bloq : '';
      return t(
        409,
        `No se puede traspasar desde el contrato elegido. ${textoBloqueo(motivo, { depositoPlan: d.depPlan == null ? null : num(d.depPlan) })}`,
      );
    }
    case 'EXCEDE_DESTINO':
      return t(
        409,
        `Los depósitos elegidos (${fmtMonto(num(d.total))}) superan el del nuevo contrato (${fmtMonto(num(d.cantidadDestino))}). Quita un origen o ajusta el depósito nuevo.`,
      );
    case 'DESTINO_PAGADO':
      return t(409, 'El depósito del contrato destino ya tiene un pago aplicado; no admite traspaso.');
    case 'DESTINO_SIN_SALDO':
      return t(409, 'El depósito del contrato destino ya está en 0; no hay nada que cubrir con un traspaso.');
    case 'DEPOSITO_NO_ESTANDAR':
      return t(409, 'El depósito del contrato destino tiene una estructura no estándar y no admite traspaso.');
    case 'DEPOSITO_DESTINO_INVALIDO':
      return t(409, 'El contrato destino debe tener exactamente una partida de depósito de garantía.');
    case 'MONEDA_INVALIDA':
      return t(409, 'El depósito del contrato destino no tiene una moneda válida (MXN o USD).');
    case 'FECHAS_INVALIDAS':
      return t(409, 'El contrato destino no tiene fecha de inicio.');
    // 409 — reversa
    case 'PAGO_APLICADO':
      return t(409, 'Primero desaplica el pago del depósito (Registro de movimientos).');
    case 'DESTINO_YA_EMITIO':
      return t(409, 'El contrato destino ya traspasó su depósito a otro contrato. Revierte primero ese traspaso.');
    case 'REVERTIR_ANTES_OTRO':
      return t(409, 'Hay otro traspaso al mismo contrato que lo dejó en 0. Revierte primero ese traspaso.');
    case 'YA_REVERTIDO':
      return t(409, 'Ese traspaso ya fue revertido.');
    // 409 — cambió mientras operabas
    case 'OCUPADO':
      return t(409, 'Otro usuario está modificando este depósito. Recarga e inténtalo de nuevo.');
    case 'PARTIDA_CAMBIO':
      return t(409, 'El depósito cambió mientras operabas. Recarga e inténtalo de nuevo.');
    case 'DEPOSITO_TRASPASADO':
      return t(409, 'Ese depósito ya fue traspasado a otro contrato.');
    case 'ESTADO_INCONSISTENTE':
      return t(409, 'El depósito cambió después del traspaso y no se puede revertir automáticamente. Contacta a soporte.');
    // 404
    case 'DESTINO_NO_ENCONTRADO':
      return t(404, 'Contrato destino no encontrado.');
    case 'TRASPASO_NO_ENCONTRADO':
      return t(404, 'Traspaso no encontrado.');
    default:
      return null;
  }
}

function excepcionHttp(status: number, mensaje: string, codigo: string): HttpException {
  return excepcionConCodigo(status, mensaje, codigo);
}

/** Guardas D13 (solo si el plan participa en traspasos; sin ellos, el flujo es idéntico). */
export type AccionGuarda =
  | 'eliminar_plan'
  | 'cambiar_moneda'
  | 'editar_deposito'
  | 'eliminar_concepto';

const MENSAJE_GUARDA: Record<AccionGuarda, string> = {
  eliminar_plan:
    'No se puede eliminar este contrato: participa en traspasos de depósito (aplicados o revertidos) y ese historial debe conservarse.',
  cambiar_moneda:
    'No se puede cambiar la moneda del depósito de garantía: participa en un traspaso aplicado. Revierte primero el traspaso.',
  editar_deposito:
    'No se puede editar a mano el depósito de garantía: participa en un traspaso aplicado. Revierte primero el traspaso.',
  eliminar_concepto:
    'No se puede eliminar el depósito de garantía: participa en un traspaso aplicado. Revierte primero el traspaso.',
};

// ----------------------------- Contratos de salida -----------------------------

/** Identificación legible de un plan (para etiquetas «Nave 12 · dd/mm/aaaa – dd/mm/aaaa»). */
export interface PlanEtiqueta {
  idArrePdp: string;
  nave: string | null;
  parque: string | null;
  fecInicio: string | null;
  fecFin: string | null;
}

/** «Nave 12 · 17/10/2025 – 16/10/2026» (o «otro contrato» si no se pudo identificar). */
export function textoPlan(e: PlanEtiqueta | null | undefined): string {
  if (!e) return 'otro contrato';
  const nave = e.nave ? `Nave ${e.nave}` : 'otro contrato';
  return e.fecInicio || e.fecFin ? `${nave} · ${fmtFechaCorta(e.fecInicio)} – ${fmtFechaCorta(e.fecFin)}` : nave;
}

export interface TraspasoDto {
  id: string;
  /** `recibido` = el plan consultado es el destino; `emitido` = es el origen. */
  direccion: 'recibido' | 'emitido';
  estado: 'aplicado' | 'revertido';
  monto: number;
  moneda: string;
  fecTraspaso: string;
  nota: string;
  /** Esta fila dejó el destino en 0 (pagado por traspaso, sin pago bancario). */
  marcoPagada: boolean;
  /** El otro plan del par (origen si `recibido`, destino si `emitido`). */
  contraparte: PlanEtiqueta | null;
  registro: { uid: string; autor: string | null; fecha: string };
  reversion: { uid: string | null; autor: string | null; fecha: string; motivo: string | null } | null;
}

export interface EstadoDepositoDto {
  deposito: {
    idArrePdpDet: string;
    moneda: string;
    /** `cantidad` actual de la partida (ya con los traspasos recibidos descontados). */
    cantidad: number;
    recibido: number;
    emitido: number;
    /** `cantidad + recibido`: lo que valía la partida antes de recibir traspasos. */
    contractual: number;
    porCobrar: number;
    /** `cantidad + recibido − emitido` (D5): lo que el plan puede emitir hoy. */
    disponible: number;
    /** La partida tiene `fecPago` (pago bancario real o pagada por traspaso). */
    pagada: boolean;
    fecPago: string | null;
    /** Una fila recibida aplicada dejó la partida en 0 (etiqueta «Pagado por traspaso»). */
    pagadaPorTraspaso: boolean;
  } | null;
  traspasos: TraspasoDto[];
}

export type TipoCandidato = 'RENOVADO' | 'MISMA_NAVE' | 'HERMANA';

export interface CandidatoDto {
  idArrePdp: string;
  idNavArrend: string;
  idArrePdpDet: string;
  fecInicio: string | null;
  fecFin: string | null;
  finEfectivo: string | null;
  mismaNave: boolean;
  tipo: TipoCandidato;
  nave: string | null;
  parque: string | null;
  moneda: string | null;
  cantidad: number;
  recibido: number;
  emitido: number;
  /** Lo que se traspasaría si se elige este origen (D5). */
  disponible: number;
  depositoPlan: number | null;
  /** Código del bloqueo (`null` = seleccionable). */
  bloqueo: string | null;
  bloqueoTexto: string | null;
}

export interface TraspasoAplicadoDto {
  total: number;
  cantidadRestante: number;
  pagadaPorTraspaso: boolean;
  /** `true` si era un reintento del mismo envío (idempotencia): no se duplicó nada. */
  yaAplicado: boolean;
  traspasos: Array<{ id: string; idArrePdpOrigen: string; monto: number }>;
}

export type TraspasoRenovacionDto =
  | { estado: 'omitido' }
  | ({ estado: 'aplicado' } & TraspasoAplicadoDto)
  | { estado: 'fallido'; codigo: string; mensaje: string };

export type ResultadoTraspaso =
  | { ok: true; data: TraspasoAplicadoDto }
  | { ok: false; status: number; codigo: string; mensaje: string };

interface CandidatoRpc {
  idArrePdp: string;
  idNavArrend: string;
  idArrePdpDet: string;
  fecInicio: string | null;
  fecFin: string | null;
  finEfectivo: string | null;
  mismaNave: boolean | null;
  moneda: string | null;
  cantidad: number | string | null;
  recibido: number | string | null;
  emitido: number | string | null;
  disponible: number | string | null;
  depositoPlan: number | string | null;
  bloqueo: string | null;
}

interface PartidaDeposito {
  idArrePdpDet: string;
  concepto: string | null;
  moneda: string | null;
  cantidad: number;
  fecPago: string | null;
}

type Db = ReturnType<SupabaseService['comoActor']>;

@Injectable()
export class TraspasosDepositoService {
  private readonly logger = new Logger(TraspasosDepositoService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /** Falla de la capa de datos: el detalle va al log y al cliente un 500 genérico con `codigo: ERROR_INTERNO` (regla 4b). */
  private falla(contexto: string, error: unknown): never {
    const detalle =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message)
        : String(error);
    this.logger.error(`${contexto}: ${detalle}`);
    throw excepcionConCodigo(500, MSG_GENERICO, 'ERROR_INTERNO');
  }

  /** `arre_traspasos_deposito` es nueva y aún no está en @erp/types: cliente sin tipar, localizado aquí. */
  private tabla() {
    return (this.supabase.admin as unknown as SupabaseClient).from('arre_traspasos_deposito');
  }

  // ----------------------------- Lectura -----------------------------

  private normalizar(r: Record<string, unknown>): TraspasoRow {
    return {
      id: String(r.id),
      idArrePdpOrigen: String(r.idArrePdpOrigen),
      idArrePdpDestino: String(r.idArrePdpDestino),
      idDetOrigen: String(r.idDetOrigen),
      idDetDestino: String(r.idDetDestino),
      moneda: String(r.moneda ?? ''),
      monto: num(r.monto),
      marcoPagada: r.marcoPagada === true,
      fecTraspaso: String(r.fecTraspaso ?? ''),
      nota: String(r.nota ?? ''),
      estado: r.estado === 'revertido' ? 'revertido' : 'aplicado',
      claveIdempotencia: String(r.claveIdempotencia ?? ''),
      uid: String(r.uid ?? ''),
      fc: String(r.fc ?? ''),
      revertidoPor: (r.revertidoPor as string | null) ?? null,
      fecReversion: (r.fecReversion as string | null) ?? null,
      motivoReversion: (r.motivoReversion as string | null) ?? null,
    };
  }

  /** Todas las filas (o solo las aplicadas) donde el plan es origen o destino, de la más antigua a la más reciente. */
  async filasDePlan(idArrePdp: string, opts: { soloAplicados?: boolean } = {}): Promise<TraspasoRow[]> {
    const consulta = (col: 'idArrePdpOrigen' | 'idArrePdpDestino') => {
      let q = this.tabla().select(COLS_TRASPASO).eq(col, idArrePdp);
      if (opts.soloAplicados) q = q.eq('estado', 'aplicado');
      return q.order('fc', { ascending: true }).limit(1000);
    };
    const [o, d] = await Promise.all([consulta('idArrePdpOrigen'), consulta('idArrePdpDestino')]);
    if (o.error) this.falla('traspasos.filas', o.error);
    if (d.error) this.falla('traspasos.filas', d.error);
    const porId = new Map<string, TraspasoRow>();
    for (const r of [...(o.data ?? []), ...(d.data ?? [])] as Record<string, unknown>[]) {
      const fila = this.normalizar(r);
      porId.set(fila.id, fila);
    }
    return [...porId.values()].sort(
      (a, b) => a.fc.localeCompare(b.fc) || a.id.localeCompare(b.id),
    );
  }

  /**
   * Lo traspasado por partida de depósito (solo filas `aplicado`): `emitido` por
   * `idDetOrigen` y `recibido` por `idDetDestino`. Lo consume `CobranzaService.pagos()`
   * (D6: la cobranza oculta lo traspasado). Tabla minúscula: se lee completa, por páginas.
   */
  async traspasosPorPartida(): Promise<{ emitido: Map<string, number>; recibido: Map<string, number> }> {
    const emi = new Map<string, number>();
    const rec = new Map<string, number>();
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await this.tabla()
        .select('idDetOrigen, idDetDestino, monto')
        .eq('estado', 'aplicado')
        .order('seq', { ascending: true })
        .range(desde, desde + 999);
      if (error) this.falla('traspasos.por-partida', error);
      const filas = (data ?? []) as Array<{ idDetOrigen: string; idDetDestino: string; monto: number | string }>;
      for (const f of filas) {
        emi.set(f.idDetOrigen, (emi.get(f.idDetOrigen) ?? 0) + aMicro(f.monto));
        rec.set(f.idDetDestino, (rec.get(f.idDetDestino) ?? 0) + aMicro(f.monto));
      }
      if (filas.length < 1000) break;
    }
    const aNormal = (m: Map<string, number>) => new Map([...m].map(([k, v]) => [k, deMicro(v)]));
    return { emitido: aNormal(emi), recibido: aNormal(rec) };
  }

  /**
   * Guarda D13: bloquea la acción si el plan participa en traspasos. `eliminar_plan`
   * cuenta TAMBIÉN las filas revertidas (la FK `RESTRICT` las bloquearía igual); las
   * demás solo las aplicadas. Sin traspasos no hace nada (comportamiento idéntico).
   */
  async exigirSinTraspasos(idArrePdp: string, accion: AccionGuarda): Promise<void> {
    const soloAplicados = accion !== 'eliminar_plan';
    const cuenta = (col: 'idArrePdpOrigen' | 'idArrePdpDestino') => {
      let q = this.tabla().select('id', { count: 'exact', head: true }).eq(col, idArrePdp);
      if (soloAplicados) q = q.eq('estado', 'aplicado');
      return q;
    };
    const [o, d] = await Promise.all([cuenta('idArrePdpOrigen'), cuenta('idArrePdpDestino')]);
    if (o.error) this.falla('traspasos.guarda', o.error);
    if (d.error) this.falla('traspasos.guarda', d.error);
    if ((o.count ?? 0) + (d.count ?? 0) > 0)
      throw excepcionConCodigo(
        409,
        MENSAJE_GUARDA[accion],
        accion === 'eliminar_plan' ? 'PLAN_CON_TRASPASOS' : 'TRASPASO_APLICADO',
      );
  }

  /**
   * Guarda D13 de *Desaplicar pago*: si alguna de las partidas ya emitió un traspaso APLICADO
   * (`idDetOrigen`), no se puede desaplicar su pago hasta revertir el traspaso. Solo las partidas
   * de depósito pueden ser `idDetOrigen`, así que basta una consulta. Sin traspasos no hace nada.
   */
  async exigirDepositosSinEmision(idsDet: string[]): Promise<void> {
    const ids = [...new Set(idsDet.filter(Boolean))];
    if (ids.length === 0) return;
    const { count, error } = await this.tabla()
      .select('id', { count: 'exact', head: true })
      .in('idDetOrigen', ids)
      .eq('estado', 'aplicado');
    if (error) this.falla('traspasos.guarda-desaplicar', error);
    if ((count ?? 0) > 0)
      throw excepcionConCodigo(
        409,
        'No se puede desaplicar este pago: el depósito de garantía ya fue traspasado a otro contrato. Revierte primero el traspaso de este depósito.',
        'TRASPASO_APLICADO',
      );
  }

  /** Partidas de depósito (`numPartida=0` + concepto «Depósito Garantía») activas del plan. */
  private async partidasDeposito(idArrePdp: string): Promise<PartidaDeposito[]> {
    const { data, error } = await this.supabase.admin
      .from('arrePdpDetalle')
      .select('idArrePdpDet, concepto, moneda, cantidad, fecPago')
      .eq('idArrePdp', idArrePdp)
      .eq('numPartida', 0)
      .eq('status', true);
    if (error) this.falla('traspasos.partida', error);
    return (data ?? [])
      .filter((d) => esConceptoDeposito(d.concepto))
      .map((d) => ({
        idArrePdpDet: d.idArrePdpDet,
        concepto: d.concepto,
        moneda: d.moneda,
        cantidad: num(d.cantidad),
        fecPago: d.fecPago ?? null,
      }));
  }

  private async nombresDe(uids: string[]): Promise<Map<string, string>> {
    const nombres = new Map<string, string>();
    const ids = [...new Set(uids.filter((u) => UUID_RE.test(u)))];
    if (ids.length === 0) return nombres;
    const { data, error } = await this.supabase.admin
      .from('catUsers')
      .select('uid, nomCompleto, nombre, apellidos')
      .in('uid', ids);
    if (error) this.falla('traspasos.autores', error);
    for (const u of data ?? [])
      nombres.set(
        u.uid,
        u.nomCompleto?.trim() || [u.nombre, u.apellidos].filter(Boolean).join(' ').trim() || 'Usuario',
      );
    return nombres;
  }

  /** Nave, parque y vigencia de varios planes (para etiquetar contrapartes y candidatos). */
  async etiquetasDePlanes(ids: string[]): Promise<Map<string, PlanEtiqueta>> {
    const unicos = [...new Set(ids.filter(Boolean))];
    const out = new Map<string, PlanEtiqueta>();
    if (unicos.length === 0) return out;
    const [naves, { data: planes, error }] = await Promise.all([
      navePorPlan(this.supabase, unicos),
      this.supabase.admin.from('arrePdp').select('idArrePdp, fecInicio, fecFin').in('idArrePdp', unicos),
    ]);
    if (error) this.falla('traspasos.etiquetas', error);
    for (const p of planes ?? []) {
      const nv = naves.get(p.idArrePdp);
      out.set(p.idArrePdp, {
        idArrePdp: p.idArrePdp,
        nave: nv?.nave ?? null,
        parque: nv?.parque ?? null,
        fecInicio: p.fecInicio ?? null,
        fecFin: p.fecFin ?? null,
      });
    }
    return out;
  }

  /** `GET planes/:id/deposito` — tarjeta «Depósito contractual · Traspasado · Por cobrar» + lista de traspasos. */
  async estadoPlan(idArrePdp: string): Promise<EstadoDepositoDto> {
    const { data: plan, error } = await this.supabase.admin
      .from('arrePdp')
      .select('idArrePdp, Moneda')
      .eq('idArrePdp', idArrePdp)
      .maybeSingle();
    if (error) this.falla('traspasos.estado', error);
    if (!plan) throw excepcionConCodigo(404, 'Plan no encontrado.', 'PLAN_NO_ENCONTRADO');

    const [partidas, filas] = await Promise.all([
      this.partidasDeposito(idArrePdp),
      this.filasDePlan(idArrePdp),
    ]);

    // Contrapartes y autores de todas las filas (aplicadas y revertidas).
    const otros = filas.map((f) => (f.idArrePdpOrigen === idArrePdp ? f.idArrePdpDestino : f.idArrePdpOrigen));
    const [etiquetas, nombres] = await Promise.all([
      this.etiquetasDePlanes(otros),
      this.nombresDe(filas.flatMap((f) => [f.uid, f.revertidoPor ?? ''])),
    ]);

    const traspasos: TraspasoDto[] = filas.map((f) => {
      const emitido = f.idArrePdpOrigen === idArrePdp;
      return {
        id: f.id,
        direccion: emitido ? 'emitido' : 'recibido',
        estado: f.estado,
        monto: f.monto,
        moneda: f.moneda,
        fecTraspaso: f.fecTraspaso,
        nota: f.nota,
        marcoPagada: f.marcoPagada,
        contraparte: etiquetas.get(emitido ? f.idArrePdpDestino : f.idArrePdpOrigen) ?? null,
        registro: { uid: f.uid, autor: nombres.get(f.uid) ?? null, fecha: f.fc },
        reversion:
          f.estado === 'revertido'
            ? {
                uid: f.revertidoPor,
                autor: f.revertidoPor ? (nombres.get(f.revertidoPor) ?? null) : null,
                fecha: f.fecReversion ?? '',
                motivo: f.motivoReversion,
              }
            : null,
      };
    });

    if (partidas.length !== 1) return { deposito: null, traspasos };

    const p = partidas[0]!;
    const { recibido, emitido } = sumarTraspasos(filas, idArrePdp);
    const pagada = !!p.fecPago;
    const calc = calcularDeposito({ cantidad: p.cantidad, recibido, emitido, pagada });
    return {
      deposito: {
        idArrePdpDet: p.idArrePdpDet,
        moneda: monedaEfectiva(p.moneda, plan.Moneda),
        cantidad: p.cantidad,
        recibido,
        emitido,
        contractual: calc.contractual,
        porCobrar: calc.porCobrar,
        disponible: calc.disponible,
        pagada,
        fecPago: p.fecPago,
        pagadaPorTraspaso: filas.some(
          (f) => f.estado === 'aplicado' && f.idArrePdpDestino === idArrePdp && f.marcoPagada,
        ),
      },
      traspasos,
    };
  }

  // ----------------------------- Candidatos a origen -----------------------------

  private async consultarCandidatos(
    a: {
      idArrendador: string;
      idNavArrend: string;
      fecInicioDestino: string;
      moneda: string | null;
      excluir: string | null;
      /** Renovación: el plan que se renueva (se marca `RENOVADO`). */
      idRenovado: string | null;
    },
    actorUid: string,
  ): Promise<CandidatoDto[]> {
    const { data, error } = await rpcSinTipar(this.supabase.comoActor(actorUid), 'arre_traspaso_candidatos', {
      p_id_arrendador: a.idArrendador,
      p_id_nav_arrend: a.idNavArrend,
      p_fec_inicio_destino: a.fecInicioDestino,
      p_moneda: a.moneda ?? '',
      p_excluir: a.excluir,
    });
    if (error) this.falla('traspasos.candidatos', error);
    const filas = (Array.isArray(data) ? data : []) as CandidatoRpc[];
    const etiquetas = await this.etiquetasDePlanes(filas.map((f) => f.idArrePdp));

    return filas.map((c) => {
      const mismaNave = c.mismaNave === true;
      const esRenovado = a.idRenovado
        ? c.idArrePdp === a.idRenovado
        : mismaNave && !!c.fecFin && diaSiguiente(c.fecFin) === a.fecInicioDestino;
      const nv = etiquetas.get(c.idArrePdp);
      const depositoPlan = c.depositoPlan == null ? null : num(c.depositoPlan);
      return {
        idArrePdp: c.idArrePdp,
        idNavArrend: c.idNavArrend,
        idArrePdpDet: c.idArrePdpDet,
        fecInicio: c.fecInicio,
        fecFin: c.fecFin,
        finEfectivo: c.finEfectivo,
        mismaNave,
        tipo: esRenovado ? 'RENOVADO' : mismaNave ? 'MISMA_NAVE' : 'HERMANA',
        nave: nv?.nave ?? null,
        parque: nv?.parque ?? null,
        moneda: c.moneda,
        cantidad: num(c.cantidad),
        recibido: num(c.recibido),
        emitido: num(c.emitido),
        disponible: num(c.disponible),
        depositoPlan,
        bloqueo: c.bloqueo,
        bloqueoTexto: c.bloqueo ? textoBloqueo(c.bloqueo, { moneda: c.moneda, depositoPlan }) : null,
      };
    });
  }

  /** `GET planes/:id/traspaso-origenes` — candidatos para un destino que ya existe. */
  async candidatos(idDestino: string, actorUid: string): Promise<CandidatoDto[]> {
    const { data: plan, error } = await this.supabase.admin
      .from('arrePdp')
      .select('idArrePdp, idArrendador, idNavArrend, fecInicio, Moneda')
      .eq('idArrePdp', idDestino)
      .maybeSingle();
    if (error) this.falla('traspasos.candidatos-plan', error);
    if (!plan) throw excepcionConCodigo(404, 'Plan no encontrado.', 'PLAN_NO_ENCONTRADO');
    if (!plan.idArrendador || !plan.idNavArrend || !plan.fecInicio) return [];

    // Moneda efectiva del destino: la de su partida de depósito si es válida; si no, la del plan.
    const partidas = await this.partidasDeposito(idDestino);
    const moneda =
      (partidas.length === 1 ? monedaValida(partidas[0]!.moneda) : null) ?? monedaValida(plan.Moneda);

    return this.consultarCandidatos(
      {
        idArrendador: plan.idArrendador,
        idNavArrend: plan.idNavArrend,
        fecInicioDestino: plan.fecInicio,
        moneda,
        excluir: idDestino,
        idRenovado: null,
      },
      actorUid,
    );
  }

  /**
   * `GET planes/:id/renovacion-traspaso-origenes?moneda=` — candidatos para la renovación
   * de `:id` cuando el destino AÚN no existe (arrendador y nave del plan; inicio = fin + 1).
   * Exige además el permiso 25 (la ruta ya exigió el 23).
   */
  async candidatosRenovacion(
    idPlanActual: string,
    monedaSolicitada: string | undefined,
    actorUid: string,
  ): Promise<CandidatoDto[]> {
    await exigirPermiso(this.supabase, this.logger, actorUid, [25], 'PERMISO_REQUERIDO');
    const moneda = monedaSolicitada ? monedaValida(monedaSolicitada) : null;
    if (monedaSolicitada && !moneda)
      throw excepcionConCodigo(400, 'Moneda inválida (debe ser MXN o USD).', 'PARAMETRO_INVALIDO');

    const { data: plan, error } = await this.supabase.admin
      .from('arrePdp')
      .select('idArrePdp, idArrendador, idNavArrend, fecFin, Moneda')
      .eq('idArrePdp', idPlanActual)
      .maybeSingle();
    if (error) this.falla('traspasos.candidatos-renovacion', error);
    if (!plan) throw excepcionConCodigo(404, 'Plan no encontrado.', 'PLAN_NO_ENCONTRADO');
    if (!plan.fecFin) throw excepcionConCodigo(400, 'El plan no tiene fecha de fin.', 'PLAN_SIN_FECHA_FIN');
    if (!plan.idArrendador || !plan.idNavArrend) return [];

    return this.consultarCandidatos(
      {
        idArrendador: plan.idArrendador,
        idNavArrend: plan.idNavArrend,
        fecInicioDestino: diaSiguiente(plan.fecFin),
        moneda: moneda ?? monedaValida(plan.Moneda),
        excluir: null,
        idRenovado: idPlanActual,
      },
      actorUid,
    );
  }

  // ----------------------------- Traspasar / revertir -----------------------------

  /**
   * Traduce una respuesta `exito:false` de la BD a (status, código, texto). Los
   * imprevistos se registran (con el `detalle` solo al log) y devuelven un genérico.
   */
  private rechazo(res: RpcPaquete | null, contexto: string): { status: number; codigo: string; mensaje: string } {
    const codigo = res?.codigo ?? 'ERROR_INTERNO';
    const r = respuestaDeCodigo(codigo, res?.detalles ?? {});
    if (r) return { status: r.status, codigo, mensaje: r.mensaje };
    const det = res?.detalles ?? {};
    this.logger.error(
      `${contexto}: ${codigo}${det.sqlstate ? ` [${String(det.sqlstate)}]` : ''}${det.detalle ? ` — ${String(det.detalle)}` : ''}`,
    );
    return { status: 500, codigo: 'ERROR_INTERNO', mensaje: MSG_GENERICO };
  }

  /**
   * Ejecuta `arre_traspasar_deposito` y devuelve un RESULTADO (no lanza por rechazos de
   * negocio ni por fallas de la RPC), para que `renovar` pueda informar un traspaso
   * fallido sin perder el plan ya creado. `traspasar()` lo convierte en excepción HTTP.
   */
  async intentarTraspaso(
    idDestino: string,
    dto: TraspasarDepositoDto,
    actorUid: string,
  ): Promise<ResultadoTraspaso> {
    const db = this.supabase.comoActor(actorUid);
    const { data, error } = await rpcSinTipar(db, 'arre_traspasar_deposito', {
      p_id_destino: idDestino,
      p_origenes: dto.origenes,
      p_fec_traspaso: dto.fecTraspaso,
      p_nota: dto.nota,
      p_confirmado: dto.confirmado,
      p_clave_idempotencia: dto.claveIdempotencia,
    });
    if (error) {
      this.logger.error(`traspasos.traspasar: ${error.message}`);
      return { ok: false, status: 500, codigo: 'ERROR_INTERNO', mensaje: MSG_GENERICO };
    }
    const res = data as RpcPaquete | null;
    if (res?.exito !== true) {
      const r = this.rechazo(res, 'traspasos.traspasar');
      return { ok: false, ...r };
    }

    const d = res.detalles ?? {};
    const traspasos = (Array.isArray(d.traspasos) ? d.traspasos : []).map((t) => {
      const x = t as Record<string, unknown>;
      return { id: String(x.id), idArrePdpOrigen: String(x.idArrePdpOrigen), monto: num(x.monto) };
    });

    if (res.codigo === 'YA_APLICADO') {
      // Reintento del mismo envío: la BD no recalcula; se arma la respuesta con lo ya aplicado.
      const [partidas, { data: marcadas, error: mErr }] = await Promise.all([
        this.partidasDeposito(idDestino),
        this.tabla()
          .select('marcoPagada')
          .eq('claveIdempotencia', dto.claveIdempotencia)
          .eq('idArrePdpDestino', idDestino)
          .eq('estado', 'aplicado'),
      ]);
      if (mErr) this.falla('traspasos.ya-aplicado', mErr);
      return {
        ok: true,
        data: {
          total: deMicro(traspasos.reduce((s, t) => s + aMicro(t.monto), 0)),
          cantidadRestante: partidas.length === 1 ? partidas[0]!.cantidad : 0,
          pagadaPorTraspaso: (marcadas ?? []).some((m) => (m as { marcoPagada?: boolean }).marcoPagada === true),
          yaAplicado: true,
          traspasos,
        },
      };
    }

    await this.registrarActividad(db, {
      nomwidget: 'TraspasarDeposito',
      comentario: `Traspaso de depósito al plan ${idDestino} desde ${dto.origenes.join(', ')}: ${fmtMonto(num(d.total))}. Nota: ${dto.nota}`,
      actorUid,
    });
    return {
      ok: true,
      data: {
        total: num(d.total),
        cantidadRestante: num(d.cantidadRestante),
        pagadaPorTraspaso: d.pagadaPorTraspaso === true,
        yaAplicado: false,
        traspasos,
      },
    };
  }

  /** `POST planes/:id/traspasos` — traspasa el disponible completo de cada origen (D3). */
  async traspasar(
    idDestino: string,
    dto: TraspasarDepositoDto,
    actorUid: string,
  ): Promise<TraspasoAplicadoDto> {
    const r = await this.intentarTraspaso(idDestino, dto, actorUid);
    if (!r.ok) throw excepcionHttp(r.status, r.mensaje, r.codigo);
    return r.data;
  }

  /**
   * Traspaso encadenado a una renovación (D12): NUNCA lanza ni revierte el plan ya
   * creado; devuelve `aplicado` o `fallido` (con el código y un texto en claro) para
   * que el modal ofrezca «Reintentar» con la misma clave.
   */
  async traspasarTrasRenovar(
    idNuevo: string,
    dto: TraspasarDepositoDto,
    actorUid: string,
  ): Promise<TraspasoRenovacionDto> {
    try {
      const r = await this.intentarTraspaso(idNuevo, dto, actorUid);
      if (r.ok) return { estado: 'aplicado', ...r.data };
      return { estado: 'fallido', codigo: r.codigo, mensaje: r.mensaje };
    } catch (e) {
      this.logger.error(`traspasos.renovar: ${e instanceof Error ? e.message : String(e)}`);
      return { estado: 'fallido', codigo: 'ERROR_INTERNO', mensaje: MSG_GENERICO };
    }
  }

  /** `POST traspasos/:id/revertir` — reversa aditiva de UNA fila, con motivo (D8). */
  async revertir(
    idTraspaso: string,
    dto: RevertirTraspasoDto,
    actorUid: string,
  ): Promise<{ ok: true; idDestino: string | null; monto: number | null }> {
    if (!UUID_RE.test(idTraspaso))
      throw excepcionConCodigo(400, 'Identificador de traspaso inválido.', 'PARAMETRO_INVALIDO');
    const db = this.supabase.comoActor(actorUid);
    const { data, error } = await rpcSinTipar(db, 'arre_revertir_traspaso', {
      p_id_traspaso: idTraspaso,
      p_motivo: dto.motivo,
    });
    if (error) this.falla('traspasos.revertir', error);
    const res = data as RpcPaquete | null;
    if (res?.exito !== true) {
      const r = this.rechazo(res, 'traspasos.revertir');
      throw excepcionHttp(r.status, r.mensaje, r.codigo);
    }
    const d = res.detalles ?? {};
    await this.registrarActividad(db, {
      nomwidget: 'RevertirTraspasoDeposito',
      comentario: `Se revirtió el traspaso de depósito ${idTraspaso} (${fmtMonto(num(d.monto))}). Motivo: ${dto.motivo}`,
      actorUid,
    });
    return {
      ok: true,
      idDestino: typeof d.idDestino === 'string' ? d.idDestino : null,
      monto: d.monto == null ? null : num(d.monto),
    };
  }

  /** Bitácora de actividad (entorno 3 = web/servidor), como `renovar`. */
  private async registrarActividad(
    db: Db,
    a: { nomwidget: string; comentario: string; actorUid: string },
  ): Promise<void> {
    const { error } = await db.from('actividad').insert({
      uid: a.actorUid,
      entorno: 3,
      logeado: true,
      pantalla: 'Arrendatarios',
      widget: 'Button',
      nomwidget: a.nomwidget,
      comentario: a.comentario,
      version: 'erp-v2',
    });
    if (error) this.logger.warn(`No se pudo registrar actividad: ${error.message}`);
  }
}
