import { InternalServerErrorException, Logger, type HttpException } from '@nestjs/common';
import { fallaBd } from './db-error.js';

const SECRETO = 'duplicate key value violates unique constraint "fk_secreto"';

function capturar(fn: () => never): HttpException {
  try {
    fn();
  } catch (e) {
    return e as HttpException;
  }
  throw new Error('Se esperaba una excepción.');
}

describe('fallaBd', () => {
  const logger = new Logger('prueba');
  beforeEach(() => {
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  });

  it('sin código: 500 con mensaje genérico en texto plano (comportamiento de siempre)', () => {
    const e = capturar(() => fallaBd(logger, 'x.op', { message: SECRETO }));
    expect(e).toBeInstanceOf(InternalServerErrorException);
    expect(e.getResponse()).toEqual({
      statusCode: 500,
      message: 'No se pudo completar la operación. Inténtalo de nuevo.',
      error: 'Internal Server Error',
    });
    expect(JSON.stringify(e.getResponse())).not.toContain('fk_secreto');
  });

  it('sin código y con mensaje propio: lo usa tal cual', () => {
    const e = capturar(() => fallaBd(logger, 'x.op', new Error(SECRETO), 'No se pudo guardar.'));
    expect((e.getResponse() as { message: string }).message).toBe('No se pudo guardar.');
  });

  it('con código: el cuerpo es { message, codigo } y nunca lleva el detalle de la BD', () => {
    const e = capturar(() =>
      fallaBd(logger, 'x.op', { message: SECRETO }, 'No se pudo aplicar el pago.', 'ERROR_INTERNO'),
    );
    expect(e).toBeInstanceOf(InternalServerErrorException);
    expect(e.getStatus()).toBe(500);
    expect(e.getResponse()).toEqual({ message: 'No se pudo aplicar el pago.', codigo: 'ERROR_INTERNO' });
    expect(JSON.stringify(e.getResponse())).not.toContain('fk_secreto');
  });

  it('el detalle real va al log con su contexto', () => {
    capturar(() => fallaBd(logger, 'x.op', { message: SECRETO }, undefined, 'ERROR_INTERNO'));
    expect(logger.error).toHaveBeenCalledWith(`x.op: ${SECRETO}`);
  });
});
