import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { KardexFila } from './fideicomiso.api';
import { moneda, fechaCorta, numero } from './format';

const COLUMNAS = ['Mov', 'Monto', 'Fec. Ini', 'Fecha', 'Días', 'Cálculo', 'Com SPH', 'Retención', 'Dispersión', 'Estado', 'Fórmula'];

const formula = (f: KardexFila) =>
  `((${numero(f.monto, 0)} × ${numero(f.rend, 0)}%) / 365) × ${f.dias ?? 0} días`;

export interface KardexExportOpts {
  archivo: string;
  titulo: string;
  subLineas: string[];
  generado: string;
  logoUrl?: string | null;
  filas: KardexFila[];
  totales: { calculo: number; comsph: number; retencionIsr: number; dispersion: number };
  totalesEtiqueta: string;
}

interface LogoCargado { dataUrl: string; base64: string; ext: 'png' | 'jpeg' }

/** Descarga el logo (URL pública) y lo prepara para jsPDF/ExcelJS. */
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
    if (!dataUrl) return null;
    const base64 = dataUrl.split(',')[1] ?? '';
    const ext = /jpe?g/i.test(blob.type) ? 'jpeg' : 'png';
    return { dataUrl, base64, ext };
  } catch {
    return null;
  }
}

/* ───────────────────────────── PDF ───────────────────────────── */

export async function exportarKardexPDF(o: KardexExportOpts): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  let textoX = 40;
  let headBottom = 40;

  const logo = await cargarLogo(o.logoUrl);
  if (logo) {
    try {
      const props = doc.getImageProperties(logo.dataUrl);
      const w = 96;
      const h = props.height && props.width ? (props.height / props.width) * w : 38;
      doc.addImage(logo.dataUrl, 40, 16, w, h);
      textoX = 40 + w + 18;
      headBottom = Math.max(headBottom, 16 + h);
    } catch {
      /* logo no soportado: se omite */
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(31, 42, 77);
  doc.text(o.titulo, textoX, 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(110, 110, 110);
  o.subLineas.forEach((l, i) => doc.text(l, textoX, 48 + i * 12));
  doc.text(`Generado: ${o.generado}`, textoX, 48 + o.subLineas.length * 12);
  doc.setTextColor(0, 0, 0);

  const startY = Math.max(headBottom + 14, 48 + (o.subLineas.length + 1) * 12 + 8);

  autoTable(doc, {
    head: [COLUMNAS],
    body: o.filas.map((f) => [
      f.numMov ?? '',
      moneda(f.monto),
      fechaCorta(f.fecini),
      fechaCorta(f.fecfin),
      f.dias ?? '',
      moneda(f.calculo),
      moneda(f.comsph),
      moneda(f.retencionIsr),
      moneda(f.dispersion),
      f.pagado ? 'Pagado' : 'Pendiente',
      formula(f),
    ]),
    foot: [[
      { content: o.totalesEtiqueta, colSpan: 5 },
      moneda(o.totales.calculo),
      moneda(o.totales.comsph),
      moneda(o.totales.retencionIsr),
      moneda(o.totales.dispersion),
      '', '',
    ]],
    startY,
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: [31, 42, 77], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [31, 42, 77], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      1: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' },
      7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'center' },
    },
  });
  doc.save(`${o.archivo}.pdf`);
}

/* ───────────────────────────── Excel ───────────────────────────── */

const AZUL = 'FF1F2A4D';
const MONEDA_FMT = '"$"#,##0.00';

export async function exportarKardexExcel(o: KardexExportOpts): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Kardex', { views: [{ state: 'frozen', ySplit: 6 }] });

  ws.columns = [
    { width: 6 }, { width: 16 }, { width: 12 }, { width: 12 }, { width: 8 },
    { width: 16 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 12 }, { width: 34 },
  ];

  // Encabezado: logo (izquierda) + título/subtítulos (derecha).
  const logo = await cargarLogo(o.logoUrl);
  if (logo) {
    try {
      const id = wb.addImage({ base64: logo.base64, extension: logo.ext });
      ws.addImage(id, { tl: { col: 0, row: 0 }, ext: { width: 150, height: 54 } });
    } catch {
      /* logo no soportado */
    }
  }

  ws.mergeCells('C1:K1');
  const t = ws.getCell('C1');
  t.value = o.titulo;
  t.font = { bold: true, size: 15, color: { argb: AZUL } };
  t.alignment = { vertical: 'middle' };

  o.subLineas.forEach((l, i) => {
    ws.mergeCells(`C${2 + i}:K${2 + i}`);
    const c = ws.getCell(`C${2 + i}`);
    c.value = l;
    c.font = { size: 9, color: { argb: 'FF6E6E6E' } };
  });
  const genRow = 2 + o.subLineas.length;
  ws.mergeCells(`C${genRow}:K${genRow}`);
  const g = ws.getCell(`C${genRow}`);
  g.value = `Generado: ${o.generado}`;
  g.font = { size: 9, color: { argb: 'FF6E6E6E' } };

  // Encabezado de tabla (fila 6).
  const HEAD = 6;
  COLUMNAS.forEach((col, i) => {
    const cell = ws.getCell(HEAD, i + 1);
    cell.value = col;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFBBBBBB' } } };
  });

  // Filas de datos.
  const num = (n: number | null) => (n == null ? null : n);
  o.filas.forEach((f, idx) => {
    const r = ws.getRow(HEAD + 1 + idx);
    r.getCell(1).value = f.numMov ?? null;
    r.getCell(2).value = num(f.monto);
    r.getCell(3).value = fechaCorta(f.fecini);
    r.getCell(4).value = fechaCorta(f.fecfin);
    r.getCell(5).value = f.dias ?? null;
    r.getCell(6).value = num(f.calculo);
    r.getCell(7).value = num(f.comsph);
    r.getCell(8).value = num(f.retencionIsr);
    r.getCell(9).value = num(f.dispersion);
    r.getCell(10).value = f.pagado ? 'Pagado' : 'Pendiente';
    r.getCell(11).value = formula(f);
    for (const col of [2, 6, 7, 8, 9]) r.getCell(col).numFmt = MONEDA_FMT;
    [1, 3, 4, 5, 10].forEach((col) => (r.getCell(col).alignment = { horizontal: 'center' }));
    if (idx % 2 === 1) {
      for (let c = 1; c <= 11; c++)
        r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }
  });

  // Fila de totales.
  const totRow = ws.getRow(HEAD + 1 + o.filas.length);
  ws.mergeCells(totRow.number, 1, totRow.number, 5);
  totRow.getCell(1).value = o.totalesEtiqueta;
  totRow.getCell(6).value = o.totales.calculo;
  totRow.getCell(7).value = o.totales.comsph;
  totRow.getCell(8).value = o.totales.retencionIsr;
  totRow.getCell(9).value = o.totales.dispersion;
  for (let c = 1; c <= 11; c++) {
    const cell = totRow.getCell(c);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
  }
  for (const col of [6, 7, 8, 9]) totRow.getCell(col).numFmt = MONEDA_FMT;

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${o.archivo}.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
}
