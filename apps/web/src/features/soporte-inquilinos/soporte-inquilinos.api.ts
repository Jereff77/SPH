import { api } from '@/lib/api';
import type { CuentaCorreo, CuentaInput, MensajeCorreo, ResultadoConexion } from '@/features/correo/correo.api';

export type EstadoIncidente = 'Nuevo' | 'En Proceso' | 'Resuelto' | 'Detenido' | 'Cerrado';

export interface IncidenteResumen {
  id: string;
  folio: string;
  conversationId: string;
  asunto: string | null;
  estado: EstadoIncidente;
  detenidoOrigen: 'auto' | 'manual' | null;
  categoria: string | null;
  prioridad: string | null;
  idArrendador: string | null;
  idNavArrend: string | null;
  idNave: string | null;
  idParque: string | null;
  asignadoA: string | null;
  ultimaActividad: string | null;
  creadoEn: string | null;
  remitente: string | null;
  inquilino: string | null;
  parque: string | null;
  nave: string | null;
  asignado: string | null;
}

export interface Seguimiento {
  id: string;
  tipo: 'evento' | 'nota';
  texto: string;
  uid: string | null;
  fc: string;
  autor: string | null;
}

export interface IncidenteDetalle {
  incidente: IncidenteResumen & { idCuenta: string };
  hilo: MensajeCorreo[];
  inquilino: string | null;
  asignado: string | null;
  seguimientos: Seguimiento[];
}

export interface AgenteOpcion {
  uid: string;
  nombre: string;
}

export interface InquilinoOpcion {
  idArrendador: string;
  nombre: string;
}

export interface NaveOpcion {
  idNavArrend: string;
  idParque: string;
  idNave: string;
  nomParque: string | null;
  numNaveNAME: string | null;
  nomDescriptivo: string | null;
}

export interface VincularInput {
  idArrendador?: string | null;
  idNavArrend?: string | null;
  idNave?: string | null;
  idParque?: string | null;
}

const base = '/arrendatarios/soporte';

export const soporteApi = {
  // Bandeja / incidentes
  incidentes: (estado?: string, q?: string) => {
    const p = new URLSearchParams();
    if (estado) p.set('estado', estado);
    if (q) p.set('q', q);
    const qs = p.toString();
    return api.get<IncidenteResumen[]>(`${base}/incidentes${qs ? `?${qs}` : ''}`);
  },
  detalle: (id: string) => api.get<IncidenteDetalle>(`${base}/incidentes/${id}`),
  seguimientos: (id: string) =>
    api.get<Seguimiento[]>(`${base}/incidentes/${id}/seguimientos`),
  puedeVerTodos: () => api.get<{ verTodos: boolean }>(`${base}/puede-ver-todos`),
  sincronizar: () =>
    api.post<{ nuevos: number; incidentesNuevos: number }>(`${base}/sincronizar`),
  responder: (id: string, form: FormData) =>
    api.postForm<{ ok: true }>(`${base}/incidentes/${id}/responder`, form),
  vincular: (id: string, dto: VincularInput) =>
    api.post<{ ok: true }>(`${base}/incidentes/${id}/vincular`, dto),
  cambiarEstado: (id: string, estado: EstadoIncidente) =>
    api.post<{ ok: true }>(`${base}/incidentes/${id}/estado`, { estado }),
  asignar: (id: string, asignadoA: string | null) =>
    api.post<{ ok: true }>(`${base}/incidentes/${id}/asignar`, { asignadoA }),
  agregarNota: (id: string, texto: string) =>
    api.post<{ ok: true }>(`${base}/incidentes/${id}/nota`, { texto }),
  clasificar: (id: string) =>
    api.post<{ categoria: string; prioridad: string; motivo: string }>(
      `${base}/incidentes/${id}/clasificar`,
    ),

  // Selectores
  agentes: () => api.get<AgenteOpcion[]>(`${base}/agentes`),
  inquilinos: () => api.get<InquilinoOpcion[]>(`${base}/inquilinos`),
  naves: (idArrendador: string) =>
    api.get<NaveOpcion[]>(`${base}/inquilinos/${idArrendador}/naves`),

  // Cuenta de correo de soporte
  cuenta: () => api.get<CuentaCorreo | null>(`${base}/cuenta`),
  cuentasDisponibles: () => api.get<CuentaCorreo[]>(`${base}/cuentas-disponibles`),
  designar: (idCuenta: string) =>
    api.put<{ ok: true }>(`${base}/cuenta/designar`, { idCuenta }),
  crearCuenta: (dto: CuentaInput) => api.post<{ id: string }>(`${base}/cuenta`, dto),
  editarCuenta: (id: string, dto: CuentaInput) =>
    api.patch<{ ok: true }>(`${base}/cuenta/${id}`, dto),
  probar: (dto: CuentaInput) =>
    api.post<ResultadoConexion>(`${base}/cuenta/probar`, dto),
  probarGuardada: (id: string, dto: CuentaInput) =>
    api.post<ResultadoConexion>(`${base}/cuenta/${id}/probar`, dto),
};
