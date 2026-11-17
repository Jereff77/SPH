import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Ancho del popover (w-60 = 15rem = 240 px). */
const ANCHO = 240;

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
  const [pos, setPos] = useState({ top: 0, left: 0, maxH: 320 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const abrir = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      setPos({
        top: r.bottom + 4,
        left: Math.max(8, Math.min(r.left, window.innerWidth - ANCHO - 8)),
        // Alto disponible hasta el borde inferior de la pantalla (no depende de la tabla).
        maxH: Math.max(160, window.innerHeight - r.bottom - 12),
      });
    }
    setQ('');
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    // Scroll fuera del popover (tabla/página) lo cierra; el de su propia lista no.
    const onScroll = (e: Event) => {
      if (popRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const cerrar = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', cerrar);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', cerrar);
      document.removeEventListener('keydown', onKey);
    };
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
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); if (open) setOpen(false); else abrir(); }}
        title={`Filtrar — ${etiqueta}`}
        className={`rounded px-1 text-[10px] leading-none ${activo ? 'bg-white/25 text-white' : 'text-white/50 hover:text-white'}`}
      >
        ▼
      </button>
      {open && createPortal(
        <div
          ref={popRef}
          className="fixed z-[61] flex w-60 flex-col rounded-lg border bg-white p-2 text-left normal-case tracking-normal text-gray-700 shadow-lg"
          style={{ top: pos.top, left: pos.left, maxHeight: pos.maxH }}
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
          <div className="min-h-0 flex-1 overflow-auto">
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
        </div>,
        document.body,
      )}
    </>
  );
}
