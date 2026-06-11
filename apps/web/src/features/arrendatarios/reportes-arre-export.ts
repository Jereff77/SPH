import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type Celda = string | number | null | undefined;

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

/** Exporta una tabla a CSV (con BOM para Excel). */
export function exportarCSV(nombre: string, columnas: string[], filas: Celda[][]) {
  const esc = (v: Celda) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [columnas.map(esc).join(','), ...filas.map((f) => f.map(esc).join(','))].join('\r\n');
  descargar(`${nombre}.csv`, new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
}

/** Exporta una tabla a PDF (jsPDF + autoTable), horizontal, con encabezado azul. */
export function exportarPDF(titulo: string, columnas: string[], filas: Celda[][]) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(14);
  doc.text(titulo, 40, 30);
  autoTable(doc, {
    head: [columnas],
    body: filas.map((f) => f.map((c) => (c == null ? '' : String(c)))),
    startY: 44,
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: [31, 42, 77], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  doc.save(`${titulo}.pdf`);
}
