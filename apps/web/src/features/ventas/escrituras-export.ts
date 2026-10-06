import type { EscrituraRow } from './ventas.api';

/**
 * Exportación a Excel de la pantalla Ventas → Escrituras (clave 630). Respeta el
 * orden y los filtros aplicados en pantalla (recibe ya las filas mostradas).
 * Reutiliza el patrón de `kardex-export.ts` (ExcelJS por carga diferida, logo
 * opcional, descarga por Blob). Encabezado azul congelado y fila de total de naves.
 */

const AZUL = 'FF1F2A4D';
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

const COLUMNAS = ['Parque', 'Nave', 'Inversionista', 'Estatus', 'Fecha de escrituración'];
const NCOL = COLUMNAS.length;

export async function exportarEscriturasExcel(o: EscriturasExportOpts): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Escrituras', { views: [{ state: 'frozen', ySplit: HEAD }] });

  ws.columns = [
    { width: 18 }, { width: 12 }, { width: 38 }, { width: 14 }, { width: 22 },
  ];

  // Encabezado: logo (izq) + título / generado (der).
  const logo = await cargarLogo(o.logoUrl);
  if (logo) {
    try {
      const id = wb.addImage({ base64: logo.base64, extension: logo.ext });
      ws.addImage(id, { tl: { col: 0, row: 0 }, ext: { width: 150, height: 54 } });
    } catch { /* logo no soportado: se omite */ }
  }
  ws.mergeCells('C1:E1');
  const t = ws.getCell('C1');
  t.value = o.titulo;
  t.font = { bold: true, size: 15, color: { argb: AZUL } };
  t.alignment = { vertical: 'middle' };
  ws.mergeCells('C2:E2');
  const g = ws.getCell('C2');
  g.value = `Generado: ${o.generado}`;
  g.font = { size: 9, color: { argb: 'FF6E6E6E' } };

  // Centradas: Estatus (3) y Fecha (4).
  const alineacion = (i: number): 'left' | 'center' => (i === 3 || i === 4 ? 'center' : 'left');

  // Encabezado de tabla (fila HEAD).
  COLUMNAS.forEach((col, i) => {
    const cell = ws.getCell(HEAD, i + 1);
    cell.value = col;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
    cell.alignment = { horizontal: alineacion(i), vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFBBBBBB' } } };
  });

  // Filas.
  o.filas.forEach((f, idx) => {
    const r = ws.getRow(HEAD + 1 + idx);
    r.getCell(1).value = f.parque ?? '';
    r.getCell(2).value = f.numNave ?? '';
    r.getCell(3).value = f.inversionista ?? '';
    r.getCell(4).value = f.escriturada ? 'Escriturada' : 'Pendiente';
    r.getCell(4).alignment = { horizontal: 'center' };
    r.getCell(5).value = fechaCorta(f.fechaEscrituracion);
    r.getCell(5).alignment = { horizontal: 'center' };
    if (idx % 2 === 1) {
      for (let c = 1; c <= NCOL; c++)
        r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }
  });

  // Total de naves (con el desglose por estatus).
  const escrituradas = o.filas.filter((f) => f.escriturada).length;
  const totRow = ws.getRow(HEAD + 1 + o.filas.length);
  ws.mergeCells(totRow.number, 1, totRow.number, NCOL);
  totRow.getCell(1).value = `Total: ${o.filas.length} naves · ${escrituradas} escrituradas · ${o.filas.length - escrituradas} pendientes`;
  for (let c = 1; c <= NCOL; c++) {
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
