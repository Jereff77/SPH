import { KbService } from './kb.service.js';

/**
 * Test del router de la Base de Conocimiento (RAG fase 1).
 *
 * Verifica que el enrutamiento por palabras clave selecciona los documentos
 * correctos para preguntas reales (usando las `palabras_clave` del frontmatter).
 * Requiere que la carpeta `version2/base-conocimiento/` sea alcanzable (lo es
 * desde el árbol del repo; KbService la resuelve hacia arriba).
 *
 * Nota: el proyecto aún no tiene runner de pruebas configurado (ver HANDOFF §8).
 * Para una verificación inmediata sin Jest, usar `scripts/verificar-kb.mjs`.
 */
describe('KbService (router de la KB)', () => {
  let kb: KbService;

  beforeAll(() => {
    kb = new KbService();
    kb.cargar();
  });

  it('carga los documentos de módulo con su frontmatter', () => {
    const mods = kb.modulos();
    expect(mods.length).toBeGreaterThan(5);
    const cxp = mods.find((m) => m.archivo === 'cxp');
    expect(cxp).toBeDefined();
    expect(cxp!.palabrasClave.length).toBeGreaterThan(0);
    expect(cxp!.rutas.some((r) => r.startsWith('/cxp'))).toBe(true);
  });

  it('rutea "¿cómo apruebo una solicitud de pago?" a CxP', () => {
    const sel = kb.seleccionar('¿cómo apruebo una solicitud de pago?');
    expect(sel.modulos).toContain('cxp');
    expect(sel.contenido.length).toBeGreaterThan(0);
  });

  it('rutea preguntas de permisos/Claves SAT a Configuraciones', () => {
    const sel = kb.seleccionar('¿por qué no veo la pestaña de Claves SAT?');
    expect(sel.modulos).toContain('configuraciones');
  });

  it('usa la ruta actual como señal de contexto fuerte', () => {
    const sel = kb.seleccionar('no me deja guardar', '/arrendatarios/planes');
    expect(sel.modulos).toContain('arrendatarios');
  });

  it('devuelve vacío sin coincidencias ni ruta', () => {
    const sel = kb.seleccionar('zzz qwerty asdf 12345 sin relación');
    expect(sel.modulos.length).toBe(0);
  });
});
