// Pruebas de `validarRepContra` (complemento de pago / REP) con REP compartido entre
// parcialidades de la misma factura PPD (D3). Corren con `node --test`:
//   pnpm --filter @erp/api test:unit
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsearComplementoPago, validarRepContra, type ComplementoPagoData } from './cfdi.ts';

const FACTURA = '0ACB93AC-F5CF-5777-9BB8-5950927EC57A';
const OTRA = '99999999-AAAA-BBBB-CCCC-DDDDDDDDDDDD';
const RFC_PROV = 'AAA010101AAA';
const RFC_EMPRESA = 'BBB010101BBB';

/** REP mínimo: una lista de DoctoRelacionado (idDocumento, impPagado) en un solo nodo Pago. */
function rep(doctos: Array<[string, number]>, extra: Partial<ComplementoPagoData> = {}): ComplementoPagoData {
  return {
    tipoComprobante: 'P',
    uuid: 'REP-0001',
    emisorRfc: RFC_PROV,
    receptorRfc: RFC_EMPRESA,
    fecha: '2026-11-02T10:00:00',
    pagos: [
      {
        monto: doctos.reduce((s, [, i]) => s + i, 0),
        fecha: '2026-11-02T10:00:00',
        moneda: 'MXN',
        doctos: doctos.map(([idDocumento, impPagado], i) => ({
          idDocumento,
          impPagado,
          numParcialidad: String(i + 1),
          serie: '',
          folio: '',
        })),
      },
    ],
    ...extra,
  };
}

const base = (montoEsperado: number, montosYaCubiertos?: number[]) => ({
  folioFactura: FACTURA,
  montoEsperado,
  rfcProveedor: RFC_PROV,
  receptoresAutorizados: [RFC_EMPRESA],
  ...(montosYaCubiertos ? { montosYaCubiertos } : {}),
});

describe('validarRepContra: un REP por parcialidad (comportamiento de siempre)', () => {
  it('1 DoctoRelacionado con el importe exacto → válido', () => {
    assert.deepEqual(validarRepContra(rep([[FACTURA, 6264]]), base(6264)), []);
  });

  it('tolerancia de 1 centavo', () => {
    assert.deepEqual(validarRepContra(rep([[FACTURA, 6264.01]]), base(6264)), []);
    assert.equal(validarRepContra(rep([[FACTURA, 6264.02]]), base(6264)).length, 1);
  });

  it('importe distinto → error con el importe del REP y el de la parcialidad', () => {
    const e = validarRepContra(rep([[FACTURA, 6000]]), base(6264));
    assert.equal(e.length, 1);
    assert.match(e[0]!, /6000\.00.*6264\.00/);
  });

  it('el REP no referencia la factura → error y no valida monto', () => {
    const e = validarRepContra(rep([[OTRA, 6264]]), base(6264));
    assert.equal(e.length, 1);
    assert.match(e[0]!, /no corresponde a esta factura/);
  });

  it('suma de varios DoctoRelacionado de la factura = monto (pago repartido): sigue válido', () => {
    assert.deepEqual(validarRepContra(rep([[FACTURA, 3000], [FACTURA, 3264]]), base(6264)), []);
  });

  it('el emisor y el receptor se siguen validando', () => {
    const e = validarRepContra(rep([[FACTURA, 6264]], { emisorRfc: 'XXX010101XXX', receptorRfc: 'ZZZ010101ZZZ' }), base(6264));
    assert.equal(e.length, 2);
  });
});

describe('validarRepContra: REP que ampara 2 o más parcialidades de la misma factura (D3)', () => {
  const dos = rep([[FACTURA, 6264], [FACTURA, 6264]]);

  it('REP con 2 DoctoRelacionado del mismo importe: la 1.ª parcialidad valida contra UNO (antes fallaba: sumaba 12,528)', () => {
    assert.deepEqual(validarRepContra(dos, base(6264)), []);
  });

  it('la 2.ª parcialidad (mismo REP, ya cubierta la 1.ª) valida contra el otro DoctoRelacionado', () => {
    assert.deepEqual(validarRepContra(dos, base(6264, [6264])), []);
  });

  it('una 3.ª parcialidad igual NO cabe: los 2 documentos ya están asignados', () => {
    const e = validarRepContra(dos, base(6264, [6264, 6264]));
    assert.equal(e.length, 1);
    assert.match(e[0]!, /solo puede amparar una parcialidad/);
  });

  it('REP con 1 solo DoctoRelacionado NO ampara a una 2.ª parcialidad del mismo importe', () => {
    const uno = rep([[FACTURA, 6264]]);
    assert.deepEqual(validarRepContra(uno, base(6264)), []); // la 1.ª sí
    assert.equal(validarRepContra(uno, base(6264, [6264])).length, 1); // la 2.ª no
  });

  it('importes distintos: cada parcialidad empata con el documento de SU importe, en cualquier orden', () => {
    const r = rep([[FACTURA, 4000], [FACTURA, 8528]]);
    assert.deepEqual(validarRepContra(r, base(4000)), []);
    assert.deepEqual(validarRepContra(r, base(8528, [4000])), []);
    assert.deepEqual(validarRepContra(r, base(4000, [8528])), []);
    assert.deepEqual(validarRepContra(r, base(8528)), []);
  });

  it('importes distintos: un importe que no está en el REP se rechaza aunque haya otro REP compartido', () => {
    const r = rep([[FACTURA, 4000], [FACTURA, 8528]]);
    assert.equal(validarRepContra(r, base(5000)).length, 1);
    assert.equal(validarRepContra(r, base(5000, [4000])).length, 1);
  });

  it('importe distinto del docto que sobra → error', () => {
    const r = rep([[FACTURA, 4000], [FACTURA, 8528]]);
    // La otra parcialidad ya consumió el de 4,000; esta pide 4,000 y solo queda 8,528.
    assert.equal(validarRepContra(r, base(4000, [4000])).length, 1);
  });

  it('REP con doctos de OTRA factura: solo cuentan los de esta (el UUID de otra no suma)', () => {
    const r = rep([[FACTURA, 6264], [OTRA, 6264]]);
    assert.deepEqual(validarRepContra(r, base(6264)), []);
    assert.equal(validarRepContra(r, base(6264, [6264])).length, 1); // el de la otra factura no ampara esta
  });

  it('una parcialidad ya validada por SUMA consume todos los documentos restantes', () => {
    const r = rep([[FACTURA, 3000], [FACTURA, 3264], [FACTURA, 6264]]);
    // otra parcialidad de 9,264 (3,000 + 6,264) no empata con uno solo → consume todo
    assert.equal(validarRepContra(r, base(3264, [9264])).length, 1);
  });

  it('REP con 2 nodos Pago (2 fechas) y la misma factura en cada uno', () => {
    const r = rep([[FACTURA, 6264]]);
    r.pagos.push({
      monto: 6264,
      fecha: '2026-11-20T10:00:00',
      moneda: 'MXN',
      doctos: [{ idDocumento: FACTURA, impPagado: 6264, numParcialidad: '2', serie: '', folio: '' }],
    });
    assert.deepEqual(validarRepContra(r, base(6264)), []);
    assert.deepEqual(validarRepContra(r, base(6264, [6264])), []);
    assert.equal(validarRepContra(r, base(6264, [6264, 6264])).length, 1);
  });

  it('con XML real: parsea 2 Pago / 2 DoctoRelacionado y valida a las dos parcialidades', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:pago20="http://www.sat.gob.mx/Pagos20"
  xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" TipoDeComprobante="P" Fecha="2026-11-02T10:00:00">
  <cfdi:Emisor Rfc="${RFC_PROV}" Nombre="Proveedor"/>
  <cfdi:Receptor Rfc="${RFC_EMPRESA}" Nombre="Empresa"/>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      <pago20:Pago FechaPago="2026-11-01T12:00:00" MonedaP="MXN" Monto="6264.00">
        <pago20:DoctoRelacionado IdDocumento="${FACTURA}" NumParcialidad="1" ImpPagado="6264.00"/>
      </pago20:Pago>
      <pago20:Pago FechaPago="2026-11-20T12:00:00" MonedaP="MXN" Monto="6264.00">
        <pago20:DoctoRelacionado IdDocumento="${FACTURA}" NumParcialidad="2" ImpPagado="6264.00"/>
      </pago20:Pago>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital UUID="aaaaaaaa-0000-4000-8000-000000000001"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
    const parseado = parsearComplementoPago(xml);
    assert.equal(parseado.pagos.length, 2);
    assert.deepEqual(validarRepContra(parseado, base(6264)), []);
    assert.deepEqual(validarRepContra(parseado, base(6264, [6264])), []);
    assert.equal(validarRepContra(parseado, base(6264, [6264, 6264])).length, 1);
  });
});
