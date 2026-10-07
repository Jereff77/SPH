import type { TipoPlantilla } from './kvas-plantillas.schemas.js';

/**
 * Catálogo CERRADO de campos automáticos por tipo de plantilla (Fase 2).
 * Fuente de verdad en el servidor: el editor lo lee por `GET /kvas/plantillas/catalogo/:tipo`
 * y `crear`/`guardar` rechazan cualquier clave fuera del catálogo del tipo.
 */
export const CLAVES_CAMPO = [
  'empresa',
  'parque',
  'naves',
  'kvas_por_nave',
  'nivel',
  'fecha',
] as const;
export type ClaveCampo = (typeof CLAVES_CAMPO)[number];

export interface CampoCatalogo {
  clave: ClaveCampo;
  etiqueta: string;
  grupo: 'INVERSIONISTAS' | 'PARQUES' | 'PROPIEDADES' | 'SISTEMA';
  ejemplo: string;
}

const TODOS: readonly CampoCatalogo[] = [
  { clave: 'empresa', etiqueta: 'Empresa', grupo: 'INVERSIONISTAS', ejemplo: 'EM BAJÍO EMPAQUES S.A. DE C.V.' },
  { clave: 'parque', etiqueta: 'Parque', grupo: 'PARQUES', ejemplo: 'Acupark III' },
  { clave: 'naves', etiqueta: 'Naves', grupo: 'PROPIEDADES', ejemplo: '107, 108, 109, 110, 119, 120, 121 y 122' },
  { clave: 'kvas_por_nave', etiqueta: 'KVA por nave', grupo: 'PROPIEDADES', ejemplo: '5 KVAS' },
  { clave: 'nivel', etiqueta: 'Nivel de tensión', grupo: 'PROPIEDADES', ejemplo: 'baja tensión' },
  { clave: 'fecha', etiqueta: 'Fecha', grupo: 'SISTEMA', ejemplo: '7 de octubre de 2026' },
];

const POR_TIPO: Record<TipoPlantilla, readonly CampoCatalogo[]> = {
  ASIGNACION_CARGA: TODOS,
  DEVOLUCION: [],
};

export function catalogoDeTipo(tipo: TipoPlantilla): readonly CampoCatalogo[] {
  return POR_TIPO[tipo];
}

/** `true` si todas las claves están en el catálogo del tipo. */
export function clavesPermitidas(tipo: TipoPlantilla, claves: Iterable<string>): boolean {
  const ok = new Set<string>(POR_TIPO[tipo].map((c) => c.clave));
  for (const c of claves) if (!ok.has(c)) return false;
  return true;
}
