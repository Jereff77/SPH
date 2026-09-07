/**
 * Catálogos y tipos del tablero de pendientes.
 *
 * ⛔ Las claves DEBEN ser idénticas a los CHECK de la tabla `dev_pendientes`
 * (migración `2026-09-02-dev-pendientes.sql`). Agregar un valor aquí sin
 * agregarlo en la BD hace que el INSERT se rechace en runtime.
 */

export const TIPOS = {
  modulo_nuevo: 'Módulo nuevo',
  mejora: 'Mejora',
  bug: 'Bug',
  deuda_tecnica: 'Deuda técnica',
  seguridad: 'Seguridad',
  datos: 'Datos',
} as const;

export const URGENCIAS = {
  p0: 'P0 · Crítica',
  p1: 'P1 · Alta',
  p2: 'P2 · Media',
  p3: 'P3 · Cuando se pueda',
} as const;

export const ESTADOS = {
  propuesto: 'Propuesto',
  aprobado: 'Aprobado',
  en_curso: 'En curso',
  bloqueado: 'Bloqueado',
  terminado: 'Terminado',
  descartado: 'Descartado',
} as const;

export type TipoPendiente = keyof typeof TIPOS;
export type UrgenciaPendiente = keyof typeof URGENCIAS;
export type EstadoPendiente = keyof typeof ESTADOS;

/** Estados que sacan el pendiente del tablero de trabajo. */
export const ESTADOS_CERRADOS: EstadoPendiente[] = ['terminado', 'descartado'];

/** Los demás: lo que se ve por defecto. */
export const ESTADOS_ABIERTOS: EstadoPendiente[] = (
  Object.keys(ESTADOS) as EstadoPendiente[]
).filter((e) => !ESTADOS_CERRADOS.includes(e));

/** Peso de urgencia para ordenar (P0 primero). */
export const PESO_URGENCIA: Record<UrgenciaPendiente, number> = {
  p0: 0,
  p1: 1,
  p2: 2,
  p3: 3,
};

export interface Pendiente {
  id: number;
  titulo: string;
  descripcion: string | null;
  notas: string | null;
  origen: string | null;
  tipo: TipoPendiente;
  urgencia: UrgenciaPendiente;
  estado: EstadoPendiente;
  modulo: string | null;
  version_resuelto: string | null;
  resuelto_at: string | null;
  fc: string;
  fm: string;
  creadoPor: string | null;
}

/**
 * Contadores del encabezado.
 *
 * ⚠️ Dos naturalezas distintas, y por eso están separados:
 * - Los de TRABAJO (`abiertos`, `p0`, `p1`, `enCurso`, `bloqueados`) los
 *   recalcula el FRONT sobre las filas filtradas: al filtrar por módulo o
 *   urgencia, el usuario espera ver el conteo de lo que tiene enfrente. Los que
 *   manda el backend son el punto de partida (sin filtros aplicados).
 * - Los HISTÓRICOS (`total`, `cerrados`) son globales y NO responden al filtro
 *   ni al interruptor de «ver cerrados»: un total que cambia al filtrar deja de
 *   ser un total. Se cuentan en la BD, no sobre las filas cargadas — cuando el
 *   interruptor está apagado las cerradas ni siquiera vienen en la respuesta.
 */
export interface ResumenPendientes {
  abiertos: number;
  p0: number;
  p1: number;
  enCurso: number;
  bloqueados: number;
  /** Todos los pendientes registrados, abiertos y cerrados. Global. */
  total: number;
  /** Terminados + descartados. Global. */
  cerrados: number;
}
