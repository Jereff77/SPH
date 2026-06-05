import { api } from '@/lib/api';

export interface ParqueListado {
  idParque: string;
  nomParque: string | null;
  direccion: string | null;
  kvasAlta: number;
  kvasMedia: number;
  naves: number; // conteo real de naves del parque
}

export interface ResumenKvas {
  kvasAlta: number;
  kvasMedia: number;
  kvasAltaDisponibles: number;
  kvasMediaDisponibles: number;
  kvasAltaUtilizados: number;
  kvasMediaUtilizados: number;
}

export interface NaveItem {
  idNave: string;
  idParque: string | null;
  numNave: number | null;
  numNaveNAME: string | null;
  situacion: string | null;
  mza: number;
  lote: number;
  terreno: number;
  construccion: number;
  precio: number;
  fecEntrega: string | null;
  razonsocial: string | null; // dueño (inversionista de la propiedad)
  nomDescriptivo: string | null;
  idArrendador: string | null;
  nomArrendador?: string | null; // quien renta (inversionista); solo en el listado
  tienePdp: boolean | null;
  pdpActivo: boolean | null;
  fum: string | null;
}

export interface DisponibilidadItem {
  idNave: string;
  idParque: string | null;
  nomParque: string | null;
  numNave: number | null;
  numNaveNAME: string | null;
  situacion: string | null;
  mza: number;
  lote: number;
  terreno: number;
  construccion: number;
  idPropiedad: string | null;
  idInversionista: string | null;
  nombre: string | null; // ocupante
}

export interface CrearParqueDto {
  nomParque: string;
  direccion: string;
  naves: number;
  kvasAlta: number;
  kvasMedia: number;
}

export interface EditarParqueDto {
  direccion: string;
  kvasAlta: number;
  kvasMedia: number;
}

export interface EditarNaveDto {
  situacion: string;
  numNaveName: string;
  mza: number;
  lote: number;
  terreno: number;
  construccion: number;
  precio: number;
  fecEntrega: string | null;
}

/** Situaciones asignables desde el editor de naves ("Vendida" se asigna en Propietarios). */
export const SITUACIONES = ['Disponible', 'Apartado', 'Bloqueado'] as const;

export const parquesApi = {
  listar: () => api.get<ParqueListado[]>('/parques'),
  kvas: (idParque: string) =>
    api.get<ResumenKvas>(`/parques/${idParque}/kvas`),
  naves: (idParque: string) =>
    api.get<NaveItem[]>(`/parques/${idParque}/naves`),
  nave: (idNave: string) => api.get<NaveItem>(`/parques/naves/${idNave}`),
  crear: (dto: CrearParqueDto) =>
    api.post<{ idParque: string }>('/parques', dto),
  editar: (idParque: string, dto: EditarParqueDto) =>
    api.patch<{ ok: true }>(`/parques/${idParque}`, dto),
  editarNave: (idNave: string, dto: EditarNaveDto) =>
    api.patch<{ ok: true }>(`/parques/naves/${idNave}`, dto),
  agregarNaves: (idParque: string, cantidad: number) =>
    api.post<{ creadas: number }>(`/parques/${idParque}/naves`, { cantidad }),
  disponibilidad: (idParque: string) =>
    api.get<DisponibilidadItem[]>(
      `/disponibilidad?parque=${encodeURIComponent(idParque)}`,
    ),
};
