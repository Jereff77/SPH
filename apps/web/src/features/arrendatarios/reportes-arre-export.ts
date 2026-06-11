import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Celda } from './csv-export';

// Reexport por compatibilidad: el CSV vive en `csv-export` (sin jsPDF). Importar
// `exportarCSV` desde aquí arrastra jsPDF, así que para CSV usar './csv-export'.
export { exportarCSV } from './csv-export';

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

/** Descarga una imagen (URL pública) y la convierte a dataURL para jsPDF. */
async function urlADataURL(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(typeof r.result === 'string' ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Exporta una tabla a PDF con **encabezado** (logo + título + subtítulo). El logo
 * es opcional: si falla su carga, se omite y sale solo el título. Horizontal A4.
 */
export async function exportarPDFConEncabezado(opts: {
  archivo: string;
  titulo: string;
  subtitulo?: string;
  logoUrl?: string | null;
  columnas: string[];
  filas: Celda[][];
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  let textoX = 40;
  let startY = 40;

  if (opts.logoUrl) {
    const dataUrl = await urlADataURL(opts.logoUrl);
    if (dataUrl) {
      try {
        const props = doc.getImageProperties(dataUrl);
        const w = 90;
        const h = props.height && props.width ? (props.height / props.width) * w : 36;
        doc.addImage(dataUrl, 40, 18, w, h);
        textoX = 40 + w + 16;
        startY = Math.max(startY, 18 + h + 8);
      } catch {
        /* imagen no soportada: se omite el logo */
      }
    }
  }

  doc.setFontSize(15);
  doc.setTextColor(31, 42, 77);
  doc.text(opts.titulo, textoX, 36);
  if (opts.subtitulo) {
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text(opts.subtitulo, textoX, 52);
  }
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    head: [opts.columnas],
    body: opts.filas.map((f) => f.map((c) => (c == null ? '' : String(c)))),
    startY: startY + 8,
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: [31, 42, 77], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  doc.save(`${opts.archivo}.pdf`);
}

/**
 * PDF del Estado de Cuenta: encabezado (logo + título) + **tarjeta de datos del
 * plan** en grid de 4 columnas (etiqueta/valor, como en la app) + la corrida en
 * tabla. Reproduce visualmente la pantalla.
 */
/** Paleta del badge de estado del contrato (RGB). */
const ESTADO_COLOR: Record<
  'VIGENTE' | 'TERMINADO' | 'CANCELADO',
  { borde: [number, number, number]; fondo: [number, number, number]; texto: [number, number, number] }
> = {
  VIGENTE: { borde: [34, 197, 94], fondo: [240, 253, 244], texto: [21, 128, 61] },
  TERMINADO: { borde: [156, 163, 175], fondo: [249, 250, 251], texto: [75, 85, 99] },
  CANCELADO: { borde: [239, 68, 68], fondo: [254, 242, 242], texto: [185, 28, 28] },
};

export async function exportarPDFEstadoCuenta(opts: {
  archivo: string;
  titulo: string;
  generado: string;
  estado: 'VIGENTE' | 'TERMINADO' | 'CANCELADO';
  logoUrl?: string | null;
  datos: { etiqueta: string; valor: string }[];
  columnas: string[];
  filas: Celda[][];
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let textoX = marginX;
  let logoBottom = 18;

  if (opts.logoUrl) {
    const dataUrl = await urlADataURL(opts.logoUrl);
    if (dataUrl) {
      try {
        const props = doc.getImageProperties(dataUrl);
        const w = 84;
        const h = props.height && props.width ? (props.height / props.width) * w : 32;
        doc.addImage(dataUrl, marginX, 18, w, h);
        textoX = marginX + w + 16;
        logoBottom = 18 + h;
      } catch {
        /* imagen no soportada: se omite */
      }
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(31, 42, 77);
  doc.text(opts.titulo, textoX, 34);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generado ${opts.generado}`, textoX, 48);

  // Tarjeta de datos del plan (grid 4 columnas) + badge de estado a la derecha.
  const badgeW = 160;
  const badgeGap = 12;
  const cols = 4;
  const gridContentW = pageW - marginX * 2 - badgeW - badgeGap;
  const colW = gridContentW / cols;
  const rowH = 30;
  const gridTop = Math.max(64, logoBottom + 12);
  const filasGrid = Math.ceil(opts.datos.length / cols);
  const gridBottom = gridTop + filasGrid * rowH;
  const cardTop = gridTop - 12;
  const cardH = gridBottom - gridTop + 8;

  // Marco suave de la tarjeta.
  doc.setDrawColor(225, 228, 235);
  doc.setLineWidth(0.8);
  doc.roundedRect(marginX, cardTop, pageW - marginX * 2, cardH, 4, 4);

  opts.datos.forEach((d, i) => {
    const x = marginX + 10 + (i % cols) * colW;
    const y = gridTop + Math.floor(i / cols) * rowH;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(150, 150, 150);
    doc.text(d.etiqueta.toUpperCase(), x, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(55, 55, 55);
    doc.text(doc.splitTextToSize(d.valor, colW - 16)[0] ?? d.valor, x, y + 12);
  });

  // Badge de estado del contrato.
  const col = ESTADO_COLOR[opts.estado];
  const bx = pageW - marginX - badgeW + 6;
  const by = cardTop + 6;
  const bw = badgeW - 12;
  const bh = cardH - 12;
  doc.setDrawColor(col.borde[0], col.borde[1], col.borde[2]);
  doc.setFillColor(col.fondo[0], col.fondo[1], col.fondo[2]);
  doc.setLineWidth(1.4);
  doc.roundedRect(bx, by, bw, bh, 5, 5, 'FD');
  const cx = bx + bw / 2;
  const cy = by + bh / 2;
  doc.setTextColor(col.texto[0], col.texto[1], col.texto[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('ESTADO DEL CONTRATO', cx, cy - 7, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(opts.estado, cx, cy + 9, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  autoTable(doc, {
    head: [opts.columnas],
    body: opts.filas.map((f) => f.map((c) => (c == null ? '' : String(c)))),
    startY: gridBottom + 8,
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: [31, 42, 77], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  doc.save(`${opts.archivo}.pdf`);
}
