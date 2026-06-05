/** Constantes de la aplicación. */

export const APP_VERSION = 'v. 2.0.0';

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
