import { api } from '@/lib/api';

/**
 * Administración de KVA's (capacidad eléctrica).
 * Nivel: MT = media tensión · BT = baja tensión (bolsas independientes).
 * Figura: VENTA (se va con la nave) · RENTA (regresa al cerrar el contrato).
 * Etapa: POR_ASIGNAR · COMPROMETIDO · ASIGNADO (ya hay contrato con CFE).
 */
export type NivelKva = 'MT' | 'BT';
export type FiguraKva = 'VENTA' | 'RENTA';
export type EtapaKva = 'POR_ASIGNAR' | 'COMPROMETIDO' | 'ASIGNADO';

export const ETIQUETA_NIVEL: Record<NivelKva, string> = {
  MT: 'Media tensión',
  BT: 'Baja tensión',
};

export const ETIQUETA_ETAPA: Record<EtapaKva, string> = {
  POR_ASIGNAR: 'Por asignar',
  COMPROMETIDO: 'Comprometido',
  ASIGNADO: 'Asignado (con CFE)',
};

export interface AsignacionKva {
  idKvas: string;
  idParque: string;
  idNave: string;
  nave: string | null;
  numNave: number | null;
  nivel: NivelKva;
  figura: FiguraKva;
  etapa: EtapaKva;
  cantKvas: number;
  cantDevuelta: number;
  /** Lo que sigue consumiendo del parque. */
  pendiente: number;
  contratoCfe: string | null;
  fechaContratoCfe: string | null;
  status: boolean;
  fc: string;
}

export interface ResumenParqueKva {
  idParque: string;
  nomParque: string | null;
  idAcometida: string | null;
  kvasMt: number;
  kvasBt: number;
  /** Pueden ser NEGATIVOS: es un sobregiro real, no un error. */
  kvasMtDisponibles: number;
  kvasBtDisponibles: number;
  kvasMtUtilizados: number;
  kvasBtUtilizados: number;
}

export interface Acometida {
  idAcometida: string;
  nombre: string;
  tensionKv: number | null;
  capacidadMt: number;
  capacidadBt: number;
  folioCfe: string | null;
  notas: string | null;
  repartidoMt: number;
  repartidoBt: number;
  parques: ResumenParqueKva[];
}

export interface ResumenKvas {
  acometidas: Acometida[];
  sinAcometida: ResumenParqueKva[];
}

export interface DevolucionKva {
  idDevolucion: string;
  cantidad: number;
  fechaDevolucion: string;
  documento: string;
  /** URL firmada temporal (el bucket es privado). */
  urldoc: string | null;
  observaciones: string | null;
  status: boolean;
  fc: string;
}

export interface AsignacionDto {
  idNave: string;
  nivel: NivelKva;
  figura: FiguraKva;
  etapa: EtapaKva;
  cantKvas: number;
  contratoCfe?: string | null;
  fechaContratoCfe?: string | null;
  idPropiedad?: string | null;
  idNavArrend?: string | null;
}

export interface AcometidaDto {
  nombre: string;
  tensionKv?: number | null;
  capacidadMt: number;
  capacidadBt: number;
  folioCfe?: string | null;
  notas?: string | null;
}

export const kvasApi = {
  resumen: () => api.get<ResumenKvas>('/kvas/resumen'),
  porParque: (idParque: string) =>
    api.get<AsignacionKva[]>(`/kvas/parque/${encodeURIComponent(idParque)}`),
  porNave: (idNave: string) =>
    api.get<AsignacionKva[]>(`/kvas/nave/${encodeURIComponent(idNave)}`),
  devoluciones: (idKvas: string) =>
    api.get<DevolucionKva[]>(
      `/kvas/asignacion/${encodeURIComponent(idKvas)}/devoluciones`,
    ),

  crear: (dto: AsignacionDto) =>
    api.post<{ idKvas: string }>('/kvas/asignacion', dto),
  editar: (idKvas: string, dto: Omit<AsignacionDto, 'idNave'>) =>
    api.patch<{ ok: true }>(`/kvas/asignacion/${encodeURIComponent(idKvas)}`, dto),
  /** Baja LÓGICA con motivo (POST y no DELETE: el motivo viaja en el body). */
  cancelar: (idKvas: string, motivo: string) =>
    api.post<{ ok: true }>(
      `/kvas/asignacion/${encodeURIComponent(idKvas)}/cancelar`,
      { motivo },
    ),

  /** El documento es OBLIGATORIO: es lo que acredita la devolución. */
  registrarDevolucion: (idKvas: string, datos: FormData) =>
    api.postForm<{ idDevolucion: string }>(
      `/kvas/asignacion/${encodeURIComponent(idKvas)}/devolucion`,
      datos,
    ),

  crearAcometida: (dto: AcometidaDto) =>
    api.post<{ idAcometida: string }>('/kvas/acometida', dto),
  editarAcometida: (idAcometida: string, dto: AcometidaDto) =>
    api.patch<{ ok: true }>(
      `/kvas/acometida/${encodeURIComponent(idAcometida)}`,
      dto,
    ),
  asignarAcometida: (idParque: string, idAcometida: string | null) =>
    api.patch<{ ok: true }>(
      `/kvas/parque/${encodeURIComponent(idParque)}/acometida`,
      { idAcometida },
    ),
};
