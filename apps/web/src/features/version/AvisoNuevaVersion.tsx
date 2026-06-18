import { useNuevaVersion } from './useNuevaVersion';

/**
 * Banner que aparece cuando se publicó (desplegó) una versión más nueva que la del
 * bundle que el usuario tiene cargado. Le indica cómo forzar la recarga para obtener
 * el código actualizado. No aparece si el bundle ya está al día.
 */
export function AvisoNuevaVersion() {
  const nueva = useNuevaVersion();
  if (!nueva) return null;

  return (
    <div className="sticky top-14 z-30 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-[#1f2a4d] px-4 py-2 text-sm text-white shadow">
      <span>
        🔄 Hay una <strong>nueva versión disponible (v. {nueva})</strong>. Estás viendo
        una versión anterior; para actualizar, recarga la página con{' '}
        <kbd className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-xs">
          Ctrl + Shift + F5
        </kbd>{' '}
        (Windows) o{' '}
        <kbd className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-xs">
          ⌘ Cmd + Shift + F5
        </kbd>{' '}
        (Mac).
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="shrink-0 rounded-md bg-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/25"
      >
        Actualizar ahora
      </button>
    </div>
  );
}
