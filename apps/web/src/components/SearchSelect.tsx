import { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface OpcionSelect {
  value: string;
  label: string;
}

/** Normaliza para comparar sin acentos ni mayúsculas. */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/**
 * Selector con búsqueda (combobox) sin dependencias externas. Muestra el valor
 * seleccionado; al abrir, permite escribir para filtrar y elegir una opción.
 * Las opciones se ordenan alfabéticamente por su `label` (locale es).
 */
export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = 'Selecciona…',
  disabled = false,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  options: OpcionSelect[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busca, setBusca] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const ordenadas = useMemo(
    () => [...options].sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' })),
    [options],
  );

  const filtradas = useMemo(() => {
    const q = norm(busca);
    if (!q) return ordenadas;
    return ordenadas.filter((o) => norm(o.label).includes(q));
  }, [ordenadas, busca]);

  const seleccionada = options.find((o) => o.value === value);

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

  function elegir(v: string) {
    onChange(v);
    setAbierto(false);
    setBusca('');
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
        <span className={seleccionada ? 'truncate text-gray-800' : 'truncate text-gray-400'}>
          {seleccionada ? seleccionada.label : placeholder}
        </span>
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
          <ul role="listbox" aria-labelledby={listId} className="max-h-64 overflow-auto py-1">
            {filtradas.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400">Sin resultados.</li>
            ) : (
              filtradas.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => elegir(o.value)}
                    className={`block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-gray-100 ${
                      o.value === value ? 'bg-gray-50 font-medium text-[#1f2a4d]' : 'text-gray-700'
                    }`}
                  >
                    {o.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
