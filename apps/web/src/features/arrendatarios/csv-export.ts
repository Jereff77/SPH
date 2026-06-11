export type Celda = string | number | null | undefined;

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

/**
 * Exporta una tabla a CSV (con BOM para Excel). Utilidad **ligera** (sin jsPDF),
 * para que el Dashboard —que no es lazy— no arrastre jsPDF al bundle principal.
 */
export function exportarCSV(nombre: string, columnas: string[], filas: Celda[][]) {
  const esc = (v: Celda) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [columnas.map(esc).join(','), ...filas.map((f) => f.map(esc).join(','))].join('\r\n');
  descargar(`${nombre}.csv`, new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
}
