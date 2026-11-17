// Pruebas de `subtotalParcial`. Corren con `node --test` (Node 22, sin jest):
//   pnpm --filter @erp/api test:unit
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { subtotalParcial } from './ppd-subtotal.ts';

const r2 = (n: number): number => Math.round(n * 100) / 100;

type Factura = { total: number; subtotal: number | null };

/**
 * Simula pagos sucesivos sobre una factura como lo hace `nuevaParcial`: antes de cada
 * pago lee el saldo disponible y el subtotal ya asignado (solo parcialidades activas).
 * `rechazar` lista los índices de pagos que se rechazan justo después de crearse.
 */
function secuencia(f: Factura, montos: number[], rechazar: number[] = []) {
  const ps: { m: number; sub: number; activa: boolean }[] = [];
  for (const [i, m] of montos.entries()) {
    const act = ps.filter((p) => p.activa);
    const disponible = r2(f.total - act.reduce((s, p) => s + p.m, 0));
    const subtotalAsignado = r2(act.reduce((s, p) => s + p.sub, 0));
    ps.push({ m, sub: subtotalParcial(f, m, { disponible, subtotalAsignado }), activa: true });
    if (rechazar.includes(i)) ps[i]!.activa = false;
  }
  const suma = r2(ps.filter((p) => p.activa).reduce((s, p) => s + p.sub, 0));
  return { ps, suma };
}

const F: Factura = { total: 1_000_000, subtotal: 862_068.97 };

describe('subtotalParcial', () => {
  it('1. pago único del 100 % copia exacto el subtotal de la factura', () => {
    assert.equal(
      subtotalParcial({ total: 1160, subtotal: 1000 }, 1160, { disponible: 1160, subtotalAsignado: 0 }),
      1000,
    );
  });

  it('2. 20 pagos iguales suman exacto el subtotal', () => {
    const { ps, suma } = secuencia(F, Array(20).fill(50_000));
    assert.equal(suma, 862_068.97);
    assert.ok(ps.every((p) => p.sub >= 0));
  });

  it('3. 5 pagos desiguales (50k/400k/120k/30k/400k): el último cierra con lo que falta y suma exacta', () => {
    const { ps, suma } = secuencia(F, [50_000, 400_000, 120_000, 30_000, 400_000]);
    // Acumulado a los primeros 600k = round(862,068.97 × 0.6) = 517,241.38 → el último
    // cierra con 862,068.97 − 517,241.38 = 344,827.59 (no .58: el .58 no suma exacto).
    assert.equal(ps[4]!.sub, 344_827.59);
    assert.equal(suma, 862_068.97);
  });

  it('4. un pago rechazado a media vida libera su subtotal y el reemplazo cierra exacto', () => {
    const { suma } = secuencia(F, [300_000, 200_000, 500_000, 200_000], [1]);
    assert.equal(suma, 862_068.97);
  });

  it('5. con retenciones (subtotal 100,000 > total 95,333) pagar 9,533.30 consume 10,000', () => {
    assert.equal(
      subtotalParcial({ total: 95_333, subtotal: 100_000 }, 9_533.3, {
        disponible: 95_333,
        subtotalAsignado: 0,
      }),
      10_000,
    );
  });

  it('6. cualquier orden de los mismos pagos da la misma suma', () => {
    const a = secuencia(F, [50_000, 400_000, 120_000, 30_000, 400_000]).suma;
    const b = secuencia(F, [400_000, 30_000, 400_000, 50_000, 120_000]).suma;
    assert.equal(a, 862_068.97);
    assert.equal(b, a);
  });

  it('7a. centavos extremos: monto = disponible − 0.01 cierra la factura', () => {
    assert.equal(
      subtotalParcial({ total: 2.24, subtotal: 1.93 }, 2.23, { disponible: 2.24, subtotalAsignado: 0 }),
      1.93,
    );
  });

  it('7b. centavos extremos: 5,000 pagos de 0.01 y uno final no exceden el subtotal', () => {
    const { suma } = secuencia({ total: 1000, subtotal: 862.07 }, [...Array(5_000).fill(0.01), 950]);
    assert.equal(suma, 862.07);
  });

  it('8. factura sin subtotal (0, null) o sin total devuelve 0', () => {
    assert.equal(subtotalParcial({ total: 500, subtotal: 0 }, 500, { disponible: 500, subtotalAsignado: 0 }), 0);
    assert.equal(subtotalParcial({ total: 500, subtotal: null }, 500, { disponible: 500, subtotalAsignado: 0 }), 0);
    assert.equal(subtotalParcial({ total: 0, subtotal: 100 }, 10, { disponible: 0, subtotalAsignado: 0 }), 0);
  });

  it('9. nunca devuelve negativos aunque el subtotal asignado ya exceda el objetivo', () => {
    assert.ok(subtotalParcial(F, 0.01, { disponible: 0.02, subtotalAsignado: 862_068.98 }) >= 0);
  });

  it('10. total con 3 decimales (caso real de v1: 25,842.375 en 17,228.25 + 8,614.125) suma exacto en cualquier orden', () => {
    const f: Factura = { total: 25_842.375, subtotal: 22_278 };
    assert.equal(secuencia(f, [17_228.25, 8_614.125]).suma, 22_278);
    assert.equal(secuencia(f, [8_614.125, 17_228.25]).suma, 22_278);
  });
});
