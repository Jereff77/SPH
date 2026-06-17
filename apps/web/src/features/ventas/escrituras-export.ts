import type { EscrituraRow } from './ventas.api';

/**
 * Exportación a Excel de la pantalla Ventas → Escrituras (clave 630). Respeta el
 * orden y los filtros aplicados en pantalla (recibe ya las filas mostradas).
 * Reutiliza el patrón de `kardex-export.ts` (ExcelJS por carga diferida, logo
 * opcional, descarga por Blob). Encabezado azul congelado, negativos/Monto con
 * formato de moneda y fila de Total.
 */

const AZUL = 'FF1F2A4D';
const MONEDA_FMT = '"$"#,##0.00';
const HEAD = 6;

export interface EscriturasExportOpts {
  archivo: string;
  titulo: string;
  generado: string;
  logoUrl?: string | null;
  filas: EscrituraRow[];
}

interface LogoCargado { base64: string; ext: 'png' | 'jpeg' }

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

/** Fecha ISO (yyyy-MM-dd) → dd/mm/aaaa (regla 7b). */
function fechaCorta(iso: string | null): string {
  if (!iso) return '';
  const p = (iso.split('T')[0] ?? iso).split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

const COLUMNAS = ['Tipo Pago', 'Nave', 'No. de pago', 'Inversionista', 'Fecha', 'Monto'];

export async function exportarEscriturasExcel(o: EscriturasExportOpts): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Escrituras', { views: [{ state: 'frozen', ySplit: HEAD }] });

  ws.columns = [
    { width: 16 }, { width: 18 }, { width: 12 }, { width: 32 }, { width: 14 }, { width: 16 },
  ];

  // Encabezado: logo (izq) + título / generado (der).
  const logo = await cargarLogo(o.logoUrl);
  if (logo) {
    try {
      const id = wb.addImage({ base64: logo.base64, extension: logo.ext });
      ws.addImage(id, { tl: { col: 0, row: 0 }, ext: { width: 150, height: 54 } });
    } catch { /* logo no soportado: se omite */ }
  }
  ws.mergeCells('C1:F1');
  const t = ws.getCell('C1');
  t.value = o.titulo;
  t.font = { bold: true, size: 15, color: { argb: AZUL } };
  t.alignment = { vertical: 'middle' };
  ws.mergeCells('C2:F2');
  const g = ws.getCell('C2');
  g.value = `Generado: ${o.generado}`;
  g.font = { size: 9, color: { argb: 'FF6E6E6E' } };

  // Encabezado de tabla (fila HEAD).
  COLUMNAS.forEach((col, i) => {
    const cell = ws.getCell(HEAD, i + 1);
    cell.value = col;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
    cell.alignment = { horizontal: i === 2 ? 'center' : i === 5 ? 'right' : 'left', vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFBBBBBB' } } };
  });

  // Filas.
  let total = 0;
  o.filas.forEach((f, idx) => {
    const r = ws.getRow(HEAD + 1 + idx);
    r.getCell(1).value = f.tipoPago ?? '';
    r.getCell(2).value = f.nave ?? '';
    r.getCell(3).value = f.numPago ?? null;
    r.getCell(3).alignment = { horizontal: 'center' };
    r.getCell(4).value = f.inversionista ?? '';
    r.getCell(5).value = fechaCorta(f.fecha);
    r.getCell(5).alignment = { horizontal: 'center' };
    const monto = r.getCell(6);
    monto.value = f.monto ?? 0;
    monto.numFmt = MONEDA_FMT;
    total += f.monto ?? 0;
    if (idx % 2 === 1) {
      for (let c = 1; c <= 6; c++)
        r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }
  });

  // Total.
  const totRow = ws.getRow(HEAD + 1 + o.filas.length);
  ws.mergeCells(totRow.number, 1, totRow.number, 5);
  totRow.getCell(1).value = `Total (${o.filas.length})`;
  totRow.getCell(6).value = total;
  totRow.getCell(6).numFmt = MONEDA_FMT;
  for (let c = 1; c <= 6; c++) {
    const cell = totRow.getCell(c);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
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
