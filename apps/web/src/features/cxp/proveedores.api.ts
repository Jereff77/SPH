import { api } from '@/lib/api';

export interface Proveedor {
  idProveedor: string;
  razonSocial: string;
  rfc: string;
  nombre: string | null;
  apellidos: string | null;
  email: string | null;
  telefono: string | null;
  nombreBanco: string;
  tipoCuenta: string;
  noCuenta: string | null;
  personalidad: string | null;
  claveRegimen: number | null;
  tipoIdentificacion: number | null;
  numIdentificacion: string | null;
  status: boolean;
  fc: string;
}

export interface ProveedorDto {
  razonSocial: string;
  rfc: string;
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string;
  nombreBanco: string;
  tipoCuenta: string;
  noCuenta: string;
  personalidad?: 'Fisica' | 'Moral';
  claveRegimen?: number;
  tipoIdentificacion?: number;
  numIdentificacion: string;
}

export const TIPOS_CUENTA = ['CLABE', 'Cuenta', 'Tarjeta'] as const;
export const PERSONALIDADES = ['Fisica', 'Moral'] as const;

export const proveedoresApi = {
  listar: () => api.get<Proveedor[]>('/cxp/proveedores'),
  crear: (dto: ProveedorDto) =>
    api.post<{ idProveedor: string }>('/cxp/proveedores', dto),
  editar: (id: string, dto: ProveedorDto) =>
    api.patch<{ ok: true }>(`/cxp/proveedores/${id}`, dto),
  setStatus: (id: string, status: boolean) =>
    api.patch<{ ok: true }>(`/cxp/proveedores/${id}/status`, { status }),
};
