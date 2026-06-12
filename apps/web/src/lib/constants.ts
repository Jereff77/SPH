/** Constantes de la aplicación. */

/**
 * Versión del bundle (solo *fallback*). La versión REAL del sistema se lee en vivo
 * del changelog (`GET /api/changelog` → Sidebar). Mantener alineada con la última
 * versión publicada al ejecutar «documenta todo» (ver HANDOFF, regla 9 / sección 5e).
 */
export const APP_VERSION = 'v. 2.22.1';

/** Paleta de marca SPH (provisional, ajustable al manual de marca). */
export const COLORS = {
  navy: '#1f2a4d',
  navyHover: '#172039',
  navyDark: '#141c33',
  azul: '#3f5b87',
  verde: '#8cc63f',
} as const;

/** Claves de almacenamiento local (nunca se guardan contraseñas). */
export const STORAGE = {
  ultimoUsuario: 'sph_ultimo_usuario',
  sidebarColapsado: 'sph_sidebar_colapsado',
} as const;
