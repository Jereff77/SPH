import ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';

/**
 * Parser del **estado de cuenta de BanBajío** (exportación "ConsultaMovimientos").
 *
 * El archivo trae una sola hoja con un encabezado de metadatos (cliente, cuenta,
 * periodo) y, a partir de la fila de columnas
 * `# | Fecha Movimiento | Hora | Recibo | Descripción | Cargos | Abonos | Saldo`,
 * un renglón por movimiento. Toda la información del SPEI vive en la celda
 * **Descripción** como texto con separadores `|`:
 *
 *   `SPEI Recibido: | Institucion contraparte: BBVA MEXICO Ordenante: NN Cuenta
 *    Ordenante: 0124... | RFC Ordenante: XXXX | Referencia: 605260 | Hora: 20:52:12
 *    | Clave de Rastreo: MBAN... Concepto del Pago: ... | Recibo # 256816486`
 *
 * Solo nos interesan los **abonos** cuya descripción empieza con `SPEI Recibido`.
 * La clave de rastreo es la llave única del movimiento (anti-duplicado).
 */

/** Número de cuenta esperado del estado de cuenta de Grupo SPH en BanBajío. */
export const CUENTA_SPH = '21568480';

export interface SpeiRecibido {
  fecha: string; // YYYY-MM-DD (fecOperacion)
  hora: string | null; // HH:MM:SS
  institucion: string | null; // banco emisor (contraparte)
  ordenante: string | null; // nombre del ordenante (normalizado)
  cuentaOrdenante: string | null; // informativo (no se persiste)
  rfcOrdenante: string | null; // informativo (no se persiste)
  referencia: string | null;
  rastreo: string; // llave única
  concepto: string | null; // en MAYÚSCULAS
  importe: number;
  descripcionCruda: string;
}

/** Texto plano de una celda exceljs (soporta richText, fórmulas y fechas). */
function texto(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return '';
  const v = cell.value as unknown;
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.richText)) {
      return (o.richText as { text?: string }[]).map((t) => t.text ?? '').join('');
    }
    if ('result' in o) return String(o.result ?? '');
    if ('text' in o) return String(o.text ?? '');
  }
  return String(v);
}

/** Valor numérico de una celda (Abonos); tolera fórmulas y formato con separadores. */
function numero(cell: ExcelJS.Cell | undefined): number | null {
  if (!cell) return null;
  const v = cell.value as unknown;
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && 'result' in (v as object)) {
    const r = (v as { result?: unknown }).result;
    if (typeof r === 'number') return r;
  }
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Fecha YYYY-MM-DD de una celda (exceljs interpreta las fechas de Excel como UTC). */
function fechaISO(cell: ExcelJS.Cell | undefined): string | null {
  if (!cell) return null;
  const v = cell.value as unknown;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = texto(cell).match(/(\d{4})-(\d{2})-(\d{2})/);
  return m?.[0] ?? null;
}

function buscar(desc: string, re: RegExp): string | null {
  const m = desc.match(re);
  return m?.[1]?.trim() ?? null;
}

/** Normaliza el nombre del ordenante igual que los registros existentes: sin
 * puntos/comas, espacios colapsados y en MAYÚSCULAS. */
function normalizarOrdenante(s: string | null): string | null {
  if (!s) return s;
  return s.replace(/[.,]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

/** Extrae los campos estructurados de la celda Descripción de un "SPEI Recibido". */
function parsearDescripcion(desc: string): Omit<SpeiRecibido, 'fecha' | 'hora' | 'importe'> {
  // El rastreo puede contener guiones/barras (KAPITAL '136-28/05/2026/28-...',
  // BANREGIO '058-...'); se captura TODO hasta "Concepto del Pago:" (o "Recibo #").
  let rastreo =
    buscar(desc, /Clave de Rastreo:\s*(.*?)\s*Concepto del Pago:/i) ??
    buscar(desc, /Clave de Rastreo:\s*(.*?)\s*\|?\s*Recibo #/i) ??
    buscar(desc, /Clave de Rastreo:\s*(\S+)\s*$/i) ??
    '';
  rastreo = rastreo.replace(/\s*\|\s*/g, ' ').trim();

  let concepto = buscar(desc, /Concepto del Pago:\s*(.*?)\s*\|?\s*Recibo #/i);
  if (concepto) concepto = concepto.replace(/\s*\|\s*/g, ' ').trim().toUpperCase();

  return {
    institucion: buscar(desc, /Institucion contraparte:\s*(.*?)\s*Ordenante:/i),
    ordenante: normalizarOrdenante(buscar(desc, /Ordenante:\s*(.*?)\s*Cuenta Ordenante:/i)),
    cuentaOrdenante: buscar(desc, /Cuenta Ordenante:\s*([0-9]+)/i),
    rfcOrdenante: buscar(desc, /RFC Ordenante:\s*([A-ZÑ&0-9]+)/i),
    referencia: buscar(desc, /Referencia:\s*([^|]+?)\s*(?:\||Hora:)/i),
    rastreo,
    concepto,
    descripcionCruda: desc,
  };
}

export interface ResultadoParseo {
  /** Todos los SPEI Recibido del archivo, deduplicados por rastreo. */
  speis: SpeiRecibido[];
  /** Cuántos renglones "SPEI Recibido" había antes de deduplicar por rastreo. */
  leidos: number;
}

/**
 * Lee el buffer del .xlsx de BanBajío y devuelve los SPEI Recibido parseados y
 * deduplicados por rastreo. Lanza `BadRequestException` si el archivo no tiene el
 * formato esperado (no es el estado de cuenta de BanBajío).
 */
export async function parsearEstadoCuentaBanBajio(buffer: Buffer): Promise<ResultadoParseo> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new BadRequestException('No se pudo leer el archivo. ¿Es un .xlsx válido?');
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new BadRequestException('El archivo no contiene hojas.');

  // Localizar la fila de encabezados (la que tiene "Descripción" y "Abonos").
  let headerRow = 0;
  let fechaCol = 0;
  let horaCol = 0;
  let descCol = 0;
  let abonosCol = 0;
  for (let r = 1; r <= Math.min(ws.rowCount, 30); r++) {
    const fila = ws.getRow(r);
    let f = 0;
    let h = 0;
    let d = 0;
    let a = 0;
    fila.eachCell((cell, col) => {
      const t = texto(cell)
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .trim();
      if (t === 'fecha movimiento') f = col;
      else if (t === 'hora') h = col;
      else if (t === 'descripcion') d = col;
      else if (t === 'abonos') a = col;
    });
    if (d && a && f) {
      headerRow = r;
      fechaCol = f;
      horaCol = h;
      descCol = d;
      abonosCol = a;
      break;
    }
  }
  if (!headerRow) {
    throw new BadRequestException(
      'El archivo no tiene el formato de estado de cuenta de BanBajío (no se encontraron las columnas Fecha/Descripción/Abonos).',
    );
  }

  const speis: SpeiRecibido[] = [];
  let leidos = 0;
  const vistos = new Set<string>();

  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const fila = ws.getRow(r);
    const desc = texto(fila.getCell(descCol));
    if (!/^\s*SPEI Recibido/i.test(desc)) continue;
    leidos++;

    const fecha = fechaISO(fila.getCell(fechaCol));
    const importe = numero(fila.getCell(abonosCol));
    if (!fecha || importe == null || importe <= 0) continue;

    const campos = parsearDescripcion(desc);
    if (!campos.rastreo) continue;

    // Hora: preferir la del texto ("Hora: HH:MM:SS"); si no, la celda.
    let hora = buscar(desc, /Hora:\s*([0-9]{1,2}:[0-9]{2}:[0-9]{2})/i);
    if (!hora && horaCol) {
      const hv = fila.getCell(horaCol).value as unknown;
      if (hv instanceof Date) hora = hv.toISOString().slice(11, 19);
    }

    if (vistos.has(campos.rastreo)) continue; // dedup dentro del propio archivo
    vistos.add(campos.rastreo);

    speis.push({ fecha, hora, importe, ...campos });
  }

  return { speis, leidos };
}
