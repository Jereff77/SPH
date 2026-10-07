import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const ANCHOS = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
} as const;

/**
 * Modal compartido: se dibuja en un portal sobre `body` (nunca queda bajo el
 * sidebar), con velo, Escape, clic fuera, foco atrapado y bloqueo del scroll
 * del body. `cabeceraAzul` usa la marca (#1f2a4d).
 */
export function Modal({
  abierto,
  onCerrar,
  titulo,
  ancho = 'md',
  cabeceraAzul = false,
  bloqueado = false,
  pie,
  children,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  ancho?: keyof typeof ANCHOS;
  cabeceraAzul?: boolean;
  /** Mientras está bloqueado no cierra con Escape ni con clic fuera. */
  bloqueado?: boolean;
  pie?: ReactNode;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const previo = useRef<HTMLElement | null>(null);
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;

  useEffect(() => {
    if (!abierto) return;
    previo.current = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const foco = panel.current?.querySelector<HTMLElement>(
      'input,select,textarea,button:not([data-cerrar])',
    );
    (foco ?? panel.current)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !bloqueado) {
        e.stopPropagation();
        cerrarRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      const els = Array.from(
        panel.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[contenteditable="true"],[tabindex]:not([tabindex="-1"])',
        ),
      );
      const primero = els[0];
      const ultimo = els[els.length - 1];
      if (!primero || !ultimo) return;
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previo.current?.focus?.();
    };
  }, [abierto, bloqueado]);

  if (!abierto) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-3 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !bloqueado) onCerrar();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className={`flex max-h-full w-full ${ANCHOS[ancho]} flex-col overflow-hidden rounded-xl bg-white shadow-xl outline-none`}
      >
        <div
          className={`flex items-center justify-between gap-3 px-5 py-3 ${
            cabeceraAzul ? 'bg-[#1f2a4d] text-white' : 'border-b border-gray-200 text-gray-800'
          }`}
        >
          <h2 className="text-base font-semibold">{titulo}</h2>
          <button
            type="button"
            data-cerrar
            aria-label="Cerrar"
            onClick={() => !bloqueado && onCerrar()}
            className={`rounded p-1 text-lg leading-none ${
              cabeceraAzul ? 'hover:bg-white/10' : 'text-gray-400 hover:bg-gray-100'
            }`}
          >
            ✕
          </button>
        </div>
        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {pie && (
          <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
            {pie}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
