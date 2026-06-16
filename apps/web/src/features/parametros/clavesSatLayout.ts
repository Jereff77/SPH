/**
 * Layout (plantilla) Excel para la carga masiva de Claves SAT:
 *  - `descargarLayout()` genera el archivo modelo (hoja de captura + instrucciones).
 *  - `leerLayout(file)` lee un Excel lleno y devuelve filas válidas e inválidas.
 * ExcelJS se importa de forma diferida (lazy), igual que en los reportes de CxP.
 */

export interface FilaImport {
  claveProdServ: string;
  descripcion: string;
  retieneIVA: boolean;
  retieneISR: boolean;
}

export interface FilaInvalida {
  fila: number; // número de fila en el Excel (1-based)
  valor: string; // lo que venía en la columna Clave
  motivo: string;
}

export interface LecturaLayout {
  validas: FilaImport[];
  invalidas: FilaInvalida[];
}

const NOMBRE_HOJA = 'Claves SAT';
const HEADERS = ['Clave SAT', 'Descripción', 'Retiene IVA', 'Retiene ISR'] as const;

const hoyISO = () => new Date().toISOString().split('T')[0]!;

/** Quita acentos y normaliza a minúsculas para comparar encabezados/valores. */
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/** Interpreta Sí/No/TRUE/1/X… como booleano. */
function parseBool(v: string): boolean {
  const s = norm(v);
  return ['si', 's', 'true', 'verdadero', '1', 'x', '✓'].includes(s);
}

/** Extrae texto plano del value de una celda ExcelJS (string, número, richText, fórmula…). */
function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (Array.isArray((o as { richText?: unknown }).richText)) {
      return (o.richText as { text?: string }[]).map((r) => r.text ?? '').join('');
    }
    if ('result' in o) return String(o.result ?? '');
    if ('text' in o) return String(o.text ?? '');
    return '';
  }
  return String(v);
}

/** Genera y descarga la plantilla .xlsx. */
export async function descargarLayout(): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();

  // --- Hoja de captura ---
  const ws = wb.addWorksheet(NOMBRE_HOJA);
  ws.columns = [
    { header: HEADERS[0], key: 'clave', width: 16 },
    { header: HEADERS[1], key: 'desc', width: 50 },
    { header: HEADERS[2], key: 'iva', width: 14 },
    { header: HEADERS[3], key: 'isr', width: 14 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F2A4D' },
  };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Ejemplos (se pueden borrar antes de cargar).
  const ejemplos: [string, string, string, string][] = [
    ['80131601', 'Comisiones por venta/renta', 'Sí', 'Sí'],
    ['84111506', 'Servicios de contabilidad', 'Sí', 'Sí'],
    ['25101910', 'Suministro de agua', 'No', 'No'],
  ];
  for (const e of ejemplos) ws.addRow(e);

  // Lista desplegable Sí/No en las columnas de retención (filas 2..1000).
  for (let r = 2; r <= 1000; r++) {
    for (const col of ['C', 'D']) {
      ws.getCell(`${col}${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Sí,No"'],
      };
    }
  }

  // --- Hoja de instrucciones ---
  const ins = wb.addWorksheet('Instrucciones');
  ins.getColumn(1).width = 110;
  const lineas = [
    'CARGA MASIVA DE CLAVES SAT',
    '',
    'Captura las claves en la hoja "Claves SAT", una por fila. Puedes borrar las filas de ejemplo.',
    '',
    'Columnas:',
    '  • Clave SAT: la clave Producto/Servicio del SAT (normalmente 8 dígitos). Obligatoria y única.',
    '  • Descripción: texto libre (opcional).',
    '  • Retiene IVA: Sí / No  (se acepta también TRUE/FALSE, 1/0, X).',
    '  • Retiene ISR: Sí / No.',
    '',
    'Reglas importantes:',
    '  • "Retiene IVA/ISR" indica SI la clave causa retención; la TASA la define el régimen del',
    '    proveedor al validar la factura (612 → ISR 10% · 606 → ISR 10% · 626/RESICO → ISR 1.25% ·',
    '    retención de IVA = 10.6667%).',
    '  • Si una clave ya existe, la importación la ACTUALIZA (descripción y retenciones) y la deja activa.',
    '  • Si repites una clave en el archivo, se conserva la última ocurrencia.',
  ];
  lineas.forEach((t, i) => {
    const cell = ins.getCell(`A${i + 1}`);
    cell.value = t;
    if (i === 0) cell.font = { bold: true, size: 14 };
    else if (t.endsWith(':')) cell.font = { bold: true };
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Layout_ClavesSAT_${hoyISO()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Lee un Excel de carga y separa filas válidas de inválidas. */
export async function leerLayout(file: File): Promise<LecturaLayout> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());

  const ws = wb.getWorksheet(NOMBRE_HOJA) ?? wb.worksheets[0];
  if (!ws) throw new Error('El archivo no tiene hojas.');

  // Detectar columnas por encabezado (fila 1); fallback al orden por defecto.
  let cClave = 1;
  let cDesc = 2;
  let cIva = 3;
  let cIsr = 4;
  const head = ws.getRow(1);
  if (head?.cellCount) {
    head.eachCell((cell, col) => {
      const h = norm(cellText(cell.value));
      if (h.includes('clave')) cClave = col;
      else if (h.includes('descrip')) cDesc = col;
      else if (h.includes('iva')) cIva = col;
      else if (h.includes('isr')) cIsr = col;
    });
  }

  const validas: FilaImport[] = [];
  const invalidas: FilaInvalida[] = [];

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // encabezado
    const clave = cellText(row.getCell(cClave).value).trim();
    const descripcion = cellText(row.getCell(cDesc).value).trim();
    const ivaTxt = cellText(row.getCell(cIva).value);
    const isrTxt = cellText(row.getCell(cIsr).value);

    // Fila completamente vacía → se ignora en silencio.
    if (!clave && !descripcion && !ivaTxt.trim() && !isrTxt.trim()) return;

    if (!clave) {
      invalidas.push({ fila: rowNumber, valor: '', motivo: 'Clave vacía' });
      return;
    }
    if (clave.length > 20) {
      invalidas.push({ fila: rowNumber, valor: clave, motivo: 'Clave demasiado larga (máx. 20)' });
      return;
    }

    validas.push({
      claveProdServ: clave,
      descripcion: descripcion.slice(0, 300),
      retieneIVA: parseBool(ivaTxt),
      retieneISR: parseBool(isrTxt),
    });
  });

  return { validas, invalidas };
}
