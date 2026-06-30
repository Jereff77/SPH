import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/types';

/**
 * Reglas de tiempo del Complemento de Pago (REP) en facturas PPD.
 *
 * El plazo NO se mide como "días desde el pago", sino con **fechas de calendario
 * ancladas al MES en que se pagó** cada parcialidad (alineado con el SAT, que da
 * hasta el día 5 natural del mes siguiente para emitir el REP):
 *
 *  - **Bloqueo del proveedor** (nivel 1): al llegar el día `diaBloqueoProveedor`
 *    (por defecto 6) del mes SIGUIENTE al pago, si no hay REP el proveedor no
 *    admite nuevas solicitudes.
 *  - **Bloqueo del usuario** (nivel 2): al llegar el día `diaBloqueoUsuario`
 *    (por defecto 21 = día 6 + 15) del mes SIGUIENTE al pago, el usuario que
 *    pagó queda bloqueado para crear cualquier solicitud.
 *  - **Aviso por correo**: del día `diaAviso` (por defecto 16) al día anterior al
 *    bloqueo del usuario.
 *
 * Los tres días son **configurables** desde `SPHConfiguraciones` (ver
 * `leerRepConfig`); aquí viven los valores por defecto y la matemática pura.
 */
export interface RepConfig {
  /** Día del mes siguiente al pago en que se bloquea al PROVEEDOR. */
  diaBloqueoProveedor: number;
  /** Día del mes siguiente al pago en que se bloquea al USUARIO. */
  diaBloqueoUsuario: number;
  /** Día del mes siguiente al pago desde el que empieza el aviso por correo. */
  diaAviso: number;
}

export const DEFAULT_REP_CONFIG: RepConfig = {
  diaBloqueoProveedor: 6,
  diaBloqueoUsuario: 21,
  diaAviso: 16,
};

/** Parámetros en `SPHConfiguraciones` que gobiernan estos plazos. */
export const PARAM_REP = {
  diaBloqueoProveedor: 'PPD_REP_DIA_BLOQUEO_PROVEEDOR',
  diaBloqueoUsuario: 'PPD_REP_DIA_BLOQUEO_USUARIO',
  diaAviso: 'PPD_REP_DIA_AVISO',
} as const;

/** Nivel de un REP pendiente, de menos a más grave. */
export type RepNivel =
  | 'ninguno' // sin pendiente (no pagada / dispensada / con REP)
  | 'pendiente' // pagada sin REP, aún en plazo
  | 'vencido_proveedor' // venció el día 6 → proveedor bloqueado
  | 'vencido_usuario'; // venció el día 21 → usuario bloqueado

/** Severidad numérica para agregar el nivel "peor" de una factura. */
export const SEVERIDAD_REP: Record<RepNivel, number> = {
  ninguno: 0,
  pendiente: 1,
  vencido_proveedor: 2,
  vencido_usuario: 3,
};

/**
 * Lee los 3 parámetros de `SPHConfiguraciones`. Si falta alguno o no es un día
 * válido (1–28, para que exista en cualquier mes), cae al valor por defecto.
 */
export async function leerRepConfig(
  admin: SupabaseClient<Database>,
): Promise<RepConfig> {
  const { data } = await admin
    .from('SPHConfiguraciones')
    .select('parametro, valor')
    .in('parametro', [
      PARAM_REP.diaBloqueoProveedor,
      PARAM_REP.diaBloqueoUsuario,
      PARAM_REP.diaAviso,
    ])
    .eq('status', true);
  const map = new Map((data ?? []).map((r) => [r.parametro, r.valor]));
  const dia = (param: string, def: number): number => {
    const n = parseInt(String(map.get(param) ?? ''), 10);
    return Number.isFinite(n) && n >= 1 && n <= 28 ? n : def;
  };
  return {
    diaBloqueoProveedor: dia(
      PARAM_REP.diaBloqueoProveedor,
      DEFAULT_REP_CONFIG.diaBloqueoProveedor,
    ),
    diaBloqueoUsuario: dia(
      PARAM_REP.diaBloqueoUsuario,
      DEFAULT_REP_CONFIG.diaBloqueoUsuario,
    ),
    diaAviso: dia(PARAM_REP.diaAviso, DEFAULT_REP_CONFIG.diaAviso),
  };
}

/**
 * Desfase de Ciudad de México respecto a UTC (UTC-6 FIJO; CDMX ya no aplica
 * horario de verano desde 2022). Todo el cálculo de "mes del pago" se hace en
 * hora de México para que un pago nocturno del último día del mes (que en UTC
 * cae el día 1 del mes siguiente) cuente en el mes correcto.
 */
export const MX_OFFSET_MS = 6 * 60 * 60 * 1000;

/** Partes de fecha (año, mes 0–11, día) en hora de Ciudad de México. */
export function partesMx(d: Date): { anio: number; mes: number; dia: number } {
  const mx = new Date(d.getTime() - MX_OFFSET_MS);
  return { anio: mx.getUTCFullYear(), mes: mx.getUTCMonth(), dia: mx.getUTCDate() };
}

/**
 * Instante UTC (ISO) que corresponde al inicio (00:00 hora de México) del día 1
 * del mes `mes` (0–11; admite desbordes como -1 → diciembre anterior). Sirve de
 * cota para comparar contra `fecPago` (timestamp UTC).
 */
export function inicioMesMxISO(anio: number, mes: number): string {
  return new Date(Date.UTC(anio, mes, 1) + MX_OFFSET_MS).toISOString();
}

/**
 * Cota (ISO, EXCLUSIVA) de `fecPago` a partir de la cual una parcialidad ya
 * venció para el corte `diaCorte` (día del mes SIGUIENTE al pago). Es decir:
 * una parcialidad está vencida ⟺ `fecPago < boundVencidoISO(diaCorte, hoy)`.
 *
 * Derivación: una parcialidad pagada en el mes M vence el día `diaCorte` del mes
 * M+1. Por tanto, a fecha de hoy (en hora de México):
 *  - si hoy ya alcanzó el día de corte de ESTE mes ⇒ vencen todas las pagadas
 *    antes del inicio del mes actual;
 *  - si aún no ⇒ solo las pagadas antes del inicio del mes anterior.
 */
export function boundVencidoISO(diaCorte: number, hoy: Date): string {
  const { anio, mes, dia } = partesMx(hoy);
  return dia >= diaCorte
    ? inicioMesMxISO(anio, mes)
    : inicioMesMxISO(anio, mes - 1);
}

/**
 * Nivel del REP de UNA parcialidad ya filtrada como "pagada, sin REP y no
 * dispensada". Para las que no cumplen esa condición, el llamador usa 'ninguno'.
 */
export function nivelRepPendiente(
  fecPagoIso: string | null,
  hoy: Date,
  cfg: RepConfig,
): RepNivel {
  if (!fecPagoIso) return 'pendiente';
  const t = new Date(fecPagoIso).getTime();
  if (Number.isNaN(t)) return 'pendiente';
  if (t < new Date(boundVencidoISO(cfg.diaBloqueoUsuario, hoy)).getTime())
    return 'vencido_usuario';
  if (t < new Date(boundVencidoISO(cfg.diaBloqueoProveedor, hoy)).getTime())
    return 'vencido_proveedor';
  return 'pendiente';
}
