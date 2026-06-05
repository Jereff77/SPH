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
