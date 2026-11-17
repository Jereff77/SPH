// Funciones puras del folio y de la fecha de las parcialidades (abonos) PPD.
// Sin dependencias: se prueban con `node --test` (ver `ppd-folio.spec.ts`).

/**
 * Fecha de HOY (yyyy-MM-dd) en hora de México (America/Mexico_City), igual que la
 * calculan `cxp_puede_insertar()` y el trigger de fechas de la BD. Decisión de Jereff
 * (2026-11-02, D4): ningún «hoy» del módulo PPD se toma en UTC, porque después de las
 * 18:00 de México la fecha UTC ya es la de mañana (la solicitud nacería con un día
 * de más: sufijo del folio, semana y mes). `ahora` solo existe para las pruebas.
 */
export function hoyMexicoISO(ahora: Date = new Date()): string {
  // Se arman las partes a mano (en vez de depender del formato de un locale concreto) para
  // que el resultado no cambie si el Node del contenedor trae datos de locale reducidos.
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora);
  const de = (tipo: string): string => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${de('year')}-${de('month')}-${de('day')}`;
}

/**
 * Sufijo de fecha del folio de una parcialidad, estilo v1 pero CON CEROS (decisión de
 * Jereff, 2026-11-02, D2): `ddmmaaaa`. Ej.: 01/11/2026 → "01112026"; 12/05/2026 →
 * "12052026". `fecISO` es la `fecSolicitud` (yyyy-MM-dd) del pago. Con ceros el sufijo
 * ya no es ambiguo (1/11 ≠ 11/1); el consecutivo de `folioDeParcial` queda para el
 * mismo día.
 */
export function sufijoFechaV1(fecISO: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecISO);
  if (!m) throw new Error(`Fecha inválida para el sufijo del folio: ${fecISO}`);
  return `${m[3]}${m[2]}${m[1]}`;
}

/**
 * Folio de una parcialidad PPD (columna `cxp.folio`, UNIQUE en `cxp_folio_key`).
 * Convención v1 confirmada por Jereff:
 *   - 1.ª parcialidad: el UUID de la factura tal cual (= `cxp_ppd.folio`).
 *   - 2.ª en adelante: `<UUID>-<ddmmaaaa>` con la `fecSolicitud` del pago; si ese
 *     folio YA existe (otro pago el mismo día), se agrega `-2`, `-3`, …
 * `idFolioDif` SIEMPRE lleva el UUID puro (eso lo escribe `insertarParcial`).
 *
 * `existentes` = folios ya usados por esta factura en TODAS sus filas `cxp`, también
 * las rechazadas y las `status=false`: siguen ocupando el índice único. Por eso «sin
 * sufijo» ya no significa «primera parcialidad viva»: si la 1.ª se rechazó, conserva el
 * UUID y la que la reemplaza lleva sufijo.
 */
export function folioDeParcial(
  uuidFactura: string,
  fecSolicitudISO: string,
  existentes: Iterable<string>,
): string {
  const usados = new Set(existentes);
  if (usados.size === 0) return uuidFactura; // 1.ª parcialidad conserva el folio
  const base = `${uuidFactura}-${sufijoFechaV1(fecSolicitudISO)}`;
  if (!usados.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidato = `${base}-${n}`;
    if (!usados.has(candidato)) return candidato;
  }
  throw new Error('No se pudo generar un folio único para la parcialidad.');
}

/**
 * Patrón `LIKE` que busca los folios que EMPIEZAN con el UUID de la factura
 * (`<UUID>`, `<UUID>-ddmmaaaa`, `<UUID>-ddmmaaaa-2`…). Escapa `\`, `%` y `_` para que
 * el UUID se tome literal (el folio sale del XML, no es de confianza).
 */
export function patronFoliosDeFactura(uuidFactura: string): string {
  return `${uuidFactura.replace(/[\\%_]/g, '\\$&')}%`;
}
