import { z } from 'zod';
import { CLAVES_CAMPO } from './kvas-plantillas.campos.js';

/**
 * Plantillas de documentos de KVA's · VERSION LIGHT.
 * `contenido` = { encabezado, cuerpo, pie }; cada zona es un Doc de Tiptap/ProseMirror
 * con un esquema CERRADO: nodos doc, paragraph, text, hardBreak, bulletList, orderedList,
 * listItem · marcas bold, italic, underline y textStyle (fuente y tamaño de listas CERRADAS) ·
 * nodo inline `campo` (clave de lista cerrada; las MISMAS marcas que el texto) ·
 * atributo textAlign solo en paragraph · `logoAncho` (paso de una lista cerrada) en la raíz.
 * Lo que se guarda es el resultado SANEADO (nunca el crudo del cliente).
 */

export const TIPOS_PLANTILLA = ['ASIGNACION_CARGA', 'DEVOLUCION'] as const;
export type TipoPlantilla = (typeof TIPOS_PLANTILLA)[number];

export const MARCAS = ['bold', 'italic', 'underline'] as const;
export const ALINEACIONES = ['left', 'center', 'right', 'justify'] as const;
/** Listas cerradas: el usuario elige, nunca teclea; el servidor rechaza cualquier otro valor. */
export const FUENTES = ['Arial', 'Calibri', 'Times New Roman', 'Georgia', 'Verdana'] as const;
export const TAMANOS = ['9px', '10px', '11px', '12px', '13px', '14px', '16px', '18px', '20px', '24px'] as const;
export const LOGO_ANCHOS = [80, 110, 140, 170, 220, 280, 340, 400] as const;

export const LIMITES = {
  textoTotal: 20_000,
  profundidad: 8,
  nodosPorZona: 500,
  motivoMin: 20,
} as const;

/** Quita control, ancho cero y reordenado bidireccional; normaliza a NFC. Conserva espacios. */
export function sanearTexto(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(
      // eslint-disable-next-line no-control-regex
      /[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤⁦-⁩﻿]/g,
      '',
    );
}

/** Texto de una sola línea (nombre, descripción, nota): saneado y sin espacios en los extremos. */
const linea = (max: number) =>
  z.string().transform((s) => sanearTexto(s).trim()).pipe(z.string().max(max));

// ---------------------------------------------------------------------------
// Árbol Tiptap (forma estricta; la saneada se hace en `sanearDoc`)
// ---------------------------------------------------------------------------
const marcaSimple = z.object({ type: z.enum(MARCAS) }).strict();
const marcaEstilo = z
  .object({
    type: z.literal('textStyle'),
    attrs: z
      .object({ fontFamily: z.enum(FUENTES).nullish(), fontSize: z.enum(TAMANOS).nullish() })
      .strict()
      .optional(),
  })
  .strict();
const marca = z.union([marcaSimple, marcaEstilo]);
const texto = z
  .object({
    type: z.literal('text'),
    text: z.string().max(LIMITES.textoTotal * 2),
    marks: z.array(marca).max(4).optional(),
  })
  .strict();
const salto = z.object({ type: z.literal('hardBreak') }).strict();
/** Campo automático (Fase 2): nodo atómico; la clave se valida contra el catálogo del tipo en el servicio. */
const campo = z
  .object({
    type: z.literal('campo'),
    attrs: z.object({ clave: z.enum(CLAVES_CAMPO) }).strict(),
    marks: z.array(marca).max(4).optional(),
  })
  .strict();
const inline = z.union([texto, salto, campo]);

const parrafo = z
  .object({
    type: z.literal('paragraph'),
    attrs: z.object({ textAlign: z.enum(ALINEACIONES).nullish() }).strict().optional(),
    content: z.array(inline).max(LIMITES.nodosPorZona).optional(),
  })
  .strict();

// Tiptap emite en orderedList `start` (y en versiones nuevas `type: null`).
const attrsOrdenada = z
  .object({
    start: z.number().int().min(1).max(999).optional(),
    type: z.null().optional(),
  })
  .strict()
  .optional();

const item: z.ZodTypeAny = z.lazy(() =>
  z
    .object({
      type: z.literal('listItem'),
      content: z.array(z.union([parrafo, listaVi, listaNum])).min(1).max(50),
    })
    .strict(),
);
const listaVi: z.ZodTypeAny = z.lazy(() =>
  z
    .object({ type: z.literal('bulletList'), content: z.array(item).min(1).max(100) })
    .strict(),
);
const listaNum: z.ZodTypeAny = z.lazy(() =>
  z
    .object({
      type: z.literal('orderedList'),
      attrs: attrsOrdenada,
      content: z.array(item).min(1).max(100),
    })
    .strict(),
);

const docSchema = z
  .object({
    type: z.literal('doc'),
    content: z.array(z.union([parrafo, listaVi, listaNum])).min(1).max(LIMITES.nodosPorZona),
  })
  .strict();

type Nodo = {
  type: string;
  text?: string;
  marks?: { type: string; attrs?: { fontFamily?: string | null; fontSize?: string | null } }[];
  attrs?: Record<string, unknown>;
  content?: Nodo[];
};

function sanearMarcas(marks: NonNullable<Nodo['marks']> | undefined): NonNullable<Nodo['marks']> {
  const marcas: NonNullable<Nodo['marks']> = [];
  for (const m of marks ?? []) {
    if (marcas.some((x) => x.type === m.type)) continue;
    if (m.type === 'textStyle') {
      const attrs: { fontFamily?: string; fontSize?: string } = {};
      if (m.attrs?.fontFamily) attrs.fontFamily = m.attrs.fontFamily;
      if (m.attrs?.fontSize) attrs.fontSize = m.attrs.fontSize;
      // textStyle sin fuente ni tamaño no aporta nada: se descarta.
      if (Object.keys(attrs).length) marcas.push({ type: 'textStyle', attrs });
    } else marcas.push({ type: m.type });
  }
  return marcas;
}

/** Copia SANEADA del árbol: texto limpio, sin nodos de texto vacíos, atributos solo los permitidos. */
function sanearNodo(n: Nodo): Nodo | null {
  if (n.type === 'text') {
    const t = sanearTexto(n.text ?? '');
    if (!t) return null;
    const out: Nodo = { type: 'text', text: t };
    const marcas = sanearMarcas(n.marks);
    if (marcas.length) out.marks = marcas;
    return out;
  }
  if (n.type === 'campo') {
    // Solo `clave` (ya validada contra la lista cerrada) y sus marcas.
    const out: Nodo = { type: 'campo', attrs: { clave: n.attrs?.['clave'] } };
    const marcas = sanearMarcas(n.marks);
    if (marcas.length) out.marks = marcas;
    return out;
  }
  const out: Nodo = { type: n.type };
  if (n.type === 'paragraph' && n.attrs?.['textAlign'])
    out.attrs = { textAlign: n.attrs['textAlign'] };
  if (n.type === 'orderedList' && typeof n.attrs?.['start'] === 'number' && n.attrs['start'] !== 1)
    out.attrs = { start: n.attrs['start'] };
  if (n.content) {
    const hijos = n.content.map(sanearNodo).filter((h): h is Nodo => h !== null);
    // Un párrafo sin texto queda sin `content` (así lo emite ProseMirror).
    if (hijos.length || n.type !== 'paragraph') out.content = hijos;
  }
  return out;
}

/** Claves de campo usadas en las tres zonas (sin repetir). */
export function clavesUsadas(c: ContenidoPlantilla): string[] {
  const set = new Set<string>();
  const rec = (n: Nodo): void => {
    if (n.type === 'campo' && typeof n.attrs?.['clave'] === 'string') set.add(n.attrs['clave']);
    for (const h of n.content ?? []) rec(h);
  };
  rec(c.encabezado);
  rec(c.cuerpo);
  rec(c.pie);
  return [...set];
}

function medir(n: Nodo, prof: number, acc: { nodos: number; prof: number; texto: number }): void {
  acc.nodos++;
  acc.prof = Math.max(acc.prof, prof);
  if (n.type === 'text') acc.texto += n.text?.length ?? 0;
  for (const h of n.content ?? []) medir(h, prof + 1, acc);
}

export const doc = docSchema;

/** Cada nodo ocupa ~2 niveles JSON (objeto + arreglo `content`); holgura sobre `LIMITES.profundidad`. */
const MAX_PROFUNDIDAD_JSON = LIMITES.profundidad * 2 + 8;

/** `true` si el valor JSON anida objetos/arreglos más de `max` niveles. Sin recursión. */
export function excedeProfundidad(raiz: unknown, max: number): boolean {
  const pila: [unknown, number][] = [[raiz, 1]];
  while (pila.length) {
    const [v, d] = pila.pop()!;
    if (v === null || typeof v !== 'object') continue;
    if (d > max) return true;
    for (const h of Array.isArray(v) ? v : Object.values(v)) pila.push([h, d + 1]);
  }
  return false;
}

const contenidoBase = z
  .object({
    encabezado: docSchema,
    cuerpo: docSchema,
    pie: docSchema,
    logoAncho: z
      .number()
      .int()
      .refine((v) => (LOGO_ANCHOS as readonly number[]).includes(v), 'Ancho de logo no permitido.')
      .optional(),
  })
  .strict();

export type ContenidoPlantilla = {
  encabezado: Nodo;
  cuerpo: Nodo;
  pie: Nodo;
  logoAncho?: number;
};

/**
 * `contenido` validado (forma cerrada) y SANEADO. El resultado es lo que se guarda.
 * Límites: texto total ≤ 20 000, profundidad ≤ 8 y ≤ 500 nodos por zona.
 */
export const contenidoSchema = z
  .unknown()
  .superRefine((v, ctx) => {
    // L2: se mide la profundidad de forma ITERATIVA antes de validar con Zod (la validación
    // recursiva de las listas desbordaría la pila con miles de niveles → 500).
    if (excedeProfundidad(v, MAX_PROFUNDIDAD_JSON))
      ctx.addIssue({
        code: 'custom',
        message: `Listas demasiado anidadas (máx. profundidad ${LIMITES.profundidad}).`,
        fatal: true,
      });
  })
  .pipe(contenidoBase)
  .transform((c, ctx): ContenidoPlantilla => {
  const zonas = ['encabezado', 'cuerpo', 'pie'] as const;
  const out = {} as ContenidoPlantilla;
  let textoTotal = 0;
  for (const z of zonas) {
    const limpia = sanearNodo(c[z] as Nodo)!;
    // Un doc sin contenido (todo era texto vacío) se normaliza a un párrafo vacío.
    if (!limpia.content?.length) limpia.content = [{ type: 'paragraph' }];
    const acc = { nodos: 0, prof: 0, texto: 0 };
    medir(limpia, 1, acc);
    if (acc.nodos > LIMITES.nodosPorZona)
      ctx.addIssue({ code: 'custom', path: [z], message: `Demasiados elementos en ${z} (máx. ${LIMITES.nodosPorZona}).` });
    if (acc.prof > LIMITES.profundidad)
      ctx.addIssue({ code: 'custom', path: [z], message: `Listas demasiado anidadas en ${z} (máx. profundidad ${LIMITES.profundidad}).` });
    textoTotal += acc.texto;
    out[z] = limpia;
  }
  if (textoTotal > LIMITES.textoTotal)
    ctx.addIssue({ code: 'custom', path: [], message: `El texto supera ${LIMITES.textoTotal} caracteres.` });
  if (c.logoAncho !== undefined) out.logoAncho = c.logoAncho;
  return out;
});

// ---------------------------------------------------------------------------
// Bodies
// ---------------------------------------------------------------------------
const nombre = linea(120).pipe(z.string().min(1, 'El nombre es obligatorio.'));

export const crearPlantillaSchema = z
  .object({
    tipo: z.enum(TIPOS_PLANTILLA),
    nombre,
    descripcion: linea(400).nullish(),
    contenido: contenidoSchema,
    nota: linea(200).nullish(),
  })
  .strict();
export type CrearPlantillaDto = z.infer<typeof crearPlantillaSchema>;

export const guardarPlantillaSchema = z
  .object({
    nombre: nombre.optional(),
    descripcion: linea(400).nullish(),
    contenido: contenidoSchema,
    versionBase: z.number().int().min(1),
    nota: linea(200).nullish(),
  })
  .strict();
export type GuardarPlantillaDto = z.infer<typeof guardarPlantillaSchema>;

export const bajaPlantillaSchema = z
  .object({
    motivo: linea(400).pipe(
      z.string().min(LIMITES.motivoMin, `El motivo debe tener al menos ${LIMITES.motivoMin} caracteres.`),
    ),
  })
  .strict();
export type BajaPlantillaDto = z.infer<typeof bajaPlantillaSchema>;

/** Restaurar una versión anterior como versión NUEVA (nunca sobrescribe). */
export const restaurarVersionSchema = z
  .object({
    version: z.number().int().min(1).max(1_000_000),
    versionBase: z.number().int().min(1).max(1_000_000),
    nota: linea(200).nullish(),
  })
  .strict();
export type RestaurarVersionDto = z.infer<typeof restaurarVersionSchema>;

/** `:n` de la ruta: entero ≥ 1 en texto (rechaza `1.5`, `-1`, `abc`, `1e3`, `0`). */
export const numeroVersionSchema = z
  .string()
  .regex(/^[1-9]\d{0,8}$/, 'Número de versión inválido.')
  .transform(Number);

export const tipoPlantillaSchema = z.enum(TIPOS_PLANTILLA);

export const idPlantillaSchema = z.string().uuid('Identificador de plantilla inválido.');

export const listarPlantillasQuerySchema = z
  .object({ incluirBajas: z.enum(['true', 'false', '1', '0']).optional() })
  .strict();
