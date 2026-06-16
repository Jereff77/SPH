import { MESES, type PivoteFila, type SaldoBanco } from './fideicomiso.api';

/**
 * Exportación a Excel del reporte de Contabilidad (Fideicomiso, clave 540),
 * fiel a la pantalla: **una hoja por año**, con la tabla pivote (conceptos
 * agrupados por tipo + columnas Ene..Dic + SubTotal), las filas de totales
 * (BASE IVA / IVA 16% / SIN IVA / GRAN TOTAL) y la fila de Saldo estado de
 * cuenta. Negativos en rojo, encabezado azul congelado, marca de IVA (●) en los
 * conceptos que aplican. Reutiliza el patrón de `kardex-export.ts` (ExcelJS por
 * carga diferida, logo opcional, descarga por Blob).
 */

const AZUL = 'FF1F2A4D';
const AZUL2 = 'FF3A3F5C';
const GRIS_SUB = 'FFC8C9CE';
const GRIS_TOT = 'FFD4D5DA';
const NARANJA = 'FFE67E22';
const GRIS_TXT = 'FF6E6E6E';
const BORDE = 'FFB8B9BE';

/** Formato contable: negativos en rojo, cero como "0" (igual que la pantalla). */
const NUM_FMT = '#,##0.00;[Red]-#,##0.00;"0"';
/** Igual pero sin rojo (para la fila GRAN TOTAL, que va en azul con texto blanco). */
const NUM_FMT_BLANCO = '#,##0.00;-#,##0.00;"0"';

/** Datos de un año a exportar (lo que pinta la pantalla para ese año). */
export interface AnioConta {
  anio: number;
  pivote: PivoteFila[];
  totales: PivoteFila[];
  saldos: SaldoBanco[];
}

export interface ContaExportOpts {
  archivo: string;
  titulo: string;
  generado: string;
  logoUrl?: string | null;
  anios: AnioConta[];
}

interface LogoCargado { base64: string; ext: 'png' | 'jpeg' }

/** Descarga el logo (URL pública) y lo prepara para ExcelJS. */
async function cargarLogo(url?: string | null): Promise<LogoCargado | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(typeof r.result === 'string' ? r.result : '');
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const base64 = dataUrl.split(',')[1] ?? '';
    if (!base64) return null;
    return { base64, ext: /jpe?g/i.test(blob.type) ? 'jpeg' : 'png' };
  } catch {
    return null;
  }
}

const mesVal = (f: PivoteFila, mes: string): number =>
  Number((f as unknown as Record<string, number>)[mes]) || 0;

const COLS = 17; // # | Tipo | Concepto | Descripción | Ene..Dic (12) | SubTotal
const HEAD = 6; // fila del encabezado de la tabla (igual que kardex)

export async function exportarContabilidadExcel(o: ContaExportOpts): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const logo = await cargarLogo(o.logoUrl);

  for (const data of o.anios) {
    construirHoja(wb, o, data, logo);
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${o.archivo}.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function construirHoja(
  wb: import('exceljs').Workbook,
  o: ContaExportOpts,
  data: AnioConta,
  logo: LogoCargado | null,
): void {
  const ws = wb.addWorksheet(String(data.anio), {
    views: [{ state: 'frozen', xSplit: 4, ySplit: HEAD }],
  });

  ws.columns = [
    { width: 5 }, { width: 20 }, { width: 22 }, { width: 26 },
    ...Array.from({ length: 12 }, () => ({ width: 12 })),
    { width: 15 },
  ];

  // ── Encabezado: logo (izq) + título / año / generado (der) ──
  if (logo) {
    try {
      const id = wb.addImage({ base64: logo.base64, extension: logo.ext });
      ws.addImage(id, { tl: { col: 0, row: 0 }, ext: { width: 150, height: 54 } });
    } catch { /* logo no soportado: se omite */ }
  }
  const tituloCell = mergeFila(ws, 1, o.titulo);
  tituloCell.font = { bold: true, size: 15, color: { argb: AZUL } };
  tituloCell.alignment = { vertical: 'middle' };
  const anioCell = mergeFila(ws, 2, `Año ${data.anio}`);
  anioCell.font = { bold: true, size: 11, color: { argb: GRIS_TXT } };
  const genCell = mergeFila(ws, 3, `Generado: ${o.generado}`);
  genCell.font = { size: 9, color: { argb: GRIS_TXT } };

  // ── Encabezado de la tabla (fila HEAD) ──
  const cabeceras = ['#', 'Tipo', 'Concepto', 'Descripción', ...MESES, 'SubTotal'];
  cabeceras.forEach((txt, i) => {
    const cell = ws.getCell(HEAD, i + 1);
    cell.value = txt;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
    cell.alignment = { horizontal: i <= 3 ? 'left' : i === COLS - 1 ? 'right' : 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: BORDE } } };
  });

  let fila = HEAD + 1;

  // ── Filas de datos (numeradas, en el orden del pivote = agrupadas por tipo) ──
  data.pivote.forEach((f, idx) => {
    const r = ws.getRow(fila);
    r.getCell(1).value = idx + 1;
    r.getCell(1).alignment = { horizontal: 'center' };
    r.getCell(1).font = { size: 9, color: { argb: GRIS_TXT } };
    r.getCell(2).value = f.tipo;
    r.getCell(3).value = f.concepto;

    // Descripción con marca de IVA (● naranja) cuando el concepto aplica IVA.
    const descTxt = f.descripcion && f.descripcion !== '-' ? f.descripcion : '';
    r.getCell(4).value = f.aplicaIVA
      ? { richText: [
          { text: '● ', font: { color: { argb: NARANJA }, size: 10 } },
          { text: descTxt, font: { color: { argb: GRIS_TXT }, size: 10 } },
        ] }
      : descTxt;

    MESES.forEach((m, k) => {
      const cell = r.getCell(5 + k);
      cell.value = mesVal(f, m);
      cell.numFmt = NUM_FMT;
      cell.alignment = { horizontal: 'right' };
    });
    const sub = r.getCell(COLS);
    sub.value = Number(f.Total) || 0;
    sub.numFmt = NUM_FMT;
    sub.font = { bold: true };
    sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_SUB } };

    if (idx % 2 === 1) pintarFila(r, 1, COLS - 1, 'FFFFFFFF', 'FFD4D5DA');
    bordeFila(r, COLS);
    fila++;
  });

  if (data.pivote.length === 0) {
    const r = ws.getRow(fila);
    const c = mergeRango(ws, fila, 1, COLS);
    c.value = `Sin movimientos registrados en ${data.anio}.`;
    c.alignment = { horizontal: 'center' };
    c.font = { italic: true, color: { argb: GRIS_TXT } };
    r.height = 22;
    fila++;
  }

  // ── Filas de totales (BASE IVA / IVA 16% / SIN IVA / GRAN TOTAL) ──
  data.totales.forEach((t) => {
    const esGran = (t.tipo ?? '').toUpperCase().includes('GRAN');
    const r = ws.getRow(fila);
    const etiqueta = mergeRango(ws, fila, 1, 4);
    etiqueta.value = t.tipo;
    etiqueta.alignment = { horizontal: 'left', vertical: 'middle' };
    MESES.forEach((m, k) => {
      const cell = r.getCell(5 + k);
      cell.value = mesVal(t, m);
      cell.numFmt = esGran ? NUM_FMT_BLANCO : NUM_FMT;
      cell.alignment = { horizontal: 'right' };
    });
    const sub = r.getCell(COLS);
    sub.value = Number(t.Total) || 0;
    sub.numFmt = esGran ? NUM_FMT_BLANCO : NUM_FMT;

    for (let c = 1; c <= COLS; c++) {
      const cell = r.getCell(c);
      if (esGran) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c === COLS ? AZUL2 : AZUL } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c === COLS ? GRIS_SUB : GRIS_TOT } };
        cell.font = { bold: true };
      }
    }
    fila++;
  });

  // ── Fila de Saldo estado de cuenta ──
  if (data.saldos.length > 0) {
    const porMes: Record<number, number> = {};
    data.saldos.forEach((s) => { porMes[s.mes] = s.saldo; });
    const r = ws.getRow(fila);
    const etiqueta = mergeRango(ws, fila, 1, 4);
    etiqueta.value = 'Saldo estado de cuenta';
    etiqueta.font = { bold: true, size: 10 };
    etiqueta.alignment = { horizontal: 'left', vertical: 'middle' };
    MESES.forEach((_m, k) => {
      const cell = r.getCell(5 + k);
      const saldo = porMes[k + 1];
      if (saldo !== undefined) { cell.value = saldo; cell.numFmt = NUM_FMT; }
      cell.alignment = { horizontal: 'right' };
    });
    for (let c = 1; c <= COLS; c++) {
      r.getCell(c).border = { top: { style: 'medium', color: { argb: AZUL } } };
    }
    fila++;
  }

  // ── Leyenda ──
  fila++;
  const ley = mergeRango(ws, fila, 1, COLS);
  ley.value = '● Concepto que aplica IVA   ·   Los importes negativos se muestran en rojo';
  ley.font = { size: 9, italic: true, color: { argb: GRIS_TXT } };
}

/* ───────────────────────── helpers de celda ───────────────────────── */

function mergeFila(ws: import('exceljs').Worksheet, row: number, value: string) {
  return mergeRango(ws, row, 3, COLS, value); // desde C (deja A:B para el logo)
}

function mergeRango(
  ws: import('exceljs').Worksheet,
  row: number,
  colIni: number,
  colFin: number,
  value?: string,
) {
  ws.mergeCells(row, colIni, row, colFin);
  const cell = ws.getCell(row, colIni);
  if (value !== undefined) cell.value = value;
  return cell;
}

function pintarFila(
  r: import('exceljs').Row,
  desde: number,
  hasta: number,
  _claro: string,
  argb: string,
) {
  for (let c = desde; c <= hasta; c++) {
    r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
  }
}

function bordeFila(r: import('exceljs').Row, cols: number) {
  for (let c = 1; c <= cols; c++) {
    const cur = r.getCell(c).border ?? {};
    r.getCell(c).border = { ...cur, bottom: { style: 'hair', color: { argb: BORDE } } };
  }
}
