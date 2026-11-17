// Pruebas de INTEGRACIÓN de la Fase 2 de PPD (abonos de punta a punta) con un Supabase FALSO en
// memoria (`supabase-falso-cxp.testing-spec.ts`). Ejercitan los servicios reales (PpdService,
// SolicitudesService, PendientesService, AprobacionService, PagosService), no solo funciones puras.
//
// Los servicios usan decoradores de NestJS, que `node --test` no lee directo desde .ts: este spec
// se compila primero con `tsc -p tsconfig.pruebas.json` y se corre sobre el JS resultante:
//   pnpm --filter @erp/api test:integracion
import { afterEach, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PpdService } from './ppd.service.js';
import { SolicitudesService } from './solicitudes.service.js';
import { PendientesService } from './pendientes.service.js';
import { AprobacionService } from './aprobacion.service.js';
import { PagosService } from './pagos.service.js';
import type { BloqueoService } from './bloqueo.service.js';
import type { ClavesSatService } from './claves-sat.service.js';
import {
  crearSupabaseFalsoCxp,
  type Fila,
  type IndiceUnico,
  type OpcionesFalsoCxp,
} from './supabase-falso-cxp.testing-spec.js';

const UID = '11111111-1111-4111-8111-111111111111';
const UUID = '0ACB93AC-F5CF-5777-9BB8-5950927EC57A';
const UUID2 = '99999999-AAAA-4BBB-8CCC-DDDDDDDDDDDD';
const RFC_PROV = 'AAA010101AAA';
const UNICO_FOLIO: IndiceUnico = { tabla: 'cxp', nombre: 'cxp_folio_key', columnas: ['folio'] };
/** 21:00 del 1/nov/2026 en México = 03:00Z del 2/nov (en UTC ya es «mañana»). */
const AHORA = new Date('2026-11-02T03:00:00Z');
const HOY_MX = '2026-11-01';
const SUFIJO_HOY = '01112026';

before(() => {
  Logger.overrideLogger(false); // sin ruido de logs de Nest en la salida de las pruebas
});
afterEach(() => {
  mock.timers.reset();
});
const congelarReloj = () => mock.timers.enable({ apis: ['Date'], now: AHORA });

async function rechazo(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error('Se esperaba un rechazo y la promesa se resolvió.');
}
const textoDe = (e: unknown): string => {
  const r = (e as HttpException).getResponse();
  return typeof r === 'string' ? r : JSON.stringify(r);
};

const bloqueoStub = { verificar: async () => undefined } as unknown as BloqueoService;

const maestro = (extra: Fila = {}): Fila => ({
  idCxpPPD: 'M1',
  folio: UUID,
  idProveedor: 'P1',
  nombreProveedor: 'Proveedor SA',
  nomCFDI: 'Proveedor SA',
  concepto: 'Servicio',
  fecCFDI: '2026-09-15',
  urlXLM: `https://falso.supabase.co/storage/v1/object/public/CFDIproveedores/${RFC_PROV}/${UUID}.xml`,
  urlCFDI: `https://falso.supabase.co/storage/v1/object/public/CFDIproveedores/${RFC_PROV}/${UUID}.pdf`,
  status: true,
  uidr: UID,
  idCategoria: 'C1',
  total: 12000,
  subtotal: 10000,
  numPagos: 1,
  montoAplicado: 0,
  ...extra,
});

const parcial = (idCxp: string, extra: Fila = {}): Fila => ({
  idCxp,
  status: true,
  idCxpPPD: 'M1',
  folio: UUID,
  idFolioDif: UUID,
  idEstado: 2,
  total: 3000,
  subtotal: 2500,
  montoAplicado: 0,
  moneda: 'MXN',
  diferido: true,
  uidr: UID,
  idCategoria: 'C1',
  idProveedor: 'P1',
  urlXLM: `https://falso.supabase.co/storage/v1/object/public/CFDIproveedores/${RFC_PROV}/${UUID}.xml`,
  urlCFDI: `https://falso.supabase.co/storage/v1/object/public/CFDIproveedores/${RFC_PROV}/${UUID}.pdf`,
  ...extra,
});

function montar(op: OpcionesFalsoCxp = {}) {
  const f = crearSupabaseFalsoCxp({
    rpc: { cxp_puede_insertar: true, ...(op.rpc ?? {}) },
    unicos: [UNICO_FOLIO],
    ...op,
    tablas: {
      PresCategorias: [{ idCategoria: 'C1', uidResponsable: 'GERENTE-1' }],
      catProveedores: [{ idProveedor: 'P1', rfc: RFC_PROV }],
      ...(op.tablas ?? {}),
    },
  });
  const solicitudes = new SolicitudesService(f.supabase, {} as ClavesSatService, bloqueoStub);
  const ppd = new PpdService(f.supabase, solicitudes, bloqueoStub);
  return {
    ...f,
    solicitudes,
    ppd,
    pendientes: new PendientesService(f.supabase),
    aprobacion: new AprobacionService(f.supabase),
    pagos: new PagosService(f.supabase),
  };
}

const dto = (monto: number) => ({
  idCategoria: 'C1',
  justificacion: 'Abono de la factura según acuerdo con el proveedor',
  monto,
});
const filasCxp = (t: { ctx: { tablas: Record<string, Fila[]> } }): Fila[] => t.ctx.tablas['cxp'] ?? [];
const foliosCxp = (t: { ctx: { tablas: Record<string, Fila[]> } }): string[] =>
  filasCxp(t).map((f) => String(f['folio']));

// ============================================================================================
// 1. Folio y fecha de las parcialidades
// ============================================================================================
describe('nuevaParcial: folio estilo v1 y fecha en hora de México', () => {
  it('la 1.ª parcialidad (maestro sin parciales) conserva el UUID solo; idFolioDif = UUID', async () => {
    congelarReloj();
    const t = montar({ tablas: { cxp_ppd: [maestro()], cxp: [] } });
    const { idCxp } = await t.ppd.nuevaParcial('M1', dto(3000), UID);
    const fila = filasCxp(t).find((f) => f['idCxp'] === idCxp)!;
    assert.equal(fila['folio'], UUID);
    assert.equal(fila['idFolioDif'], UUID);
  });

  it('la 2.ª parcialidad lleva UUID-ddmmaaaa (con ceros) de su fecSolicitud en hora de México', async () => {
    congelarReloj();
    const t = montar({ tablas: { cxp_ppd: [maestro()], cxp: [parcial('X1')] } });
    const { idCxp } = await t.ppd.nuevaParcial('M1', dto(3000), UID);
    const fila = filasCxp(t).find((f) => f['idCxp'] === idCxp)!;
    assert.equal(fila['folio'], `${UUID}-${SUFIJO_HOY}`);
    assert.equal(fila['idFolioDif'], UUID, 'idFolioDif guarda SIEMPRE el UUID real de la factura');
    // D4: en UTC ya era 2/nov; en México es 1/nov.
    assert.equal(fila['fecSolicitud'], HOY_MX);
    // subtotal de la Fase 1 sigue calculándose (3000 de 12000 → 2500 de 10000)
    assert.equal(fila['subtotal'], 2500);
  });

  it('mismo día: la 3.ª parcial lleva consecutivo -2 y la 4.ª -3', async () => {
    congelarReloj();
    const t = montar({ tablas: { cxp_ppd: [maestro()], cxp: [parcial('X1', { total: 1000, subtotal: 833.33 })] } });
    await t.ppd.nuevaParcial('M1', dto(1000), UID);
    await t.ppd.nuevaParcial('M1', dto(1000), UID);
    await t.ppd.nuevaParcial('M1', dto(1000), UID);
    assert.deepEqual(foliosCxp(t), [
      UUID,
      `${UUID}-${SUFIJO_HOY}`,
      `${UUID}-${SUFIJO_HOY}-2`,
      `${UUID}-${SUFIJO_HOY}-3`,
    ]);
  });

  it('una parcial RECHAZADA o status=false sigue ocupando su folio: la nueva no lo repite', async () => {
    congelarReloj();
    const t = montar({
      tablas: {
        cxp_ppd: [maestro()],
        cxp: [
          parcial('X1', { idEstado: 3 }), // 1.ª rechazada: conserva folio = UUID
          parcial('X2', { folio: `${UUID}-${SUFIJO_HOY}`, status: false }), // borrada lógicamente
        ],
      },
    });
    const { idCxp } = await t.ppd.nuevaParcial('M1', dto(3000), UID);
    const fila = filasCxp(t).find((f) => f['idCxp'] === idCxp)!;
    assert.equal(fila['folio'], `${UUID}-${SUFIJO_HOY}-2`);
  });

  it('reintenta ante 23505 de cxp_folio_key: relee los folios y toma el consecutivo (2 intentos)', async () => {
    congelarReloj();
    let simulada = false;
    const t = montar({
      tablas: { cxp_ppd: [maestro()], cxp: [parcial('X1')] },
      // Otra petición toma el mismo folio entre la lectura y el insert (solo la 1.ª vez).
      antesDeInsertar: (tabla, fila, tablas) => {
        if (tabla !== 'cxp' || simulada) return;
        simulada = true;
        tablas['cxp']!.push(parcial('CONCURRENTE', { folio: fila['folio'] }));
      },
    });
    const { idCxp } = await t.ppd.nuevaParcial('M1', dto(3000), UID);
    assert.equal(t.ctx.intentosInsert['cxp'], 2);
    const fila = filasCxp(t).find((f) => f['idCxp'] === idCxp)!;
    assert.equal(fila['folio'], `${UUID}-${SUFIJO_HOY}-2`);
  });

  it('agota los 3 intentos → 409 claro (no 500) y no deja fila propia', async () => {
    congelarReloj();
    let n = 0;
    const t = montar({
      tablas: { cxp_ppd: [maestro()], cxp: [parcial('X1')] },
      antesDeInsertar: (tabla, fila, tablas) => {
        if (tabla !== 'cxp') return;
        tablas['cxp']!.push(parcial(`CONC${++n}`, { folio: fila['folio'], status: false }));
      },
    });
    const e = await rechazo(t.ppd.nuevaParcial('M1', dto(3000), UID));
    assert.ok(e instanceof ConflictException);
    assert.match(textoDe(e), /folio/);
    assert.equal(t.ctx.intentosInsert['cxp'], 3);
    assert.equal(
      filasCxp(t).filter((f) => !String(f['idCxp']).startsWith('CONC') && f['idCxp'] !== 'X1').length,
      0,
    );
  });

  it('un 23505 de OTRO índice no se reintenta (500) y mapearErrorCxp traduce los triggers CXP_ a 400', async () => {
    congelarReloj();
    const otro = montar({
      tablas: { cxp_ppd: [maestro()], cxp: [parcial('X1')] },
      antesDeInsertar: (tabla) =>
        tabla === 'cxp'
          ? { code: '23505', message: 'duplicate key value violates unique constraint "cxp_idMovBancarios_unico"' }
          : undefined,
    });
    const e1 = await rechazo(otro.ppd.nuevaParcial('M1', dto(3000), UID));
    assert.ok(e1 instanceof InternalServerErrorException);
    assert.equal(otro.ctx.intentosInsert['cxp'], 1);

    const trigger = montar({
      tablas: { cxp_ppd: [maestro()], cxp: [parcial('X1')] },
      antesDeInsertar: (tabla) =>
        tabla === 'cxp'
          ? { code: 'P0001', message: 'CXP_CFDI_NO_HABILITADO: Hoy no es un día habilitado' }
          : undefined,
    });
    const e2 = await rechazo(trigger.ppd.nuevaParcial('M1', dto(3000), UID));
    assert.ok(e2 instanceof BadRequestException);
    assert.match(textoDe(e2), /día habilitado para registrar comprobantes/);
  });
});

// ============================================================================================
// 2. Periodo cerrado y verificación posterior
// ============================================================================================
describe('nuevaParcial: periodo de captura y concurrencia', () => {
  it('periodo cerrado → 400 claro ANTES de calcular saldo ni insertar', async () => {
    congelarReloj();
    const t = montar({
      rpc: { cxp_puede_insertar: false },
      tablas: { cxp_ppd: [maestro()], cxp: [parcial('X1')] },
    });
    const e = await rechazo(t.ppd.nuevaParcial('M1', dto(3000), UID));
    assert.ok(e instanceof BadRequestException);
    assert.match(textoDe(e), /periodo de captura está cerrado/);
    assert.equal(t.ctx.intentosInsert['cxp'], undefined, 'no se intentó insertar');
    assert.equal(
      t.ctx.rpcs.filter((r) => r.fn === 'cxp_puede_insertar').length,
      1,
    );
  });

  it('verificación posterior: si otra petición dejó el saldo en negativo → 409, borra su fila y su comentario, y recuenta', async () => {
    congelarReloj();
    let concurrente = false;
    const t = montar({
      // Maestro 12,000 con 9,000 ya pedidos: quedan 3,000. Esta petición pide 3,000 (pasa el
      // saldo leído) pero otra petición inserta 3,000 más justo después.
      tablas: {
        cxp_ppd: [maestro({ numPagos: 1 })],
        cxp: [parcial('X1', { total: 9000, subtotal: 7500 })],
      },
      despuesDeInsertar: (tabla, fila, tablas) => {
        if (tabla !== 'cxp' || concurrente) return;
        concurrente = true;
        tablas['cxp']!.push(parcial('X-OTRA', { folio: `${UUID}-OTRA` }));
        assert.ok(fila['idCxp']);
      },
    });
    const e = await rechazo(t.ppd.nuevaParcial('M1', dto(3000), UID));
    assert.ok(e instanceof ConflictException);
    assert.match(textoDe(e), /al mismo tiempo/);
    // Quedan solo X1 y la concurrente; la propia se deshizo junto con su comentario.
    assert.deepEqual(filasCxp(t).map((f) => f['idCxp']).sort(), ['X-OTRA', 'X1']);
    assert.equal((t.ctx.tablas['cxpComentarios'] ?? []).length, 0);
    // numPagos del maestro recontado (X1 + la concurrente).
    assert.equal(t.ctx.tablas['cxp_ppd']![0]!['numPagos'], 2);
  });

  it('sin concurrencia: inserta, recuenta numPagos y responde idCxp', async () => {
    congelarReloj();
    const t = montar({ tablas: { cxp_ppd: [maestro({ numPagos: 1 })], cxp: [parcial('X1')] } });
    const res = await t.ppd.nuevaParcial('M1', dto(3000), UID);
    assert.ok(res.idCxp);
    assert.equal(t.ctx.tablas['cxp_ppd']![0]!['numPagos'], 2);
    assert.equal((t.ctx.tablas['cxpComentarios'] ?? []).length, 1);
  });

  it('la cuenta de un pago nuevo es la de la factura: se ignora la que mande el cliente (o si no manda ninguna)', async () => {
    congelarReloj();
    const t = montar({ tablas: { cxp_ppd: [maestro()], cxp: [parcial('X1')] } });
    const r1 = await t.ppd.nuevaParcial('M1', { ...dto(1000), idCategoria: 'OTRA' }, UID);
    const { idCategoria: _omitida, ...sinCuenta } = dto(1000);
    const r2 = await t.ppd.nuevaParcial('M1', sinCuenta, UID);
    for (const id of [r1.idCxp, r2.idCxp])
      assert.equal(filasCxp(t).find((f) => f['idCxp'] === id)!['idCategoria'], 'C1');
  });

  it('una factura sin cuenta asignada no admite pagos nuevos (400)', async () => {
    congelarReloj();
    const t = montar({ tablas: { cxp_ppd: [maestro({ idCategoria: null })], cxp: [parcial('X1')] } });
    const e = await rechazo(t.ppd.nuevaParcial('M1', dto(1000), UID));
    assert.ok(e instanceof BadRequestException);
    assert.match(textoDe(e), /no tiene cuenta asignada/);
  });

  it('monto mayor al disponible sigue dando 400', async () => {
    congelarReloj();
    const t = montar({ tablas: { cxp_ppd: [maestro()], cxp: [parcial('X1', { total: 9000, subtotal: 7500 })] } });
    const e = await rechazo(t.ppd.nuevaParcial('M1', dto(3000.5), UID));
    assert.ok(e instanceof BadRequestException);
    assert.match(textoDe(e), /excede el disponible/);
  });
});

// ============================================================================================
// 3. eliminar() de una parcial PPD
// ============================================================================================
describe('eliminar(): parcialidades PPD', () => {
  it('NO borra los archivos de storage (son los de la factura) y recuenta numPagos (solo no rechazadas)', async () => {
    const t = montar({
      tablas: {
        cxp_ppd: [maestro({ numPagos: 3 })],
        cxp: [
          parcial('X1', { idEstado: 3 }), // rechazada: no cuenta
          parcial('X2', { idEstado: 1, folio: `${UUID}-${SUFIJO_HOY}` }), // la que se elimina
          parcial('X3', { idEstado: 2, folio: `${UUID}-02112026` }),
        ],
        cxpComentarios: [{ idCxpComentarios: 'K1', idCxP: 'X2', status: true }],
      },
    });
    await t.solicitudes.eliminar('X2', UID);
    assert.deepEqual(t.ctx.storage.removidos, [], 'no se tocó el storage');
    assert.deepEqual(filasCxp(t).map((f) => f['idCxp']), ['X1', 'X3']);
    assert.equal((t.ctx.tablas['cxpComentarios'] ?? []).length, 0);
    assert.equal(t.ctx.tablas['cxp_ppd']![0]!['numPagos'], 1);
  });

  it('eliminar la ÚNICA parcial deja numPagos en 0 y conserva el maestro con sus archivos', async () => {
    const t = montar({
      tablas: { cxp_ppd: [maestro({ numPagos: 1 })], cxp: [parcial('X1', { idEstado: 1 })] },
    });
    await t.solicitudes.eliminar('X1', UID);
    assert.equal(filasCxp(t).length, 0);
    assert.equal(t.ctx.tablas['cxp_ppd']!.length, 1);
    assert.equal(t.ctx.tablas['cxp_ppd']![0]!['numPagos'], 0);
    assert.deepEqual(t.ctx.storage.removidos, []);
  });

  it('una solicitud NORMAL (no PPD) sigue borrando sus archivos del storage (sin cambio)', async () => {
    const t = montar({
      tablas: {
        cxp: [
          {
            idCxp: 'N1',
            uidr: UID,
            idEstado: 1,
            status: true,
            idCxpPPD: null,
            urlCFDI: `https://falso.supabase.co/storage/v1/object/public/CFDIproveedores/${RFC_PROV}/N1.pdf`,
            urlXLM: `https://falso.supabase.co/storage/v1/object/public/CFDIproveedores/${RFC_PROV}/N1.xml`,
          },
        ],
      },
    });
    await t.solicitudes.eliminar('N1', UID);
    assert.deepEqual(t.ctx.storage.removidos, [
      { bucket: 'CFDIproveedores', path: `${RFC_PROV}/N1.pdf` },
      { bucket: 'CFDIproveedores', path: `${RFC_PROV}/N1.xml` },
    ]);
    assert.equal(filasCxp(t).length, 0);
  });

  it('solo el dueño puede eliminar (sin cambio)', async () => {
    const t = montar({ tablas: { cxp_ppd: [maestro()], cxp: [parcial('X1', { idEstado: 1, uidr: 'otro' })] } });
    const e = await rechazo(t.solicitudes.eliminar('X1', UID));
    assert.ok(e instanceof HttpException);
    assert.equal((e as HttpException).getStatus(), 403);
  });
});

// ============================================================================================
// 4. devolver() 3→1 en PPD
// ============================================================================================
describe('devolver(): transición rechazada → guardado', () => {
  it('parcial PPD rechazada (3) → 400 y no cambia de estado', async () => {
    const t = montar({ tablas: { cxp_ppd: [maestro()], cxp: [parcial('X1', { idEstado: 3 })] } });
    const e = await rechazo(t.pendientes.devolver('X1', UID));
    assert.ok(e instanceof BadRequestException);
    assert.match(textoDe(e), /no se regresa a Guardado: capture un pago nuevo/);
    assert.equal(filasCxp(t)[0]!['idEstado'], 3);
    assert.equal(t.ctx.escrituras.filter((w) => w.tabla === 'cxp').length, 0);
  });

  it('parcial PPD enviada (2) o aprobada (4) sí se devuelve a Guardado (sin cambio)', async () => {
    const t = montar({
      tablas: {
        cxp_ppd: [maestro()],
        cxp: [parcial('X1', { idEstado: 2 }), parcial('X2', { idEstado: 4, folio: `${UUID}-x` })],
      },
    });
    await t.pendientes.devolver('X1', UID);
    await t.pendientes.devolver('X2', UID);
    assert.deepEqual(filasCxp(t).map((f) => f['idEstado']), [1, 1]);
  });

  it('solicitud NORMAL rechazada (3) sigue pudiendo devolverse (sin cambio)', async () => {
    const t = montar({ tablas: { cxp: [{ idCxp: 'N1', idEstado: 3, idCxpPPD: null, status: true }] } });
    await t.pendientes.devolver('N1', UID);
    assert.equal(filasCxp(t)[0]!['idEstado'], 1);
  });

  it('estados fuera de 2–4 siguen dando 400 (sin cambio)', async () => {
    const t = montar({ tablas: { cxp: [{ idCxp: 'N1', idEstado: 6, idCxpPPD: null, status: true }] } });
    assert.ok((await rechazo(t.pendientes.devolver('N1', UID))) instanceof BadRequestException);
  });
});

// ============================================================================================
// 5. enviar() sin «CFDI del mes en curso» en PPD
// ============================================================================================
describe('enviar(): exención del mes en curso solo en PPD', () => {
  it('parcial PPD con CFDI de un mes anterior SÍ se envía (idEstado 1 → 2)', async () => {
    congelarReloj();
    const t = montar({
      tablas: { cxp_ppd: [maestro()], cxp: [parcial('X1', { idEstado: 1, fecCFDI: '2026-09-15' })] },
    });
    await t.solicitudes.enviar('X1', UID);
    assert.equal(filasCxp(t)[0]!['idEstado'], 2);
  });

  it('parcial marcada `diferido` sin idCxpPPD también queda exenta', async () => {
    congelarReloj();
    const t = montar({
      tablas: { cxp: [parcial('X1', { idEstado: 1, idCxpPPD: null, fecCFDI: '2026-09-15' })] },
    });
    await t.solicitudes.enviar('X1', UID);
    assert.equal(filasCxp(t)[0]!['idEstado'], 2);
  });

  it('solicitud NORMAL con CFDI de un mes anterior sigue rechazándose con 400 (sin cambio)', async () => {
    congelarReloj();
    const t = montar({
      tablas: {
        cxp: [
          { idCxp: 'N1', uidr: UID, idEstado: 1, idCategoria: 'C1', fecCFDI: '2026-09-15', idCxpPPD: null, diferido: false, status: true },
        ],
      },
    });
    const e = await rechazo(t.solicitudes.enviar('N1', UID));
    assert.ok(e instanceof BadRequestException);
    assert.match(textoDe(e), /no corresponde al mes en curso/);
    assert.equal(filasCxp(t)[0]!['idEstado'], 1);
  });
});

// ============================================================================================
// 6. rechazar(): recuento de numPagos
// ============================================================================================
describe('rechazar(): recuenta numPagos de la factura PPD', () => {
  it('al rechazar una parcial PPD el maestro deja de contarla', async () => {
    const t = montar({
      tablas: {
        cxp_ppd: [maestro({ numPagos: 2 })],
        cxp: [parcial('X1', { idEstado: 4 }), parcial('X2', { idEstado: 2, uidGerente: 'GER', folio: `${UUID}-x` })],
      },
    });
    await t.aprobacion.rechazar('X2', 'Falta soporte del pago', 'GER');
    assert.equal(filasCxp(t).find((f) => f['idCxp'] === 'X2')!['idEstado'], 3);
    assert.equal(t.ctx.tablas['cxp_ppd']![0]!['numPagos'], 1);
  });

  it('una solicitud NORMAL se rechaza igual que siempre y no toca cxp_ppd', async () => {
    const t = montar({
      tablas: { cxp: [{ idCxp: 'N1', idEstado: 2, uidGerente: 'GER', idCxpPPD: null, status: true }] },
    });
    await t.aprobacion.rechazar('N1', 'No procede', 'GER');
    assert.equal(filasCxp(t)[0]!['idEstado'], 3);
    assert.equal(t.ctx.escrituras.filter((w) => w.tabla === 'cxp_ppd').length, 0);
  });
});

// ============================================================================================
// 7. D7: importe al asignar un movimiento bancario
// ============================================================================================
describe('asignarMovimiento(): importe contra el total (D7)', () => {
  const solicitudAprobada = (extra: Fila = {}): Fila =>
    parcial('X1', { idEstado: 4, total: 6264, subtotal: 5400, idMovBancarios: null, ...extra });

  it('parcial PPD: importe distinto del total → 400 y el movimiento NO se marca como aplicado', async () => {
    const t = montar({
      tablas: {
        cxp_ppd: [maestro({ total: 12528 })],
        cxp: [solicitudAprobada()],
        movbancarios: [{ idmov: 'MOV1', importe: 6000, aplicado: false }],
      },
    });
    const e = await rechazo(t.pagos.asignarMovimiento('X1', 'MOV1', UID));
    assert.ok(e instanceof BadRequestException);
    assert.match(textoDe(e), /importe del pago \(6000\.00\) no coincide con el total a pagar \(6264\.00\)/);
    assert.equal(t.ctx.tablas['movbancarios']![0]!['aplicado'], false);
    assert.equal(filasCxp(t)[0]!['idEstado'], 4);
  });

  it('parcial PPD: importe igual al total → se aplica el pago y se sincroniza el maestro', async () => {
    const t = montar({
      tablas: {
        cxp_ppd: [maestro({ total: 12528 })],
        cxp: [solicitudAprobada()],
        movbancarios: [{ idmov: 'MOV1', importe: 6264, aplicado: false }],
      },
    });
    await t.pagos.asignarMovimiento('X1', 'MOV1', UID);
    assert.equal(filasCxp(t)[0]!['idEstado'], 6);
    assert.equal(t.ctx.tablas['movbancarios']![0]!['aplicado'], true);
    assert.equal(t.ctx.tablas['cxp_ppd']![0]!['montoAplicado'], 6264);
  });

  it('parcial PPD: una diferencia de 2 centavos ya no se acepta (misma tolerancia que registrarPago)', async () => {
    const t = montar({
      tablas: {
        cxp_ppd: [maestro({ total: 12528 })],
        cxp: [solicitudAprobada()],
        movbancarios: [{ idmov: 'MOV1', importe: 6264.02, aplicado: false }],
      },
    });
    assert.ok((await rechazo(t.pagos.asignarMovimiento('X1', 'MOV1', UID))) instanceof BadRequestException);
  });

  it('solicitud NORMAL: asignar un importe distinto sigue permitido (alcance de D7 = PPD; sin cambio)', async () => {
    const t = montar({
      tablas: {
        cxp: [solicitudAprobada({ idCxpPPD: null, diferido: false })],
        movbancarios: [{ idmov: 'MOV1', importe: 6000, aplicado: false }],
      },
    });
    await t.pagos.asignarMovimiento('X1', 'MOV1', UID);
    assert.equal(filasCxp(t)[0]!['idEstado'], 6);
  });

  it('registrarPago conserva su validación y mensaje (ahora por el helper compartido)', async () => {
    const t = montar({ tablas: { cxp: [solicitudAprobada({ idCxpPPD: null })] } });
    const e = await rechazo(t.pagos.registrarPago('X1', { importe: 100 } as never, null, UID));
    assert.ok(e instanceof BadRequestException);
    assert.match(textoDe(e), /importe del pago \(100\.00\) no coincide con el total a pagar \(6264\.00\)/);
  });
});

// ============================================================================================
// 8. D3: un REP que ampara 2 parcialidades de la misma factura
// ============================================================================================
describe('subirComplemento(): REP compartido entre parcialidades de la misma factura (D3)', () => {
  const repXml = (repUuid: string, doctos: Array<[string, number]>) => `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:pago20="http://www.sat.gob.mx/Pagos20"
  xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" TipoDeComprobante="P" Fecha="2026-11-02T10:00:00">
  <cfdi:Emisor Rfc="${RFC_PROV}" Nombre="Proveedor SA"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Empresa"/>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      ${doctos
        .map(
          ([id, imp], i) => `<pago20:Pago FechaPago="2026-11-0${i + 1}T12:00:00" MonedaP="MXN" Monto="${imp.toFixed(2)}">
        <pago20:DoctoRelacionado IdDocumento="${id}" NumParcialidad="${i + 1}" ImpPagado="${imp.toFixed(2)}"/>
      </pago20:Pago>`,
        )
        .join('\n      ')}
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital UUID="${repUuid}"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

  const pagada = (idCxp: string, idCxpPPD: string, extra: Fila = {}): Fila =>
    parcial(idCxp, { idCxpPPD, idEstado: 6, total: 6264, montoAplicado: 6264, uuidComplemento: null, folio: `${idCxp}-folio`, ...extra });

  const REP = 'AAAAAAAA-0000-4000-8000-000000000001';

  it('el mismo REP (2 doctos) se registra en 2 parcialidades de la factura; la 3.ª se rechaza', async () => {
    const t = montar({
      tablas: {
        cxp_ppd: [maestro({ total: 18792 })],
        cxp: [pagada('X1', 'M1'), pagada('X2', 'M1'), pagada('X3', 'M1')],
      },
    });
    const xml = Buffer.from(repXml(REP, [[UUID, 6264], [UUID, 6264]]), 'utf8');
    assert.deepEqual(await t.ppd.subirComplemento('X1', xml, null, UID), { uuid: REP });
    assert.deepEqual(await t.ppd.subirComplemento('X2', xml, null, UID), { uuid: REP });
    const e = await rechazo(t.ppd.subirComplemento('X3', xml, null, UID));
    assert.ok(e instanceof BadRequestException);
    assert.match(textoDe(e), /solo puede amparar una parcialidad/);
    const uuids = filasCxp(t).map((f) => f['uuidComplemento']);
    assert.deepEqual(uuids, [REP, REP, null]);
  });

  it('REP con importes distintos: cada parcialidad empata con el documento de su importe', async () => {
    const t = montar({
      tablas: {
        cxp_ppd: [maestro({ total: 12000 })],
        cxp: [
          pagada('X1', 'M1', { total: 4000, montoAplicado: 4000 }),
          pagada('X2', 'M1', { total: 8000, montoAplicado: 8000 }),
        ],
      },
    });
    const xml = Buffer.from(repXml(REP, [[UUID, 8000], [UUID, 4000]]), 'utf8');
    await t.ppd.subirComplemento('X2', xml, null, UID);
    await t.ppd.subirComplemento('X1', xml, null, UID);
    assert.deepEqual(filasCxp(t).map((f) => f['uuidComplemento']), [REP, REP]);
  });

  it('el mismo UUID de REP en OTRA factura sigue rechazado', async () => {
    const t = montar({
      tablas: {
        cxp_ppd: [maestro({ total: 12528 }), maestro({ idCxpPPD: 'M2', folio: UUID2, total: 6264 })],
        cxp: [pagada('X1', 'M1'), pagada('Y1', 'M2', { folio: `${UUID2}` })],
      },
    });
    // Un REP que ampara a las dos facturas: se registra en la primera, y NO puede repetirse en la otra.
    const xml = Buffer.from(repXml(REP, [[UUID, 6264], [UUID2, 6264]]), 'utf8');
    await t.ppd.subirComplemento('X1', xml, null, UID);
    const e = await rechazo(t.ppd.subirComplemento('Y1', xml, null, UID));
    assert.ok(e instanceof BadRequestException);
    assert.match(textoDe(e), /ya fue registrado en otra solicitud/);
    assert.equal(filasCxp(t).find((f) => f['idCxp'] === 'Y1')!['uuidComplemento'], null);
  });

  it('un REP de 1 solo documento NO ampara una 2.ª parcialidad de igual importe', async () => {
    const t = montar({
      tablas: {
        cxp_ppd: [maestro({ total: 12528 })],
        cxp: [pagada('X1', 'M1'), pagada('X2', 'M1')],
      },
    });
    const xml = Buffer.from(repXml(REP, [[UUID, 6264]]), 'utf8');
    await t.ppd.subirComplemento('X1', xml, null, UID);
    const e = await rechazo(t.ppd.subirComplemento('X2', xml, null, UID));
    assert.ok(e instanceof BadRequestException);
    assert.match(textoDe(e), /no coincide con el monto de la parcialidad/);
  });

  it('un REP de una parcialidad sola se registra como siempre', async () => {
    const t = montar({ tablas: { cxp_ppd: [maestro({ total: 6264 })], cxp: [pagada('X1', 'M1')] } });
    const xml = Buffer.from(repXml(REP, [[UUID, 6264]]), 'utf8');
    assert.deepEqual(await t.ppd.subirComplemento('X1', xml, null, UID), { uuid: REP });
    assert.equal(filasCxp(t)[0]!['uuidComplemento'], REP);
    assert.equal(t.ctx.storage.subidos.length, 1);
  });
});
