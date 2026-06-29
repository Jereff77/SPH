/**
 * Utilidades de RFC para el control de duplicados de clientes (tabla `inversionista`).
 *
 * El RFC mexicano se compone de **base + homoclave**: persona física = 4 letras +
 * 6 dígitos de fecha (AAMMDD) + 3 de homoclave (13); persona moral = 3 letras +
 * 6 dígitos + 3 de homoclave (12). Como los usuarios a veces omiten la homoclave,
 * la detección de duplicados se hace por **base** (letras + fecha), no por el string
 * completo: así `VIBA700712` empata con `VIBA700712` y con `VIBA7007129F6`.
 */

/** Bases de los RFC genéricos del SAT (no se permiten en altas/ediciones de v2). */
const BASES_GENERICAS = ['XAXX010101', 'XEXX010101'];

/** Estructura de un RFC: grupo 1 = base (letras+fecha), grupo 2 = homoclave (0-3). */
const RFC_RE = /^([A-ZÑ&]{3,4}\d{6})([A-Z0-9]{0,3})$/;

/** Mayúsculas y sin separadores (espacios, guiones, etc.). */
export function normalizarRfc(rfc: string | null | undefined): string {
  return (rfc ?? '').toUpperCase().replace(/[^A-ZÑ&0-9]/g, '');
}

/** Base del RFC (letras + fecha) ya normalizada, o '' si no tiene forma de RFC. */
export function baseRfc(rfc: string | null | undefined): string {
  const m = RFC_RE.exec(normalizarRfc(rfc));
  return m ? m[1]! : '';
}

/** ¿El formato es un RFC válido? (homoclave opcional). */
export function rfcFormatoValido(rfc: string | null | undefined): boolean {
  return RFC_RE.test(normalizarRfc(rfc));
}

/** ¿Es un RFC genérico del SAT? (prohibido en v2). */
export function esRfcGenerico(rfc: string | null | undefined): boolean {
  return BASES_GENERICAS.includes(baseRfc(rfc));
}

/** Parte alfabética de la base (3-4 letras), para acotar la búsqueda de candidatos. */
export function letrasBaseRfc(rfc: string | null | undefined): string {
  return baseRfc(rfc).replace(/\d+$/, '');
}
