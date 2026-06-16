import type { DatosComprobante } from './pagos.service.js';

/**
 * Parser determinista de comprobantes de pago (sin IA ni servicios externos).
 *
 * Cada banco tiene un formato fijo; aquí se reconoce el formato por su
 * encabezado y se extraen los campos del texto que produce `pdf-parse`.
 * El objetivo es cubrir los formatos comunes localmente (rápido, gratis,
 * determinista) y dejar que el llamador use un fallback (IA / captura manual)
 * solo para formatos no reconocidos.
 *
 * Para añadir un formato nuevo: implementar `detecta`/`parsea` y registrarlo
 * en `FORMATOS`.
 */

const MESES: Record<string, string> = {
  ene: '01', jan: '01', feb: '02', mar: '03', abr: '04', apr: '04', may: '05',
  jun: '06', jul: '07', ago: '08', aug: '08', sep: '09', sept: '09',
  oct: '10', nov: '11', dic: '12', dec: '12',
};

function sinAcentos(s: string): string {
  return s.replace(/[áéíóú]/g, (c) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' }[c] ?? c));
}

/** "12-Jun-2026" | "12/06/2026" -> "2026-06-12" */
function parseFecha(s: string): string {
  if (!s) return '';
  let m = /(\d{1,2})[-/]([A-Za-zÁÉÍÓÚáéíóú]{3,4})[-/](\d{4})/.exec(s);
  if (m) {
    const dd = m[1]!.padStart(2, '0');
    const mes = MESES[sinAcentos(m[2]!.toLowerCase())];
    if (mes) return `${m[3]}-${mes}-${dd}`;
  }
  m = /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  return '';
}

/** "15:02:03 horas" -> "15:02" */
function parseHora(s: string): string {
  const m = /(\d{1,2}):(\d{2})/.exec(s ?? '');
  return m ? `${m[1]!.padStart(2, '0')}:${m[2]}` : '';
}

/** "$10,691.14 MN" -> 10691.14 */
function parseImporte(s: string): number {
  if (!s) return 0;
  const limpio = String(s).replace(/[^0-9.,]/g, '').replace(/,/g, '');
  const n = parseFloat(limpio);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Valor asociado a una etiqueta dentro del texto extraído. Tolera:
 *  - "Etiqueta: valor"          (caso normal)
 *  - "valor <TAB> Etiqueta:"    (caso invertido, p.ej. "No. de Autorización")
 */
function valorDe(lineas: string[], etiqueta: string): string {
  let linea = lineas.find((l) => l.trimStart().startsWith(etiqueta));
  if (!linea) linea = lineas.find((l) => l.trimEnd().endsWith(etiqueta));
  if (!linea) linea = lineas.find((l) => l.includes(etiqueta));
  if (!linea) return '';
  return linea.replace(etiqueta, '').replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Formato: BanBajío / BajioNet — "Transferencia Interbancaria SPEI"
// ---------------------------------------------------------------------------

function esBanBajio(texto: string): boolean {
  return /BajioNet/i.test(texto) || /Banco del Baj[ií]o/i.test(texto) || /BBA940707IE1/.test(texto);
}

function parsearBanBajio(texto: string): DatosComprobante {
  const l = texto.split('\n');
  return {
    fecOperacion: parseFecha(valorDe(l, 'Fecha de Operación:')),
    horaOperacion: parseHora(valorDe(l, 'Hora de Operación:')),
    ordenante: valorDe(l, 'Nombre del Ordenante:'),
    ctaDestino: valorDe(l, 'Cuenta Destino:'),
    bcoDestino: valorDe(l, 'Banco Destino:'),
    beneficiario: valorDe(l, 'Nombre del Beneficiario:'),
    importe: parseImporte(valorDe(l, 'Importe:')),
    concepto: valorDe(l, 'Concepto de Pago:'),
    referencia: valorDe(l, 'Referencia:'),
    autorizacion: valorDe(l, 'No. de Autorización:'),
    claveRastreo: valorDe(l, 'Clave de Rastreo:'),
  };
}

// ---------------------------------------------------------------------------
// Registro de formatos soportados
// ---------------------------------------------------------------------------

interface FormatoComprobante {
  tipo: string;
  detecta: (texto: string) => boolean;
  parsea: (texto: string) => DatosComprobante;
}

const FORMATOS: FormatoComprobante[] = [
  { tipo: 'banbajio', detecta: esBanBajio, parsea: parsearBanBajio },
];

export interface ResultadoParser {
  tipo: string;
  datos: DatosComprobante;
}

/**
 * Intenta extraer los datos del comprobante con un parser determinista.
 * Devuelve `null` cuando:
 *  - no se reconoce el formato, o
 *  - se reconoce pero faltan los campos críticos (importe > 0 y fecha).
 * En ambos casos el llamador debe recurrir al fallback (IA / captura manual).
 */
export function parsearComprobante(texto: string): ResultadoParser | null {
  if (!texto) return null;
  for (const f of FORMATOS) {
    if (!f.detecta(texto)) continue;
    const datos = f.parsea(texto);
    if (datos.importe > 0 && datos.fecOperacion) return { tipo: f.tipo, datos };
    return null; // formato reconocido pero incompleto -> fallback
  }
  return null; // formato no reconocido -> fallback
}
