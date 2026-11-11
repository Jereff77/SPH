import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  type HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseService } from '../../common/supabase/supabase.service.js';

/**
 * Utilidades compartidas del depósito de garantía (traspaso de depósito). Archivo
 * HOJA: no importa ningún servicio, para que `cobranza`, `planes`, `historial`,
 * `reportes` y `traspasos` lo usen sin ciclos de importación.
 */

type Db = ReturnType<SupabaseService['comoActor']>;

// ----------------------------- Errores HTTP con código -----------------------------

/**
 * Excepción HTTP con un **código de negocio estable** (`codigo`) además del texto: el cuerpo
 * de la excepción es `{ message, codigo }` y el filtro global lo responde como
 * `{ statusCode, path, message, codigo }`. La web decide por `codigo`, nunca por el texto.
 * Nunca recibe `error.message` ni el `mensaje` de una RPC (regla 4b): solo textos escritos a mano.
 */
export function excepcionConCodigo(status: number, mensaje: string, codigo: string): HttpException {
  const cuerpo = { message: mensaje, codigo };
  switch (status) {
    case 400:
      return new BadRequestException(cuerpo);
    case 403:
      return new ForbiddenException(cuerpo);
    case 404:
      return new NotFoundException(cuerpo);
    case 409:
      return new ConflictException(cuerpo);
    default:
      return new InternalServerErrorException(cuerpo);
  }
}

// ----------------------------- Concepto de depósito -----------------------------

/**
 * ¿El concepto es el «Depósito Garantía»? Misma normalización que el trigger de BD
 * `v2_arrepdpdetalle_calc_iva` y que `arre_traspaso_candidatos`
 * (`deposito%garantia%` sin acentos ni mayúsculas): el depósito no causa IVA.
 */
export function esConceptoDeposito(concepto: string | null | undefined): boolean {
  const c = (concepto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
  return /^deposito.*garantia/.test(c);
}

/**
 * Conceptos base del plan (no son cargos KVA): no se pueden eliminar de la corrida. Misma regla
 * que `CONCEPTOS_BASE`/`esCargoKva` de `PlanPagoForm.tsx` (la web la usa para ocultar el botón;
 * aquí se hace cumplir en el servidor): el concepto «empieza con» un base, sin acentos ni
 * mayúsculas, lo que cubre «Renta (Cortesia)», «Renta (Cortesía)», etc.
 */
const CONCEPTOS_BASE = ['renta', 'administracion', 'mantenimiento', 'vigilancia', 'deposito garantia'];

export function esConceptoBase(concepto: string | null | undefined): boolean {
  const c = (concepto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
  return CONCEPTOS_BASE.some((b) => c.startsWith(b));
}

// ----------------------------- RPC nuevas (sin tipar) -----------------------------

/** Forma común del jsonb que devuelven las funciones del paquete. */
export interface RpcPaquete {
  exito?: boolean;
  codigo?: string;
  mensaje?: string;
  detalles?: Record<string, unknown>;
}

type RpcFn = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

/**
 * Llama una RPC que aún no está en `@erp/types` (las del traspaso de depósito).
 * Cast localizado — igual que `renovar` / `cancelarAnticipado` — conservando `this`.
 * SIEMPRE con un cliente `comoActor(uid)`: las funciones leen `auth.uid()`.
 */
export function rpcSinTipar(
  db: Db,
  fn: string,
  args: Record<string, unknown>,
): ReturnType<RpcFn> {
  return (db.rpc as unknown as RpcFn).call(db, fn, args);
}

// ----------------------------- Aritmética y formato -----------------------------

const MICRO = 1_000_000;

/** Entero en micro-unidades (6 decimales): evita errores de coma flotante al sumar/restar montos. */
export const aMicro = (n: number | string | null | undefined): number =>
  Math.round((Number(n) || 0) * MICRO);
export const deMicro = (m: number): number => m / MICRO;

/** Número seguro (null/NaN → 0). */
export const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Importe con 2 a 4 decimales («237,002.955», «474,005.91»): los depósitos pueden tener
 * hasta 4 decimales y `toFixed(2)` mostraría 474,005.92 en vez de 474,005.91.
 */
export function fmtMonto(n: number | null | undefined): string {
  return num(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

/** yyyy-MM-dd → dd/mm/aaaa (la fecha se muestra siempre así). */
export function fmtFechaCorta(s: unknown): string {
  const t = typeof s === 'string' ? s.slice(0, 10) : '';
  const [y, m, d] = t.split('-');
  return y && m && d ? `${d}/${m}/${y}` : '—';
}

/** Día siguiente (yyyy-MM-dd → yyyy-MM-dd), en UTC para no desfasar. */
export function diaSiguiente(fecha: string): string {
  const f = new Date(`${fecha.slice(0, 10)}T00:00:00Z`);
  f.setUTCDate(f.getUTCDate() + 1);
  return f.toISOString().slice(0, 10);
}

// ----------------------------- Disponible (D5) -----------------------------

/** Fila de `arre_traspasos_deposito` (tabla nueva, aún no tipada en `@erp/types`). */
export interface TraspasoRow {
  id: string;
  idArrePdpOrigen: string;
  idArrePdpDestino: string;
  idDetOrigen: string;
  idDetDestino: string;
  moneda: string;
  monto: number;
  marcoPagada: boolean;
  fecTraspaso: string;
  nota: string;
  estado: 'aplicado' | 'revertido';
  claveIdempotencia: string;
  uid: string;
  fc: string;
  revertidoPor: string | null;
  fecReversion: string | null;
  motivoReversion: string | null;
}

export interface CalculoDeposito {
  /** Depósito que el plan puede emitir hoy: `cantidad + recibido − emitido` (D5, mínimo 0). */
  disponible: number;
  /** Lo que valía la partida antes de recibir traspasos: `cantidad + recibido`. */
  contractual: number;
  /** Lo que sí falta cobrar en efectivo: 0 si ya está pagada; si no, `max(0, cantidad − emitido)`. */
  porCobrar: number;
}

/**
 * Cifras del depósito de un plan (solo presentación; la BD es la autoridad y calcula lo
 * mismo en `arre_traspaso_candidatos`). Aritmética en micro-unidades para que
 * 500,645.02 − 474,005.91 dé EXACTAMENTE 26,639.11. Casos verificables en 04-FLUJOS.
 */
export function calcularDeposito(i: {
  cantidad: number;
  recibido: number;
  emitido: number;
  pagada: boolean;
}): CalculoDeposito {
  const cant = aMicro(i.cantidad);
  const rec = aMicro(i.recibido);
  const emi = aMicro(i.emitido);
  return {
    disponible: deMicro(Math.max(0, cant + rec - emi)),
    contractual: deMicro(cant + rec),
    porCobrar: i.pagada ? 0 : deMicro(Math.max(0, cant - emi)),
  };
}

/** Suma lo recibido y lo emitido por un plan (solo filas `aplicado`), en micro-unidades exactas. */
export function sumarTraspasos(
  filas: TraspasoRow[],
  idArrePdp: string,
): { recibido: number; emitido: number } {
  let rec = 0;
  let emi = 0;
  for (const f of filas) {
    if (f.estado !== 'aplicado') continue;
    if (f.idArrePdpDestino === idArrePdp) rec += aMicro(f.monto);
    if (f.idArrePdpOrigen === idArrePdp) emi += aMicro(f.monto);
  }
  return { recibido: deMicro(rec), emitido: deMicro(emi) };
}

// ----------------------------- Nave / parque de un plan -----------------------------

/** Mapa idArrePdp → {nave, parque} (arrePdp→arrenPropiedades→naves→parques). */
export async function navePorPlan(
  supabase: SupabaseService,
  idArrePdps: string[],
): Promise<Map<string, { nave: string | null; parque: string | null }>> {
  const out = new Map<string, { nave: string | null; parque: string | null }>();
  if (idArrePdps.length === 0) return out;
  const { data: planes } = await supabase.admin
    .from('arrePdp')
    .select('idArrePdp, idNavArrend')
    .in('idArrePdp', idArrePdps);
  const navArrends = [
    ...new Set((planes ?? []).map((p) => p.idNavArrend).filter((x): x is string => !!x)),
  ];
  const { data: props } = navArrends.length
    ? await supabase.admin
        .from('arrenPropiedades')
        .select('idNavArrend, idNave')
        .in('idNavArrend', navArrends)
    : { data: [] as { idNavArrend: string; idNave: string | null }[] };
  const idNaves = [...new Set((props ?? []).map((p) => p.idNave).filter((x): x is string => !!x))];
  const { data: naves } = idNaves.length
    ? await supabase.admin
        .from('naves')
        .select('idNave, numNave, numNaveNAME, idParque')
        .in('idNave', idNaves)
    : {
        data: [] as {
          idNave: string;
          numNave: number | null;
          numNaveNAME: string | null;
          idParque: string | null;
        }[],
      };
  const idParques = [
    ...new Set((naves ?? []).map((n) => n.idParque).filter((x): x is string => !!x)),
  ];
  const { data: parques } = idParques.length
    ? await supabase.admin.from('parques').select('idParque, nomParque').in('idParque', idParques)
    : { data: [] as { idParque: string; nomParque: string | null }[] };

  const parqueNom = new Map((parques ?? []).map((p) => [p.idParque, p.nomParque]));
  const naveInfo = new Map(
    (naves ?? []).map((n) => [
      n.idNave,
      {
        nave: n.numNaveNAME ?? (n.numNave != null ? String(n.numNave) : null),
        parque: n.idParque ? (parqueNom.get(n.idParque) ?? null) : null,
      },
    ]),
  );
  const porNavArrend = new Map(
    (props ?? []).map((p) => [p.idNavArrend, p.idNave ? (naveInfo.get(p.idNave) ?? null) : null]),
  );
  for (const pl of planes ?? []) {
    const nv = pl.idNavArrend ? porNavArrend.get(pl.idNavArrend) : null;
    out.set(pl.idArrePdp, nv ?? { nave: null, parque: null });
  }
  return out;
}
