/**
 * Utilidades del reporte «Estado de cuenta» de CxP (puras, sin base de datos, con pruebas).
 */

/** Texto comparable: sin espacios de más, sin mayúsculas ni acentos. */
export function normalizarTexto(v: string | null | undefined): string {
  return (v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * ¿El valor de la fila es EXACTAMENTE uno de los elegidos? La RPC del reporte filtra con
 * `ILIKE '%…%'` (contiene), así que «Acupark II» también trae «Acupark III»: tras la RPC se
 * vuelve a filtrar por igualdad, también cuando solo se eligió un valor.
 */
export function coincideExacto(valor: string | null | undefined, elegidos: readonly string[]): boolean {
  if (valor == null) return false;
  const v = normalizarTexto(valor);
  return elegidos.some((e) => normalizarTexto(e) === v);
}

/** Etiqueta del tipo de solicitud para auditar: PUE, PPD, urgente, línea de captura… */
export function etiquetaTipoSolicitud(m: {
  tipoOperacion: number | null;
  idCxpPPD: string | null;
  diferido: boolean | null;
}): string {
  if (m.idCxpPPD || m.diferido === true) return 'Factura PPD';
  switch (m.tipoOperacion) {
    case 1:
      return 'Factura PUE';
    case 2:
      return 'Urgente';
    case 4:
      return 'Línea de captura';
    case 5:
      return 'Devolución';
    case 6:
      return 'Sin XML';
    case 98:
      return 'Ajuste presupuestal';
    default:
      return 'Otro';
  }
}
