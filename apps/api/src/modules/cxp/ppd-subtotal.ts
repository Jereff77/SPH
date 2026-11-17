// Funciones puras del subtotal de las solicitudes (parcialidades) PPD.
// Sin dependencias: se prueban con `node --test` (ver `ppd-subtotal.spec.ts`).

const aCentavos = (n: number): number => Math.round(n * 100);

/**
 * Subtotal (base presupuestal, antes de IVA y retenciones) de una parcialidad PPD.
 * Regla (Jereff, 2026-11-02): cada parcialidad consume del subtotal la misma
 * proporción que pide del total; la que liquida cierra con lo que falte (suma exacta).
 * Centavos enteros y objetivo ACUMULADO (el redondeo no se acumula entre parcialidades).
 *
 * - `factura.subtotal`: la BASE del gasto (SubTotal del CFDI − Descuento), en pesos.
 * - `saldo.disponible`: lo que aún se puede solicitar de la factura ANTES de este pago.
 * - `saldo.subtotalAsignado`: Σ subtotal de las parcialidades no rechazadas ya creadas.
 */
export function subtotalParcial(
  factura: { subtotal: number | null; total: number | null },
  monto: number,
  saldo: { disponible: number; subtotalAsignado: number },
): number {
  const T = aCentavos(factura.total ?? 0);
  const S = aCentavos(factura.subtotal ?? 0);
  if (!(T > 0) || !(S > 0)) return 0; // factura heredada sin subtotal o sin total
  const M = aCentavos(monto);
  const D = aCentavos(saldo.disponible);
  const Y = aCentavos(saldo.subtotalAsignado);
  const cierra = M >= D - 1; // deja ≤ 1 centavo de saldo
  const objetivo = cierra ? S : Math.round((S * Math.min(T, T - D + M)) / T);
  return Math.max(0, objetivo - Y) / 100;
}
