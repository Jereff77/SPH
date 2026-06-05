import { XMLParser } from 'fast-xml-parser';
import type { ReglaRetencion } from './claves-sat.service.js';

/**
 * Parser de CFDI 4.0 (factura electrónica del SAT) y validación de deducciones.
 * Reemplaza al webhook externo de N8N usado en v1: aquí la lectura del XML y la
 * validación fiscal ocurren server-side, sin dependencias externas.
 *
 * Impuestos SAT: 001 = ISR, 002 = IVA, 003 = IEPS.
 */

export interface ConceptoCfdi {
  claveProdServ: string;
  descripcion: string;
  importe: number;
}

export interface CfdiData {
  version: string;
  fecha: string; // Fecha del comprobante (ISO con hora)
  fechaCFDI: string; // YYYY-MM-DD (solo fecha)
  metodoPago: string | null; // PUE / PPD
  formaPago: string | null;
  tipoComprobante: string | null; // I (ingreso), E (egreso)…
  moneda: string;
  subtotal: number;
  total: number;
  folio: string | null; // atributo Folio (NO el UUID)
  uuid: string | null; // TimbreFiscalDigital@UUID (folio fiscal)
  emisorRfc: string;
  emisorNombre: string;
  emisorRegimen: string;
  receptorRfc: string;
  receptorNombre: string;
  conceptos: ConceptoCfdi[];
  conceptoResumen: string;
  impuestos: { traslIVA: number; retIVA: number; retISR: number };
}

/** Tasas y reglas fiscales (de la tabla de deducciones por régimen). */
export const IVA_TASA = 0.16;
export const RET_IVA_TASA = 0.106667;
/** Régimen del emisor → tasa de retención de ISR cuando aplica. */
export const RET_ISR_POR_REGIMEN: Record<string, number> = {
  '612': 0.1, // P. Físicas Act. Empresariales y Profesionales
  '626': 0.0125, // Régimen Simplificado de Confianza
  '606': 0.1, // Arrendamiento
};
export const REGIMENES_CON_RETENCION = Object.keys(RET_ISR_POR_REGIMEN);
/** Tolerancia para comparar tasas efectivas (0.5 puntos porcentuales). */
const TOL_TASA = 0.005;

function num(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true, // quita prefijos cfdi:/tfd: → nodos planos
  parseAttributeValue: false, // mantener strings (RFC, tasas con ceros)
  trimValues: true,
  isArray: (name) => ['Concepto', 'Traslado', 'Retencion'].includes(name),
});

interface ImpuestosNodo {
  Traslados?: { Traslado?: Record<string, unknown>[] };
  Retenciones?: { Retencion?: Record<string, unknown>[] };
}

function acumularImpuestos(
  imp: ImpuestosNodo | undefined,
  acc: { traslIVA: number; retIVA: number; retISR: number },
): void {
  if (!imp) return;
  for (const t of imp.Traslados?.Traslado ?? []) {
    if (str(t['@_Impuesto']) === '002') acc.traslIVA += num(t['@_Importe']);
  }
  for (const r of imp.Retenciones?.Retencion ?? []) {
    const code = str(r['@_Impuesto']);
    if (code === '002') acc.retIVA += num(r['@_Importe']);
    else if (code === '001') acc.retISR += num(r['@_Importe']);
  }
}

/** Parsea el contenido XML de un CFDI 4.0. Lanza Error si no es un CFDI válido. */
export function parsearCfdi(xml: string): CfdiData {
  let root: Record<string, unknown>;
  try {
    const doc = parser.parse(xml) as Record<string, unknown>;
    root = (doc.Comprobante ?? {}) as Record<string, unknown>;
  } catch {
    throw new Error('El archivo XML no se pudo leer (formato inválido).');
  }
  if (!root || Object.keys(root).length === 0) {
    throw new Error('El XML no es un CFDI válido (no se encontró el Comprobante).');
  }

  const emisor = (root.Emisor ?? {}) as Record<string, unknown>;
  const receptor = (root.Receptor ?? {}) as Record<string, unknown>;
  const conceptosNodo = (root.Conceptos ?? {}) as {
    Concepto?: Record<string, unknown>[];
  };
  const conceptosRaw = conceptosNodo.Concepto ?? [];

  const conceptos: ConceptoCfdi[] = conceptosRaw.map((c) => ({
    claveProdServ: str(c['@_ClaveProdServ']),
    descripcion: str(c['@_Descripcion']),
    importe: num(c['@_Importe']),
  }));

  // Impuestos: a nivel comprobante; si no hay, se suman desde los conceptos.
  const acc = { traslIVA: 0, retIVA: 0, retISR: 0 };
  const impComprobante = root.Impuestos as ImpuestosNodo | undefined;
  if (impComprobante && (impComprobante.Traslados || impComprobante.Retenciones)) {
    acumularImpuestos(impComprobante, acc);
  } else {
    for (const c of conceptosRaw)
      acumularImpuestos(c.Impuestos as ImpuestosNodo | undefined, acc);
  }

  // UUID del Timbre Fiscal Digital (puede venir como objeto o array).
  const complemento = root.Complemento as
    | Record<string, unknown>
    | Record<string, unknown>[]
    | undefined;
  let uuid: string | null = null;
  const buscarTimbre = (comp: Record<string, unknown> | undefined): void => {
    const tfd = comp?.['TimbreFiscalDigital'] as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined;
    const t = Array.isArray(tfd) ? tfd[0] : tfd;
    if (t && t['@_UUID']) uuid = str(t['@_UUID']);
  };
  if (Array.isArray(complemento)) complemento.forEach(buscarTimbre);
  else buscarTimbre(complemento);

  const fecha = str(root['@_Fecha']);
  const fechaCFDI = fecha ? (fecha.split('T')[0] ?? fecha) : '';

  return {
    version: str(root['@_Version']),
    fecha,
    fechaCFDI,
    metodoPago: str(root['@_MetodoPago']) || null,
    formaPago: str(root['@_FormaPago']) || null,
    tipoComprobante: str(root['@_TipoDeComprobante']) || null,
    moneda: str(root['@_Moneda']) || 'MXN',
    subtotal: num(root['@_SubTotal']),
    total: num(root['@_Total']),
    folio: str(root['@_Folio']) || null,
    uuid,
    emisorRfc: str(emisor['@_Rfc']).toUpperCase(),
    emisorNombre: str(emisor['@_Nombre']),
    emisorRegimen: str(emisor['@_RegimenFiscal']),
    receptorRfc: str(receptor['@_Rfc']).toUpperCase(),
    receptorNombre: str(receptor['@_Nombre']),
    conceptos,
    conceptoResumen:
      conceptos
        .map((c) => c.descripcion)
        .filter(Boolean)
        .join(' | ')
        .slice(0, 500) || '',
    impuestos: acc,
  };
}

/**
 * Valida las deducciones (retenciones IVA/ISR) del CFDI contra el catálogo de
 * claves y el régimen del emisor. Estrategia "presencia + tasa esperada":
 * verifica que existan (o no) las retenciones que corresponden y que su tasa
 * efectiva coincida con la esperada (tolerante a redondeos). Devuelve la lista
 * de errores (vacía = válido). Si alguna clave no está en el catálogo, exige
 * registrarla antes de continuar.
 */
export function validarDeducciones(
  cfdi: CfdiData,
  reglas: Map<string, ReglaRetencion>,
): string[] {
  const errores: string[] = [];
  const regimen = cfdi.emisorRegimen;

  // Solo aplica a los regímenes con retención (612, 626, 606).
  if (!REGIMENES_CON_RETENCION.includes(regimen)) return errores;

  // 1) Toda clave del CFDI debe existir en el catálogo.
  let esperaRetIVA = false;
  let esperaRetISR = false;
  const faltantes = new Set<string>();
  for (const c of cfdi.conceptos) {
    const r = reglas.get(c.claveProdServ);
    if (!r) {
      faltantes.add(c.claveProdServ || '(sin clave)');
      continue;
    }
    if (r.retieneIVA) esperaRetIVA = true;
    if (r.retieneISR) esperaRetISR = true;
  }
  if (faltantes.size > 0) {
    errores.push(
      `Hay claves de producto/servicio no registradas en el catálogo de Claves SAT: ${[...faltantes].join(', ')}. Regístrelas en Configuraciones → Parámetros → Claves SAT para poder validar la factura.`,
    );
    return errores; // sin reglas no se puede validar el resto
  }

  const base = cfdi.subtotal || cfdi.conceptos.reduce((s, c) => s + c.importe, 0);
  if (base <= 0) {
    errores.push('No se pudo determinar la base (subtotal) de la factura.');
    return errores;
  }
  const { retIVA, retISR } = cfdi.impuestos;

  // 2) Retención de IVA
  if (esperaRetIVA && retIVA <= 0) {
    errores.push('La factura debería incluir retención de IVA y no la trae.');
  } else if (!esperaRetIVA && retIVA > 0) {
    errores.push('La factura trae retención de IVA que no corresponde según el catálogo.');
  } else if (esperaRetIVA && retIVA > 0) {
    const tasa = retIVA / base;
    if (Math.abs(tasa - RET_IVA_TASA) > TOL_TASA)
      errores.push(
        `La tasa de retención de IVA (${(tasa * 100).toFixed(4)}%) no corresponde con la esperada (10.6667%).`,
      );
  }

  // 3) Retención de ISR (tasa según régimen)
  const tasaISR = RET_ISR_POR_REGIMEN[regimen]!;
  if (esperaRetISR && retISR <= 0) {
    errores.push('La factura debería incluir retención de ISR y no la trae.');
  } else if (!esperaRetISR && retISR > 0) {
    errores.push('La factura trae retención de ISR que no corresponde según el catálogo.');
  } else if (esperaRetISR && retISR > 0) {
    const tasa = retISR / base;
    if (Math.abs(tasa - tasaISR) > TOL_TASA)
      errores.push(
        `La tasa de retención de ISR (${(tasa * 100).toFixed(4)}%) no corresponde con la esperada (${(tasaISR * 100).toFixed(2)}%).`,
      );
  }

  return errores;
}
