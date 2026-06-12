import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReporteCxpRow, TotalesReporteCxp } from './reportes.api';

/** Fecha dd/mm/aaaa (es-MX), igual que v1. */
function fechaCorta(v: string | null): string {
  if (!v) return '';
  const d = new Date(v.length <= 10 ? `${v}T00:00:00` : v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-MX');
}

const moneda = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const hoyISO = () => new Date().toISOString().split('T')[0]!;

/** 17 columnas del Excel (idénticas a v1, en este orden). */
const COLS_EXCEL: { header: string; get: (r: ReporteCxpRow) => string | number }[] = [
  { header: 'Folio', get: (r) => r.folio ?? '' },
  { header: 'Proveedor', get: (r) => r.proveedor ?? '' },
  { header: 'Estado', get: (r) => r.estado ?? '' },
  { header: 'Categoría', get: (r) => r.categoria ?? '' },
  { header: 'Sección', get: (r) => r.seccion ?? '' },
  { header: 'Concepto', get: (r) => r.concepto ?? '' },
  { header: 'Fecha Solicitud', get: (r) => fechaCorta(r.fecSolicitud) },
  { header: 'Fecha CFDI', get: (r) => fechaCorta(r.fecCFDI) },
  { header: 'Fecha Pago', get: (r) => fechaCorta(r.fecPago) },
  { header: 'Subtotal', get: (r) => r.subtotal ?? 0 },
  { header: 'Total', get: (r) => r.total ?? 0 },
  { header: 'Monto Aplicado', get: (r) => r.montoAplicado ?? 0 },
  { header: 'Balance', get: (r) => r.balance ?? 0 },
  { header: 'Urgente', get: (r) => (r.esUrgente ? 'Sí' : 'No') },
  { header: 'Quién solicitó', get: (r) => r.quienSolicito ?? '' },
  { header: 'Quién autorizó', get: (r) => r.quienAutorizo ?? '' },
  { header: 'Quién pagó', get: (r) => r.quienPago ?? '' },
];

/** Exporta a Excel (.xlsx) — 17 columnas, hoja "CXP". ExcelJS lazy. */
export async function exportarReporteExcel(filas: ReporteCxpRow[]): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('CXP');
  ws.columns = COLS_EXCEL.map((c) => ({ header: c.header, key: c.header, width: 18 }));
  ws.getRow(1).font = { bold: true };
  for (const r of filas) {
    ws.addRow(COLS_EXCEL.map((c) => c.get(r)));
  }
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  descargar(`Reporte_CXP_${hoyISO()}.xlsx`, blob);
}

/** Exporta a PDF — 7 columnas, encabezado azul #2c3e50, resumen (igual que v1). */
export function exportarReportePDF(
  filas: ReporteCxpRow[],
  totales: TotalesReporteCxp,
): void {
  const doc = new jsPDF(); // portrait, A4 (igual que v1)
  doc.setFontSize(16);
  doc.text('Reporte de Cuentas por Pagar', 14, 15);
  doc.setFontSize(10);
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-MX')}`, 14, 25);

  autoTable(doc, {
    head: [['Folio', 'Proveedor', 'Estado', 'F. Solicitud', 'Total', 'Monto Aplicado', 'Balance']],
    body: filas.map((r) => [
      r.folio ?? '',
      r.proveedor ?? '',
      r.estado ?? '',
      fechaCorta(r.fecSolicitud),
      moneda(r.total),
      moneda(r.montoAplicado),
      moneda(r.balance),
    ]),
    startY: 35,
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [44, 62, 80], textColor: 255 },
  });

  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 35;
  doc.setFontSize(10);
  doc.text(`Total Registros: ${totales.totalRegistros}`, 14, finalY + 10);
  doc.text(`Monto Total: ${moneda(totales.montoTotal)}`, 14, finalY + 16);
  doc.text(`Balance Total: ${moneda(totales.balance)}`, 14, finalY + 22);

  doc.save(`Reporte_CXP_${hoyISO()}.pdf`);
}

function descargar(nombre: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
