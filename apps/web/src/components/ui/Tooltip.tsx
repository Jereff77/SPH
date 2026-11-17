import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Tooltip compartido: se muestra al pasar el cursor o al enfocar con teclado y va en un
 * portal sobre `body` (regla de UI: todo flotante en portal), así no lo recorta el scroll
 * interno de las tablas. El disparador es el `children`; `contenido` es lo que se muestra.
 */
export function Tooltip({
  contenido,
  children,
  className,
}: {
  contenido: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const ancla = useRef<HTMLSpanElement>(null);
  const globo = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!abierto || !ancla.current || !globo.current) {
      setPos(null);
      return;
    }
    const a = ancla.current.getBoundingClientRect();
    const t = globo.current.getBoundingClientRect();
    // Alineado al borde derecho del disparador (columnas numéricas), sin salirse de la pantalla.
    const left = Math.max(8, Math.min(a.right - t.width, window.innerWidth - t.width - 8));
    let top = a.bottom + 6;
    if (top + t.height > window.innerHeight - 8) top = Math.max(8, a.top - t.height - 6);
    setPos({ top, left });
  }, [abierto]);

  return (
    <>
      <span
        ref={ancla}
        tabIndex={0}
        aria-describedby={abierto ? id : undefined}
        onMouseEnter={() => setAbierto(true)}
        onMouseLeave={() => setAbierto(false)}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        className={className}
      >
        {children}
      </span>
      {abierto &&
        createPortal(
          <div
            ref={globo}
            id={id}
            role="tooltip"
            style={{
              position: 'fixed',
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              visibility: pos ? 'visible' : 'hidden',
            }}
            className="pointer-events-none z-[70] w-max max-w-xs rounded-lg bg-[#1f2a4d] px-3 py-2 text-left text-xs text-white shadow-lg"
          >
            {contenido}
          </div>,
          document.body,
        )}
    </>
  );
}
