/**
 * Conceptos base del plan (no son cargos KVA): no se pueden eliminar de la corrida ni usarse como
 * nombre de un cargo libre. MISMA regla y normalización que `esConceptoBase` del servidor
 * (`apps/api/src/modules/arrendatarios/deposito.util.ts`): sin acentos ni mayúsculas y por
 * prefijo, lo que cubre «Renta (Cortesia)», «Renta (Cortesía)», etc. El servidor la hace cumplir.
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
