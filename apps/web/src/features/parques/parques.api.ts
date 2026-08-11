import { api } from '@/lib/api';

export interface ParqueListado {
  idParque: string;
  nomParque: string | null;
  direccion: string | null;
  /** Capacidad en MEDIA tensión (antes `kvasAlta`). */
  kvasMt: number;
  /** Capacidad en BAJA tensión (antes `kvasMedia`). */
  kvasBt: number;
  /** KVA que se dan por defecto a cada nave NUEVA de este parque. */
  dotacionMtNave: number;
  dotacionBtNave: number;
  naves: number; // conteo real de naves del parque
}

/** Los *Disponibles* pueden venir NEGATIVOS: es un sobregiro real, no un error. */
export interface ResumenKvas {
  kvasMt: number;
  kvasBt: number;
  kvasMtDisponibles: number;
  kvasBtDisponibles: number;
  kvasMtUtilizados: number;
  kvasBtUtilizados: number;
}

export interface NaveItem {
  idNave: string;
  idParque: string | null;
  numNave: number | null;
  numNaveNAME: string | null;
  /** KVA que le tocan por disposición del parque (reservados, no entregados). */
  dotacionMt: number;
  dotacionBt: number;
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
  kvasMt: number;
  kvasBt: number;
  /** KVA que le tocan a CADA nave por disposición del parque. */
  dotacionMtNave: number;
  dotacionBtNave: number;
}

/** Dotación de UNA nave. Endpoint aparte porque exige permiso 721. */
export interface DotacionNaveDto {
  dotacionMt: number;
  dotacionBt: number;
}

export interface EditarParqueDto {
  direccion: string;
  kvasMt: number;
  kvasBt: number;
  /** Solo afecta a las naves FUTURAS; no re-aplica a las existentes. */
  dotacionMtNave: number;
  dotacionBtNave: number;
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

/** Un evento de la trayectoria de una nave (línea de tiempo, desde la auditoría). */
export interface EventoHistorialNave {
  fecha: string;
  dimension: 'renta' | 'venta';
  evento: string;
  detalle: string | null;
  motivo: string | null;
  actor: string;
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
  historialNave: (idNave: string) =>
    api.get<EventoHistorialNave[]>(`/parques/naves/${idNave}/historial`),
  crear: (dto: CrearParqueDto) =>
    api.post<{ idParque: string }>('/parques', dto),
  editar: (idParque: string, dto: EditarParqueDto) =>
    api.patch<{ ok: true }>(`/parques/${idParque}`, dto),
  editarNave: (idNave: string, dto: EditarNaveDto) =>
    api.patch<{ ok: true }>(`/parques/naves/${idNave}`, dto),
  /** Dotación de la nave. Endpoint aparte: exige permiso 721, no 702. */
  editarDotacionNave: (idNave: string, dto: DotacionNaveDto) =>
    api.patch<{ ok: true }>(`/parques/naves/${idNave}/dotacion`, dto),
  agregarNaves: (idParque: string, cantidad: number) =>
    api.post<{ creadas: number }>(`/parques/${idParque}/naves`, { cantidad }),
  disponibilidad: (idParque: string) =>
    api.get<DisponibilidadItem[]>(
      `/disponibilidad?parque=${encodeURIComponent(idParque)}`,
    ),
};
