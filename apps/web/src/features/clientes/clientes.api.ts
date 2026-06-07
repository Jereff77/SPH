import { api } from '@/lib/api';

export type TipoCliente =
  | 'inversionistas'
  | 'arrendatarios'
  | 'ticket'
  | 'usuarioFinal'
  | 'papelera';

export interface Cliente {
  idInversionista: string;
  personalidad: string | null;
  idContpac: string | null;
  razonsocial: string | null;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  fecNacimiento: string | null;
  telefono: string | null;
  correo: string | null;
  RFC: string | null;
  CURP: string | null;
  inversionista: boolean;
  arrendatario: boolean;
  ticket: boolean;
  usuarioFinal: boolean;
  pruebas: boolean;
}

export interface ClienteInput {
  nombre: string;
  apellido1?: string;
  apellido2?: string;
  telefono?: string;
  correo?: string;
  RFC?: string;
  CURP?: string;
  idContpac?: string;
  razonsocial?: string;
  personalidad?: string;
  fecNacimiento?: string;
  inversionista: boolean;
  arrendatario: boolean;
  ticket: boolean;
  usuarioFinal: boolean;
}

export const CHIPS: { id: TipoCliente; label: string }[] = [
  { id: 'inversionistas', label: 'Inversionistas' },
  { id: 'arrendatarios', label: 'Arrendatarios' },
  { id: 'ticket', label: 'Ticket' },
  { id: 'usuarioFinal', label: 'Usuario Final' },
  { id: 'papelera', label: 'Papelera' },
];

export const clientesApi = {
  listar: (tipo: TipoCliente) => api.get<Cliente[]>(`/clientes?tipo=${tipo}`),
  crear: (dto: ClienteInput) => api.post<{ idInversionista: string }>('/clientes', dto),
  actualizar: (id: string, dto: ClienteInput) =>
    api.patch<{ ok: true }>(`/clientes/${id}`, dto),
  moverPapelera: (id: string) => api.post<{ ok: true }>(`/clientes/${id}/papelera`, {}),
};
