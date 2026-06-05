import type { ReactNode } from 'react';
import type { Dir } from './useSort';

/**
 * Clases del `<thead>` para el encabezado FIJO con fondo azul del sidebar y
 * letra blanca (regla de diseño 7). Aplicar junto a un contenedor con
 * `overflow-auto` + `max-h-…` para que el sticky funcione.
 */
export const THEAD_STICKY =
  '[&>tr>th]:sticky [&>tr>th]:top-0 [&>tr>th]:z-10 [&>tr>th]:bg-[#1f2a4d]';

/** Clases del `<tr>` del encabezado (texto blanco). */
export const THEAD_TR = 'text-left text-xs font-semibold uppercase tracking-wide text-white';

type Align = 'left' | 'center' | 'right';

interface Props {
  children: ReactNode;
  /** Clave de orden; si se omite, la columna no es ordenable. */
  campo?: string;
  sortKey?: string | null;
  dir?: Dir;
  onSort?: (k: string) => void;
  align?: Align;
  className?: string;
  /** Control de filtro de columna (estilo Excel), opcional. */
  filtro?: ReactNode;
}

/**
 * Celda de encabezado ordenable. Si recibe `campo` + `onSort`, muestra el
 * indicador de orden y ordena al hacer clic. Si no, es un encabezado simple.
 * Con `filtro`, agrega un control (embudo) a la derecha del título.
 */
export function SortableTh({
  children,
  campo,
  sortKey,
  dir,
  onSort,
  align = 'left',
  className = '',
  filtro,
}: Props) {
  const alinear =
    align === 'center'
      ? 'text-center'
      : align === 'right'
        ? 'text-right'
        : 'text-left';
  const justify =
    align === 'center'
      ? 'justify-center'
      : align === 'right'
        ? 'justify-end'
        : 'justify-start';
  const activo = !!campo && sortKey === campo;
  const clickable = !!campo && !!onSort;

  return (
    <th className={`px-4 py-3 ${alinear} ${className}`}>
      <div className={`flex items-center gap-1 ${justify}`}>
        {clickable ? (
          <button
            type="button"
            onClick={() => onSort(campo)}
            className="inline-flex items-center gap-1 uppercase tracking-wide text-white hover:text-white/80"
          >
            {children}
            <span className="text-[10px] opacity-70">
              {activo ? (dir === 'asc' ? '▲' : '▼') : '↕'}
            </span>
          </button>
        ) : (
          <span className="uppercase tracking-wide">{children}</span>
        )}
        {filtro}
      </div>
    </th>
  );
}
