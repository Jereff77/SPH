import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { traspasarDepositoSchema, revertirTraspasoSchema } from './arrendatarios.schemas.js';
import { calcularDeposito, esConceptoDeposito } from './deposito.util.js';
import { crearSupabaseFalso, type Fila } from './supabase-falso.testing-spec.js';
import {
  TraspasosDepositoService,
  respuestaDeCodigo,
  textoBloqueo,
} from './traspasos-deposito.service.js';

/**
 * Pruebas del servicio de traspaso de depósito (06 §5.2): mapa código→HTTP completo, que
 * NUNCA se reenvía el `mensaje`/`detalle` de la BD, que todo va con `comoActor`, la
 * idempotencia, las guardas D13 y el cálculo del depósito (paridad con 04-FLUJOS).
 */

const UID = '11111111-1111-4111-8111-111111111111';
const CLAVE = '22222222-2222-4222-8222-222222222222';
const SECRETO = 'relation "arre_traspasos_deposito" violates foreign key constraint fk_secreto';

const dto = (extra: Partial<Record<string, unknown>> = {}) =>
  traspasarDepositoSchema.parse({
    origenes: ['PDP_A_2025', 'PDP_B_2025'],
    fecTraspaso: '2026-10-20',
    nota: 'Contrato SPH-2025-12',
    confirmado: true,
    claveIdempotencia: CLAVE,
    ...extra,
  });

async function rechazo(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error('Se esperaba un rechazo y la promesa se resolvió.');
}

const textoDe = (e: unknown): string => {
  const x = e as HttpException;
  const r = x.getResponse();
  return typeof r === 'string' ? r : JSON.stringify(r);
};

/** `codigo` de negocio que viaja en el cuerpo de la excepción (el filtro global lo responde tal cual). */
const codigoDe = (e: unknown): unknown => {
  const r = (e as HttpException).getResponse();
  return typeof r === 'object' && r !== null ? (r as Record<string, unknown>).codigo : undefined;
};
const mensajeDe = (e: unknown): unknown => {
  const r = (e as HttpException).getResponse();
  return typeof r === 'object' && r !== null ? (r as Record<string, unknown>).message : r;
};

function servicio(opts: Parameters<typeof crearSupabaseFalso>[0] = {}) {
  const f = crearSupabaseFalso(opts);
  return { svc: new TraspasosDepositoService(f.supabase), ...f };
}

describe('esConceptoDeposito / calcularDeposito', () => {
  it('reconoce el depósito con y sin acentos y rechaza otros conceptos', () => {
    expect(esConceptoDeposito('Depósito Garantía')).toBe(true);
    expect(esConceptoDeposito('  DEPOSITO GARANTIA ')).toBe(true);
    expect(esConceptoDeposito('Deposito de Garantia (anexo)')).toBe(true);
    expect(esConceptoDeposito('Renta')).toBe(false);
    expect(esConceptoDeposito(null)).toBe(false);
  });

  it('Deumex destino: 2 × 237,002.955 traspasados dejan EXACTO 26,639.11 por cobrar', () => {
    const c = calcularDeposito({ cantidad: 26639.11, recibido: 474005.91, emitido: 0, pagada: false });
    expect(c.contractual).toBe(500645.02);
    expect(c.porCobrar).toBe(26639.11);
    expect(c.disponible).toBe(500645.02);
  });

  it('Deumex origen: emitió todo, ya no tiene nada por cobrar ni disponible', () => {
    const c = calcularDeposito({ cantidad: 237002.955, recibido: 0, emitido: 237002.955, pagada: false });
    expect(c.porCobrar).toBe(0);
    expect(c.disponible).toBe(0);
    expect(c.contractual).toBe(237002.955);
  });

  it('cadena 2023→2025→2026: el del medio recibe 218,283.70 y su disponible es 237,002.955; luego emite y queda en 0', () => {
    const recibe = calcularDeposito({ cantidad: 18719.255, recibido: 218283.7, emitido: 0, pagada: false });
    expect(recibe.disponible).toBe(237002.955);
    expect(recibe.contractual).toBe(237002.955);
    expect(recibe.porCobrar).toBe(18719.255);
    const emite = calcularDeposito({ cantidad: 18719.255, recibido: 218283.7, emitido: 237002.955, pagada: false });
    expect(emite.disponible).toBe(0);
    expect(emite.porCobrar).toBe(0); // 00 §10 #10: al emitir deja de mostrar su complemento por cobrar
  });

  it('nave 18 (97,710 → 97,710): destino en 0 y pagado por traspaso', () => {
    const c = calcularDeposito({ cantidad: 0, recibido: 97710, emitido: 0, pagada: true });
    expect(c.contractual).toBe(97710);
    expect(c.porCobrar).toBe(0);
  });

  it('sin traspasos la partida se calcula como siempre (pendiente = cantidad; pagada = 0)', () => {
    expect(calcularDeposito({ cantidad: 100, recibido: 0, emitido: 0, pagada: false }).porCobrar).toBe(100);
    expect(calcularDeposito({ cantidad: 100, recibido: 0, emitido: 0, pagada: true }).porCobrar).toBe(0);
  });
});

describe('traspasarDepositoSchema / revertirTraspasoSchema (zod)', () => {
  const base = {
    origenes: ['A'],
    fecTraspaso: '2026-10-20',
    nota: 'Folio 12345678',
    confirmado: true,
    claveIdempotencia: CLAVE,
  };

  it('acepta un cuerpo válido (sin montos ni arrendador)', () => {
    expect(traspasarDepositoSchema.safeParse(base).success).toBe(true);
  });
  it('rechaza nota menor a 10 caracteres', () => {
    expect(traspasarDepositoSchema.safeParse({ ...base, nota: 'corta' }).success).toBe(false);
  });
  it('rechaza confirmado distinto de true', () => {
    expect(traspasarDepositoSchema.safeParse({ ...base, confirmado: false }).success).toBe(false);
    expect(traspasarDepositoSchema.safeParse({ ...base, confirmado: undefined }).success).toBe(false);
  });
  it('rechaza orígenes vacíos, repetidos o más de 10', () => {
    expect(traspasarDepositoSchema.safeParse({ ...base, origenes: [] }).success).toBe(false);
    expect(traspasarDepositoSchema.safeParse({ ...base, origenes: ['A', 'A'] }).success).toBe(false);
    const once = Array.from({ length: 11 }, (_, i) => `P${i}`);
    expect(traspasarDepositoSchema.safeParse({ ...base, origenes: once }).success).toBe(false);
  });
  it('rechaza clave de idempotencia que no es UUID y fechas imposibles', () => {
    expect(traspasarDepositoSchema.safeParse({ ...base, claveIdempotencia: 'no-uuid' }).success).toBe(false);
    expect(traspasarDepositoSchema.safeParse({ ...base, fecTraspaso: '2026-02-31' }).success).toBe(false);
    expect(traspasarDepositoSchema.safeParse({ ...base, fecTraspaso: '20/10/2026' }).success).toBe(false);
  });
  it('revertir exige motivo de 5 a 400 caracteres', () => {
    expect(revertirTraspasoSchema.safeParse({ motivo: 'err' }).success).toBe(false);
    expect(revertirTraspasoSchema.safeParse({ motivo: 'Se capturó mal' }).success).toBe(true);
    expect(revertirTraspasoSchema.safeParse({ motivo: 'x'.repeat(401) }).success).toBe(false);
  });
});

describe('respuestaDeCodigo (mapa código → HTTP + texto escrito a mano)', () => {
  const casos: Array<[string, 400 | 404 | 409]> = [
    ['CONFIRMACION_REQUERIDA', 400],
    ['NOTA_INVALIDA', 400],
    ['FECHA_INVALIDA', 400],
    ['PARAMETRO_INVALIDO', 400],
    ['MOTIVO_INVALIDO', 400],
    ['ORIGEN_ES_DESTINO', 400],
    ['ORIGEN_NO_VALIDO', 400],
    ['ORIGEN_BLOQUEADO', 409],
    ['EXCEDE_DESTINO', 409],
    ['DESTINO_PAGADO', 409],
    ['DESTINO_SIN_SALDO', 409],
    ['DEPOSITO_NO_ESTANDAR', 409],
    ['DEPOSITO_DESTINO_INVALIDO', 409],
    ['MONEDA_INVALIDA', 409],
    ['FECHAS_INVALIDAS', 409],
    ['PAGO_APLICADO', 409],
    ['DESTINO_YA_EMITIO', 409],
    ['REVERTIR_ANTES_OTRO', 409],
    ['YA_REVERTIDO', 409],
    ['OCUPADO', 409],
    ['PARTIDA_CAMBIO', 409],
    ['DEPOSITO_TRASPASADO', 409],
    ['ESTADO_INCONSISTENTE', 409],
    ['DESTINO_NO_ENCONTRADO', 404],
    ['TRASPASO_NO_ENCONTRADO', 404],
  ];

  for (const [codigo, status] of casos) {
    it(`${codigo} → ${status} con texto en español`, () => {
      const r = respuestaDeCodigo(codigo, {});
      expect(r).not.toBeNull();
      expect(r!.status).toBe(status);
      expect(r!.mensaje.length).toBeGreaterThan(15);
      expect(r!.mensaje).not.toContain(codigo); // nunca el código crudo como texto
    });
  }

  it('los imprevistos (ERROR_INTERNO, SIN_ACTOR, desconocidos) no tienen texto: van al log', () => {
    expect(respuestaDeCodigo('ERROR_INTERNO')).toBeNull();
    expect(respuestaDeCodigo('SIN_ACTOR')).toBeNull();
    expect(respuestaDeCodigo('CODIGO_NUEVO_DE_LA_BD')).toBeNull();
  });

  it('EXCEDE_DESTINO formatea las cifras con 2–4 decimales', () => {
    const r = respuestaDeCodigo('EXCEDE_DESTINO', { total: 474005.91, cantidadDestino: 400000 })!;
    expect(r.mensaje).toContain('474,005.91');
    expect(r.mensaje).toContain('400,000.00');
    const r2 = respuestaDeCodigo('EXCEDE_DESTINO', { total: 237002.955, cantidadDestino: 100 })!;
    expect(r2.mensaje).toContain('237,002.955');
  });

  it('ORIGEN_BLOQUEADO explica el motivo (y muestra ambos montos si el depósito está en 0)', () => {
    const r = respuestaDeCodigo('ORIGEN_BLOQUEADO', { bloq: 'DEPOSITO_EN_CERO', depPlan: 868305.55 })!;
    expect(r.mensaje).toContain('868,305.55');
    expect(textoBloqueo('MONEDA_DISTINTA', { moneda: 'USD' })).toContain('USD');
    expect(textoBloqueo('INCLUIDO_EN_SIGUIENTE')).toContain('contrato siguiente');
    expect(textoBloqueo('YA_TRASPASADO')).toContain('ya fue traspasado');
  });

  it('cada motivo de bloqueo de la BD tiene su texto escrito a mano (incluido SUCESOR_SIN_DEPOSITO)', () => {
    expect(textoBloqueo('INCLUIDO_EN_SIGUIENTE')).toBe(
      'Su depósito ya está incluido en el contrato siguiente de esta nave. Para limpiar el historial, traspásalo desde ese contrato.',
    );
    expect(textoBloqueo('SUCESOR_SIN_DEPOSITO')).toBe(
      'El contrato siguiente de esta nave tiene depósito en 0; probablemente se consolidó en otra nave del mismo arrendatario. Revisa los planes.',
    );
    expect(textoBloqueo('DEPOSITO_AMBIGUO')).toBe('Este plan tiene más de una partida de depósito; pide apoyo a soporte.');
    for (const motivo of [
      'MONEDA_DISTINTA',
      'DEPOSITO_EN_CERO',
      'YA_TRASPASADO',
      'DEPOSITO_NO_ESTANDAR',
      'DEPOSITO_AMBIGUO',
      'INCLUIDO_EN_SIGUIENTE',
      'SUCESOR_SIN_DEPOSITO',
    ]) {
      expect(textoBloqueo(motivo)).not.toBe(textoBloqueo('MOTIVO_QUE_NO_EXISTE')); // ninguno cae al texto genérico
      const r = respuestaDeCodigo('ORIGEN_BLOQUEADO', { bloq: motivo })!;
      expect(r.status).toBe(409);
      expect(r.mensaje).toContain(textoBloqueo(motivo));
    }
  });

  it('FECHA_INVALIDA también cubre fechas anteriores a 2020', () => {
    expect(respuestaDeCodigo('FECHA_INVALIDA')!.mensaje).toContain('01/01/2020');
  });
});

describe('TraspasosDepositoService.traspasar (errores seguros y actor)', () => {
  const exito = {
    exito: true,
    codigo: 'EXITO',
    mensaje: 'Depósito traspasado.',
    detalles: {
      idDestino: 'PDP_2026',
      total: 474005.91,
      cantidadRestante: 26639.11,
      pagadaPorTraspaso: false,
      traspasos: [
        { id: 'f1', idArrePdpOrigen: 'PDP_A_2025', monto: 237002.955 },
        { id: 'f2', idArrePdpOrigen: 'PDP_B_2025', monto: 237002.955 },
      ],
    },
  };

  it('éxito: llama arre_traspasar_deposito UNA vez con comoActor(uid), sin montos ni arrendador', async () => {
    const { svc, ctx } = servicio({ rpc: { arre_traspasar_deposito: exito } });
    const r = await svc.traspasar('PDP_2026', dto(), UID);

    expect(r.total).toBe(474005.91);
    expect(r.cantidadRestante).toBe(26639.11);
    expect(r.pagadaPorTraspaso).toBe(false);
    expect(r.yaAplicado).toBe(false);
    expect(r.traspasos).toHaveLength(2);

    expect(ctx.rpcs).toHaveLength(1);
    const c = ctx.rpcs[0]!;
    expect(c.fn).toBe('arre_traspasar_deposito');
    expect(c.via).toBe('actor');
    expect(c.uid).toBe(UID);
    expect(Object.keys(c.args).sort()).toEqual(
      ['p_clave_idempotencia', 'p_confirmado', 'p_fec_traspaso', 'p_id_destino', 'p_nota', 'p_origenes'].sort(),
    );
    expect(c.args.p_origenes).toEqual(['PDP_A_2025', 'PDP_B_2025']);
    expect(c.args.p_confirmado).toBe(true);
    // actividad registrada a nombre del actor
    expect(ctx.escrituras.some((e) => e.tabla === 'actividad' && e.uid === UID)).toBe(true);
  });

  it('un rechazo de negocio NUNCA reenvía el mensaje ni el detalle de la BD', async () => {
    const { svc } = servicio({
      rpc: {
        arre_traspasar_deposito: {
          exito: false,
          codigo: 'EXCEDE_DESTINO',
          mensaje: SECRETO,
          detalles: { total: 474005.91, cantidadDestino: 400000, detalle: SECRETO },
        },
      },
    });
    const e = await rechazo(svc.traspasar('PDP_2026', dto(), UID));
    expect(e).toBeInstanceOf(ConflictException);
    expect(textoDe(e)).toContain('474,005.91');
    expect(textoDe(e)).not.toContain('fk_secreto');
    expect(textoDe(e)).not.toContain('arre_traspasos_deposito');
  });

  it('ERROR_INTERNO: 500 genérico; el detalle solo se loguea', async () => {
    const { svc } = servicio({
      rpc: {
        arre_traspasar_deposito: {
          exito: false,
          codigo: 'ERROR_INTERNO',
          mensaje: 'Error interno.',
          detalles: { sqlstate: '23503', detalle: SECRETO },
        },
      },
    });
    const e = await rechazo(svc.traspasar('PDP_2026', dto(), UID));
    expect(e).toBeInstanceOf(InternalServerErrorException);
    expect(textoDe(e)).not.toContain('fk_secreto');
    expect(textoDe(e)).not.toContain('23503');
  });

  it('SIN_ACTOR y códigos desconocidos también quedan en 500 genérico', async () => {
    for (const codigo of ['SIN_ACTOR', 'CODIGO_QUE_NO_EXISTE']) {
      const { svc } = servicio({
        rpc: { arre_traspasar_deposito: { exito: false, codigo, mensaje: SECRETO, detalles: {} } },
      });
      const e = await rechazo(svc.traspasar('PDP_2026', dto(), UID));
      expect(e).toBeInstanceOf(InternalServerErrorException);
      expect(textoDe(e)).not.toContain('fk_secreto');
    }
  });

  it('falla de transporte (error de PostgREST): 500 genérico sin error.message', async () => {
    const { svc } = servicio({ rpc: { arre_traspasar_deposito: { __error: SECRETO } } });
    const e = await rechazo(svc.traspasar('PDP_2026', dto(), UID));
    expect(e).toBeInstanceOf(InternalServerErrorException);
    expect(textoDe(e)).not.toContain('fk_secreto');
  });

  it('ORIGEN_BLOQUEADO usa el motivo de detalles.bloq; DESTINO_NO_ENCONTRADO es 404', async () => {
    const a = servicio({
      rpc: {
        arre_traspasar_deposito: {
          exito: false,
          codigo: 'ORIGEN_BLOQUEADO',
          mensaje: SECRETO,
          detalles: { id: 'PDP_A', bloq: 'YA_TRASPASADO' },
        },
      },
    });
    const e1 = await rechazo(a.svc.traspasar('PDP_2026', dto(), UID));
    expect(e1).toBeInstanceOf(ConflictException);
    expect(textoDe(e1)).toContain('ya fue traspasado');

    const b = servicio({
      rpc: { arre_traspasar_deposito: { exito: false, codigo: 'DESTINO_NO_ENCONTRADO', mensaje: SECRETO } },
    });
    expect(await rechazo(b.svc.traspasar('NO_EXISTE', dto(), UID))).toBeInstanceOf(NotFoundException);
  });

  it('TODO error HTTP lleva `codigo` de negocio junto al texto (la web decide por código, no por texto)', async () => {
    const casos: Array<[string, number]> = [
      ['CONFIRMACION_REQUERIDA', 400], ['NOTA_INVALIDA', 400], ['FECHA_INVALIDA', 400], ['PARAMETRO_INVALIDO', 400],
      ['ORIGEN_ES_DESTINO', 400], ['ORIGEN_NO_VALIDO', 400], ['ORIGEN_BLOQUEADO', 409], ['EXCEDE_DESTINO', 409],
      ['DESTINO_PAGADO', 409], ['DESTINO_SIN_SALDO', 409], ['DEPOSITO_NO_ESTANDAR', 409], ['DEPOSITO_DESTINO_INVALIDO', 409],
      ['MONEDA_INVALIDA', 409], ['FECHAS_INVALIDAS', 409], ['OCUPADO', 409], ['PARTIDA_CAMBIO', 409],
      ['DEPOSITO_TRASPASADO', 409], ['DESTINO_NO_ENCONTRADO', 404],
    ];
    for (const [codigo, status] of casos) {
      const { svc } = servicio({ rpc: { arre_traspasar_deposito: { exito: false, codigo, mensaje: SECRETO, detalles: {} } } });
      const e = await rechazo(svc.traspasar('PDP_2026', dto(), UID));
      expect((e as HttpException).getStatus()).toBe(status);
      expect(codigoDe(e)).toBe(codigo);
      expect(typeof mensajeDe(e)).toBe('string');
      expect(String(mensajeDe(e))).not.toContain('fk_secreto');
    }
    // imprevistos: 500 con codigo ERROR_INTERNO y texto genérico
    for (const rpc of [
      { exito: false, codigo: 'SIN_ACTOR', mensaje: SECRETO },
      { exito: false, codigo: 'ERROR_INTERNO', mensaje: SECRETO, detalles: { detalle: SECRETO } },
      { exito: false, codigo: 'CODIGO_QUE_NO_EXISTE', mensaje: SECRETO },
      { __error: SECRETO },
    ]) {
      const { svc } = servicio({ rpc: { arre_traspasar_deposito: rpc } });
      const e = await rechazo(svc.traspasar('PDP_2026', dto(), UID));
      expect((e as HttpException).getStatus()).toBe(500);
      expect(codigoDe(e)).toBe('ERROR_INTERNO');
      expect(String(mensajeDe(e))).not.toContain('fk_secreto');
    }
  });

  it('idempotencia: YA_APLICADO es éxito y se arma con lo ya aplicado (no duplica)', async () => {
    const { svc, ctx } = servicio({
      tablas: {
        arrePdpDetalle: [
          { idArrePdpDet: 'PDP_2026_DEP', idArrePdp: 'PDP_2026', numPartida: 0, status: true, concepto: 'Depósito Garantía', moneda: 'MXN', cantidad: 26639.11, fecPago: null },
        ],
        arre_traspasos_deposito: [
          { id: 'f1', claveIdempotencia: CLAVE, idArrePdpDestino: 'PDP_2026', estado: 'aplicado', marcoPagada: false },
          { id: 'f2', claveIdempotencia: CLAVE, idArrePdpDestino: 'PDP_2026', estado: 'aplicado', marcoPagada: false },
        ],
      },
      rpc: {
        arre_traspasar_deposito: {
          exito: true,
          codigo: 'YA_APLICADO',
          mensaje: 'Este traspaso ya estaba registrado.',
          detalles: {
            idDestino: 'PDP_2026',
            traspasos: [
              { id: 'f1', idArrePdpOrigen: 'PDP_A_2025', monto: 237002.955 },
              { id: 'f2', idArrePdpOrigen: 'PDP_B_2025', monto: 237002.955 },
            ],
          },
        },
      },
    });
    const r = await svc.traspasar('PDP_2026', dto(), UID);
    expect(r.yaAplicado).toBe(true);
    expect(r.total).toBe(474005.91);
    expect(r.cantidadRestante).toBe(26639.11);
    expect(r.pagadaPorTraspaso).toBe(false);
    // no vuelve a registrar actividad ni a escribir nada
    expect(ctx.escrituras).toHaveLength(0);
  });
});

describe('TraspasosDepositoService.traspasarTrasRenovar (D12)', () => {
  it('éxito → estado aplicado con las cifras', async () => {
    const { svc } = servicio({
      rpc: {
        arre_traspasar_deposito: {
          exito: true,
          codigo: 'EXITO',
          detalles: { total: 97710, cantidadRestante: 0, pagadaPorTraspaso: true, traspasos: [{ id: 'f1', idArrePdpOrigen: 'P18', monto: 97710 }] },
        },
      },
    });
    const r = await svc.traspasarTrasRenovar('NUEVO', dto({ origenes: ['P18'] }), UID);
    expect(r.estado).toBe('aplicado');
    if (r.estado === 'aplicado') {
      expect(r.pagadaPorTraspaso).toBe(true);
      expect(r.cantidadRestante).toBe(0);
    }
  });

  it('rechazo de la BD → estado fallido con código y texto en claro (nunca lanza)', async () => {
    const { svc } = servicio({
      rpc: { arre_traspasar_deposito: { exito: false, codigo: 'OCUPADO', mensaje: SECRETO } },
    });
    const r = await svc.traspasarTrasRenovar('NUEVO', dto(), UID);
    expect(r.estado).toBe('fallido');
    if (r.estado === 'fallido') {
      expect(r.codigo).toBe('OCUPADO');
      expect(r.mensaje).toContain('Recarga');
      expect(r.mensaje).not.toContain('fk_secreto');
    }
  });

  it('si la RPC se cae (excepción), tampoco lanza: fallido ERROR_INTERNO genérico', async () => {
    const { svc } = servicio({
      rpc: {
        arre_traspasar_deposito: () => {
          throw new Error(SECRETO);
        },
      },
    });
    const r = await svc.traspasarTrasRenovar('NUEVO', dto(), UID);
    expect(r.estado).toBe('fallido');
    if (r.estado === 'fallido') {
      expect(r.codigo).toBe('ERROR_INTERNO');
      expect(r.mensaje).not.toContain('fk_secreto');
    }
  });
});

describe('TraspasosDepositoService.revertir', () => {
  const ID = '33333333-3333-4333-8333-333333333333';

  it('identificador que no es UUID → 400 sin llamar a la BD', async () => {
    const { svc, ctx } = servicio();
    const e = await rechazo(svc.revertir('no-es-uuid', { motivo: 'Capturado por error' }, UID));
    expect(e).toBeInstanceOf(BadRequestException);
    expect(ctx.rpcs).toHaveLength(0);
  });

  it('éxito: llama arre_revertir_traspaso con comoActor y devuelve ok', async () => {
    const { svc, ctx } = servicio({
      rpc: { arre_revertir_traspaso: { exito: true, codigo: 'EXITO', detalles: { id: ID, monto: 237002.955, idDestino: 'PDP_2026' } } },
    });
    const r = await svc.revertir(ID, { motivo: 'Capturado por error' }, UID);
    expect(r).toEqual({ ok: true, idDestino: 'PDP_2026', monto: 237002.955 });
    expect(ctx.rpcs[0]!.via).toBe('actor');
    expect(ctx.rpcs[0]!.uid).toBe(UID);
    expect(ctx.rpcs[0]!.args).toEqual({ p_id_traspaso: ID, p_motivo: 'Capturado por error' });
  });

  it('PAGO_APLICADO, DESTINO_YA_EMITIO y REVERTIR_ANTES_OTRO son 409 con texto a mano', async () => {
    for (const [codigo, frag] of [
      ['PAGO_APLICADO', 'desaplica el pago'],
      ['DESTINO_YA_EMITIO', 'Revierte primero'],
      ['REVERTIR_ANTES_OTRO', 'Revierte primero'],
      ['YA_REVERTIDO', 'ya fue revertido'],
    ] as const) {
      const { svc } = servicio({ rpc: { arre_revertir_traspaso: { exito: false, codigo, mensaje: SECRETO } } });
      const e = await rechazo(svc.revertir(ID, { motivo: 'Capturado por error' }, UID));
      expect(e).toBeInstanceOf(ConflictException);
      expect(textoDe(e)).toContain(frag);
      expect(textoDe(e)).not.toContain('fk_secreto');
    }
  });

  it('TRASPASO_NO_ENCONTRADO es 404', async () => {
    const { svc } = servicio({ rpc: { arre_revertir_traspaso: { exito: false, codigo: 'TRASPASO_NO_ENCONTRADO', mensaje: SECRETO } } });
    expect(await rechazo(svc.revertir(ID, { motivo: 'Capturado por error' }, UID))).toBeInstanceOf(NotFoundException);
  });

  it('los errores de reversa llevan `codigo` (incluido el UUID inválido)', async () => {
    for (const codigo of ['PAGO_APLICADO', 'DESTINO_YA_EMITIO', 'REVERTIR_ANTES_OTRO', 'YA_REVERTIDO', 'ESTADO_INCONSISTENTE', 'OCUPADO', 'TRASPASO_NO_ENCONTRADO', 'MOTIVO_INVALIDO']) {
      const { svc } = servicio({ rpc: { arre_revertir_traspaso: { exito: false, codigo, mensaje: SECRETO } } });
      expect(codigoDe(await rechazo(svc.revertir(ID, { motivo: 'Capturado por error' }, UID)))).toBe(codigo);
    }
    const { svc } = servicio();
    expect(codigoDe(await rechazo(svc.revertir('no-es-uuid', { motivo: 'Capturado por error' }, UID)))).toBe('PARAMETRO_INVALIDO');
  });
});

describe('TraspasosDepositoService.exigirSinTraspasos (guardas D13)', () => {
  const fila = (extra: Fila): Fila => ({ id: 'x', idArrePdpOrigen: 'O', idArrePdpDestino: 'D', ...extra });

  it('sin traspasos no hace nada (comportamiento idéntico al de siempre)', async () => {
    const { svc } = servicio({ tablas: { arre_traspasos_deposito: [] } });
    for (const a of ['eliminar_plan', 'cambiar_moneda', 'editar_deposito', 'eliminar_concepto'] as const)
      await svc.exigirSinTraspasos('D', a);
  });

  it('eliminar plan: bloquea con filas aplicadas O revertidas, como origen o como destino', async () => {
    for (const estado of ['aplicado', 'revertido']) {
      for (const plan of ['O', 'D']) {
        const { svc } = servicio({ tablas: { arre_traspasos_deposito: [fila({ estado })] } });
        const e = await rechazo(svc.exigirSinTraspasos(plan, 'eliminar_plan'));
        expect(e).toBeInstanceOf(ConflictException);
        expect(textoDe(e)).toContain('traspasos de depósito');
      }
    }
  });

  it('cambiar moneda / editar / eliminar concepto: bloquean solo con traspaso APLICADO', async () => {
    for (const a of ['cambiar_moneda', 'editar_deposito', 'eliminar_concepto'] as const) {
      const aplicado = servicio({ tablas: { arre_traspasos_deposito: [fila({ estado: 'aplicado' })] } });
      expect(await rechazo(aplicado.svc.exigirSinTraspasos('D', a))).toBeInstanceOf(ConflictException);
      const revertido = servicio({ tablas: { arre_traspasos_deposito: [fila({ estado: 'revertido' })] } });
      await revertido.svc.exigirSinTraspasos('D', a); // revertido: ya no hay traspaso vigente
    }
  });

  it('un error de BD en la guarda no se filtra y lleva codigo ERROR_INTERNO', async () => {
    const { svc } = servicio({ errores: { arre_traspasos_deposito: { message: SECRETO } } });
    const e = await rechazo(svc.exigirSinTraspasos('D', 'eliminar_plan'));
    expect(e).toBeInstanceOf(InternalServerErrorException);
    expect(textoDe(e)).not.toContain('fk_secreto');
    expect(codigoDe(e)).toBe('ERROR_INTERNO');
  });

  it('el 409 de la guarda lleva codigo: PLAN_CON_TRASPASOS al eliminar el plan, TRASPASO_APLICADO en lo demás', async () => {
    const { svc } = servicio({ tablas: { arre_traspasos_deposito: [fila({ estado: 'aplicado' })] } });
    expect(codigoDe(await rechazo(svc.exigirSinTraspasos('D', 'eliminar_plan')))).toBe('PLAN_CON_TRASPASOS');
    for (const a of ['cambiar_moneda', 'editar_deposito', 'eliminar_concepto'] as const)
      expect(codigoDe(await rechazo(svc.exigirSinTraspasos('D', a)))).toBe('TRASPASO_APLICADO');
  });
});

describe('TraspasosDepositoService.traspasosPorPartida (D6)', () => {
  it('suma emitido por idDetOrigen y recibido por idDetDestino, solo aplicados', async () => {
    const { svc } = servicio({
      tablas: {
        arre_traspasos_deposito: [
          { seq: 1, estado: 'aplicado', idDetOrigen: 'A_DEP', idDetDestino: 'N_DEP', monto: 237002.955 },
          { seq: 2, estado: 'aplicado', idDetOrigen: 'B_DEP', idDetDestino: 'N_DEP', monto: 237002.955 },
          { seq: 3, estado: 'revertido', idDetOrigen: 'C_DEP', idDetDestino: 'N_DEP', monto: 999 },
        ],
      },
    });
    const { emitido, recibido } = await svc.traspasosPorPartida();
    expect(emitido.get('A_DEP')).toBe(237002.955);
    expect(emitido.get('B_DEP')).toBe(237002.955);
    expect(emitido.has('C_DEP')).toBe(false);
    expect(recibido.get('N_DEP')).toBe(474005.91);
  });
});

describe('TraspasosDepositoService.estadoPlan (GET planes/:id/deposito)', () => {
  const tablas = (): Record<string, Fila[]> => ({
    arrePdp: [
      { idArrePdp: 'PDP_2026', Moneda: 'MXN', idNavArrend: 'NAV12', fecInicio: '2026-10-17', fecFin: '2027-10-16' },
      { idArrePdp: 'PDP_A_2025', Moneda: 'MXN', idNavArrend: 'NAV12', fecInicio: '2025-10-17', fecFin: '2026-10-16' },
      { idArrePdp: 'PDP_B_2025', Moneda: 'MXN', idNavArrend: 'NAV13', fecInicio: '2025-10-17', fecFin: '2026-10-16' },
    ],
    arrePdpDetalle: [
      { idArrePdpDet: 'D26', idArrePdp: 'PDP_2026', numPartida: 0, status: true, concepto: 'Depósito Garantía', moneda: 'MXN', cantidad: 26639.11, fecPago: null },
      { idArrePdpDet: 'DA', idArrePdp: 'PDP_A_2025', numPartida: 0, status: true, concepto: 'Depósito Garantía', moneda: 'MXN', cantidad: 237002.955, fecPago: null },
    ],
    arrenPropiedades: [
      { idNavArrend: 'NAV12', idNave: 'N12' },
      { idNavArrend: 'NAV13', idNave: 'N13' },
    ],
    naves: [
      { idNave: 'N12', numNave: 12, numNaveNAME: '12', idParque: 'PQ' },
      { idNave: 'N13', numNave: 13, numNaveNAME: '13', idParque: 'PQ' },
    ],
    parques: [{ idParque: 'PQ', nomParque: 'Ocupar 2' }],
    catUsers: [{ uid: UID, nomCompleto: 'Mónica Echeverry' }],
    arre_traspasos_deposito: [
      {
        id: 'f1', seq: 1, idArrePdpOrigen: 'PDP_A_2025', idArrePdpDestino: 'PDP_2026', idDetOrigen: 'DA', idDetDestino: 'D26',
        moneda: 'MXN', monto: 237002.955, marcoPagada: false, fecTraspaso: '2026-10-20', nota: 'Contrato SPH-2025-12',
        estado: 'aplicado', claveIdempotencia: CLAVE, uid: UID, fc: '2026-10-20T18:41:00Z', revertidoPor: null, fecReversion: null, motivoReversion: null,
      },
      {
        id: 'f2', seq: 2, idArrePdpOrigen: 'PDP_B_2025', idArrePdpDestino: 'PDP_2026', idDetOrigen: 'DB', idDetDestino: 'D26',
        moneda: 'MXN', monto: 237002.955, marcoPagada: false, fecTraspaso: '2026-10-20', nota: 'Contrato SPH-2025-12',
        estado: 'aplicado', claveIdempotencia: CLAVE, uid: UID, fc: '2026-10-20T18:41:01Z', revertidoPor: null, fecReversion: null, motivoReversion: null,
      },
    ],
  });

  it('destino Deumex: contractual 500,645.02 · traspasado 474,005.91 · por cobrar 26,639.11', async () => {
    const { svc } = servicio({ tablas: tablas() });
    const r = await svc.estadoPlan('PDP_2026');
    expect(r.deposito!.cantidad).toBe(26639.11);
    expect(r.deposito!.recibido).toBe(474005.91);
    expect(r.deposito!.emitido).toBe(0);
    expect(r.deposito!.contractual).toBe(500645.02);
    expect(r.deposito!.porCobrar).toBe(26639.11);
    expect(r.deposito!.pagada).toBe(false);
    expect(r.deposito!.pagadaPorTraspaso).toBe(false);
    expect(r.traspasos).toHaveLength(2);
    expect(r.traspasos[0]!.direccion).toBe('recibido');
    expect(r.traspasos[0]!.contraparte!.nave).toBe('12');
    expect(r.traspasos[0]!.registro.autor).toBe('Mónica Echeverry');
  });

  it('origen: emitió todo → por cobrar 0 y traspaso «emitido» hacia el destino', async () => {
    const { svc } = servicio({ tablas: tablas() });
    const r = await svc.estadoPlan('PDP_A_2025');
    expect(r.deposito!.emitido).toBe(237002.955);
    expect(r.deposito!.porCobrar).toBe(0);
    expect(r.traspasos).toHaveLength(1);
    expect(r.traspasos[0]!.direccion).toBe('emitido');
  });

  it('plan sin traspasos ni partida de depósito: deposito null y lista vacía', async () => {
    const t = tablas();
    t.arre_traspasos_deposito = [];
    const { svc } = servicio({ tablas: t });
    const r = await svc.estadoPlan('PDP_B_2025');
    expect(r.deposito).toBeNull();
    expect(r.traspasos).toEqual([]);
  });

  it('plan inexistente → 404', async () => {
    const { svc } = servicio({ tablas: tablas() });
    expect(await rechazo(svc.estadoPlan('NO_EXISTE'))).toBeInstanceOf(NotFoundException);
  });
});

describe('TraspasosDepositoService.candidatos / candidatosRenovacion', () => {
  const candidato = (extra: Fila = {}): Fila => ({
    idArrePdp: 'PDP_A_2025', idNavArrend: 'NAV12', idArrePdpDet: 'DA', fecInicio: '2025-10-17', fecFin: '2026-10-16',
    finEfectivo: '2026-10-16', mismaNave: true, moneda: 'MXN', cantidad: 237002.955, recibido: 0, emitido: 0,
    disponible: 237002.955, depositoPlan: 237002.955, bloqueo: null, ...extra,
  });

  const tablas = (): Record<string, Fila[]> => ({
    arrePdp: [
      { idArrePdp: 'PDP_2026', idArrendador: 'TOK', idNavArrend: 'NAV12', fecInicio: '2026-10-17', fecFin: '2027-10-16', Moneda: 'MXN' },
      { idArrePdp: 'PDP_A_2025', idArrendador: 'TOK', idNavArrend: 'NAV12', fecInicio: '2025-10-17', fecFin: '2026-10-16', Moneda: 'MXN' },
    ],
    arrePdpDetalle: [
      { idArrePdpDet: 'D26', idArrePdp: 'PDP_2026', numPartida: 0, status: true, concepto: 'Depósito Garantía', moneda: '', cantidad: 500645.02, fecPago: null },
    ],
    arrenPropiedades: [{ idNavArrend: 'NAV12', idNave: 'N12' }],
    naves: [{ idNave: 'N12', numNave: 12, numNaveNAME: '12', idParque: 'PQ' }],
    parques: [{ idParque: 'PQ', nomParque: 'Ocupar 2' }],
  });

  it('candidatos: arrendador, nave, inicio y moneda salen del PLAN (no del cliente) y va con comoActor', async () => {
    const { svc, ctx } = servicio({
      tablas: tablas(),
      rpc: { arre_traspaso_candidatos: [candidato(), candidato({ idArrePdp: 'PDP_B_2025', idNavArrend: 'NAV13', mismaNave: false, bloqueo: 'DEPOSITO_EN_CERO', cantidad: 0, disponible: 0, depositoPlan: 868305.55 })] },
    });
    const r = await svc.candidatos('PDP_2026', UID);

    expect(ctx.rpcs).toHaveLength(1);
    expect(ctx.rpcs[0]!.via).toBe('actor');
    expect(ctx.rpcs[0]!.uid).toBe(UID);
    expect(ctx.rpcs[0]!.args).toEqual({
      p_id_arrendador: 'TOK',
      p_id_nav_arrend: 'NAV12',
      p_fec_inicio_destino: '2026-10-17',
      p_moneda: 'MXN', // la partida tiene moneda vacía → la del plan
      p_excluir: 'PDP_2026',
    });
    expect(r).toHaveLength(2);
    expect(r[0]!.tipo).toBe('RENOVADO'); // misma nave, fin = día anterior al inicio del destino
    expect(r[0]!.nave).toBe('12');
    expect(r[0]!.bloqueo).toBeNull();
    expect(r[1]!.tipo).toBe('HERMANA');
    expect(r[1]!.bloqueo).toBe('DEPOSITO_EN_CERO');
    expect(r[1]!.bloqueoTexto).toContain('868,305.55');
  });

  it('candidatos de un plan inexistente → 404 con codigo', async () => {
    const { svc } = servicio({ tablas: tablas() });
    const e = await rechazo(svc.candidatos('NO_EXISTE', UID));
    expect(e).toBeInstanceOf(NotFoundException);
    expect(codigoDe(e)).toBe('PLAN_NO_ENCONTRADO');
  });

  it('candidatosRenovacion exige el permiso 25 (403 si no lo tiene) sin consultar candidatos', async () => {
    const t = tablas();
    t.catUsers = [{ uid: UID, isSupport: false }];
    t.segModulosUsuarios = [{ uid: UID, clave: 23, acceso: true }];
    const { svc, ctx } = servicio({ tablas: t, rpc: { arre_traspaso_candidatos: [] } });
    const e = await rechazo(svc.candidatosRenovacion('PDP_A_2025', 'MXN', UID));
    expect(e).toBeInstanceOf(ForbiddenException);
    expect(codigoDe(e)).toBe('PERMISO_REQUERIDO');
    expect(ctx.rpcs).toHaveLength(0);
  });

  it('candidatosRenovacion: destino = fin + 1; el plan renovado se marca RENOVADO', async () => {
    const t = tablas();
    t.catUsers = [{ uid: UID, isSupport: false }];
    t.segModulosUsuarios = [{ uid: UID, clave: 25, acceso: true }];
    const { svc, ctx } = servicio({ tablas: t, rpc: { arre_traspaso_candidatos: [candidato()] } });
    const r = await svc.candidatosRenovacion('PDP_A_2025', 'USD', UID);
    expect(ctx.rpcs[0]!.args).toEqual({
      p_id_arrendador: 'TOK',
      p_id_nav_arrend: 'NAV12',
      p_fec_inicio_destino: '2026-10-17', // 2026-10-16 + 1
      p_moneda: 'USD',
      p_excluir: null,
    });
    expect(r[0]!.tipo).toBe('RENOVADO');
  });

  it('moneda inválida en la consulta → 400', async () => {
    const t = tablas();
    t.catUsers = [{ uid: UID, isSupport: true }];
    const { svc } = servicio({ tablas: t });
    expect(await rechazo(svc.candidatosRenovacion('PDP_A_2025', 'EUR', UID))).toBeInstanceOf(BadRequestException);
  });
});
