/**
 * Control de paginación reutilizable ("‹ Anterior · Página X de Y · Siguiente ›"
 * + "Mostrando A-B de N"). Extrae el patrón que hoy vive inline en features.
 * La paginación es del lado del cliente: el consumidor hace el `slice`; este
 * componente solo pinta el estado y emite el cambio de página.
 */
export function Paginacion({
  pagina,
  totalPaginas,
  total,
  porPagina,
  onCambio,
}: {
  /** Página actual (1-based). */
  pagina: number;
  /** Total de páginas (≥ 1). */
  totalPaginas: number;
  /** Total de registros (ya filtrados). */
  total: number;
  /** Tamaño de página. */
  porPagina: number;
  onCambio: (pagina: number) => void;
}) {
  const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-gray-500">
      <span>
        Mostrando {desde}-{hasta} de {total} registros
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onCambio(Math.max(1, pagina - 1))}
          disabled={pagina <= 1}
          className="rounded border px-2 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
        >
          ‹ Anterior
        </button>
        <span>
          Página {pagina} de {totalPaginas}
        </span>
        <button
          type="button"
          onClick={() => onCambio(Math.min(totalPaginas, pagina + 1))}
          disabled={pagina >= totalPaginas}
          className="rounded border px-2 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
        >
          Siguiente ›
        </button>
      </div>
    </div>
  );
}
