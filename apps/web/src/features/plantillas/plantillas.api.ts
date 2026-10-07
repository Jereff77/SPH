import { api } from '@/lib/api';

export type TipoPlantilla = 'ASIGNACION_CARGA' | 'DEVOLUCION';

export const ETIQUETA_TIPO: Record<TipoPlantilla, string> = {
  ASIGNACION_CARGA: 'Asignación de carga',
  DEVOLUCION: 'Devolución',
};

/** Documento JSON de Tiptap (nodos y marcas de la lista permitida). */
export interface DocJson {
  type: 'doc';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content?: any[];
}

export interface ContenidoPlantilla {
  encabezado: DocJson;
  cuerpo: DocJson;
  pie: DocJson;
  /** Ancho del logo en px (uno de PASOS_LOGO); por omisión 170. */
  logoAncho?: number;
}

export interface PlantillaResumen {
  idPlantilla: string;
  tipo: TipoPlantilla;
  nombre: string;
  descripcion: string | null;
  versionActual: number;
  status: boolean;
  fc: string;
  fum: string | null;
}

export interface PlantillaDetalle {
  idPlantilla: string;
  tipo: TipoPlantilla;
  nombre: string;
  descripcion: string | null;
  status: boolean;
  versionActual: number;
  contenido: ContenidoPlantilla;
  nota: string | null;
  fcVersion: string;
}

const BASE = '/kvas/plantillas';

export const plantillasApi = {
  listar: (incluirBajas: boolean) =>
    api.get<PlantillaResumen[]>(`${BASE}?incluirBajas=${incluirBajas}`),
  obtener: (id: string) => api.get<PlantillaDetalle>(`${BASE}/${encodeURIComponent(id)}`),
  crear: (body: {
    tipo: TipoPlantilla;
    nombre: string;
    descripcion?: string;
    contenido: ContenidoPlantilla;
    nota?: string;
  }) => api.post<{ idPlantilla: string; version: number }>(BASE, body),
  actualizar: (
    id: string,
    body: {
      nombre?: string;
      descripcion?: string;
      contenido: ContenidoPlantilla;
      versionBase: number;
      nota?: string;
    },
  ) => api.put<{ version: number }>(`${BASE}/${encodeURIComponent(id)}`, body),
  duplicar: (id: string) =>
    api.post<{ idPlantilla: string }>(`${BASE}/${encodeURIComponent(id)}/duplicar`),
  baja: (id: string, motivo: string) =>
    api.post<{ ok: true }>(`${BASE}/${encodeURIComponent(id)}/baja`, { motivo }),
};

/** Lee el código de negocio de un 409 (NOMBRE_DUPLICADO, VERSION_DESACTUALIZADA...). */
export function codigoError(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const b = body as Record<string, unknown>;
  const directo = b.codigo ?? b.code;
  if (typeof directo === 'string') return directo;
  if (typeof b.message === 'string') return b.message;
  if (b.message && typeof b.message === 'object') return codigoError(b.message);
  if (b.error && typeof b.error === 'object') return codigoError(b.error);
  return undefined;
}

interface DatosConflicto {
  versionActual: number;
  contenido: ContenidoPlantilla;
}

/** Busca `{ versionActual, contenido }` en el cuerpo de un 409 de versión. */
export function datosConflicto(body: unknown): DatosConflicto | null {
  if (!body || typeof body !== 'object') return null;
  const r = body as Record<string, unknown>;
  if (typeof r.versionActual === 'number' && r.contenido) {
    return { versionActual: r.versionActual, contenido: r.contenido as ContenidoPlantilla };
  }
  return datosConflicto(r.message ?? r.detalle ?? r.details ?? r.error ?? r.data);
}

/** dd/mm/aaaa */
export function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}
