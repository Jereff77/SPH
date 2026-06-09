/**
 * Tipos del dominio Changelog (Configuraciones → Novedades).
 *
 * Fuente de verdad: tabla NUEVA de v2 `public.v2_changelog` (una fila por versión
 * publicada, SemVer). El frontend NUNCA toca la tabla: lee vía `GET /api/changelog`.
 */

/**
 * Categorías de un cambio (estilo «Keep a Changelog», en español). El backend las
 * usa para validar/normalizar; el frontend las pinta con un color por tipo.
 */
export const TIPOS_CAMBIO = [
  'Agregado', // funcionalidad nueva
  'Cambiado', // cambio de comportamiento existente
  'Corregido', // corrección de error (bugfix)
  'Eliminado', // funcionalidad retirada
  'Obsoleto', // marcada para retiro futuro
  'Seguridad', // corrección/medida de seguridad
] as const;

export type TipoCambio = (typeof TIPOS_CAMBIO)[number];

/** Un cambio individual dentro de una versión. */
export interface CambioChangelog {
  tipo: TipoCambio;
  descripcion: string;
}

/** Una versión publicada del sistema con su lista de cambios. */
export interface VersionChangelog {
  /** SemVer «MAJOR.MINOR.PATCH» (sin el prefijo «v.», que es solo presentación). */
  version: string;
  /** Fecha de publicación en ISO «yyyy-mm-dd» (la UI la muestra dd/mm/aaaa). */
  fecha: string;
  /** Título corto opcional de la versión. */
  titulo: string | null;
  cambios: CambioChangelog[];
}

/** Respuesta de `GET /api/changelog`. */
export interface ChangelogResponse {
  /** Versión más reciente publicada (la «versión del sistema»). null si no hay. */
  versionActual: string | null;
  /** Versiones publicadas, de la más reciente a la más antigua (orden SemVer). */
  versiones: VersionChangelog[];
}
