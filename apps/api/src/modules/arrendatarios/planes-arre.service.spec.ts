import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { IncrementosService } from './incrementos.service.js';
import type { KvasService } from '../parques/kvas.service.js';
import type { NotasService } from '../notas/notas.service.js';
import { renovarPlanSchema } from './arrendatarios.schemas.js';
import { PlanesArreService } from './planes-arre.service.js';
import { TraspasosDepositoService } from './traspasos-deposito.service.js';
import { crearSupabaseFalso, type Fila } from './supabase-falso.testing-spec.js';

/**
 * Pruebas de PlanesArreService para el traspaso de depósito (06 §5.2):
 * renovar (D11/D12), guardas D13 y mapeo de ERROR_GENERAL sin reenviar SQLERRM (regla 4b).
 * Con 0 traspasos los flujos tocados responden igual que antes (06 §4 #8).
 */

const UID = '11111111-1111-4111-8111-111111111111';
const CLAVE = '22222222-2222-4222-8222-222222222222';
const SQLERRM = 'insert or update on table "arre_traspasos_deposito" violates foreign key constraint "fk_secreto"';

const dtoRenovar = (conTraspaso: boolean) =>
  renovarPlanSchema.parse({
    plazo: 12,
    m2Construccion: 1150,
    deposito: 500645.02,
    precioM2: 62.5,
    moneda: 'MXN',
    ...(conTraspaso
      ? {
          traspaso: {
            origenes: ['PDP_A_2025', 'PDP_B_2025'],
            fecTraspaso: '2026-10-20',
            nota: 'Contrato SPH-2025-12',
            confirmado: true,
            claveIdempotencia: CLAVE,
          },
        }
      : {}),
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
  const r = (e as HttpException).getResponse();
  return typeof r === 'string' ? r : JSON.stringify(r);
};

const codigoDe = (e: unknown): unknown => {
  const r = (e as HttpException).getResponse();
  return typeof r === 'object' && r !== null ? (r as Record<string, unknown>).codigo : undefined;
};

function servicio(opts: Parameters<typeof crearSupabaseFalso>[0] = {}) {
  const f = crearSupabaseFalso(opts);
  const traspasos = new TraspasosDepositoService(f.supabase);
  const avisos: string[] = [];
  const notas = {
    avisar: async () => undefined,
    avisarCambioManual: async (_ref: unknown, c: { descripcion: string }) => {
      avisos.push(c.descripcion);
    },
  } as unknown as NotasService;
  const svc = new PlanesArreService(
    f.supabase,
    {} as IncrementosService,
    {} as KvasService,
    notas,
    traspasos,
  );
  return { svc, avisos, ...f };
}

const RENOVAR_OK = { exito: true, mensaje: 'Renovación registrada.', detalles: { id_plan: 'NUEVO' } };
const TRASPASO_OK = {
  exito: true,
  codigo: 'EXITO',
  detalles: {
    total: 474005.91,
    cantidadRestante: 26639.11,
    pagadaPorTraspaso: false,
    traspasos: [
      { id: 'f1', idArrePdpOrigen: 'PDP_A_2025', monto: 237002.955 },
      { id: 'f2', idArrePdpOrigen: 'PDP_B_2025', monto: 237002.955 },
    ],
  },
};

/** Usuario con el permiso 25 (no soporte). */
const con25 = (): Record<string, Fila[]> => ({
  catUsers: [{ uid: UID, isSupport: false }],
  segModulosUsuarios: [{ uid: UID, clave: 25, acceso: true }],
});

const traspasoAplicado = (estado = 'aplicado'): Fila => ({
  id: 'f1', idArrePdpOrigen: 'O', idArrePdpDestino: 'PDP_2026', estado,
});

describe('PlanesArreService.renovar (D11/D12)', () => {
  it('sin traspaso: responde como siempre + traspaso omitido, sin tocar la tabla ni la RPC de traspaso', async () => {
    const { svc, ctx } = servicio({ rpc: { v2_arrepdp_renovar: RENOVAR_OK } });
    const r = await svc.renovar('PDP_ACTUAL', dtoRenovar(false), UID);
    expect(r).toEqual({ idArrePdp: 'NUEVO', mensaje: 'Renovación registrada.', traspaso: { estado: 'omitido' } });
    expect(ctx.rpcs.map((c) => c.fn)).toEqual(['v2_arrepdp_renovar']);
    expect(ctx.consultas).not.toContain('arre_traspasos_deposito');
  });

  it('con traspaso y SIN el permiso 25: 403 y NO se llama v2_arrepdp_renovar (no queda un plan a medias)', async () => {
    const { svc, ctx } = servicio({
      tablas: { catUsers: [{ uid: UID, isSupport: false }], segModulosUsuarios: [{ uid: UID, clave: 23, acceso: true }] },
      rpc: { v2_arrepdp_renovar: RENOVAR_OK, arre_traspasar_deposito: TRASPASO_OK },
    });
    const e = await rechazo(svc.renovar('PDP_ACTUAL', dtoRenovar(true), UID));
    expect(e).toBeInstanceOf(ForbiddenException);
    expect(textoDe(e)).toContain('25');
    expect(codigoDe(e)).toBe('PERMISO_REQUERIDO');
    expect(ctx.rpcs).toHaveLength(0);
  });

  it('con traspaso y permiso 25: crea el plan y DESPUÉS traspasa, todo con comoActor', async () => {
    const { svc, ctx } = servicio({
      tablas: con25(),
      rpc: { v2_arrepdp_renovar: RENOVAR_OK, arre_traspasar_deposito: TRASPASO_OK },
    });
    const r = await svc.renovar('PDP_ACTUAL', dtoRenovar(true), UID);
    expect(r.idArrePdp).toBe('NUEVO');
    expect(r.traspaso.estado).toBe('aplicado');
    if (r.traspaso.estado === 'aplicado') {
      expect(r.traspaso.total).toBe(474005.91);
      expect(r.traspaso.cantidadRestante).toBe(26639.11);
    }
    expect(ctx.rpcs.map((c) => c.fn)).toEqual(['v2_arrepdp_renovar', 'arre_traspasar_deposito']);
    expect(ctx.rpcs.every((c) => c.via === 'actor' && c.uid === UID)).toBe(true);
    // el destino del traspaso es el plan NUEVO y no se envía el `traspaso` a la RPC de renovar
    expect(ctx.rpcs[1]!.args.p_id_destino).toBe('NUEVO');
    expect('traspaso' in ctx.rpcs[0]!.args).toBe(false);
  });

  it('soporte pasa sin tener el 25 asignado (misma regla que PermisoGuard)', async () => {
    const { svc } = servicio({
      tablas: { catUsers: [{ uid: UID, isSupport: true }] },
      rpc: { v2_arrepdp_renovar: RENOVAR_OK, arre_traspasar_deposito: TRASPASO_OK },
    });
    const r = await svc.renovar('PDP_ACTUAL', dtoRenovar(true), UID);
    expect(r.traspaso.estado).toBe('aplicado');
  });

  it('traspaso fallido: 200 con estado fallido y el PLAN queda creado (reintentar con la misma clave)', async () => {
    const { svc, ctx } = servicio({
      tablas: con25(),
      rpc: {
        v2_arrepdp_renovar: RENOVAR_OK,
        arre_traspasar_deposito: {
          exito: false,
          codigo: 'EXCEDE_DESTINO',
          mensaje: SQLERRM,
          detalles: { total: 474005.91, cantidadDestino: 400000 },
        },
      },
    });
    const r = await svc.renovar('PDP_ACTUAL', dtoRenovar(true), UID);
    expect(r.idArrePdp).toBe('NUEVO');
    expect(r.traspaso.estado).toBe('fallido');
    if (r.traspaso.estado === 'fallido') {
      expect(r.traspaso.codigo).toBe('EXCEDE_DESTINO');
      expect(r.traspaso.mensaje).toContain('474,005.91');
      expect(r.traspaso.mensaje).not.toContain('fk_secreto');
    }
    // no se vuelve a llamar a renovar (sin YA_RENOVADO) ni se deshace el plan
    expect(ctx.rpcs.filter((c) => c.fn === 'v2_arrepdp_renovar')).toHaveLength(1);
  });

  it('v2_arrepdp_renovar con ERROR_GENERAL: 500 genérico, jamás el SQLERRM', async () => {
    const { svc } = servicio({
      rpc: { v2_arrepdp_renovar: { exito: false, codigo: 'ERROR_GENERAL', mensaje: SQLERRM } },
    });
    const e = await rechazo(svc.renovar('PDP_ACTUAL', dtoRenovar(false), UID));
    expect(e).toBeInstanceOf(InternalServerErrorException);
    expect(textoDe(e)).not.toContain('fk_secreto');
    expect(textoDe(e)).not.toContain('arre_traspasos_deposito');
  });

  it('un rechazo de NEGOCIO de v2_arrepdp_renovar conserva su mensaje (comportamiento de siempre)', async () => {
    const { svc } = servicio({
      rpc: { v2_arrepdp_renovar: { exito: false, codigo: 'YA_RENOVADO', mensaje: 'El plan ya fue renovado.' } },
    });
    const e = await rechazo(svc.renovar('PDP_ACTUAL', dtoRenovar(false), UID));
    expect(e).toBeInstanceOf(BadRequestException);
    expect(textoDe(e)).toContain('El plan ya fue renovado.');
  });
});

describe('PlanesArreService.eliminarPlan (D13)', () => {
  it('sin traspasos: elimina como siempre', async () => {
    const { svc, ctx } = servicio({
      rpc: { arrepdp_eliminar_plan_con_restricciones: { exito: true, mensaje: 'Plan eliminado.' } },
    });
    const r = await svc.eliminarPlan('PDP_X', UID);
    expect(r).toEqual({ mensaje: 'Plan eliminado.' });
    expect(ctx.rpcs.map((c) => c.fn)).toEqual(['arrepdp_eliminar_plan_con_restricciones']);
  });

  it('con filas de traspaso (aplicadas o revertidas) → 409 y NO se llama a la RPC', async () => {
    for (const estado of ['aplicado', 'revertido']) {
      const { svc, ctx } = servicio({
        tablas: { arre_traspasos_deposito: [traspasoAplicado(estado)] },
        rpc: { arrepdp_eliminar_plan_con_restricciones: { exito: true } },
      });
      const e = await rechazo(svc.eliminarPlan('PDP_2026', UID));
      expect(e).toBeInstanceOf(ConflictException);
      expect(codigoDe(e)).toBe('PLAN_CON_TRASPASOS');
      expect(ctx.rpcs).toHaveLength(0);
    }
  });

  it('ERROR_GENERAL ya no reenvía el SQLERRM (500 genérico)', async () => {
    const { svc } = servicio({
      rpc: { arrepdp_eliminar_plan_con_restricciones: { exito: false, codigo: 'ERROR_GENERAL', mensaje: SQLERRM } },
    });
    const e = await rechazo(svc.eliminarPlan('PDP_X', UID));
    expect(e).toBeInstanceOf(InternalServerErrorException);
    expect(textoDe(e)).not.toContain('fk_secreto');
  });

  it('un rechazo de negocio conserva su mensaje', async () => {
    const { svc } = servicio({
      rpc: { arrepdp_eliminar_plan_con_restricciones: { exito: false, codigo: 'PLAN_ACTIVO', mensaje: 'Desactiva el plan antes de eliminarlo.' } },
    });
    const e = await rechazo(svc.eliminarPlan('PDP_X', UID));
    expect(e).toBeInstanceOf(BadRequestException);
    expect(textoDe(e)).toContain('Desactiva el plan');
  });
});

describe('PlanesArreService.cambiarMoneda (D13)', () => {
  const dto = (concepto: string, simular = false) => ({ anioDesde: 0, concepto, moneda: 'USD' as const, simular });
  const CAMBIO_OK = { exito: true, detalles: { partidas_cambiadas: 0, partidas_alcance: 1 } };

  it('depósito con traspaso aplicado → 409 (también en la simulación) y no se llama a la RPC', async () => {
    for (const simular of [false, true]) {
      const { svc, ctx } = servicio({
        tablas: { arre_traspasos_deposito: [traspasoAplicado()] },
        rpc: { v2_arrepdpdetalle_cambiar_moneda: CAMBIO_OK },
      });
      const e = await rechazo(svc.cambiarMoneda('PDP_2026', dto('Depósito Garantía', simular), UID));
      expect(e).toBeInstanceOf(ConflictException);
      expect(textoDe(e)).toContain('moneda');
      expect(codigoDe(e)).toBe('TRASPASO_APLICADO');
      expect(ctx.rpcs).toHaveLength(0);
    }
  });

  it('depósito SIN traspasos: procede como siempre', async () => {
    const { svc, ctx } = servicio({ rpc: { v2_arrepdpdetalle_cambiar_moneda: CAMBIO_OK } });
    const r = await svc.cambiarMoneda('PDP_2026', dto('Depósito Garantía'), UID);
    expect(r).toEqual({ ok: true, partidasAlcance: 1, partidasCambiadas: 0 });
    expect(ctx.rpcs).toHaveLength(1);
  });

  it('otro concepto (Renta): ni siquiera consulta traspasos, aunque el plan tenga', async () => {
    const { svc, ctx } = servicio({
      tablas: { arre_traspasos_deposito: [traspasoAplicado()] },
      rpc: { v2_arrepdpdetalle_cambiar_moneda: CAMBIO_OK },
    });
    await svc.cambiarMoneda('PDP_2026', dto('Renta'), UID);
    expect(ctx.consultas).not.toContain('arre_traspasos_deposito');
    expect(ctx.rpcs).toHaveLength(1);
  });
});

describe('PlanesArreService.editarCampo / eliminarConcepto (D13)', () => {
  const campo = (concepto: string) => ({ anioDesde: 1, concepto, campo: 'pm2' as const, valor: 100 });

  it('editar el pm2 del depósito con traspaso aplicado → 409 y no se llama a la RPC', async () => {
    const { svc, ctx } = servicio({
      tablas: { arre_traspasos_deposito: [traspasoAplicado()] },
      rpc: { arrepdpdetalle_actualizar_campo_manual: { exito: true } },
    });
    const e = await rechazo(svc.editarCampo('PDP_2026', campo('Depósito Garantía'), UID));
    expect(e).toBeInstanceOf(ConflictException);
    expect(codigoDe(e)).toBe('TRASPASO_APLICADO');
    expect(ctx.rpcs).toHaveLength(0);
  });

  it('editar otro concepto (Renta) sigue igual aunque el plan tenga traspasos', async () => {
    const { svc, ctx, avisos } = servicio({
      tablas: {
        arre_traspasos_deposito: [traspasoAplicado()],
        arrePdp: [{ idArrePdp: 'PDP_2026', arrePdpVigente: 'Si' }],
        arrePdpDetalle: [],
      },
      rpc: { arrepdpdetalle_actualizar_campo_manual: { exito: true } },
    });
    await svc.editarCampo('PDP_2026', campo('Renta'), UID);
    expect(ctx.rpcs.map((c) => c.fn)).toEqual(['arrepdpdetalle_actualizar_campo_manual']);
    expect(ctx.consultas).not.toContain('arre_traspasos_deposito');
    expect(avisos).toHaveLength(1);
  });

  it('eliminar el concepto de depósito con traspaso aplicado → 409 sin borrar nada', async () => {
    const { svc, ctx } = servicio({ tablas: { arre_traspasos_deposito: [traspasoAplicado()] } });
    const e = await rechazo(svc.eliminarConcepto('PDP_2026', 'Depósito Garantía', UID));
    expect(e).toBeInstanceOf(ConflictException);
    expect(codigoDe(e)).toBe('TRASPASO_APLICADO');
    expect(ctx.escrituras).toHaveLength(0);
  });

  it('eliminar el depósito SIN traspasos: borra como siempre', async () => {
    const { svc, ctx } = servicio({});
    await svc.eliminarConcepto('PDP_2026', 'Depósito Garantía', UID);
    expect(ctx.escrituras.map((w) => w.tipo)).toEqual(['delete']);
  });
});
