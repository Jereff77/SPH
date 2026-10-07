import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { Logo } from '@/components/Logo';
import type { ContenidoPlantilla, DocJson } from './plantillas.api';
import { IconLapiz } from './iconos';
import './plantillas.css';

export type Zona = 'encabezado' | 'cuerpo' | 'pie';

/** Solo lo permitido por el contrato: párrafo, salto, listas, negrita/cursiva/subrayado y alineación. */
const extensiones = () => [
  StarterKit.configure({
    blockquote: false,
    code: false,
    codeBlock: false,
    heading: false,
    horizontalRule: false,
    strike: false,
    link: false,
    trailingNode: false,
  }),
  TextAlign.configure({ types: ['paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
];

export interface EditoresHoja {
  editores: Record<Zona, Editor | null>;
  activo: Editor | null;
  leer: () => ContenidoPlantilla | null;
  cargar: (c: ContenidoPlantilla) => void;
}

/**
 * Crea los tres editores (encabezado, cuerpo, pie) de una hoja. La barra de
 * formato actúa sobre el que tenga el foco (el último enfocado).
 */
export function useEditoresHoja(
  inicial: ContenidoPlantilla,
  editable: boolean,
  onCambio?: () => void,
): EditoresHoja {
  const [activo, setActivo] = useState<Editor | null>(null);
  const cambioRef = useRef(onCambio);
  cambioRef.current = onCambio;

  const comun = {
    extensions: extensiones(),
    editable,
    immediatelyRender: true,
    editorProps: {
      attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Texto del documento' },
    },
    onFocus: ({ editor }: { editor: Editor }) => setActivo(editor),
    onUpdate: () => cambioRef.current?.(),
  };

  const encabezado = useEditor({ ...comun, content: inicial.encabezado });
  const cuerpo = useEditor({ ...comun, content: inicial.cuerpo });
  const pie = useEditor({ ...comun, content: inicial.pie });

  useEffect(() => {
    // 2.º parámetro `false`: cambiar editable NO es una edición. Sin él, Tiptap emite
    // `update` y el editor se marcaba «sin guardar» justo después de guardar.
    for (const e of [encabezado, cuerpo, pie]) e?.setEditable(editable, false);
  }, [editable, encabezado, cuerpo, pie]);

  const leer = useCallback((): ContenidoPlantilla | null => {
    if (!encabezado || !cuerpo || !pie) return null;
    return {
      encabezado: encabezado.getJSON() as DocJson,
      cuerpo: cuerpo.getJSON() as DocJson,
      pie: pie.getJSON() as DocJson,
    };
  }, [encabezado, cuerpo, pie]);

  const cargar = useCallback(
    (c: ContenidoPlantilla) => {
      encabezado?.commands.setContent(c.encabezado, { emitUpdate: false });
      cuerpo?.commands.setContent(c.cuerpo, { emitUpdate: false });
      pie?.commands.setContent(c.pie, { emitUpdate: false });
    },
    [encabezado, cuerpo, pie],
  );

  return { editores: { encabezado, cuerpo, pie }, activo: activo ?? cuerpo, leer, cargar };
}

/** Datos de impresión: HTML ya generado por el esquema de Tiptap (no HTML libre). */
export function htmlDeHoja(h: EditoresHoja): { encabezado: string; cuerpo: string; pie: string } {
  return {
    encabezado: h.editores.encabezado?.getHTML() ?? '',
    cuerpo: h.editores.cuerpo?.getHTML() ?? '',
    pie: h.editores.pie?.getHTML() ?? '',
  };
}

function EtiquetaZona({ texto }: { texto: string }) {
  return (
    <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
      <IconLapiz width={10} height={10} />
      {texto}
    </span>
  );
}

/** Hoja tipo carta con tres zonas editables. */
export function HojaDocumento({
  hoja,
  editable,
}: {
  hoja: EditoresHoja;
  editable: boolean;
}) {
  const { editencabezado, editcuerpo, editpie } = {
    editencabezado: hoja.editores.encabezado,
    editcuerpo: hoja.editores.cuerpo,
    editpie: hoja.editores.pie,
  };
  const marco = (e: Editor | null) =>
    `rounded transition-colors ${
      editable
        ? `border border-dashed border-transparent hover:border-indigo-200 ${
            e && hoja.activo === e ? 'border-indigo-300 bg-indigo-50/30' : ''
          }`
        : ''
    }`;

  return (
    <div
      id="hoja-documento"
      className="hoja-doc mx-auto flex w-[660px] max-w-full flex-col border border-gray-200 bg-white px-10 py-8 shadow-sm"
      style={{ minHeight: 854 }}
    >
      {/* ENCABEZADO */}
      <div>
        {editable && <EtiquetaZona texto="Encabezado · editable" />}
        <div className="flex items-start justify-between gap-4 pb-3">
          <div className="w-[170px] shrink-0 overflow-hidden">
            <Logo />
          </div>
          <div className={`min-w-0 flex-1 text-[10px] leading-snug ${marco(editencabezado)}`}>
            <EditorContent editor={editencabezado} />
          </div>
        </div>
        <div className="h-0.5 w-full bg-[#1f2a4d]" />
      </div>

      {/* CUERPO */}
      <div className="flex-1 py-5">
        {editable && <EtiquetaZona texto="Cuerpo · editable" />}
        <div className={`min-h-[500px] ${marco(editcuerpo)}`}>
          <EditorContent editor={editcuerpo} />
        </div>
      </div>

      {/* PIE */}
      <div>
        <div className="mb-2 h-px w-full bg-gray-300" />
        {editable && <EtiquetaZona texto="Pie de página · editable" />}
        <div className={`text-[10px] text-gray-600 ${marco(editpie)}`}>
          <EditorContent editor={editpie} />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Barra de formato ---------------- */

function Boton({
  titulo,
  activo,
  deshabilitado,
  onClick,
  children,
}: {
  titulo: string;
  activo?: boolean;
  deshabilitado?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      aria-pressed={activo}
      disabled={deshabilitado}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded text-sm transition-colors disabled:opacity-30 ${
        activo ? 'bg-blue-100 text-[#1f2a4d]' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px shrink-0 bg-gray-200" aria-hidden />;

const trazo = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function IconAlin({ tipo }: { tipo: 'left' | 'center' | 'right' | 'justify' }) {
  const l = {
    left: [[4, 20], [4, 14], [4, 20], [4, 12]],
    center: [[4, 20], [7, 17], [4, 20], [8, 16]],
    right: [[4, 20], [10, 20], [4, 20], [12, 20]],
    justify: [[4, 20], [4, 20], [4, 20], [4, 20]],
  }[tipo];
  return (
    <svg {...trazo} aria-hidden>
      {l.map(([x1, x2], i) => (
        <line key={i} x1={x1} x2={x2} y1={6 + i * 4} y2={6 + i * 4} />
      ))}
    </svg>
  );
}

/* ---------------- Zoom de la hoja (solo pantalla; no afecta la impresión) ---------------- */

export const NIVELES_ZOOM = [75, 90, 100, 125, 150, 175, 200] as const;
const CLAVE_ZOOM = 'plantillas.zoom';

/** Nivel de zoom de la hoja, recordado en este navegador (comodidad por persona). */
export function useZoomHoja(): [number, (z: number) => void] {
  const [zoom, setZoom] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem(CLAVE_ZOOM));
      return (NIVELES_ZOOM as readonly number[]).includes(v) ? v : 100;
    } catch {
      return 100;
    }
  });
  const fijar = useCallback((z: number) => {
    setZoom(z);
    try {
      localStorage.setItem(CLAVE_ZOOM, String(z));
    } catch {
      /* sin almacenamiento: el zoom vale solo para esta sesión */
    }
  }, []);
  return [zoom, fijar];
}

/** Envuelve la hoja aplicando el zoom elegido (el contenedor padre hace scroll). */
export function ZoomHoja({ zoom, children }: { zoom: number; children: React.ReactNode }) {
  return <div style={{ zoom: zoom / 100 }}>{children}</div>;
}

function ControlZoom({ zoom, onZoom }: { zoom: number; onZoom: (z: number) => void }) {
  const niveles = NIVELES_ZOOM as readonly number[];
  const i = Math.max(0, niveles.indexOf(zoom));
  return (
    <div className="ml-auto flex shrink-0 items-center gap-1 pl-3" role="group" aria-label="Zoom de la hoja">
      <Boton titulo="Alejar" deshabilitado={i <= 0} onClick={() => onZoom(niveles[Math.max(0, i - 1)] ?? 100)}>
        <svg {...trazo}><circle cx="11" cy="11" r="7" /><line x1="21" x2="16.5" y1="21" y2="16.5" /><line x1="8" x2="14" y1="11" y2="11" /></svg>
      </Boton>
      <button
        type="button"
        title="Volver a 100 %"
        aria-label={`Zoom ${zoom} %. Volver a 100 %`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onZoom(100)}
        className="min-w-[3.5rem] rounded px-1 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
      >
        {zoom} %
      </button>
      <Boton titulo="Acercar" deshabilitado={i >= niveles.length - 1} onClick={() => onZoom(niveles[Math.min(niveles.length - 1, i + 1)] ?? 100)}>
        <svg {...trazo}><circle cx="11" cy="11" r="7" /><line x1="21" x2="16.5" y1="21" y2="16.5" /><line x1="8" x2="14" y1="11" y2="11" /><line x1="11" x2="11" y1="8" y2="14" /></svg>
      </Boton>
    </div>
  );
}

export function BarraFormato({
  editor,
  habilitada,
  zoom,
  onZoom,
}: {
  editor: Editor | null;
  habilitada: boolean;
  zoom?: number;
  onZoom?: (z: number) => void;
}) {
  const est = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      negrita: e?.isActive('bold') ?? false,
      cursiva: e?.isActive('italic') ?? false,
      subrayado: e?.isActive('underline') ?? false,
      lista: e?.isActive('bulletList') ?? false,
      izq: e?.isActive({ textAlign: 'left' }) ?? false,
      cen: e?.isActive({ textAlign: 'center' }) ?? false,
      der: e?.isActive({ textAlign: 'right' }) ?? false,
      jus: e?.isActive({ textAlign: 'justify' }) ?? false,
      puedeDeshacer: e?.can().undo() ?? false,
      puedeRehacer: e?.can().redo() ?? false,
    }),
  });
  const c = () => editor?.chain().focus();
  const off = !habilitada || !editor;

  return (
    <div
      role="toolbar"
      aria-label="Formato de texto"
      className="scrollbar-hide flex items-center gap-0.5 overflow-x-auto border-b border-gray-200 bg-white px-3 py-1.5"
    >
      <Boton titulo="Deshacer (Ctrl+Z)" deshabilitado={off || !est?.puedeDeshacer} onClick={() => c()?.undo().run()}>
        <svg {...trazo}><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
      </Boton>
      <Boton titulo="Rehacer (Ctrl+Shift+Z)" deshabilitado={off || !est?.puedeRehacer} onClick={() => c()?.redo().run()}>
        <svg {...trazo}><path d="m15 14 5-5-5-5" /><path d="M20 9H10a6 6 0 0 0 0 12h3" /></svg>
      </Boton>
      <Sep />
      <Boton titulo="Negrita (Ctrl+B)" activo={est?.negrita} deshabilitado={off} onClick={() => c()?.toggleBold().run()}>
        <span className="font-bold">B</span>
      </Boton>
      <Boton titulo="Cursiva (Ctrl+I)" activo={est?.cursiva} deshabilitado={off} onClick={() => c()?.toggleItalic().run()}>
        <span className="italic">I</span>
      </Boton>
      <Boton titulo="Subrayado (Ctrl+U)" activo={est?.subrayado} deshabilitado={off} onClick={() => c()?.toggleUnderline().run()}>
        <span className="underline">U</span>
      </Boton>
      <Sep />
      <Boton titulo="Alinear a la izquierda" activo={est?.izq} deshabilitado={off} onClick={() => c()?.setTextAlign('left').run()}>
        <IconAlin tipo="left" />
      </Boton>
      <Boton titulo="Centrar" activo={est?.cen} deshabilitado={off} onClick={() => c()?.setTextAlign('center').run()}>
        <IconAlin tipo="center" />
      </Boton>
      <Boton titulo="Alinear a la derecha" activo={est?.der} deshabilitado={off} onClick={() => c()?.setTextAlign('right').run()}>
        <IconAlin tipo="right" />
      </Boton>
      <Boton titulo="Justificar" activo={est?.jus} deshabilitado={off} onClick={() => c()?.setTextAlign('justify').run()}>
        <IconAlin tipo="justify" />
      </Boton>
      <Sep />
      <Boton titulo="Lista con viñetas" activo={est?.lista} deshabilitado={off} onClick={() => c()?.toggleBulletList().run()}>
        <svg {...trazo}>
          <line x1="9" x2="20" y1="6" y2="6" /><line x1="9" x2="20" y1="12" y2="12" /><line x1="9" x2="20" y1="18" y2="18" />
          <circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" />
        </svg>
      </Boton>
      {zoom !== undefined && onZoom && <ControlZoom zoom={zoom} onZoom={onZoom} />}
    </div>
  );
}
