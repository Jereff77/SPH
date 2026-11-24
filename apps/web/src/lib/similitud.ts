/**
 * Comparación de textos para los catálogos con «selecciona o escribe uno nuevo»
 * (alta de conceptos del fideicomiso) y el aviso «¿Quisiste decir…?».
 *
 * `claveCatalogo` es la MISMA regla que `apps/api/src/modules/fideicomiso/catalogo-texto.ts`
 * (si se cambia una, cambiar la otra): el servidor es quien manda; la pantalla solo la
 * anticipa para no ofrecer como «nuevo» algo que ya existe.
 */

/** Clave de comparación: sin acentos, minúsculas, espacios colapsados; `''`/`'-'`/null → `''`. */
export function claveCatalogo(v: string | null | undefined): string {
  const t = (v ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  return t === '-' ? '' : t;
}

/** Escritura limpia de un texto nuevo: sin espacios en los bordes ni repetidos. */
export function limpiarTexto(v: string | null | undefined): string {
  return (v ?? '').replace(/\s+/g, ' ').trim();
}

const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en']);

/** Distancia de edición (Levenshtein) entre dos textos. */
export function distancia(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const actual: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      actual[j] = Math.min((anterior[j] ?? 0) + 1, (actual[j - 1] ?? 0) + 1, (anterior[j - 1] ?? 0) + costo);
    }
    anterior = actual;
  }
  return anterior[b.length] ?? 0;
}

const semejanza = (a: string, b: string) => {
  const mayor = Math.max(a.length, b.length);
  return mayor === 0 ? 1 : 1 - distancia(a, b) / mayor;
};

/**
 * Palabras que importan: sin signos, sin «de/del/la…», en singular y ordenadas.
 * «PAGOS DESARROLLO» y «PAGO DE DESARROLLO» dan la misma clave.
 */
function clavePalabras(s: string): string {
  return claveCatalogo(s)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(' ')
    .filter((p) => p !== '' && !PALABRAS_VACIAS.has(p))
    .map((p) => (p.length > 3 && p.endsWith('s') ? p.slice(0, -1) : p))
    .sort()
    .join(' ');
}

/** Qué tan parecidos son dos textos: 0 (nada) a 1 (iguales de fondo). */
export function parecido(a: string, b: string): number {
  return Math.max(
    semejanza(claveCatalogo(a), claveCatalogo(b)),
    semejanza(clavePalabras(a), clavePalabras(b)),
  );
}

/** Umbral a partir del cual dos textos se consideran «parecidos». */
export const UMBRAL_PARECIDO = 0.8;

/**
 * Opciones existentes que se parecen a lo escrito, de la más a la menos parecida.
 * Excluye las que son iguales (esas se eligen, no se «sugieren») y no sugiere nada
 * con menos de 4 letras, donde cualquier cosa se parece a todo.
 */
export function buscarSimilares(texto: string, opciones: string[], max = 3): string[] {
  const clave = claveCatalogo(texto);
  if (clave.length < 4) return [];
  return opciones
    .filter((o) => claveCatalogo(o) !== clave && claveCatalogo(o).length >= 4)
    .map((o) => ({ o, p: parecido(texto, o) }))
    .filter((x) => x.p >= UMBRAL_PARECIDO)
    .sort((x, y) => y.p - x.p)
    .slice(0, max)
    .map((x) => x.o);
}
