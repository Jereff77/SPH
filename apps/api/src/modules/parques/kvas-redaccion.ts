/**
 * Redacción de los campos automáticos de los documentos de KVA's (Fase 2).
 * Funciones PURAS (sin BD, sin red): se prueban con `scripts/prueba-kvas-redaccion.mjs`.
 * Textos aprobados como propuesta en `docs/plantillas-kvas/08-FASE2-campos.md` §3.
 */

export type NivelKva = 'BT' | 'MT';

export interface NaveSeleccionada {
  idNave: string;
  /** Etiqueta visible (`naves.numNaveNAME`); NO es única: la identidad es `idNave`. */
  numNave: string;
  idParque: string;
  nomParque: string;
  kvas: { nivel: NivelKva; cantidad: number }[];
  /** Dotación de la nave (solo para la advertencia informativa DIFIERE_DE_DOTACION). */
  dotacionBt?: number | null;
  dotacionMt?: number | null;
}

export interface Advertencia {
  codigo: string;
  mensaje: string;
}

export interface CamposResueltos {
  empresa: string;
  parque: string;
  naves: string;
  kvas_por_nave: string;
  nivel: string;
  fecha: string;
}

const NOMBRE_NIVEL: Record<NivelKva, string> = { BT: 'baja tensión', MT: 'media tensión' };
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** `a` · `a y b` · `a, b y c`. */
export function unirLista(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

function cmpTexto(a: string, b: string): number {
  return a.localeCompare(b, 'es', { sensitivity: 'base' }) || (a < b ? -1 : a > b ? 1 : 0);
}

/** Orden natural de etiquetas: numéricas por valor (2 antes que 10); las no numéricas al final, por texto. */
export function compararEtiqueta(a: string, b: string): number {
  const na = /^\d+$/.test(a);
  const nb = /^\d+$/.test(b);
  if (na && nb) return Number(a) - Number(b) || (a < b ? -1 : a > b ? 1 : 0);
  if (na) return -1;
  if (nb) return 1;
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' }) || (a < b ? -1 : a > b ? 1 : 0);
}

/** Dedupe por `idNave` (nunca por etiqueta; hallazgo B-A1), conservando la primera aparición. */
export function dedupeNaves<T extends { idNave: string }>(naves: readonly T[]): T[] {
  const vistas = new Set<string>();
  const out: T[] = [];
  for (const n of naves) {
    if (vistas.has(n.idNave)) continue;
    vistas.add(n.idNave);
    out.push(n);
  }
  return out;
}

/** Ordena por parque (nombre) y luego por número en orden natural; desempata por idNave. */
export function ordenarNaves<T extends NaveSeleccionada>(naves: readonly T[]): T[] {
  return [...naves].sort(
    (a, b) =>
      cmpTexto(a.nomParque, b.nomParque) ||
      cmpTexto(a.idParque, b.idParque) ||
      compararEtiqueta(a.numNave, b.numNave) ||
      cmpTexto(a.idNave, b.idNave),
  );
}

export interface GrupoParque {
  idParque: string;
  nomParque: string;
  etiquetas: string[];
}

/**
 * Agrupa las naves por parque. Un solo parque → solo la lista de números (`107, 108 y 109`);
 * varios → una porción por parque unidas con `; ` (`107 y 108 del parque A; 12 del parque B`).
 * `forzarParque` califica con «del parque X» aunque este subconjunto sea de un solo parque
 * (para redactar grupos de un conjunto mayor que sí tiene varios parques; hallazgo M-1).
 */
export function agruparNaves(
  naves: readonly NaveSeleccionada[],
  forzarParque = false,
): {
  texto: string;
  grupos: GrupoParque[];
} {
  const ord = ordenarNaves(dedupeNaves(naves));
  const grupos: GrupoParque[] = [];
  for (const n of ord) {
    const ult = grupos[grupos.length - 1];
    if (ult && ult.idParque === n.idParque) ult.etiquetas.push(n.numNave);
    else grupos.push({ idParque: n.idParque, nomParque: n.nomParque, etiquetas: [n.numNave] });
  }
  const texto =
    grupos.length <= 1 && !forzarParque
      ? unirLista(grupos[0]?.etiquetas ?? [])
      : grupos.map((g) => `${unirLista(g.etiquetas)} del parque ${g.nomParque}`).join('; ');
  return { texto, grupos };
}

/** Nombres de parque únicos, alfabéticos, con la regla de unión. */
export function redactarParques(naves: readonly NaveSeleccionada[]): string {
  const nombres = [...new Set(dedupeNaves(naves).map((n) => n.nomParque))].sort(cmpTexto);
  return unirLista(nombres);
}

/** `baja tensión` · `media tensión` · `baja y media tensión` (mixto). */
export function redactarNivel(naves: readonly NaveSeleccionada[]): { texto: string; mixto: boolean } {
  const niveles = new Set<NivelKva>();
  for (const n of dedupeNaves(naves)) for (const k of n.kvas) niveles.add(k.nivel);
  if (niveles.has('BT') && niveles.has('MT')) return { texto: 'baja y media tensión', mixto: true };
  if (niveles.has('MT')) return { texto: NOMBRE_NIVEL.MT, mixto: false };
  return { texto: NOMBRE_NIVEL.BT, mixto: false };
}

/** Número sin ceros sobrantes: `5`, `2.5`. */
export function formatearCantidad(n: number): string {
  return String(Number(n.toFixed(2)));
}

const kvasTxt = (n: number): string => `${formatearCantidad(n)} ${n === 1 ? 'KVA' : 'KVAS'}`;

/** `D de <mes> de AAAA` en zona America/Mexico_City. */
export function redactarFecha(fecha: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(fecha);
  const get = (t: string): number => Number(partes.find((p) => p.type === t)?.value);
  return `${get('day')} de ${MESES[get('month') - 1]} de ${get('year')}`;
}

/** Firma de las cantidades de una nave: `BT:5|MT:2` (niveles ordenados). */
function firma(n: NaveSeleccionada): string {
  return [...n.kvas]
    .sort((a, b) => (a.nivel < b.nivel ? -1 : 1))
    .map((k) => `${k.nivel}:${formatearCantidad(k.cantidad)}`)
    .join('|');
}

function describirFirma(f: string, conNivel: boolean): string {
  const items = f.split('|').map((x) => {
    const [nivel, cant] = x.split(':') as [NivelKva, string];
    return { nivel, cant: Number(cant) };
  });
  if (items.length === 1 && !conNivel) return kvasTxt(items[0]!.cant);
  return items.map((i) => `${kvasTxt(i.cant)} en ${NOMBRE_NIVEL[i.nivel]}`).join(' y ');
}

/** Texto de `kvas_por_nave` + advertencias que se derivan de la selección. */
export function redactarKvas(navesEntrada: readonly NaveSeleccionada[]): {
  texto: string;
  advertencias: Advertencia[];
} {
  const naves = ordenarNaves(dedupeNaves(navesEntrada));
  const advertencias: Advertencia[] = [];
  const nivel = redactarNivel(naves);
  if (nivel.mixto)
    advertencias.push({
      codigo: 'NIVEL_MIXTO',
      mensaje:
        'Hay naves con baja y media tensión: el texto de «KVA por nave» ya indica el nivel de cada grupo; ' +
        'si tu plantilla pone además «en [Nivel de tensión]», quita ese fragmento y revisa la redacción.',
    });

  const grupos = new Map<string, NaveSeleccionada[]>();
  for (const n of naves) {
    const f = firma(n);
    grupos.set(f, [...(grupos.get(f) ?? []), n]);
  }

  let texto: string;
  if (grupos.size <= 1) {
    const f = [...grupos.keys()][0];
    texto = f ? describirFirma(f, false) : '';
  } else {
    advertencias.push({
      codigo: 'CANTIDADES_DISTINTAS',
      mensaje: 'Las naves tienen cantidades de KVA distintas: revisa la redacción del documento.',
    });
    // M-1: con más de un parque en la selección, TODA nave se califica con su parque
    // (el número solo es ambiguo entre parques).
    const variosParques = new Set(naves.map((n) => n.idParque)).size > 1;
    const partes = [...grupos.entries()].map(([f, ns]) => {
      const lista = agruparNaves(ns, variosParques).texto;
      return `${describirFirma(f, nivel.mixto)} en ${ns.length === 1 ? 'la nave' : 'las naves'} ${lista}`;
    });
    // Con una « y » dentro de algún grupo (o con varios parques), las partes se separan con `; ` para no duplicar la «y».
    texto = variosParques || partes.some((p) => p.includes(' y ')) ? partes.join('; ') : unirLista(partes);
  }

  if (new Set(naves.map((n) => n.idParque)).size > 1)
    advertencias.push({
      codigo: 'VARIOS_PARQUES',
      mensaje: 'Las naves pertenecen a más de un parque: revisa la redacción del documento.',
    });

  const etiquetas = new Map<string, number>();
  for (const n of naves) {
    const k = `${n.idParque}|${n.numNave}`;
    etiquetas.set(k, (etiquetas.get(k) ?? 0) + 1);
  }
  if ([...etiquetas.values()].some((c) => c > 1))
    advertencias.push({
      codigo: 'ETIQUETA_REPETIDA',
      mensaje: 'Dos naves distintas del mismo parque comparten número: revisa la lista de naves.',
    });

  const difiere = naves.some((n) =>
    (['BT', 'MT'] as const).some((nv) => {
      const dot = nv === 'BT' ? n.dotacionBt : n.dotacionMt;
      if (dot === null || dot === undefined) return false;
      const cap = n.kvas.find((k) => k.nivel === nv)?.cantidad ?? 0;
      return Math.abs(cap - dot) > 1e-9;
    }),
  );
  if (difiere)
    advertencias.push({
      codigo: 'DIFIERE_DE_DOTACION',
      mensaje: 'Alguna cantidad capturada es distinta de la dotación de la nave (informativo).',
    });

  return { texto, advertencias };
}

/** Los seis campos resueltos + advertencias, a partir de la selección. */
export function resolverTodo(
  empresa: string,
  naves: readonly NaveSeleccionada[],
  fecha: Date = new Date(),
): { resueltos: CamposResueltos; advertencias: Advertencia[] } {
  const kvas = redactarKvas(naves);
  return {
    resueltos: {
      empresa,
      parque: redactarParques(naves),
      naves: agruparNaves(naves).texto,
      kvas_por_nave: kvas.texto,
      nivel: redactarNivel(naves).texto,
      fecha: redactarFecha(fecha),
    },
    advertencias: kvas.advertencias,
  };
}

// ---------------------------------------------------------------------------
// Sustitución de nodos `campo` en el documento Tiptap
// ---------------------------------------------------------------------------
export interface NodoDoc {
  type: string;
  text?: string;
  marks?: unknown[];
  attrs?: Record<string, unknown>;
  content?: NodoDoc[];
}

/** Copia del documento con cada nodo `campo` reemplazado por un nodo de texto (mismas marcas). */
export function resolverCampos<T extends NodoDoc>(doc: T, resueltos: Record<string, string>): T {
  const rec = (n: NodoDoc): NodoDoc[] => {
    if (n.type === 'campo') {
      const clave = n.attrs?.['clave'];
      const valor = typeof clave === 'string' && Object.hasOwn(resueltos, clave) ? resueltos[clave] : '';
      if (!valor) return [];
      const out: NodoDoc = { type: 'text', text: valor };
      if (n.marks?.length) out.marks = structuredClone(n.marks);
      return [out];
    }
    if (!n.content) return [structuredClone(n)];
    const { content, ...resto } = n;
    const hijos = content.flatMap(rec);
    const copia: NodoDoc = structuredClone(resto);
    // Un párrafo sin texto queda sin `content` (así lo emite ProseMirror).
    if (hijos.length || n.type !== 'paragraph') copia.content = hijos;
    return [copia];
  };
  return rec(doc)[0] as T;
}
