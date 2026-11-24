/**
 * Reglas de texto del catálogo contable del fideicomiso (`fideContaConceptos`),
 * cascada Tipo → Concepto → SubConcepto → Descripción.
 *
 * Misma regla de comparación que `apps/web/src/lib/similitud.ts` (`claveCatalogo`):
 * si se cambia una, cambiar la otra.
 */

/** Una fila del catálogo tal como la guarda la tabla. */
export interface FilaCatalogo {
  tipo: string | null;
  concepto: string | null;
  subconcepto: string | null;
  descripcion: string | null;
  orden_tipo: number | null;
  orden_concepto: number | null;
}

export interface AltaCatalogo {
  tipo: string;
  concepto: string;
  subconcepto?: string;
  descripcion?: string;
  ordenTipo: number;
  ordenConcepto: number;
}

export interface AltaResuelta {
  tipo: string;
  concepto: string;
  /** Vacío = sin subconcepto (así lo guarda `crearConcepto`). */
  subconcepto: string;
  /** `null` = sin descripción. */
  descripcion: string | null;
  ordenTipo: number;
  ordenConcepto: number;
  /** Fila que ya ocupa esa combinación (con otra escritura o igual); `null` si es nueva. */
  duplicadoDe: FilaCatalogo | null;
}

/**
 * Clave de comparación: sin acentos, en minúsculas y con los espacios colapsados.
 * `null`, `''`, `' '` y `'-'` (el hueco de la tabla del fideicomiso) valen lo mismo: `''`.
 */
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

/** Menor valor no nulo, o `null` si no hay ninguno. */
function minimo(valores: (number | null)[]): number | null {
  const nums = valores.filter((n): n is number => typeof n === 'number');
  return nums.length > 0 ? Math.min(...nums) : null;
}

/**
 * Resuelve el alta de una fila contra el catálogo ya existente:
 * - Tipo, Concepto, SubConcepto y Descripción que ya existen (sin importar
 *   mayúsculas, acentos ni espacios) se guardan con **la escritura existente**,
 *   así un alta por API no puede crear una variante de lo que ya hay.
 * - El orden del Tipo / Concepto existente se hereda (el que mande el cliente se
 *   ignora); solo lo nuevo usa el orden enviado.
 * - Avisa si la combinación completa ya existe (`duplicadoDe`).
 */
export function resolverAltaCatalogo(filas: FilaCatalogo[], dto: AltaCatalogo): AltaResuelta {
  const kTipo = claveCatalogo(dto.tipo);
  const filasTipo = filas.filter((f) => claveCatalogo(f.tipo) === kTipo);
  const tipo = filasTipo[0]?.tipo ?? limpiarTexto(dto.tipo);
  const ordenTipo = minimo(filasTipo.map((f) => f.orden_tipo)) ?? dto.ordenTipo;

  const kConcepto = claveCatalogo(dto.concepto);
  const filasConcepto = filasTipo.filter((f) => claveCatalogo(f.concepto) === kConcepto);
  const concepto = filasConcepto[0]?.concepto ?? limpiarTexto(dto.concepto);
  const ordenConcepto = minimo(filasConcepto.map((f) => f.orden_concepto)) ?? dto.ordenConcepto;

  const kSub = claveCatalogo(dto.subconcepto);
  const filasSub = filasConcepto.filter((f) => claveCatalogo(f.subconcepto) === kSub);
  const subconcepto = kSub === '' ? '' : (filasSub[0]?.subconcepto ?? limpiarTexto(dto.subconcepto));

  const kDesc = claveCatalogo(dto.descripcion);
  const filasDesc = filasSub.filter((f) => claveCatalogo(f.descripcion) === kDesc);
  const descripcion = kDesc === '' ? null : (filasDesc[0]?.descripcion ?? limpiarTexto(dto.descripcion));

  return {
    tipo: tipo ?? '',
    concepto: concepto ?? '',
    subconcepto: subconcepto ?? '',
    descripcion,
    ordenTipo,
    ordenConcepto,
    duplicadoDe: filasDesc[0] ?? null,
  };
}
