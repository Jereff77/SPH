import { api } from '@/lib/api';

export interface UsuarioSelector {
  uid: string;
  nombre: string;
}

export interface PermisoUsuario {
  idsegModulos: string;
  modulo: string;
  seccion: string;
  area: string | null;
  clave: number | null;
  acceso: boolean;
}

/** Una columna de la matriz (permiso del catálogo `segModulos`). */
export interface PermisoCatalogo {
  clave: number;
  modulo: string;
  seccion: string;
  area: string;
}

/** Una fila de la matriz (usuario + las claves que tiene concedidas). */
export interface UsuarioMatriz {
  nombre: string;
  correo: string;
  activo: boolean;
  soporte: boolean;
  claves: number[];
}

export interface MatrizPermisos {
  permisos: PermisoCatalogo[];
  usuarios: UsuarioMatriz[];
  generado: string;
}

export interface PlantillaPermiso {
  idPlantilla: string;
  nombrePlantilla: string;
  descripcion: string | null;
  categoria: string;
}

export const permisosApi = {
  listarUsuarios: () => api.get<UsuarioSelector[]>('/permisos/usuarios'),
  obtenerPermisos: (uid: string) =>
    api.get<PermisoUsuario[]>(`/permisos/${uid}`),
  setAcceso: (uid: string, idsegModulos: string, acceso: boolean) =>
    api.patch<{ ok: true }>(`/permisos/${uid}/${idsegModulos}`, { acceso }),
  matriz: () => api.get<MatrizPermisos>('/permisos/matriz'),
  listarPlantillas: () => api.get<PlantillaPermiso[]>('/permisos/plantillas'),
  aplicarPlantilla: (
    uid: string,
    idPlantilla: string,
    reemplazarTodos: boolean,
  ) =>
    api.post<{ ok: true }>('/permisos/plantillas/aplicar', {
      uid,
      idPlantilla,
      reemplazarTodos,
    }),
  crearPlantilla: (dto: {
    nombre: string;
    descripcion: string;
    uidOrigen: string;
    categoria: string;
    esPublica: boolean;
  }) => api.post<{ ok: true }>('/permisos/plantillas', dto),
};
