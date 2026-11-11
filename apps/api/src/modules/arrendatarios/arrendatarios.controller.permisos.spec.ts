import { PERMISO_KEY } from '../../common/auth/permisos.decorator.js';
import { ArrendatariosController } from './arrendatarios.controller.js';

/**
 * Editar la corrida del plan (campos de partida y moneda) exige el permiso 25 (editar planes),
 * no el 20 (solo ver). Guarda contra una regresión que vuelva a abrir esas rutas a quien solo ve.
 */
const permisoDe = (metodo: keyof ArrendatariosController): number[] | undefined =>
  Reflect.getMetadata(PERMISO_KEY, ArrendatariosController.prototype[metodo]) as number[] | undefined;

describe('ArrendatariosController: permisos de edición del plan', () => {
  it('PATCH planes/:id/detalle (editarCampo) exige 25', () => {
    expect(permisoDe('editarCampo')).toEqual([25]);
  });

  it('PATCH planes/:id/detalle/moneda (cambiarMoneda) exige 25', () => {
    expect(permisoDe('cambiarMoneda')).toEqual([25]);
  });

  it('el resto de las rutas de edición del plan siguen exigiendo 25', () => {
    for (const m of ['crearPlan', 'marcarContratoFirmado', 'agregarConcepto', 'eliminarConcepto'] as const)
      expect(permisoDe(m)).toEqual([25]);
  });
});
