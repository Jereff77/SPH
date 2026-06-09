/** Tipos de la vista de Changelog (Configuraciones → Novedades). */

export type TipoCambio =
  | 'Agregado'
  | 'Cambiado'
  | 'Corregido'
  | 'Eliminado'
  | 'Obsoleto'
  | 'Seguridad';

export interface CambioChangelog {
  tipo: TipoCambio;
  descripcion: string;
}

export interface VersionChangelog {
  version: string;
  /** ISO «yyyy-mm-dd». */
  fecha: string;
  titulo: string | null;
  cambios: CambioChangelog[];
}

export interface ChangelogResponse {
  versionActual: string | null;
  versiones: VersionChangelog[];
}
