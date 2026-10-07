import { z } from 'zod';

/**
 * Plantillas de documentos de KVA's · VERSION LIGHT.
 * `contenido` = { encabezado, cuerpo, pie }; cada zona es un Doc de Tiptap/ProseMirror
 * con un esquema CERRADO: nodos doc, paragraph, text, hardBreak, bulletList, orderedList,
 * listItem · marcas bold, italic, underline · atributo textAlign solo en paragraph.
 * Lo que se guarda es el resultado SANEADO (nunca el crudo del cliente).
 */

export const TIPOS_PLANTILLA = ['ASIGNACION_CARGA', 'DEVOLUCION'] as const;
export type TipoPlantilla = (typeof TIPOS_PLANTILLA)[number];

export const MARCAS = ['bold', 'italic', 'underline'] as const;
export const ALINEACIONES = ['left', 'center', 'right', 'justify'] as const;

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
const marca = z.object({ type: z.enum(MARCAS) }).strict();
const texto = z
  .object({
    type: z.literal('text'),
    text: z.string().max(LIMITES.textoTotal * 2),
    marks: z.array(marca).max(3).optional(),
  })
  .strict();
const salto = z.object({ type: z.literal('hardBreak') }).strict();
const inline = z.union([texto, salto]);

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
  marks?: { type: string }[];
  attrs?: Record<string, unknown>;
  content?: Nodo[];
};

/** Copia SANEADA del árbol: texto limpio, sin nodos de texto vacíos, atributos solo los permitidos. */
function sanearNodo(n: Nodo): Nodo | null {
  if (n.type === 'text') {
    const t = sanearTexto(n.text ?? '');
    if (!t) return null;
    const out: Nodo = { type: 'text', text: t };
    if (n.marks?.length) out.marks = [...new Set(n.marks.map((m) => m.type))].map((type) => ({ type }));
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

function medir(n: Nodo, prof: number, acc: { nodos: number; prof: number; texto: number }): void {
  acc.nodos++;
  acc.prof = Math.max(acc.prof, prof);
  if (n.type === 'text') acc.texto += n.text?.length ?? 0;
  for (const h of n.content ?? []) medir(h, prof + 1, acc);
}

export const doc = docSchema;

const contenidoBase = z
  .object({ encabezado: docSchema, cuerpo: docSchema, pie: docSchema })
  .strict();

export type ContenidoPlantilla = {
  encabezado: Nodo;
  cuerpo: Nodo;
  pie: Nodo;
};

/**
 * `contenido` validado (forma cerrada) y SANEADO. El resultado es lo que se guarda.
 * Límites: texto total ≤ 20 000, profundidad ≤ 8 y ≤ 500 nodos por zona.
 */
export const contenidoSchema = contenidoBase.transform((c, ctx): ContenidoPlantilla => {
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

export const idPlantillaSchema = z.string().uuid('Identificador de plantilla inválido.');

export const listarPlantillasQuerySchema = z
  .object({ incluirBajas: z.enum(['true', 'false', '1', '0']).optional() })
  .strict();
