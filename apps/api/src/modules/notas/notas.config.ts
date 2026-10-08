/**
 * Catálogo de entidades que pueden tener notas (chat). Para replicar el chat en
 * otra pantalla basta registrar aquí su `modulo|pantalla|entidadTipo` con la
 * clave de permiso del módulo y la tabla/columna donde vive la entidad (se usa
 * para validar que el id exista). Ver / escribir notas exige esa clave
 * (soporte pasa siempre, igual que `PermisoGuard`).
 */
export interface EntidadNotas {
  /** Clave de `segModulosUsuarios` que abre la pantalla. */
  clave: number;
  /** Tabla donde vive la entidad (validación de existencia). */
  tabla: string;
  /** Columna con el id de la entidad. */
  columna: string;
}

export const NOTAS_ENTIDADES: Readonly<Record<string, EntidadNotas>> = {
  // Arrendatarios > Planes de Renta: una conversación por plan (arrePdp).
  'arrendatarios|planes-renta|arrePdp': { clave: 20, tabla: 'arrePdp', columna: 'idArrePdp' },
};

/** Referencia de la entidad dueña de las notas (la usan avisos de MontseAI). */
export interface RefNotas {
  modulo: string;
  pantalla: string;
  entidadTipo: string;
  entidadId: string;
}

/** Referencia de las notas de un plan de renta. */
export const refPlanRenta = (idArrePdp: string): RefNotas => ({
  modulo: 'arrendatarios',
  pantalla: 'planes-renta',
  entidadTipo: 'arrePdp',
  entidadId: idArrePdp,
});

/** Eventos de MontseAI (columna `evento` de tipo `sistema`). */
export type EventoNotas = 'cambio_manual' | 'inpc' | 'contrato' | 'cancelacion' | 'liberacion';

/** Un cambio dentro de un aviso agrupado de «cambio manual». */
export interface CambioNota {
  /** Texto ya redactado (p. ej. «Const m² (desde el año 5): 349.17 → 340.00»). */
  descripcion: string;
  concepto?: string;
  partida?: number | null;
}
