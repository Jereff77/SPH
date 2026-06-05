import { api } from '@/lib/api';
import type { Usuario } from './types';

export const usuariosApi = {
  listar: () => api.get<Usuario[]>('/usuarios'),
  setStatus: (uid: string, status: boolean) =>
    api.patch<{ ok: true }>(`/usuarios/${uid}/status`, { status }),
  setRC: (uid: string, esRC: boolean) =>
    api.patch<{ ok: true }>(`/usuarios/${uid}/rc`, { esRC }),
  setSoporte: (uid: string, isSupport: boolean) =>
    api.patch<{ ok: true }>(`/usuarios/${uid}/soporte`, { isSupport }),
};
