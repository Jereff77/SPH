/**
 * Catálogos del tablero de pendientes (espejo de
 * `apps/api/src/modules/pendientes/pendientes.types.ts`).
 *
 * ⛔ Las CLAVES deben coincidir con los CHECK de `dev_pendientes`. Agregar un
 * valor aquí sin agregarlo en la BD hace que el guardado se rechace.
 */

export const TIPOS = {
  modulo_nuevo: 'Módulo nuevo',
  mejora: 'Mejora',
  bug: 'Bug',
  deuda_tecnica: 'Deuda técnica',
  seguridad: 'Seguridad',
  datos: 'Datos',
} as const;

export const URGENCIAS = {
  p0: 'P0 · Crítica',
  p1: 'P1 · Alta',
  p2: 'P2 · Media',
  p3: 'P3 · Cuando se pueda',
} as const;

export const ESTADOS = {
  propuesto: 'Propuesto',
  aprobado: 'Aprobado',
  en_curso: 'En curso',
  bloqueado: 'Bloqueado',
  terminado: 'Terminado',
  descartado: 'Descartado',
} as const;

export type TipoPendiente = keyof typeof TIPOS;
export type UrgenciaPendiente = keyof typeof URGENCIAS;
export type EstadoPendiente = keyof typeof ESTADOS;

export const ESTADOS_CERRADOS: EstadoPendiente[] = ['terminado', 'descartado'];

export interface Pendiente {
  id: number;
  titulo: string;
  descripcion: string | null;
  notas: string | null;
  origen: string | null;
  tipo: TipoPendiente;
  urgencia: UrgenciaPendiente;
  estado: EstadoPendiente;
  modulo: string | null;
  version_resuelto: string | null;
  resuelto_at: string | null;
  fc: string;
  fm: string;
  creadoPor: string | null;
}

export interface ResumenPendientes {
  abiertos: number;
  p0: number;
  p1: number;
  enCurso: number;
  bloqueados: number;
}

export interface ListaPendientes {
  filas: Pendiente[];
  resumen: ResumenPendientes;
}

/** Payload de alta/edición. Solo `titulo` es obligatorio. */
export interface GuardarPendiente {
  id?: number;
  titulo: string;
  descripcion?: string | null;
  notas?: string | null;
  origen?: string | null;
  modulo?: string | null;
  versionResuelto?: string | null;
  tipo: TipoPendiente;
  urgencia: UrgenciaPendiente;
  estado: EstadoPendiente;
}

/** Color del chip de urgencia: P0 grita, P3 casi no se ve. */
export const COLOR_URGENCIA: Record<UrgenciaPendiente, string> = {
  p0: 'bg-red-100 text-red-800',
  p1: 'bg-orange-100 text-orange-800',
  p2: 'bg-amber-100 text-amber-800',
  p3: 'bg-gray-100 text-gray-700',
};

export const COLOR_ESTADO: Record<EstadoPendiente, string> = {
  propuesto: 'bg-slate-100 text-slate-700',
  aprobado: 'bg-indigo-100 text-indigo-800',
  en_curso: 'bg-blue-100 text-blue-800',
  bloqueado: 'bg-purple-100 text-purple-800',
  terminado: 'bg-green-100 text-green-800',
  descartado: 'bg-gray-100 text-gray-500',
};
