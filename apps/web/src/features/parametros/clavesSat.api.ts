import { api } from '@/lib/api';

export interface ClaveSat {
  idClave: string;
  claveProdServ: string;
  descripcion: string | null;
  retieneIVA: boolean;
  retieneISR: boolean;
  status: boolean;
  fc: string;
}

export interface ClaveSatInput {
  claveProdServ: string;
  descripcion: string;
  retieneIVA: boolean;
  retieneISR: boolean;
}

export const clavesSatApi = {
  listar: () => api.get<ClaveSat[]>('/cxp/claves-sat'),
  crear: (dto: ClaveSatInput) =>
    api.post<{ idClave: string }>('/cxp/claves-sat', dto),
  editar: (idClave: string, dto: Partial<ClaveSatInput>) =>
    api.patch<{ ok: true }>(`/cxp/claves-sat/${idClave}`, dto),
  setStatus: (idClave: string, status: boolean) =>
    api.patch<{ ok: true }>(`/cxp/claves-sat/${idClave}/status`, { status }),
};
