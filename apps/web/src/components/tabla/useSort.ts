import { useMemo, useState } from 'react';

export type Dir = 'asc' | 'desc';

type Valor = string | number | boolean | null | undefined;
export type Accessors<T> = Record<string, (item: T) => Valor>;

/**
 * Hook de ordenamiento de tablas (regla de diseño 7). Recibe los items y un mapa
 * de "accessors" (clave de columna -> función que extrae el valor a comparar).
 * Devuelve los items ordenados + el estado y un `toggle(clave)` para el clic en
 * el encabezado (alterna asc/desc). Los valores nulos van al final.
 */
export function useSort<T>(
  items: T[],
  accessors: Accessors<T>,
  inicial?: { key: string; dir?: Dir },
) {
  const [key, setKey] = useState<string | null>(inicial?.key ?? null);
  const [dir, setDir] = useState<Dir>(inicial?.dir ?? 'asc');

  const ordenados = useMemo(() => {
    const acc = key ? accessors[key] : undefined;
    if (!acc) return items;
    const copia = [...items];
    copia.sort((a, b) => {
      const va = acc(a);
      const vb = acc(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      let cmp: number;
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb;
      } else if (typeof va === 'boolean' && typeof vb === 'boolean') {
        cmp = va === vb ? 0 : va ? -1 : 1;
      } else {
        cmp = String(va).localeCompare(String(vb), 'es', { numeric: true });
      }
      return dir === 'asc' ? cmp : -cmp;
    });
    return copia;
  }, [items, key, dir, accessors]);

  function toggle(k: string): void {
    if (key === k) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setKey(k);
      setDir('asc');
    }
  }

  /** Fija el criterio/dirección de orden (para selectores, no solo encabezados). */
  function setSort(k: string, d: Dir = 'asc'): void {
    setKey(k);
    setDir(d);
  }

  return { ordenados, sortKey: key, dir, toggle, setSort };
}
