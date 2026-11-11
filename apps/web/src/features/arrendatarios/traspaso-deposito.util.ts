import type { QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api';
import {
  fechaCorta,
  hoyMexico,
  montoExacto,
  type PlanEtiqueta,
  type TraspasoCandidato,
} from './arrendatarios.api';

/**
 * Lógica pura del traspaso de depósito de garantía (sin React): complemento, exceso,
 * validaciones del formulario y textos de los bloqueos. Vive aparte del componente para
 * poder probarla sin DOM y para no mezclar exports con el componente (react-refresh).
 */

export const NOTA_MIN = 10;
export const NOTA_MAX = 400;
export const MOTIVO_MIN = 5;
export const MOTIVO_MAX = 400;

/** Valor del `TraspasoDepositoForm` (lo que la persona elige y escribe; nunca montos, D3). */
export interface TraspasoFormValor {
  /** `idArrePdp` de los planes origen marcados. */
  origenes: string[];
  nota: string;
  /** yyyy-MM-dd (la captura es dd/mm/aaaa con `InputFecha`). */
  fecTraspaso: string;
  confirmado: boolean;
}

export const valorInicialTraspaso = (origenes: string[] = []): TraspasoFormValor => ({
  origenes,
  nota: '',
  fecTraspaso: hoyMexico(),
  confirmado: false,
});

/** UUID v4 para la clave de idempotencia de un envío (D15). */
export function nuevaClave(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Redondeo a 4 decimales (los depósitos guardan hasta 4): evita ruido de coma flotante al sumar. */
export const r4 = (n: number): number => Math.round(n * 10000) / 10000;

/** Ids marcados que siguen siendo elegibles (existen en la lista y no están bloqueados). */
export function origenesVigentes(candidatos: TraspasoCandidato[], ids: string[]): string[] {
  return ids.filter((id) => candidatos.some((c) => c.idArrePdp === id && !c.bloqueo));
}

export interface Complemento {
  /** Σ disponible de los orígenes marcados. */
  traspasado: number;
  /** Depósito − traspasado; `null` si lo elegido supera el depósito (se bloquea confirmar). */
  complemento: number | null;
  excede: boolean;
  /** Cuántos orígenes vigentes hay marcados. */
  contratos: number;
}

/** Complemento resultante = depósito del contrato destino − Σ disponible elegido (D3). */
export function calcularComplemento(
  deposito: number,
  candidatos: TraspasoCandidato[],
  ids: string[],
): Complemento {
  const vigentes = origenesVigentes(candidatos, ids);
  const traspasado = r4(
    vigentes.reduce(
      (s, id) => s + (candidatos.find((c) => c.idArrePdp === id)?.disponible ?? 0),
      0,
    ),
  );
  const dep = r4(deposito);
  const excede = traspasado > dep;
  return {
    traspasado,
    complemento: excede ? null : r4(dep - traspasado),
    excede,
    contratos: vigentes.length,
  };
}

export const notaValida = (nota: string): boolean => {
  const n = nota.trim().length;
  return n >= NOTA_MIN && n <= NOTA_MAX;
};

/** Fecha del traspaso: obligatoria y no futura (hora de México). */
export const fechaTraspasoValida = (iso: string, hoy: string = hoyMexico()): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso) && iso <= hoy;

/** El formulario permite confirmar: ≥ 1 origen vigente, sin exceso, nota, fecha y casilla. */
export function traspasoValido(
  valor: TraspasoFormValor,
  candidatos: TraspasoCandidato[],
  deposito: number,
  hoy: string = hoyMexico(),
): boolean {
  const c = calcularComplemento(deposito, candidatos, valor.origenes);
  return (
    c.contratos >= 1 &&
    !c.excede &&
    notaValida(valor.nota) &&
    fechaTraspasoValida(valor.fecTraspaso, hoy) &&
    valor.confirmado
  );
}

// ------------------------------------------------------------------ etiquetas y bloqueos

export type Tono = 'verde' | 'gris' | 'ambar' | 'rojo';

/** «12» → «Nave 12»; si la API ya manda un nombre («Nave 12», «Ocupar 2 · Nave 12») se respeta. */
export function etiquetaNave(nave: string | null | undefined): string {
  const t = (nave ?? '').trim();
  if (!t) return 'Nave';
  return /^[\w-]{1,6}$/.test(t) && /\d/.test(t) ? `Nave ${t}` : t;
}

/** Periodo `dd/mm/aaaa – dd/mm/aaaa` (usa el fin efectivo: si se canceló, la cancelación). */
export const periodoCandidato = (c: Pick<TraspasoCandidato, 'fecInicio' | 'fecFin' | 'finEfectivo'>): string =>
  `${fechaCorta(c.fecInicio)} – ${fechaCorta(c.finEfectivo ?? c.fecFin)}`;

export interface EtiquetaCandidato {
  texto: string;
  tono: Tono;
}

/**
 * Etiquetas de un candidato no bloqueado (03 §2). `tipo` lo calcula la API: en Renovar el
 * plan que se renueva viene como `RENOVADO`; en el modal manual esa misma nave sale como
 * «Misma nave» (wireframe 4).
 */
export function etiquetasCandidato(
  c: Pick<TraspasoCandidato, 'tipo' | 'mismaNave'>,
  modo: 'renovar' | 'manual',
): EtiquetaCandidato[] {
  if (modo === 'renovar' && c.tipo === 'RENOVADO') {
    return [{ texto: 'Mismo contrato (renovado)', tono: 'verde' }];
  }
  if (c.mismaNave) return [{ texto: 'Misma nave', tono: 'verde' }];
  return modo === 'renovar'
    ? [
        { texto: 'Posible adicional', tono: 'ambar' },
        { texto: 'Nave hermana · vence el mismo día', tono: 'gris' },
      ]
    : [{ texto: 'Nave hermana · vence el día anterior', tono: 'gris' }];
}

export interface MotivoBloqueo {
  titulo: string;
  detalle: string;
  tono: Tono;
}

/** Motivo en claro de un candidato bloqueado (lo decide la BD; aquí solo se muestra). */
export function motivoBloqueo(c: TraspasoCandidato, divisaDestino: string): MotivoBloqueo {
  const mon = c.moneda === 'USD' ? 'USD' : 'MXN';
  switch (c.bloqueo) {
    case 'INCLUIDO_EN_SIGUIENTE':
      return {
        titulo: 'Ya incluido en el contrato siguiente de esta nave',
        detalle:
          'Su depósito normalmente ya está en el contrato siguiente. Para limpiar el historial, traspásalo desde ese contrato.',
        tono: 'gris',
      };
    case 'MONEDA_DISTINTA':
      return {
        titulo: 'Otra moneda',
        detalle: c.moneda
          ? `Este contrato es ${divisaDestino}; ese depósito es ${c.moneda}. No se mezclan sin tipo de cambio.`
          : 'Ese depósito no tiene una moneda válida, así que no se puede comparar con la de este contrato.',
        tono: 'rojo',
      };
    case 'DEPOSITO_EN_CERO':
      return {
        titulo: 'Depósito en 0 en la corrida',
        detalle: `El plan dice ${montoExacto(c.depositoPlan, mon)} pero la partida está en ${montoExacto(c.cantidad, mon)}. Revisa el plan antes de traspasar.`,
        tono: 'rojo',
      };
    case 'YA_TRASPASADO':
      return {
        titulo: 'Ya traspasado',
        detalle: 'Su depósito ya se traspasó por completo a otro contrato.',
        tono: 'gris',
      };
    case 'DEPOSITO_NO_ESTANDAR':
      return {
        titulo: 'Estructura no estándar',
        detalle: 'La partida de depósito no tiene el formato esperado. Pide apoyo a soporte.',
        tono: 'rojo',
      };
    case 'DEPOSITO_AMBIGUO':
      return {
        titulo: 'Más de una partida de depósito',
        detalle: 'Este plan tiene más de una partida de depósito; pide apoyo a soporte.',
        tono: 'rojo',
      };
    case 'SUCESOR_SIN_DEPOSITO':
      return {
        titulo: 'El contrato siguiente tiene depósito en 0',
        detalle:
          'El contrato siguiente de esta nave tiene depósito en 0; probablemente se consolidó en otra nave del mismo arrendatario. Revisa los planes.',
        tono: 'rojo',
      };
    default:
      // Código que esta versión no conoce: se muestra el texto que escribió la API.
      return {
        titulo: 'No disponible para traspasar',
        detalle: c.bloqueoTexto ?? 'Pide apoyo a soporte.',
        tono: 'gris',
      };
  }
}

/** «Nave 12 · 17/10/2025 – 16/10/2026» (la contraparte de un traspaso), o «otro contrato». */
export function etiquetaPlan(p: PlanEtiqueta | null | undefined): string {
  if (!p) return 'otro contrato';
  const nave = p.nave ? etiquetaNave(p.nave) : 'otro contrato';
  return p.fecInicio || p.fecFin ? `${nave} · ${fechaCorta(p.fecInicio)} – ${fechaCorta(p.fecFin)}` : nave;
}

export interface SugerenciaAdicional {
  /** Naves hermanas sin marcar que cabrían en el depósito nuevo. */
  naves: string[];
  /** Complemento si se marcaran todas ellas. */
  complemento: number;
  /** Contratos en total si se marcaran (los ya elegidos + estas). */
  contratos: number;
}

/**
 * Sugerencia de Renovar (wireframe 1): hay naves hermanas del mismo día sin marcar y el
 * depósito nuevo cubriría también su depósito. Va acumulando mientras quepa.
 */
export function sugerenciaAdicional(
  deposito: number,
  candidatos: TraspasoCandidato[],
  ids: string[],
): SugerenciaAdicional | null {
  const actual = calcularComplemento(deposito, candidatos, ids);
  if (actual.contratos < 1 || actual.excede) return null;
  let acumulado = actual.traspasado;
  const naves: string[] = [];
  for (const c of candidatos) {
    if (c.bloqueo || c.mismaNave || ids.includes(c.idArrePdp)) continue;
    if (r4(acumulado + c.disponible) > r4(deposito)) continue;
    acumulado = r4(acumulado + c.disponible);
    naves.push(etiquetaNave(c.nave));
  }
  if (naves.length === 0) return null;
  return {
    naves,
    complemento: r4(deposito - acumulado),
    contratos: actual.contratos + naves.length,
  };
}

// ------------------------------------------------------------------ errores de la API

/** Código de negocio del cuerpo del error, si la API lo manda (`codigo`). */
export function codigoError(err: unknown): string | null {
  if (err instanceof ApiRequestError && err.body && typeof err.body === 'object') {
    const c = (err.body as Record<string, unknown>).codigo;
    return typeof c === 'string' ? c : null;
  }
  return null;
}

/** «Otro usuario está modificando este depósito» (bloqueo de 5 s en la BD): `codigo: 'OCUPADO'` en el cuerpo. */
export const esOcupado = (err: unknown): boolean => codigoError(err) === 'OCUPADO';

/**
 * Códigos de la API tras los que tiene sentido «Recargar» (la lista de candidatos o el depósito
 * cambiaron mientras operabas). Sin `codigo` en el cuerpo el error se trata como genérico.
 */
const CODIGOS_RECARGAR = new Set([
  'PARTIDA_CAMBIO',
  'DEPOSITO_TRASPASADO',
  'ORIGEN_BLOQUEADO',
  'ORIGEN_NO_VALIDO',
  'EXCEDE_DESTINO',
  'DESTINO_PAGADO',
  'DESTINO_SIN_SALDO',
]);
export const debeRecargar = (err: unknown): boolean => CODIGOS_RECARGAR.has(codigoError(err) ?? '');

/** Códigos por los que una reversa «no se puede todavía» (orden de reversa, pago aplicado…). */
const CODIGOS_REVERSA_BLOQUEADA = new Set([
  'PAGO_APLICADO',
  'DESTINO_YA_EMITIO',
  'REVERTIR_ANTES_OTRO',
  'YA_REVERTIDO',
  'ESTADO_INCONSISTENTE',
  'OCUPADO',
]);
export const reversaBloqueada = (err: unknown): boolean =>
  CODIGOS_REVERSA_BLOQUEADA.has(codigoError(err) ?? '');

export const statusError = (err: unknown): number | null =>
  err instanceof ApiRequestError ? err.status : null;

export const mensajeError = (err: unknown, porDefecto: string): string =>
  err instanceof Error && err.message ? err.message : porDefecto;

/** Tras un traspaso o una reversa, todo lo que lo muestra se vuelve a pedir. */
export function invalidarTraspasos(qc: QueryClient): void {
  for (const k of [
    'arre-planes',
    'arre-resumen',
    'arre-detalle',
    'arre-deposito',
    'arre-traspaso-origenes',
    'arre-renov-traspaso-origenes',
    'arre-partidas-pend',
    'arre-depositos',
    'arre-cob-pagos',
    'arre-rep-ec-corrida',
    'notas',
  ]) {
    void qc.invalidateQueries({ queryKey: [k] });
  }
}
