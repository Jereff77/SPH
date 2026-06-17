import { useEffect, useMemo, useRef, useState } from 'react';

const norm = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

interface Props {
  /** Etiqueta de la columna (título del popover). */
  etiqueta: string;
  /** Valores distintos presentes en la columna. */
  opciones: string[];
  /** Selección actual. Vacía = sin filtro (se muestran todas las filas). */
  seleccion: Set<string>;
  onChange: (s: Set<string>) => void;
  /** Texto para una opción vacía. */
  placeholderVacio?: string;
}

/**
 * Filtro de columna estilo Excel con **selección múltiple** (una o varias
 * opciones): embudo + popover con buscador, "Seleccionar todos / Limpiar" y
 * lista de checkboxes. Una selección vacía equivale a *sin filtro*. Reutilizable
 * en cualquier tabla con encabezado azul: se pasa al prop `filtro` de `SortableTh`.
 */
export function FiltroColumnaOpciones({
  etiqueta,
  opciones,
  seleccion,
  onChange,
  placeholderVacio = '(sin valor)',
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  // Activo solo si la selección restringe de verdad (algunos, no todos).
  const activo = seleccion.size > 0 && seleccion.size < opciones.length;

  const visibles = useMemo(() => {
    const qq = norm(q);
    return qq ? opciones.filter((o) => norm(o).includes(qq)) : opciones;
  }, [opciones, q]);

  const toggle = (v: string) => {
    const n = new Set(seleccion);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    onChange(n);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        title={`Filtrar — ${etiqueta}`}
        className={`rounded px-1 text-[10px] leading-none ${activo ? 'bg-white/25 text-white' : 'text-white/50 hover:text-white'}`}
      >
        ▼
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-30 mt-1 w-60 rounded-lg border bg-white p-2 text-left normal-case tracking-normal text-gray-700 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{etiqueta}</div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            autoFocus
            className="mb-1 w-full rounded border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
          />
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <button type="button" onClick={() => onChange(new Set(opciones))} className="text-[#3f5b87] hover:underline">
              Seleccionar todos
            </button>
            <button type="button" onClick={() => onChange(new Set())} className="text-[#3f5b87] hover:underline">
              Limpiar
            </button>
          </div>
          <div className="max-h-52 overflow-auto">
            {visibles.length === 0 && (
              <div className="px-1 py-2 text-xs text-gray-400">Sin coincidencias</div>
            )}
            {visibles.map((o) => (
              <label key={o} className="flex items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-gray-50">
                <input type="checkbox" checked={seleccion.has(o)} onChange={() => toggle(o)} />
                <span className="truncate">{o || placeholderVacio}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
