import { useEffect, useRef, useState } from 'react';
import { APP_VERSION_RAW } from '@/lib/constants';

/** Cada cuánto se vuelve a consultar `/version.json` (además, al recuperar foco). */
const INTERVALO_MS = 5 * 60_000;

/**
 * Detecta si el servidor ya tiene una versión más nueva que el **bundle cargado**.
 *
 * Compara `APP_VERSION_RAW` (horneado en este bundle) contra `/version.json` (que el
 * build emite y nginx sirve). Cuando se despliega una versión nueva, ese archivo
 * cambia y aquí se detecta el desfase — SIN leer la base de datos: refleja el
 * despliegue real, no el registro del changelog. Devuelve la versión nueva (cruda) o
 * `null` si el bundle está al día.
 */
export function useNuevaVersion(): string | null {
  const [nueva, setNueva] = useState<string | null>(null);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;

    const revisar = async (): Promise<void> => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string };
        const remota = (data.version ?? '').trim();
        if (vivo.current && remota && remota !== APP_VERSION_RAW) {
          setNueva(remota);
        }
      } catch {
        /* sin red / sin archivo (p. ej. en dev): se ignora */
      }
    };

    void revisar();
    const id = window.setInterval(() => void revisar(), INTERVALO_MS);
    const onFocus = (): void => void revisar();
    window.addEventListener('focus', onFocus);

    return () => {
      vivo.current = false;
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return nueva;
}
