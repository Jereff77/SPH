/** Constantes de la aplicación. */

/**
 * Versión del bundle realmente cargado en el navegador. **Es la fuente de verdad de
 * la versión que ve el usuario** (Sidebar) y la que se compara contra `/version.json`
 * para avisar de una nueva versión. NO se lee de la BD: solo cambia al construir un
 * bundle nuevo (deploy) y recargar. Actualizar `APP_VERSION_RAW` en cada cierre
 * «documenta todo» (ver HANDOFF, regla 9 / §5e); el plugin de Vite emite
 * `version.json` con este mismo número.
 */
export const APP_VERSION_RAW = '2.68.0';
export const APP_VERSION = `v. ${APP_VERSION_RAW}`;

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
