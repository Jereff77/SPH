// Pruebas del folio y la fecha de las parcialidades PPD. Corren con `node --test` (Node 22, sin jest):
//   pnpm --filter @erp/api test:unit
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { folioDeParcial, hoyMexicoISO, patronFoliosDeFactura, sufijoFechaV1 } from './ppd-folio.ts';

const U = '0ACB93AC-F5CF-5777-9BB8-5950927EC57A';

describe('sufijoFechaV1 (ddmmaaaa, con ceros: decisión D2)', () => {
  it('lleva ceros a la izquierda en día y mes', () => {
    assert.equal(sufijoFechaV1('2026-11-01'), '01112026'); // 01/11/2026
    assert.equal(sufijoFechaV1('2026-05-12'), '12052026');
    assert.equal(sufijoFechaV1('2026-06-02'), '02062026');
    assert.equal(sufijoFechaV1('2026-12-31'), '31122026');
  });

  it('acepta un timestamp ISO y toma solo la fecha', () => {
    assert.equal(sufijoFechaV1('2026-11-01T03:00:00.000Z'), '01112026');
  });

  it('rechaza fechas que no son yyyy-MM-dd', () => {
    assert.throws(() => sufijoFechaV1('01/11/2026'), /Fecha inválida/);
    assert.throws(() => sufijoFechaV1(''), /Fecha inválida/);
  });

  it('con ceros ya no hay ambigüedad 1/11 vs 11/1 (el sufijo sin ceros sí chocaba)', () => {
    assert.notEqual(sufijoFechaV1('2026-11-01'), sufijoFechaV1('2026-01-11'));
    // Referencia: sin ceros ambos eran "1112026".
    assert.equal(sufijoFechaV1('2026-11-01'), '01112026');
    assert.equal(sufijoFechaV1('2026-01-11'), '11012026');
  });
});

describe('folioDeParcial', () => {
  it('la 1.ª parcialidad conserva el UUID solo', () => {
    assert.equal(folioDeParcial(U, '2026-11-01', []), U);
  });

  it('la 2.ª lleva UUID-ddmmaaaa con la fecSolicitud de SU pago', () => {
    assert.equal(folioDeParcial(U, '2026-11-01', [U]), `${U}-01112026`);
    assert.equal(folioDeParcial(U, '2026-11-20', [U, `${U}-01112026`]), `${U}-20112026`);
  });

  it('mismo día: consecutivo -2, -3 (el folio candidato ya existe)', () => {
    const a = folioDeParcial(U, '2026-11-03', [U]);
    const b = folioDeParcial(U, '2026-11-03', [U, a]);
    const c = folioDeParcial(U, '2026-11-03', [U, a, b]);
    assert.deepEqual([a, b, c], [`${U}-03112026`, `${U}-03112026-2`, `${U}-03112026-3`]);
  });

  it('una parcial RECHAZADA sigue ocupando su folio: la que la reemplaza el mismo día lleva -2', () => {
    const rechazada = folioDeParcial(U, '2026-11-03', [U]);
    assert.equal(folioDeParcial(U, '2026-11-03', [U, rechazada]), `${rechazada}-2`);
  });

  it('la 1.ª parcialidad rechazada conserva el UUID ocupado: la nueva lleva sufijo', () => {
    // `existentes` incluye la fila rechazada (y las de status=false) porque ocupan cxp_folio_key.
    assert.equal(folioDeParcial(U, '2026-11-03', [U]), `${U}-03112026`);
  });

  it('colisión de fechas que SIN ceros chocaban (1/11 vs 11/1): hoy dan folios distintos sin consecutivo', () => {
    const a = folioDeParcial(U, '2026-11-01', [U]);
    const b = folioDeParcial(U, '2026-01-11', [U, a]);
    assert.notEqual(a, b);
    assert.equal(b, `${U}-11012026`);
  });

  it('si aun así un folio ya existe, el consecutivo lo resuelve (cualquier causa)', () => {
    // p. ej. un folio con el mismo sufijo creado por otra vía
    const ocupado = `${U}-01112026`;
    assert.equal(folioDeParcial(U, '2026-11-01', [U, ocupado]), `${ocupado}-2`);
  });

  it('respeta el UUID del maestro tal cual (58 maestros lo tienen en minúsculas)', () => {
    const u = 'dc43297e-fba4-4423-a9ec-6153c3b43215';
    assert.equal(folioDeParcial(u, '2026-08-04', [u]), `${u}-04082026`);
  });

  it('concurrencia: dos peticiones con la MISMA foto eligen el mismo folio; con la foto fresca la 2.ª sube al consecutivo', () => {
    const indice = new Set([U]); // simula el índice único cxp_folio_key
    const insertar = (folio: string) => {
      if (indice.has(folio)) throw Object.assign(new Error('duplicate key'), { code: '23505' });
      indice.add(folio);
    };
    const foto = [...indice];
    const f1 = folioDeParcial(U, '2026-11-03', foto);
    const f2 = folioDeParcial(U, '2026-11-03', foto);
    assert.equal(f1, f2); // misma foto → mismo candidato
    insertar(f1);
    assert.throws(() => insertar(f2), { code: '23505' });
    insertar(folioDeParcial(U, '2026-11-03', [...indice])); // reintento releyendo existentes
    assert.deepEqual([...indice], [U, `${U}-03112026`, `${U}-03112026-2`]);
  });
});

describe('hoyMexicoISO (decisión D4: hora de México, no UTC)', () => {
  it('21:00 hora de México del 31/oct NO es 1/nov (en UTC ya es 1/nov 03:00)', () => {
    const ahora = new Date('2026-11-01T03:00:00Z'); // 21:00 en México (UTC−6)
    assert.equal(hoyMexicoISO(ahora), '2026-10-31');
    assert.equal(ahora.toISOString().split('T')[0], '2026-11-01'); // lo que hacía el código viejo
  });

  it('después de las 18:00 de México la fecha UTC ya es la de mañana; México sigue en el día', () => {
    assert.equal(hoyMexicoISO(new Date('2026-11-03T01:00:00Z')), '2026-11-02');
    assert.equal(hoyMexicoISO(new Date('2026-11-02T23:30:00Z')), '2026-11-02');
  });

  it('a las 00:00 de México ya es el día nuevo', () => {
    assert.equal(hoyMexicoISO(new Date('2026-11-02T06:00:00Z')), '2026-11-02');
    assert.equal(hoyMexicoISO(new Date('2026-11-02T05:59:00Z')), '2026-11-01');
  });

  it('sin argumento devuelve una fecha yyyy-MM-dd', () => {
    assert.match(hoyMexicoISO(), /^\d{4}-\d{2}-\d{2}$/);
  });

  it('v1 derivaba el sufijo de la fecha local: fila real S1ClgQP0SHrNtoB (02:17 UTC del 23/05) es 22/05', () => {
    assert.equal(hoyMexicoISO(new Date('2026-05-23T02:17:11Z')), '2026-05-22');
    assert.equal(sufijoFechaV1(hoyMexicoISO(new Date('2026-05-23T02:17:11Z'))), '22052026');
  });
});

describe('patronFoliosDeFactura', () => {
  it('es el UUID + comodín al final', () => {
    assert.equal(patronFoliosDeFactura(U), `${U}%`);
  });

  it('escapa los comodines de LIKE para que el folio se tome literal', () => {
    assert.equal(patronFoliosDeFactura('AB%C_D\\E'), 'AB\\%C\\_D\\\\E%');
  });
});
