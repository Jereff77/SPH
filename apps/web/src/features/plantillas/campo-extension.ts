import { mergeAttributes, Node } from '@tiptap/react';

/** Etiquetas locales de las claves del catálogo (para pintar el chip sin esperar al API). */
export const ETIQUETAS_CAMPO: Record<string, string> = {
  empresa: 'Empresa',
  parque: 'Parque',
  naves: 'Naves',
  kvas_por_nave: 'KVA por nave',
  nivel: 'Nivel de tensión',
  fecha: 'Fecha',
};

/**
 * Campo automático: nodo inline atómico (se borra de una pieza con Backspace).
 * Se guarda como `{ type: 'campo', attrs: { clave } }`; el servidor lo sustituye
 * por el texto resuelto al generar el documento.
 */
export const Campo = Node.create({
  name: 'campo',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      clave: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-campo') ?? '',
        renderHTML: (attrs: Record<string, unknown>) => ({ 'data-campo': String(attrs.clave ?? '') }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-campo]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const clave = String(node.attrs.clave ?? '');
    const etiqueta = ETIQUETAS_CAMPO[clave];
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: etiqueta ? 'campo-chip' : 'campo-chip campo-chip--desconocido',
        contenteditable: 'false',
        title: etiqueta ? `Campo automático: ${etiqueta}` : `Campo desconocido: ${clave}`,
      }),
      etiqueta ?? `⚠ ${clave}`,
    ];
  },

  renderText({ node }) {
    return `[${ETIQUETAS_CAMPO[String(node.attrs.clave ?? '')] ?? String(node.attrs.clave ?? '')}]`;
  },
});
