import { api } from '@/lib/api';

export interface Banco {
  id: number;
  nombre: string;
  codigo: string;
  tipo: string | null;
  created_at: string | null;
}

export interface BancoDto {
  nombre: string;
  codigo: string;
  tipo: string;
}

export const bancosApi = {
  listar: () => api.get<Banco[]>('/cxp/bancos'),
  crear: (dto: BancoDto) => api.post<{ id: number }>('/cxp/bancos', dto),
  editar: (id: number, dto: BancoDto) =>
    api.patch<{ ok: true }>(`/cxp/bancos/${id}`, dto),
};
