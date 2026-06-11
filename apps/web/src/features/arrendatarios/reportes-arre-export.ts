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
