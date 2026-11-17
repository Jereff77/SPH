import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { coincideExacto, etiquetaTipoSolicitud, normalizarTexto, TIPOS_SOLICITUD } from './reportes-util.ts';

describe('coincideExacto: el filtro del reporte es por igualdad, no por «contiene»', () => {
  it('«Acupark II» NO trae «Acupark III» (el defecto del reporte)', () => {
    const elegidos = ['Desarrollos en proceso Acupark II'];
    assert.equal(coincideExacto('Desarrollos en proceso Acupark II', elegidos), true);
    assert.equal(coincideExacto('Desarrollos en proceso Acupark III', elegidos), false);
  });
  it('ignora mayúsculas, acentos y espacios de más', () => {
    assert.equal(coincideExacto('  Consultoría   P,F, ', ['consultoria p,f,']), true);
  });
  it('varios elegidos: coincide con cualquiera', () => {
    assert.equal(coincideExacto('B', ['A', 'B']), true);
    assert.equal(coincideExacto('C', ['A', 'B']), false);
  });
  it('un valor nulo nunca coincide', () => {
    assert.equal(coincideExacto(null, ['A']), false);
    assert.equal(coincideExacto(undefined, ['']), false);
  });
  it('normalizarTexto', () => {
    assert.equal(normalizarTexto('  ÁÉÍ  ó '), 'aei o');
  });
});

describe('etiquetaTipoSolicitud', () => {
  const m = (tipoOperacion: number | null, idCxpPPD: string | null = null, diferido: boolean | null = false) => ({
    tipoOperacion,
    idCxpPPD,
    diferido,
  });
  it('PPD gana sobre el tipo de operación (por idCxpPPD o por diferido)', () => {
    assert.equal(etiquetaTipoSolicitud(m(1, 'P1')), 'Factura PPD');
    assert.equal(etiquetaTipoSolicitud(m(1, null, true)), 'Factura PPD');
  });
  it('todas las etiquetas posibles están en la lista del filtro «Tipo»', () => {
    const posibles = [m(1), m(2), m(4), m(5), m(6), m(98), m(3), m(1, 'P1')].map(etiquetaTipoSolicitud);
    for (const e of posibles) assert.ok((TIPOS_SOLICITUD as readonly string[]).includes(e), e);
    assert.equal(new Set(TIPOS_SOLICITUD).size, TIPOS_SOLICITUD.length);
  });
  it('tipos de operación', () => {
    assert.equal(etiquetaTipoSolicitud(m(1)), 'Factura PUE');
    assert.equal(etiquetaTipoSolicitud(m(2)), 'Urgente');
    assert.equal(etiquetaTipoSolicitud(m(4)), 'Línea de captura');
    assert.equal(etiquetaTipoSolicitud(m(5)), 'Devolución');
    assert.equal(etiquetaTipoSolicitud(m(6)), 'Sin XML');
    assert.equal(etiquetaTipoSolicitud(m(98)), 'Ajuste presupuestal');
    assert.equal(etiquetaTipoSolicitud(m(3)), 'Otro');
    assert.equal(etiquetaTipoSolicitud(m(null)), 'Otro');
  });
});
