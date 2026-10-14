/**
 * Moneda en Arrendatarios. La moneda vive en dos niveles: `arrePdp."Moneda"` (plan) y
 * `arrePdpDetalle.moneda` (por partida/concepto). Hay datos heredados con la moneda vacía
 * (`''`) o con el TEXTO `'null'`; ninguno de los dos es una moneda válida.
 */
export type MonedaApp = 'MXN' | 'USD';

/** 'MXN' | 'USD' o null (vacío, 'null' o basura heredada). */
export function monedaValida(m: string | null | undefined): MonedaApp | null {
  const v = (m ?? '').trim().toUpperCase();
  return v === 'MXN' || v === 'USD' ? v : null;
}

/** Moneda de un depósito bancario: igual que `monedaValida`, pero 'MNX' (typo heredado en `movbancarios`) = MXN. */
export function monedaDeposito(m: string | null | undefined): MonedaApp | null {
  return (m ?? '').trim().toUpperCase() === 'MNX' ? 'MXN' : monedaValida(m);
}

/** Moneda efectiva de una partida: la suya si es válida; si no, la del plan; si tampoco, MXN. */
export function monedaEfectiva(
  partida: string | null | undefined,
  plan: string | null | undefined,
): MonedaApp {
  return monedaValida(partida) ?? monedaValida(plan) ?? 'MXN';
}
