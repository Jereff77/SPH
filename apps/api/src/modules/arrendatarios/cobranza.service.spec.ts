import {
  BadRequestException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CobranzaService, respuestaDeCodigoPago } from './cobranza.service.js';
import { TraspasosDepositoService } from './traspasos-deposito.service.js';
import { crearSupabaseFalso, type Fila } from './supabase-falso.testing-spec.js';

/**
 * Pruebas de CobranzaService para el traspaso de depósito (06 §5.2):
 * - `pagos()` oculta lo traspasado (D6) y etiqueta el complemento (D16); con 0 traspasos
 *   devuelve las filas EXACTAMENTE como antes (06 §4 #8).
 * - `aplicarPago` hace UNA llamada de escritura a `arre_aplicar_pago_atomico` (D9), conserva
 *   las validaciones TS de moneda/tolerancia con sus mensajes y mapea los códigos de la BD
 *   sin reenviar su `mensaje` (regla 4b).
 */

const UID = '11111111-1111-4111-8111-111111111111';
const SECRETO = 'duplicate key value violates unique constraint "arre_pagos_partida_activa_idx"';

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

const codigoDe = (e: unknown): unknown => {
  const r = (e as HttpException).getResponse();
  return typeof r === 'object' && r !== null ? (r as Record<string, unknown>).codigo : undefined;
};

function servicio(opts: Parameters<typeof crearSupabaseFalso>[0] = {}) {
  const f = crearSupabaseFalso(opts);
  const svc = new CobranzaService(f.supabase, new TraspasosDepositoService(f.supabase));
  return { svc, ...f };
}

// ----------------------------- pagos() -----------------------------

const filaPago = (extra: Fila): Fila => ({
  concepto: 'Renta',
  divisa: 'MXN',
  fec_pago: null,
  fecha: '2026-10-17',
  id_arrepdp: 'PDP_2026',
  id_detalle: 'R1',
  monto: 1000,
  nave: '12',
  num_partida: 1,
  parque: 'Ocupar 2',
  razon_social: 'DEUMEX TRADING SA DE CV',
  ...extra,
});

const RENTA = filaPago({});
const DEP_DESTINO = filaPago({ concepto: 'Depósito Garantía', id_detalle: 'D26_DEP', num_partida: 0, monto: 26639.11 });
const DEP_ORIGEN_A = filaPago({ concepto: 'Depósito Garantía', id_detalle: 'DA_DEP', id_arrepdp: 'PDP_A_2025', num_partida: 0, monto: 237002.955 });
const DEP_ORIGEN_B = filaPago({ concepto: 'Depósito Garantía', id_detalle: 'DB_DEP', id_arrepdp: 'PDP_B_2025', num_partida: 0, monto: 237002.955 });
// Deumex nave B 2026: depósito «pagado en 0» (existe hoy y debe seguir saliendo igual)
const DEP_PAGADO_EN_0 = filaPago({ concepto: 'Depósito Garantía', id_detalle: 'DB26_DEP', id_arrepdp: 'PDP_B_2026', num_partida: 0, monto: 0, fec_pago: '2026-10-08' });

const TRASPASOS_DEUMEX: Fila[] = [
  { seq: 1, estado: 'aplicado', idDetOrigen: 'DA_DEP', idDetDestino: 'D26_DEP', monto: 237002.955 },
  { seq: 2, estado: 'aplicado', idDetOrigen: 'DB_DEP', idDetDestino: 'D26_DEP', monto: 237002.955 },
];

describe('CobranzaService.pagos (D6/D16)', () => {
  const con = (filas: Fila[], traspasos: Fila[]) =>
    servicio({
      tablas: { parques: [], catParametros: [], arre_traspasos_deposito: traspasos },
      rpc: { pagos_arrendatarios: () => filas },
    });

  it('con 0 traspasos devuelve las filas como siempre: base, iva y monto; el depósito no causa IVA; sin campos nuevos', async () => {
    const { svc } = con([RENTA, DEP_DESTINO, DEP_PAGADO_EN_0], []);
    const r = await svc.pagos({ anios: [2026] });
    expect(r).toHaveLength(3);
    const renta = r.find((x) => x.id_detalle === 'R1')!;
    expect(renta.base).toBe(1000);
    expect(renta.iva).toBe(160);
    expect(renta.monto).toBe(1160);
    const dep = r.find((x) => x.id_detalle === 'D26_DEP')!;
    expect(dep.base).toBe(26639.11);
    expect(dep.iva).toBe(0);
    expect(dep.monto).toBe(26639.11);
    expect('traspasoRecibido' in dep).toBe(false);
    // el «pagado en 0» sigue ahí, igual que hoy
    const en0 = r.find((x) => x.id_detalle === 'DB26_DEP')!;
    expect(en0.monto).toBe(0);
    expect(en0.fec_pago).toBe('2026-10-08');
  });

  it('sin filas de depósito ni siquiera consulta la tabla de traspasos', async () => {
    const { svc, ctx } = con([RENTA], TRASPASOS_DEUMEX);
    await svc.pagos({ anios: [2026] });
    expect(ctx.consultas).not.toContain('arre_traspasos_deposito');
  });

  it('Deumex: los depósitos de los orígenes ya NO aparecen y el destino sale como complemento', async () => {
    const { svc } = con([RENTA, DEP_DESTINO, DEP_ORIGEN_A, DEP_ORIGEN_B], TRASPASOS_DEUMEX);
    const r = await svc.pagos({ anios: [2026] });
    expect(r.map((x) => x.id_detalle).sort()).toEqual(['D26_DEP', 'R1']);
    const dep = r.find((x) => x.id_detalle === 'D26_DEP')!;
    expect(dep.monto).toBe(26639.11);
    expect(dep.traspasoRecibido).toBe(474005.91);
  });

  it('destino sin pendiente (nave 18, ya pagado por traspaso) sigue listado como pagado, con su etiqueta', async () => {
    const pagado = filaPago({ concepto: 'Depósito Garantía', id_detalle: 'D18_DEP', num_partida: 0, monto: 0, fec_pago: '2026-10-20' });
    const { svc } = con(
      [pagado],
      [{ seq: 1, estado: 'aplicado', idDetOrigen: 'O18_DEP', idDetDestino: 'D18_DEP', monto: 97710 }],
    );
    const r = await svc.pagos({ anios: [2026] });
    expect(r).toHaveLength(1);
    expect(r[0]!.monto).toBe(0);
    expect(r[0]!.traspasoRecibido).toBe(97710);
  });

  it('D6 solo aplica a lo POR COBRAR: un depósito de origen YA PAGADO sigue contando como «Cobrado», sin rebaja ni omisión', async () => {
    const pagadoA = { ...DEP_ORIGEN_A, fec_pago: '2025-11-03' };
    const { svc } = con([pagadoA, DEP_ORIGEN_B], TRASPASOS_DEUMEX);
    const r = await svc.pagos({ anios: [2026] });
    // el pagado se queda tal cual (el dashboard lo suma en «Cobrado»); el pendiente del otro origen sí se oculta
    expect(r.map((x) => x.id_detalle)).toEqual(['DA_DEP']);
    expect(r[0]!.monto).toBe(237002.955);
    expect(r[0]!.base).toBe(237002.955);
    expect(r[0]!.fec_pago).toBe('2025-11-03');
  });

  it('un traspaso REVERTIDO no oculta nada', async () => {
    const { svc } = con([DEP_ORIGEN_A], [{ seq: 1, estado: 'revertido', idDetOrigen: 'DA_DEP', idDetDestino: 'D26_DEP', monto: 237002.955 }]);
    const r = await svc.pagos({ anios: [2026] });
    expect(r).toHaveLength(1);
    expect(r[0]!.monto).toBe(237002.955);
  });

  it('partidasPendientesArrendatario también oculta lo traspasado (mismo origen de datos)', async () => {
    const { svc } = servicio({
      tablas: {
        parques: [],
        catParametros: [],
        arrePdp: [{ fecInicio: '2025-01-01', fecFin: '2026-12-31', status: true }],
        arre_traspasos_deposito: TRASPASOS_DEUMEX,
      },
      rpc: { pagos_arrendatarios: () => [DEP_DESTINO, DEP_ORIGEN_A, DEP_ORIGEN_B] },
    });
    const r = await svc.partidasPendientesArrendatario('DEUMEX TRADING SA DE CV');
    expect(r.every((x) => x.id_detalle === 'D26_DEP')).toBe(true);
    expect(r.length).toBeGreaterThan(0);
  });
});

// ----------------------------- aplicarPago() -----------------------------

describe('CobranzaService.aplicarPago (D9: una llamada atómica)', () => {
  const dto = { idmov: 'MOV1', idsDetalle: ['R1', 'D26_DEP'], fecPago: '2026-10-21' };

  const tablas = (extra: Record<string, Fila[]> = {}): Record<string, Fila[]> => ({
    movbancarios: [{ idmov: 'MOV1', importe: 27799.11, aplicado: false, ordenante: 'DEUMEX', moneda: 'MXN' }],
    arre_pagos: [],
    arrePdpDetalle: [
      { idArrePdpDet: 'R1', cantidad: 1000, concepto: 'Renta', idArrePdp: 'PDP_2026', fecPago: null, moneda: 'MXN' },
      { idArrePdpDet: 'D26_DEP', cantidad: 26639.11, concepto: 'Depósito Garantía', idArrePdp: 'PDP_2026', fecPago: null, moneda: 'MXN' },
    ],
    arrePdp: [{ idArrePdp: 'PDP_2026', Moneda: 'MXN', idArrendador: 'TOK' }],
    SPHConfiguraciones: [{ parametro: 'ARRE_TOLERANCIA_PAGO', valor: 0.05, status: true }],
    catParametros: [{ idCorto: 'iva', status: true, valor: 0.16, fechaIni: '2026-01-01' }],
    arre_ordenante: [],
    ...extra,
  });

  const OK = {
    exito: true,
    codigo: 'EXITO',
    detalles: { importe: 27799.11, aplicado: 27799.11, saldoAFavor: 0, agotado: true, partidas: 2 },
  };

  it('hace UNA sola llamada de escritura (arre_aplicar_pago_atomico) con comoActor y NO usa las tres escrituras de antes', async () => {
    const { svc, ctx } = servicio({ tablas: tablas(), rpc: { arre_aplicar_pago_atomico: OK } });
    const r = await svc.aplicarPago(dto, UID);

    expect(r).toEqual({ importe: 27799.11, aplicado: 27799.11, saldoAFavor: 0, agotado: true });
    expect(ctx.rpcs).toHaveLength(1);
    const c = ctx.rpcs[0]!;
    expect(c.fn).toBe('arre_aplicar_pago_atomico');
    expect(c.via).toBe('actor');
    expect(c.uid).toBe(UID);
    expect(c.args.p_idmov).toBe('MOV1');
    expect(c.args.p_fec_pago).toBe('2026-10-21');
    expect(c.args.p_tolerancia).toBe(0.05);
    expect(String(c.args.p_uid_pago)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(c.args.p_lineas).toEqual([
      { idArrePdpDet: 'R1', cantidadEsperada: 1000, monto: 1160 },
      { idArrePdpDet: 'D26_DEP', cantidadEsperada: 26639.11, monto: 26639.11 },
    ]);
    // ni aplicar_pago_arrendatario, ni insert en arre_pagos, ni update de movbancarios
    expect(ctx.rpcs.some((x) => x.fn === 'aplicar_pago_arrendatario')).toBe(false);
    expect(ctx.escrituras.some((w) => w.tabla === 'arre_pagos' || w.tabla === 'movbancarios')).toBe(false);
  });

  it('la cifra de saldo a favor y si se agotó salen de la función (que decide bajo candado)', async () => {
    const { svc } = servicio({
      tablas: tablas({
        movbancarios: [{ idmov: 'MOV1', importe: 30000, aplicado: false, ordenante: 'DEUMEX', moneda: 'MXN' }],
      }),
      rpc: {
        arre_aplicar_pago_atomico: {
          exito: true,
          codigo: 'EXITO',
          detalles: { importe: 30000, aplicado: 27799.11, saldoAFavor: 2200.89, agotado: false, partidas: 2 },
        },
      },
    });
    const r = await svc.aplicarPago(dto, UID);
    expect(r).toEqual({ importe: 30000, aplicado: 27799.11, saldoAFavor: 2200.89, agotado: false });
  });

  it('PARTIDA_CAMBIO → 409 «recarga» y nada más se escribe (el saldo bancario no se consume)', async () => {
    const { svc, ctx } = servicio({
      tablas: tablas(),
      rpc: { arre_aplicar_pago_atomico: { exito: false, codigo: 'PARTIDA_CAMBIO', mensaje: SECRETO, detalles: { idArrePdpDet: 'D26_DEP' } } },
    });
    const e = await rechazo(svc.aplicarPago(dto, UID));
    expect(e).toBeInstanceOf(ConflictException);
    expect(textoDe(e)).toContain('recarga');
    expect(codigoDe(e)).toBe('PARTIDA_CAMBIO');
    expect(textoDe(e)).not.toContain('arre_pagos_partida_activa_idx');
    expect(ctx.escrituras.filter((w) => w.tabla !== 'actividad')).toHaveLength(0);
    expect(ctx.escrituras.some((w) => w.tabla === 'actividad')).toBe(false);
  });

  it('DEPOSITO_TRASPASADO y OCUPADO → 409', async () => {
    for (const codigo of ['DEPOSITO_TRASPASADO', 'OCUPADO']) {
      const { svc } = servicio({
        tablas: tablas(),
        rpc: { arre_aplicar_pago_atomico: { exito: false, codigo, mensaje: SECRETO } },
      });
      const e = await rechazo(svc.aplicarPago(dto, UID));
      expect(e).toBeInstanceOf(ConflictException);
      expect(codigoDe(e)).toBe(codigo);
    }
  });

  it('códigos de saldo/partida mapean a 400 con los textos de siempre', async () => {
    const { svc } = servicio({
      tablas: tablas(),
      rpc: { arre_aplicar_pago_atomico: { exito: false, codigo: 'SALDO_INSUFICIENTE', mensaje: SECRETO, detalles: { total: 27799.11, saldo: 100, tolerancia: 0.05 } } },
    });
    const e = await rechazo(svc.aplicarPago(dto, UID));
    expect(e).toBeInstanceOf(BadRequestException);
    expect(textoDe(e)).toContain('El total seleccionado (27799.11) excede el saldo disponible del depósito (100.00)');
    expect(codigoDe(e)).toBe('SALDO_INSUFICIENTE');
    expect(respuestaDeCodigoPago('PARTIDA_PAGADA')!.mensaje).toBe('Alguna partida seleccionada ya estaba pagada.');
    expect(respuestaDeCodigoPago('MOV_AGOTADO')!.mensaje).toContain('aplicado por completo');
  });

  it('ERROR_INTERNO, SIN_ACTOR, códigos desconocidos y fallas de red → 500 genérico (sin SQL ni detalle)', async () => {
    for (const rpc of [
      { exito: false, codigo: 'ERROR_INTERNO', mensaje: 'Error interno.', detalles: { sqlstate: '23505', detalle: SECRETO } },
      { exito: false, codigo: 'SIN_ACTOR', mensaje: SECRETO },
      { exito: false, codigo: 'NUEVO_CODIGO', mensaje: SECRETO },
      { __error: SECRETO },
    ]) {
      const { svc } = servicio({ tablas: tablas(), rpc: { arre_aplicar_pago_atomico: rpc } });
      const e = await rechazo(svc.aplicarPago(dto, UID));
      expect(e).toBeInstanceOf(InternalServerErrorException);
      expect(codigoDe(e)).toBe('ERROR_INTERNO');
      expect(textoDe(e)).not.toContain('arre_pagos_partida_activa_idx');
      expect(textoDe(e)).not.toContain('23505');
    }
  });

  it('se conserva la validación de moneda en TS (mismo mensaje) y NO se llama a la BD', async () => {
    const { svc, ctx } = servicio({
      tablas: tablas({
        movbancarios: [{ idmov: 'MOV1', importe: 27799.11, aplicado: false, ordenante: 'DEUMEX', moneda: 'USD' }],
      }),
      rpc: { arre_aplicar_pago_atomico: OK },
    });
    const e = await rechazo(svc.aplicarPago(dto, UID));
    expect(e).toBeInstanceOf(BadRequestException);
    expect(textoDe(e)).toContain('El depósito es USD y la partida «Renta» está en MXN');
    expect(codigoDe(e)).toBe('MONEDA_DISTINTA');
    expect(ctx.rpcs).toHaveLength(0);
  });

  it('se conserva la validación de tolerancia en TS (mismo mensaje) y NO se llama a la BD', async () => {
    const { svc, ctx } = servicio({
      tablas: tablas({
        movbancarios: [{ idmov: 'MOV1', importe: 100, aplicado: false, ordenante: 'DEUMEX', moneda: 'MXN' }],
      }),
      rpc: { arre_aplicar_pago_atomico: OK },
    });
    const e = await rechazo(svc.aplicarPago(dto, UID));
    expect(e).toBeInstanceOf(BadRequestException);
    expect(textoDe(e)).toContain('El total seleccionado (27799.11) excede el saldo disponible del depósito (100.00) por más del margen permitido (0.05).');
    expect(ctx.rpcs).toHaveLength(0);
  });

  it('partida ya pagada o inexistente: mismos mensajes de antes, sin llamar a la BD', async () => {
    const pagada = servicio({
      tablas: tablas({
        arrePdpDetalle: [
          { idArrePdpDet: 'R1', cantidad: 1000, concepto: 'Renta', idArrePdp: 'PDP_2026', fecPago: '2026-10-01', moneda: 'MXN' },
          { idArrePdpDet: 'D26_DEP', cantidad: 26639.11, concepto: 'Depósito Garantía', idArrePdp: 'PDP_2026', fecPago: null, moneda: 'MXN' },
        ],
      }),
      rpc: { arre_aplicar_pago_atomico: OK },
    });
    const ePagada = await rechazo(pagada.svc.aplicarPago(dto, UID));
    expect(textoDe(ePagada)).toContain('Alguna partida seleccionada ya estaba pagada.');
    expect(codigoDe(ePagada)).toBe('PARTIDA_PAGADA');
    expect(pagada.ctx.rpcs).toHaveLength(0);

    const falta = servicio({ tablas: tablas({ arrePdpDetalle: [] }), rpc: { arre_aplicar_pago_atomico: OK } });
    expect(textoDe(await rechazo(falta.svc.aplicarPago(dto, UID)))).toContain('Alguna partida seleccionada no existe.');
  });
});

// ----------------------------- desaplicarPago() -----------------------------

describe('CobranzaService.desaplicarPago (guarda D13 del depósito traspasado)', () => {
  const OKRPC = { desaplicar_pago_arrendatario: {} };
  const pago = (idDet: string): Fila => ({ id: `p-${idDet}`, uidPago: 'UP1', estado: 'aplicado', idArrePdpDet: idDet, idmov: 'MOV1' });

  it('depósito de un ORIGEN con traspaso emitido aplicado → 409 TRASPASO_APLICADO y NO se desaplica nada', async () => {
    const { svc, ctx } = servicio({
      tablas: { arre_pagos: [pago('DA_DEP')], arre_traspasos_deposito: TRASPASOS_DEUMEX.map((t) => ({ ...t, id: `t${t.seq}` })) },
      rpc: OKRPC,
    });
    const e = await rechazo(svc.desaplicarPago('UP1', UID));
    expect(e).toBeInstanceOf(ConflictException);
    expect(codigoDe(e)).toBe('TRASPASO_APLICADO');
    expect(textoDe(e)).toContain('Revierte primero el traspaso de este depósito');
    expect(ctx.rpcs).toHaveLength(0);
    expect(ctx.escrituras).toHaveLength(0);
  });

  it('un pago que incluye renta Y el depósito del origen también se bloquea completo', async () => {
    const { svc, ctx } = servicio({
      tablas: { arre_pagos: [pago('R1'), pago('DA_DEP')], arre_traspasos_deposito: TRASPASOS_DEUMEX },
      rpc: OKRPC,
    });
    expect(codigoDe(await rechazo(svc.desaplicarPago('UP1', UID)))).toBe('TRASPASO_APLICADO');
    expect(ctx.rpcs).toHaveLength(0);
  });

  it('el pago del complemento de un DESTINO sí se puede desaplicar (paso previo para revertir)', async () => {
    const { svc, ctx } = servicio({
      tablas: { arre_pagos: [pago('D26_DEP')], arre_traspasos_deposito: TRASPASOS_DEUMEX },
      rpc: OKRPC,
    });
    const r = await svc.desaplicarPago('UP1', UID, 'Pago mal aplicado');
    expect(r).toEqual({ ok: true, partidas: 1, idmov: 'MOV1' });
    expect(ctx.rpcs.map((c) => c.fn)).toEqual(['desaplicar_pago_arrendatario']);
    expect(ctx.escrituras.some((w) => w.tabla === 'arre_pagos' && w.tipo === 'update')).toBe(true);
  });

  it('un traspaso REVERTIDO del origen ya no bloquea', async () => {
    const { svc } = servicio({
      tablas: { arre_pagos: [pago('DA_DEP')], arre_traspasos_deposito: [{ id: 't1', seq: 1, estado: 'revertido', idDetOrigen: 'DA_DEP', idDetDestino: 'D26_DEP', monto: 1 }] },
      rpc: OKRPC,
    });
    expect((await svc.desaplicarPago('UP1', UID)).ok).toBe(true);
  });

  it('sin traspasos: se desaplica igual que antes (una RPC, un update y la actividad)', async () => {
    const { svc, ctx } = servicio({ tablas: { arre_pagos: [pago('R1'), pago('D26_DEP')], arre_traspasos_deposito: [] }, rpc: OKRPC });
    const r = await svc.desaplicarPago('UP1', UID);
    expect(r).toEqual({ ok: true, partidas: 2, idmov: 'MOV1' });
    expect(ctx.rpcs).toHaveLength(1);
    expect(ctx.rpcs[0]!.args).toEqual({ p_idmov: 'MOV1', p_ids_detalle: ['R1', 'D26_DEP'] });
    expect(ctx.escrituras.map((w) => `${w.tabla}:${w.tipo}`).sort()).toEqual(['actividad:insert', 'arre_pagos:update']);
  });

  it('pago inexistente: 404 como siempre', async () => {
    const { svc } = servicio({ tablas: { arre_pagos: [] }, rpc: OKRPC });
    expect((await rechazo(svc.desaplicarPago('NO', UID)) as HttpException).getStatus()).toBe(404);
  });
});
