import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface OpcionFiltro {
  value: string;
  label: string;
}

/**
 * Filtro de columna estilo Excel: un icono de embudo en el encabezado que abre
 * un menú (renderizado en portal con posición fija, para que el scroll de la
 * tabla no lo recorte) con la lista de valores. Selección única; "Todos" limpia.
 */
export function ColumnFilter({
  opciones,
  valor,
  onChange,
  ancho = 240,
}: {
  opciones: OpcionFiltro[];
  valor: string;
  onChange: (v: string) => void;
  ancho?: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [busca, setBusca] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);
  const activo = valor !== '';

  const abrir = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      setPos({
        top: r.bottom + 4,
        left: Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8)),
      });
    }
    setBusca('');
    setAbierto(true);
  };

  useEffect(() => {
    if (!abierto) return;
    const cerrar = () => setAbierto(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    window.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', cerrar);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', cerrar, true);
      window.removeEventListener('resize', cerrar);
      document.removeEventListener('keydown', onKey);
    };
  }, [abierto]);

  const filtradas = busca
    ? opciones.filter((o) => o.label.toLowerCase().includes(busca.toLowerCase()))
    : opciones;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title="Filtrar"
        onClick={(e) => {
          e.stopPropagation();
          if (abierto) setAbierto(false);
          else abrir();
        }}
        className={activo ? 'text-amber-300' : 'text-white/50 hover:text-white'}
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <path d="M1.5 2h13a.5.5 0 0 1 .38.82L10 9.2V14a.5.5 0 0 1-.74.44l-3-1.6A.5.5 0 0 1 6 12.4V9.2L1.12 2.82A.5.5 0 0 1 1.5 2Z" />
        </svg>
      </button>
      {abierto &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setAbierto(false)} />
            <div
              className="fixed z-[61] rounded-lg border bg-white py-1 text-gray-700 shadow-xl"
              style={{ top: pos.top, left: pos.left, width: ancho }}
              onClick={(e) => e.stopPropagation()}
            >
              {opciones.length > 8 && (
                <input
                  autoFocus
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar…"
                  className="mx-2 mb-1 block w-[calc(100%-1rem)] rounded border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
                />
              )}
              <div className="max-h-64 overflow-auto">
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setAbierto(false);
                  }}
                  className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 ${valor === '' ? 'font-semibold text-[#1f2a4d]' : ''}`}
                >
                  Todos
                </button>
                {filtradas.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    title={o.label}
                    onClick={() => {
                      onChange(o.value);
                      setAbierto(false);
                    }}
                    className={`block w-full truncate px-3 py-1.5 text-left text-xs hover:bg-gray-100 ${valor === o.value ? 'font-semibold text-[#1f2a4d]' : ''}`}
                  >
                    {o.label}
                  </button>
                ))}
                {filtradas.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-400">Sin coincidencias</div>
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
