/** Perfil del usuario devuelto al frontend (desde catUsers + permisos). */
export interface PerfilUsuario {
  uid: string;
  email: string | null;
  nombre: string | null;
  apellidos: string | null;
  nomCompleto: string | null;
  idPerfil: number;
  rol: string | null;
  isSupport: boolean;
  status: boolean;
  img: string | null;
}

/** Permiso de módulo/sección (de segModulosUsuarios). */
export interface PermisoUsuario {
  modulo: string | null;
  seccion: string | null;
  clave: number | null;
  acceso: boolean | null;
}

/** Respuesta de login: access token (para memoria del cliente) + perfil. */
export interface LoginResult {
  accessToken: string;
  expiresAt: number | null;
  usuario: PerfilUsuario;
  permisos: PermisoUsuario[];
}
