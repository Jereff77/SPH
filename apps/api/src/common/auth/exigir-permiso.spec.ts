import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { crearSupabaseFalso, type Fila } from '../../modules/arrendatarios/supabase-falso.testing-spec.js';
import { exigirPermiso } from './exigir-permiso.js';
import { PermisoGuard } from './permiso.guard.js';

/**
 * `exigirPermiso` es la regla de `PermisoGuard` extraída para usarla en servicios (p. ej. «23 y
 * 25» en Renovar). Estas pruebas fijan que el guard sigue respondiendo EXACTAMENTE igual.
 */

const UID = '11111111-1111-4111-8111-111111111111';
const logger = new Logger('prueba');

async function rechazo(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error('Se esperaba un rechazo y la promesa se resolvió.');
}

const usuario = (isSupport: boolean, claves: number[] = []): Record<string, Fila[]> => ({
  catUsers: [{ uid: UID, isSupport }],
  segModulosUsuarios: claves.map((clave) => ({ uid: UID, clave, acceso: true })),
});

describe('exigirPermiso (regla de PermisoGuard)', () => {
  it('soporte pasa siempre', async () => {
    const { supabase } = crearSupabaseFalso({ tablas: usuario(true) });
    await exigirPermiso(supabase, logger, UID, [25]);
  });

  it('pasa si tiene concedida UNA de las claves (any-of)', async () => {
    const { supabase } = crearSupabaseFalso({ tablas: usuario(false, [23]) });
    await exigirPermiso(supabase, logger, UID, [23, 25]);
  });

  it('sin acceso → 403 «Acceso denegado (permiso X o Y)»', async () => {
    const { supabase } = crearSupabaseFalso({ tablas: usuario(false, [20]) });
    const e = await rechazo(exigirPermiso(supabase, logger, UID, [23, 25]));
    expect(e).toBeInstanceOf(ForbiddenException);
    expect((e as ForbiddenException).message).toBe('Acceso denegado (permiso 23 o 25).');
  });

  it('un permiso con acceso=false no cuenta', async () => {
    const { supabase } = crearSupabaseFalso({
      tablas: { catUsers: [{ uid: UID, isSupport: false }], segModulosUsuarios: [{ uid: UID, clave: 25, acceso: false }] },
    });
    expect(await rechazo(exigirPermiso(supabase, logger, UID, [25]))).toBeInstanceOf(ForbiddenException);
  });

  it('error al verificar → 403 genérico (el detalle solo al log)', async () => {
    const { supabase } = crearSupabaseFalso({
      tablas: { catUsers: [{ uid: UID, isSupport: false }] },
      errores: { segModulosUsuarios: { message: 'relation "segModulosUsuarios" does not exist' } },
    });
    const e = await rechazo(exigirPermiso(supabase, logger, UID, [25]));
    expect(e).toBeInstanceOf(ForbiddenException);
    expect((e as ForbiddenException).message).toBe('No se pudo verificar el permiso.');
  });
});

describe('PermisoGuard delega en exigirPermiso sin cambiar su comportamiento', () => {
  const contexto = (user: unknown): ExecutionContext =>
    ({
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  const guard = (claves: number[] | undefined, tablas: Record<string, Fila[]>) => {
    const { supabase, ctx } = crearSupabaseFalso({ tablas });
    const reflector = { getAllAndOverride: () => claves } as unknown as Reflector;
    return { g: new PermisoGuard(reflector, supabase), ctx };
  };

  it('sin @RequierePermiso no restringe ni consulta la BD', async () => {
    const { g, ctx } = guard(undefined, {});
    expect(await g.canActivate(contexto({ uid: UID }))).toBe(true);
    expect(ctx.consultas).toHaveLength(0);
  });

  it('sin usuario → 401 «No autenticado.»', async () => {
    const { g } = guard([20], {});
    const e = await rechazo(g.canActivate(contexto(undefined)));
    expect(e).toBeInstanceOf(UnauthorizedException);
    expect((e as UnauthorizedException).message).toBe('No autenticado.');
  });

  it('soporte y clave concedida pasan', async () => {
    expect(await guard([20], usuario(true)).g.canActivate(contexto({ uid: UID }))).toBe(true);
    expect(await guard([20, 21], usuario(false, [21])).g.canActivate(contexto({ uid: UID }))).toBe(true);
  });

  it('sin acceso → 403 con el mismo texto de siempre', async () => {
    const e = await rechazo(guard([23, 25], usuario(false, [])).g.canActivate(contexto({ uid: UID })));
    expect(e).toBeInstanceOf(ForbiddenException);
    expect((e as ForbiddenException).message).toBe('Acceso denegado (permiso 23 o 25).');
  });
});
