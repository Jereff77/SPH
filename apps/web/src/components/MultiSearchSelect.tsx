import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { OpcionSelect } from './SearchSelect';

/** Normaliza para comparar sin acentos ni mayúsculas. */
const norm = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/**
 * Combobox con búsqueda y **selección múltiple** (una o varias opciones —
 * regla de diseño 7c). Mismo aspecto que `SearchSelect`, pero con checkboxes y
 * botones "Seleccionar todas / Limpiar". El botón muestra la opción cuando hay
 * una, o "N seleccionadas" cuando hay varias.
 */
export function MultiSearchSelect({
  values,
  onChange,
  options,
  placeholder = 'Selecciona…',
  disabled = false,
  className = '',
  ordenarAlfabetico = true,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  options: OpcionSelect[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** `false` conserva el orden de `options` (p. ej. meses en orden cronológico). */
  ordenarAlfabetico?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busca, setBusca] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const sel = useMemo(() => new Set(values), [values]);

  const ordenadas = useMemo(
    () =>
      ordenarAlfabetico
        ? [...options].sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }))
        : options,
    [options, ordenarAlfabetico],
  );
  const filtradas = useMemo(() => {
    const q = norm(busca);
    return q ? ordenadas.filter((o) => norm(o.label).includes(q)) : ordenadas;
  }, [ordenadas, busca]);

  // Cerrar al hacer clic fuera.
  useEffect(() => {
    if (!abierto) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [abierto]);
  // Enfocar el buscador al abrir.
  useEffect(() => {
    if (abierto) inputRef.current?.focus();
  }, [abierto]);

  const resumen =
    values.length === 0
      ? placeholder
      : values.length === 1
        ? options.find((o) => o.value === values[0])?.label ?? '1 seleccionada'
        : `${values.length} seleccionadas`;

  function toggle(v: string) {
    const n = new Set(sel);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    onChange([...n]);
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAbierto((a) => !a)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className="flex w-full items-center justify-between gap-2 rounded border bg-white px-2 py-1.5 text-left text-sm disabled:opacity-50"
      >
        <span className={values.length ? 'truncate text-gray-800' : 'truncate text-gray-400'}>{resumen}</span>
        <span className="text-gray-400">▾</span>
      </button>

      {abierto && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border bg-white shadow-lg">
          <div className="border-b p-1.5">
            <input
              ref={inputRef}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar…"
              className="w-full rounded border px-2 py-1 text-sm outline-none focus:border-[#1f2a4d]"
            />
          </div>
          <div className="flex items-center justify-between border-b px-2 py-1 text-[11px]">
            <button type="button" onClick={() => onChange(options.map((o) => o.value))} className="text-[#3f5b87] hover:underline">
              Seleccionar todas
            </button>
            <button type="button" onClick={() => onChange([])} className="text-[#3f5b87] hover:underline">
              Limpiar
            </button>
          </div>
          <ul role="listbox" aria-labelledby={listId} aria-multiselectable className="max-h-64 overflow-auto py-1">
            {filtradas.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400">Sin resultados.</li>
            ) : (
              filtradas.map((o) => (
                <li key={o.value}>
                  <label className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-100">
                    <input type="checkbox" checked={sel.has(o.value)} onChange={() => toggle(o.value)} />
                    <span className="truncate text-gray-700">{o.label}</span>
                  </label>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
