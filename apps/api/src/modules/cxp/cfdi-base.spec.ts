// Pruebas de la base del gasto de un CFDI (SubTotal − Descuento). Corren con `node --test`:
//   pnpm --filter @erp/api test:unit
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { baseGastoCfdi, parsearCfdi } from './cfdi.ts';

/** CFDI mínimo; `extra` agrega atributos al Comprobante y `impuestos` el nodo de impuestos. */
function xml(extra: string, impuestos = ''): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Fecha="2026-05-12T10:00:00"
  Moneda="MXN" MetodoPago="PPD" TipoDeComprobante="I" ${extra}>
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Proveedor" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Empresa"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="80141600" Descripcion="Servicio" Importe="25200.00"/>
  </cfdi:Conceptos>
  ${impuestos}
</cfdi:Comprobante>`;
}

describe('base del gasto del CFDI', () => {
  it('lee el Descuento y la base es SubTotal − Descuento (caso real: 25,200 con 25 % → 18,900)', () => {
    const cfdi = parsearCfdi(xml('SubTotal="25200.00" Descuento="6300.00" Total="21924.00"'));
    assert.equal(cfdi.subtotal, 25200);
    assert.equal(cfdi.descuento, 6300);
    assert.equal(baseGastoCfdi(cfdi), 18900);
  });

  it('sin atributo Descuento: descuento 0 y la base es el SubTotal', () => {
    const cfdi = parsearCfdi(xml('SubTotal="1000.00" Total="1160.00"'));
    assert.equal(cfdi.descuento, 0);
    assert.equal(baseGastoCfdi(cfdi), 1000);
  });

  it('las retenciones NO restan de la base', () => {
    const cfdi = parsearCfdi(
      xml(
        'SubTotal="100000.00" Total="95333.00"',
        `<cfdi:Impuestos TotalImpuestosRetenidos="10667.00">
           <cfdi:Retenciones><cfdi:Retencion Impuesto="002" Importe="10667.00"/></cfdi:Retenciones>
         </cfdi:Impuestos>`,
      ),
    );
    assert.equal(cfdi.impuestos.retIVA, 10667);
    assert.equal(baseGastoCfdi(cfdi), 100000);
  });

  it('redondea a 2 decimales (sin ruido de punto flotante)', () => {
    assert.equal(baseGastoCfdi({ subtotal: 100.1, descuento: 0.2 }), 99.9);
    assert.equal(baseGastoCfdi({ subtotal: 0.3, descuento: 0.1 }), 0.2);
  });
});
