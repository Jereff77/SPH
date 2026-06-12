/** Helpers de formato compartidos por las pantallas de Fideicomiso. */

export const moneda = (n: number | null | undefined): string =>
  (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

export const numero = (n: number | null | undefined, dec = 2): string =>
  (n ?? 0).toLocaleString('es-MX', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });

export const porcentaje = (n: number | null | undefined, dec = 2): string =>
  `${(n ?? 0).toLocaleString('es-MX', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })}%`;

/** Fecha ISO (yyyy-MM-dd[THH...]) → dd/mm/aaaa (regla de diseño 7b). */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—';
  const p = (iso.split('T')[0] ?? iso).split('-');
  if (p.length < 3) return iso;
  return `${p[2]}/${p[1]}/${p[0]}`;
}
