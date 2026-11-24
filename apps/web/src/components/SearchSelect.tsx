import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { buscarSimilares, claveCatalogo, limpiarTexto } from '@/lib/similitud';

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

const TRIGGER_BASE =
  'flex w-full items-center justify-between gap-2 rounded border bg-white px-2 py-1.5 text-left text-sm disabled:opacity-50';

/** Posición del desplegable cuando va en portal (`position: fixed`). */
interface PosicionPortal {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
}

/**
 * Selector con búsqueda (combobox) sin dependencias externas. Muestra el valor
 * seleccionado; al abrir, permite escribir para filtrar y elegir una opción.
 * Las opciones se ordenan alfabéticamente por su `label` (locale es).
 *
 * Modo «selecciona o escribe uno nuevo» (`permitirNuevo`, apagado por defecto):
 * lo escrito que no existe se ofrece como «+ Crear «texto»»; si se parece a una
 * opción existente (typo, plural, letra de menos…) se sugiere antes «¿Quisiste
 * decir…?»; y lo escrito que ya existe —aunque cambien mayúsculas, acentos o
 * espacios— elige la opción existente en vez de crear otra. En este modo `value`
 * puede ser un texto que no está en `options` (el valor nuevo).
 *
 * `enPortal` (apagado por defecto) dibuja el desplegable sobre `document.body`
 * con `position: fixed`, para que no lo recorte un contenedor con `overflow`
 * (p. ej. un modal).
 */
export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = 'Selecciona…',
  disabled = false,
  className = '',
  permitirNuevo = false,
  enPortal = false,
  triggerClassName,
  etiquetaVacio,
}: {
  value: string;
  onChange: (value: string) => void;
  options: OpcionSelect[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Permite escribir un valor que no está en `options`. */
  permitirNuevo?: boolean;
  /** Dibuja el desplegable en un portal sobre `document.body`. */
  enPortal?: boolean;
  /** Reemplaza las clases del botón (para que case con el diseño de la pantalla). */
  triggerClassName?: string;
  /** Si se da, aparece como primera opción cuando hay un valor, para dejarlo vacío. */
  etiquetaVacio?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busca, setBusca] = useState('');
  const [pos, setPos] = useState<PosicionPortal | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
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
  const esNuevo = permitirNuevo && value.trim() !== '' && !seleccionada;

  // ── Modo «escribe uno nuevo» ──
  const texto = limpiarTexto(busca);
  const claveTexto = claveCatalogo(texto);
  const exacta = useMemo(
    () => (permitirNuevo && claveTexto !== '' ? ordenadas.find((o) => claveCatalogo(o.label) === claveTexto) : undefined),
    [permitirNuevo, claveTexto, ordenadas],
  );
  const puedeCrear = permitirNuevo && claveTexto !== '' && !exacta;
  const similares = useMemo(() => {
    if (!puedeCrear) return [];
    const etiquetas = buscarSimilares(texto, ordenadas.map((o) => o.label));
    return etiquetas
      .map((e) => ordenadas.find((o) => o.label === e))
      .filter((o): o is OpcionSelect => !!o && !filtradas.includes(o));
  }, [puedeCrear, texto, ordenadas, filtradas]);

  // Posición del portal: se calcula al abrir y al redimensionar / desplazar.
  const calcularPos = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const abajo = window.innerHeight - r.bottom;
    const abrirArriba = abajo < 300 && r.top > abajo;
    setPos(
      abrirArriba
        ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 4 }
        : { left: r.left, width: r.width, top: r.bottom + 4 },
    );
  }, []);

  useEffect(() => {
    if (!abierto || !enPortal) return;
    window.addEventListener('resize', calcularPos);
    window.addEventListener('scroll', calcularPos, true);
    return () => {
      window.removeEventListener('resize', calcularPos);
      window.removeEventListener('scroll', calcularPos, true);
    };
  }, [abierto, enPortal, calcularPos]);

  // Cerrar al hacer clic fuera (el desplegable en portal no es descendiente de `ref`).
  useEffect(() => {
    if (!abierto) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t) || popRef.current?.contains(t)) return;
      setAbierto(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [abierto]);

  // Enfocar el buscador al abrir.
  useEffect(() => {
    if (abierto) inputRef.current?.focus();
  }, [abierto]);

  function alternar() {
    if (abierto) {
      setAbierto(false);
      return;
    }
    if (enPortal) calcularPos();
    setAbierto(true);
  }

  function elegir(v: string) {
    onChange(v);
    setAbierto(false);
    setBusca('');
  }

  function alTeclear(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setAbierto(false);
      return;
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const primera = filtradas[0];
    if (exacta) elegir(exacta.value);
    else if (primera) elegir(primera.value);
    // Con sugerencias de typo, crear exige un clic explícito (no se crea por accidente con Enter).
    else if (puedeCrear && similares.length === 0) elegir(texto);
  }

  const panel = (
    <div
      ref={popRef}
      style={enPortal && pos ? { position: 'fixed', left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom } : undefined}
      className={
        enPortal
          ? 'z-[300] overflow-hidden rounded-lg border bg-white shadow-lg'
          : 'absolute z-30 mt-1 w-full overflow-hidden rounded-lg border bg-white shadow-lg'
      }
    >
      <div className="border-b p-1.5">
        <input
          ref={inputRef}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={alTeclear}
          placeholder={permitirNuevo ? 'Buscar o escribir nuevo…' : 'Buscar…'}
          className="w-full rounded border px-2 py-1 text-sm outline-none focus:border-[#1f2a4d]"
        />
      </div>
      <ul role="listbox" aria-labelledby={listId} className="max-h-64 overflow-auto py-1">
        {etiquetaVacio && value !== '' && !busca && (
          <li>
            <button
              type="button"
              onClick={() => elegir('')}
              className="block w-full truncate px-3 py-1.5 text-left text-sm italic text-gray-500 hover:bg-gray-100"
            >
              {etiquetaVacio}
            </button>
          </li>
        )}
        {filtradas.length === 0 && !puedeCrear ? (
          <li className="px-3 py-2 text-sm text-gray-400">
            {permitirNuevo ? 'No hay opciones: escribe para crear una.' : 'Sin resultados.'}
          </li>
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
        {similares.length > 0 && (
          <>
            <li className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
              ¿Quisiste decir…?
            </li>
            {similares.map((o) => (
              <li key={`sim-${o.value}`}>
                <button
                  type="button"
                  onClick={() => elegir(o.value)}
                  className="block w-full truncate bg-amber-50 px-3 py-1.5 text-left text-sm font-medium text-gray-800 hover:bg-amber-100"
                >
                  {o.label}
                </button>
              </li>
            ))}
          </>
        )}
        {puedeCrear && (
          <li className={filtradas.length > 0 || similares.length > 0 ? 'mt-1 border-t pt-1' : ''}>
            <button
              type="button"
              onClick={() => elegir(texto)}
              className="block w-full truncate px-3 py-1.5 text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50"
            >
              + Crear «{texto}»
            </button>
          </li>
        )}
      </ul>
    </div>
  );

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={alternar}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className={triggerClassName ?? TRIGGER_BASE}
      >
        <span className={seleccionada || esNuevo ? 'truncate text-gray-800' : 'truncate text-gray-400'}>
          {esNuevo ? (
            <>
              {value}
              <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">nuevo</span>
            </>
          ) : seleccionada ? (
            seleccionada.label
          ) : (
            placeholder
          )}
        </span>
        <span className="text-gray-400">▾</span>
      </button>

      {abierto && (enPortal ? pos && createPortal(panel, document.body) : panel)}
    </div>
  );
}
