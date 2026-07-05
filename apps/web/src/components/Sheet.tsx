import { useCallback, useEffect, useState, type ReactNode } from 'react';

/**
 * Panel lateral ("sheet") que entra desde la derecha, con overlay. Header azul
 * sticky (regla 7), cuerpo con scroll interno y **barra oculta** (regla de diseño 1,
 * clase `.scrollbar-hide`). Cierra por ✕, clic en el overlay o tecla Esc, con
 * animación de entrada/salida. Reutilizable (patrón nuevo de la casa).
 */
export function Sheet({
  titulo,
  onClose,
  children,
  ancho = 'max-w-xl',
}: {
  titulo: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Clase Tailwind de ancho máximo del panel. */
  ancho?: string;
}) {
  const [visible, setVisible] = useState(false);

  // Anima la entrada en el siguiente frame (tras montar en translate-x-full).
  useEffect(() => {
    const r = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(r);
  }, []);

  // Cierre con animación de salida: primero repliega, luego desmonta.
  const cerrar = useCallback(() => {
    setVisible(false);
    window.setTimeout(onClose, 200);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [cerrar]);

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={cerrar}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`absolute inset-y-0 right-0 flex w-full ${ancho} flex-col bg-white shadow-2xl transition-transform duration-200 ease-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b bg-[#1f2a4d] px-5 py-3 text-white">
          <h2 className="text-base font-semibold">{titulo}</h2>
          <button
            type="button"
            onClick={cerrar}
            className="text-white/80 hover:text-white"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="scrollbar-hide flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
