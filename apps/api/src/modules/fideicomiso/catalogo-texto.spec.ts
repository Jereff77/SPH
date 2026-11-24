import { claveCatalogo, limpiarTexto, resolverAltaCatalogo, type FilaCatalogo } from './catalogo-texto';

const fila = (
  tipo: string,
  concepto: string,
  subconcepto: string | null,
  descripcion: string | null,
  orden_tipo: number | null = 3,
  orden_concepto: number | null = 3,
): FilaCatalogo => ({ tipo, concepto, subconcepto, descripcion, orden_tipo, orden_concepto });

const CATALOGO: FilaCatalogo[] = [
  fila('EGRESOS MENSUALES', 'PAGO DE DESARROLLO', ' ', 'Gestoria'),
  fila('EGRESOS MENSUALES', 'PAGO DE DESARROLLO', 'HOPI', null, 99, 99),
  fila('EGRESOS MENSUALES', 'CONTABILIDAD', 'RUY', 'Honorarios', 3, 4),
  fila('FIJOS', 'MONTO ADHESIONES COBRADAS', '', null, 1, 1),
];

const alta = (o: Partial<Parameters<typeof resolverAltaCatalogo>[1]>) =>
  resolverAltaCatalogo(CATALOGO, { tipo: '', concepto: '', ordenTipo: 99, ordenConcepto: 99, ...o });

describe('claveCatalogo', () => {
  it('ignora mayúsculas, acentos y espacios repetidos', () => {
    expect(claveCatalogo('  Retención   de ISR ')).toBe('retencion de isr');
  });
  it('trata vacío, null, espacio suelto y guion como el mismo hueco', () => {
    expect(claveCatalogo(null)).toBe('');
    expect(claveCatalogo('')).toBe('');
    expect(claveCatalogo(' ')).toBe('');
    expect(claveCatalogo('-')).toBe('');
  });
});

describe('limpiarTexto', () => {
  it('quita espacios de los bordes y repetidos', () => {
    expect(limpiarTexto('  Jaza   (Constructor) ')).toBe('Jaza (Constructor)');
  });
});

describe('resolverAltaCatalogo', () => {
  it('reutiliza la escritura existente aunque lleguen otras mayúsculas/acentos', () => {
    const r = alta({ tipo: 'egresos  mensuales', concepto: 'pago de desarrollo', subconcepto: 'hopi', descripcion: 'Nueva' });
    expect(r.tipo).toBe('EGRESOS MENSUALES');
    expect(r.concepto).toBe('PAGO DE DESARROLLO');
    expect(r.subconcepto).toBe('HOPI');
    expect(r.descripcion).toBe('Nueva');
    expect(r.duplicadoDe).toBeNull();
  });

  it('hereda el orden del Tipo y del Concepto existentes (usa el mínimo) e ignora el enviado', () => {
    const r = alta({ tipo: 'EGRESOS MENSUALES', concepto: 'PAGO DE DESARROLLO', subconcepto: 'Nuevo', ordenTipo: 50, ordenConcepto: 60 });
    // Las filas de PAGO DE DESARROLLO traen 3 y 99 → manda el 3.
    expect(r.ordenTipo).toBe(3);
    expect(r.ordenConcepto).toBe(3);
  });

  it('un concepto nuevo en un tipo existente usa el orden enviado para el concepto y hereda el del tipo', () => {
    const r = alta({ tipo: 'EGRESOS MENSUALES', concepto: 'HONORARIOS NUEVOS', ordenTipo: 50, ordenConcepto: 40 });
    expect(r.ordenTipo).toBe(3);
    expect(r.ordenConcepto).toBe(40);
    expect(r.concepto).toBe('HONORARIOS NUEVOS');
  });

  it('un tipo nuevo usa los órdenes enviados y limpia los espacios', () => {
    const r = alta({ tipo: '  OTROS   INGRESOS ', concepto: 'X', ordenTipo: 7, ordenConcepto: 8 });
    expect(r.tipo).toBe('OTROS INGRESOS');
    expect(r.ordenTipo).toBe(7);
    expect(r.ordenConcepto).toBe(8);
  });

  it('detecta duplicado con otra escritura (mayúsculas y espacios)', () => {
    const r = alta({ tipo: 'EGRESOS MENSUALES', concepto: 'contabilidad', subconcepto: ' ruy ', descripcion: 'HONORARIOS' });
    expect(r.duplicadoDe).not.toBeNull();
    expect(r.duplicadoDe?.concepto).toBe('CONTABILIDAD');
  });

  it('detecta duplicado cuando no hay descripción (antes se comparaba "" contra NULL y no lo veía)', () => {
    const r = alta({ tipo: 'EGRESOS MENSUALES', concepto: 'PAGO DE DESARROLLO', subconcepto: 'HOPI' });
    expect(r.duplicadoDe).not.toBeNull();
    expect(r.descripcion).toBeNull();
  });

  it('un subconcepto vacío equivale al hueco heredado (" " o "-")', () => {
    const r = alta({ tipo: 'EGRESOS MENSUALES', concepto: 'PAGO DE DESARROLLO', descripcion: 'gestoria' });
    expect(r.duplicadoDe?.descripcion).toBe('Gestoria');
    expect(r.subconcepto).toBe('');
  });

  it('un typo NO se reconoce como existente: el aviso "¿Quisiste decir…?" es de la pantalla', () => {
    const r = alta({ tipo: 'EGRESOS MENSUALES', concepto: 'PAGO DESARROLLO', subconcepto: 'HOPI' });
    expect(r.concepto).toBe('PAGO DESARROLLO');
    expect(r.duplicadoDe).toBeNull();
  });
});
