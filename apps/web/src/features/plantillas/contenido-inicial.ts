import type { ContenidoPlantilla, DocJson } from './plantillas.api';

type Alin = 'left' | 'center' | 'right' | 'justify';

const t = (text: string, bold = false) =>
  bold ? { type: 'text', text, marks: [{ type: 'bold' }] } : { type: 'text', text };

const p = (alin: Alin, ...nodos: unknown[]) => ({
  type: 'paragraph',
  attrs: { textAlign: alin },
  ...(nodos.length ? { content: nodos } : {}),
});

const br = { type: 'hardBreak' };

const doc = (...content: unknown[]): DocJson => ({ type: 'doc', content });

/** Texto de arranque de una plantilla nueva (carta «Asignación de Carga»). */
export function contenidoInicial(): ContenidoPlantilla {
  return {
    encabezado: doc(
      p(
        'right',
        t('Grupo SPH', true),
        br,
        t('Lic. Manuel Gómez Morín, piso 11, oficina 11A,'),
        br,
        t('76090, Centro Sur, Qro.'),
        br,
        t('www.gruposph.mx · 442 286 7180'),
      ),
    ),
    cuerpo: doc(
      p('right', t('Asunto: Asignación de Carga', true)),
      p('right', t('Santiago de Querétaro, Querétaro. A ____ de ____________ de 20____', true)),
      p('left'),
      p(
        'left',
        t('Ing. Jose Rene Garcia Alcantar', true),
        br,
        t('Jefe de departamento de planeación Superintendente de Zona Querétaro,', true),
        br,
        t('Comisión Federal de Electricidad División Bajío', true),
        br,
        t('Zona Querétaro', true),
      ),
      p('left'),
      p(
        'justify',
        t('El que suscribe '),
        t('ALMADELIA GALINDO MENA', true),
        t(
          ' en calidad de apoderado legal de la persona moral denominada Grupo SPH SA de CV, propietario del derecho de uso de energía otorgado mediante el Oficio 1721/2024, y con numero de solicitud 000001660/2024 con fecha 2024.09.21 y con nombre ',
        ),
        t('Grupo SPH SA de CV (Parque Industrial [PARQUE])', true),
        t('.'),
      ),
      p(
        'justify',
        t('Comparezco ante usted para manifestar que la empresa '),
        t('[NOMBRE DE LA EMPRESA]', true),
        t(' con número de '),
        t('Nave [NÚMEROS DE NAVE]', true),
        t(
          ' ubicada al interior del parque con ubicación en Calle Puerto Rico 202, tiene autorización para hacer efectivo el uso de energía por la calidad de ',
        ),
        t('[CANTIDAD] KVAS en baja tensión', true),
        t(
          ', en cada una de las naves mencionadas para que sea conectado eléctricamente de nuestra infraestructura; lo anterior derivado a que la persona citada llevará a cabo una ',
        ),
        t('ACOMETIDA PARTICULAR', true),
        t('.'),
      ),
    ),
    pie: doc(p('center', t('Grupo SPH · www.gruposph.mx'))),
  };
}

/** ¿El documento no tiene texto? (para validar «La plantilla no tiene texto.») */
export function docSinTexto(d: DocJson): boolean {
  const recorre = (n: unknown): boolean => {
    if (!n || typeof n !== 'object') return false;
    const o = n as { type?: string; text?: string; content?: unknown[] };
    if (o.type === 'text' && o.text && o.text.trim()) return true;
    return (o.content ?? []).some(recorre);
  };
  return !recorre(d);
}
