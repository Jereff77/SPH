/** Contrato de auth (espejo de apps/api/src/modules/auth/auth.types.ts). */
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

export interface PermisoUsuario {
  modulo: string | null;
  seccion: string | null;
  clave: number | null;
  acceso: boolean | null;
}

export interface LoginResult {
  accessToken: string;
  expiresAt: number | null;
  usuario: PerfilUsuario;
  permisos: PermisoUsuario[];
}
