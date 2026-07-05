import { api } from '@/lib/api';

export type TipoCliente =
  | 'todos'
  | 'inversionistas'
  | 'arrendatarios'
  | 'ticket'
  | 'usuarioFinal'
  | 'papelera';

/** Etiquetas de la columna "Tipo" (un cliente puede tener varias). */
export type EtiquetaTipo =
  | 'Inversionista'
  | 'Arrendatario'
  | 'Ticket'
  | 'Usuario Final'
  | 'Papelera'
  | 'Sin clasificar';

/** Opciones para el filtro de columna "Tipo" (orden de despliegue). */
export const OPCIONES_TIPO: EtiquetaTipo[] = [
  'Inversionista',
  'Arrendatario',
  'Ticket',
  'Usuario Final',
  'Sin clasificar',
  'Papelera',
];

/**
 * Etiquetas de tipo de un cliente. Semántica acordada:
 * - `pruebas=true` ⟺ **Papelera** (nombre histórico de la columna; tiene prioridad).
 * - si no, las banderas activas (puede ser varias → multi-tipo).
 * - si no tiene ninguna → **Sin clasificar** (cliente real sin tipo; hay que asignarle uno).
 */
export function etiquetasTipo(
  c: Pick<
    Cliente,
    'pruebas' | 'inversionista' | 'arrendatario' | 'ticket' | 'usuarioFinal'
  >,
): EtiquetaTipo[] {
  if (c.pruebas) return ['Papelera'];
  const t: EtiquetaTipo[] = [];
  if (c.inversionista) t.push('Inversionista');
  if (c.arrendatario) t.push('Arrendatario');
  if (c.ticket) t.push('Ticket');
  if (c.usuarioFinal) t.push('Usuario Final');
  return t.length > 0 ? t : ['Sin clasificar'];
}

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
  /** Confirma registrar pese a un RFC con la misma base pero distinta homoclave. */
  permitirSimilar?: boolean;
}

/** Una coincidencia de RFC: lo mínimo para el aviso (sin PII innecesaria). */
export interface RfcCoincidencia {
  idInversionista: string;
  razonsocial: string | null;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  RFC: string | null;
  inversionista: boolean;
  arrendatario: boolean;
  ticket: boolean;
  usuarioFinal: boolean;
  pruebas: boolean;
  /** 'exacto' = RFC completo igual; 'base' = misma base, homoclave distinta/faltante. */
  tipoCoincidencia: 'exacto' | 'base';
}

export interface VerificarRfcResp {
  generico: boolean;
  coincidencias: RfcCoincidencia[];
}

/**
 * Chips de filtro rápido. Cada uno fija la selección del filtro de la columna
 * "Tipo" (`etiquetas`). "Todos" limpia el filtro (selección vacía = sin filtro).
 */
export const CHIPS: { id: TipoCliente; label: string; etiquetas: EtiquetaTipo[] }[] = [
  { id: 'todos', label: 'Todos', etiquetas: [] },
  { id: 'inversionistas', label: 'Inversionistas', etiquetas: ['Inversionista'] },
  { id: 'arrendatarios', label: 'Arrendatarios', etiquetas: ['Arrendatario'] },
  { id: 'ticket', label: 'Ticket', etiquetas: ['Ticket'] },
  { id: 'usuarioFinal', label: 'Usuario Final', etiquetas: ['Usuario Final'] },
  { id: 'papelera', label: 'Papelera', etiquetas: ['Papelera'] },
];

/** Una atadura viva que impide mandar el cliente a la papelera (F2). */
export interface Dependencia {
  recurso: string;
  cantidad: number;
  modulo: string;
}

/** Una propiedad/nave ligada al cliente (sin montos: qué tiene + estado). */
export interface VinculoNave {
  /** Para navegar a Ventas → Planes. */
  idPropiedad: string;
  nave: string;
  parque: string;
  situacion: string;
  estadoPlan: string;
}

/** Una nave que el cliente renta (arrendatario), con la vigencia de su plan. */
export interface VinculoRenta {
  /** Para navegar a Arrendatarios → Planes. */
  idNavArrend: string;
  nave: string;
  parque: string;
  situacion: string;
  estadoPlan: string;
  vigencia: string | null;
}

/** Un documento del cliente (`inversionista_docs`). */
export interface VinculoDoc {
  titulo: string;
  descripcion: string;
  fecha: string | null;
}

/** Todo lo que el cliente tiene ligado (panel del sheet de edición). */
export interface ClienteVinculos {
  propiedades: VinculoNave[];
  tickets: VinculoNave[];
  rentas: VinculoRenta[];
  documentos: VinculoDoc[];
  otros: { recurso: string; cantidad: number }[];
}

export const clientesApi = {
  listar: (tipo: TipoCliente) => api.get<Cliente[]>(`/clientes?tipo=${tipo}`),
  obtener: (id: string) => api.get<Cliente>(`/clientes/${encodeURIComponent(id)}`),
  verificarRfc: (rfc: string, excluirId?: string) =>
    api.get<VerificarRfcResp>(
      `/clientes/verificar-rfc?rfc=${encodeURIComponent(rfc)}${
        excluirId ? `&excluirId=${encodeURIComponent(excluirId)}` : ''
      }`,
    ),
  crear: (dto: ClienteInput) => api.post<{ idInversionista: string }>('/clientes', dto),
  actualizar: (id: string, dto: ClienteInput) =>
    api.patch<{ ok: true }>(`/clientes/${id}`, dto),
  moverPapelera: (id: string) => api.post<{ ok: true }>(`/clientes/${id}/papelera`, {}),
  /** Saca al cliente de la papelera (pruebas=false → "Sin clasificar"). */
  restaurar: (id: string) => api.post<{ ok: true }>(`/clientes/${id}/restaurar`, {}),
  /** Ataduras vivas que impedirían archivar al cliente (F2). */
  dependencias: (id: string) =>
    api.get<Dependencia[]>(`/clientes/${encodeURIComponent(id)}/dependencias`),
  /** Detalle de todo lo que el cliente tiene ligado (propiedades/rentas/tickets/otros). */
  vinculos: (id: string) =>
    api.get<ClienteVinculos>(`/clientes/${encodeURIComponent(id)}/vinculos`),
  /** Ids de clientes con alguna nave ligada viva (para resaltar la Papelera). */
  conVinculos: () => api.get<string[]>('/clientes/con-vinculos'),
};
