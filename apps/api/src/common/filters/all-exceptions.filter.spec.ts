import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

/**
 * El filtro global debe propagar el `codigo` de negocio (traspaso de depósito: la web decide
 * por código, no por texto) SIN cambiar el formato de los demás errores.
 */

function responder(excepcion: unknown): { status: number; cuerpo: Record<string, unknown> } {
  let status = 0;
  let cuerpo: Record<string, unknown> = {};
  const res = {
    status(s: number) {
      status = s;
      return this;
    },
    json(b: Record<string, unknown>) {
      cuerpo = b;
    },
  };
  const req = { method: 'POST', url: '/arrendatarios/planes/PDP_2026/traspasos' };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(excepcion, host);
  return { status, cuerpo };
}

describe('AllExceptionsFilter: propaga `codigo` de forma compatible', () => {
  it('excepción con objeto { message, codigo } → el cuerpo lleva message y codigo', () => {
    const r = responder(new ConflictException({ message: 'Otro usuario está modificando este depósito.', codigo: 'OCUPADO' }));
    expect(r.status).toBe(409);
    expect(r.cuerpo).toEqual({
      statusCode: 409,
      path: '/arrendatarios/planes/PDP_2026/traspasos',
      message: 'Otro usuario está modificando este depósito.',
      codigo: 'OCUPADO',
    });
  });

  it('403 de permiso y 404 con codigo también lo conservan', () => {
    expect(responder(new ForbiddenException({ message: 'Acceso denegado (permiso 25).', codigo: 'PERMISO_REQUERIDO' })).cuerpo.codigo).toBe('PERMISO_REQUERIDO');
    expect(responder(new NotFoundException({ message: 'Plan no encontrado.', codigo: 'PLAN_NO_ENCONTRADO' })).cuerpo.codigo).toBe('PLAN_NO_ENCONTRADO');
  });

  it('5xx con codigo: el mensaje sigue siendo genérico (no se filtra nada) y el codigo se conserva', () => {
    const r = responder(new InternalServerErrorException({ message: 'detalle interno que no debe salir', codigo: 'ERROR_INTERNO' }));
    expect(r.status).toBe(500);
    expect(r.cuerpo.message).toBe('Error interno del servidor');
    expect(r.cuerpo.codigo).toBe('ERROR_INTERNO');
  });

  it('excepciones SIN codigo responden EXACTAMENTE como antes (sin el campo)', () => {
    expect(responder(new ConflictException('Texto simple.')).cuerpo).toEqual({
      statusCode: 409,
      path: '/arrendatarios/planes/PDP_2026/traspasos',
      message: 'Texto simple.',
    });
    const objeto = responder(new BadRequestException({ message: 'Datos de entrada inválidos', issues: [] }));
    expect('codigo' in objeto.cuerpo).toBe(false);
    expect(objeto.cuerpo.message).toBe('Datos de entrada inválidos');
    const nativo = responder(new Error('boom'));
    expect(nativo.status).toBe(500);
    expect('codigo' in nativo.cuerpo).toBe(false);
    expect(nativo.cuerpo.message).toBe('Error interno del servidor');
  });

  it('un `codigo` que no es string se ignora', () => {
    expect('codigo' in responder(new ConflictException({ message: 'x', codigo: 123 })).cuerpo).toBe(false);
  });

  it('ZodValidationPipe: sin codigo igual que siempre; con codigo lo propaga el filtro', () => {
    const schema = z.object({ nota: z.string().min(10) });
    const capturar = (pipe: ZodValidationPipe<{ nota: string }>) => {
      try {
        pipe.transform({ nota: 'corta' });
      } catch (e) {
        return responder(e);
      }
      throw new Error('Se esperaba un 400');
    };
    const sin = capturar(new ZodValidationPipe(schema));
    expect(sin.status).toBe(400);
    expect(sin.cuerpo.message).toBe('Datos de entrada inválidos');
    expect('codigo' in sin.cuerpo).toBe(false);
    const con = capturar(new ZodValidationPipe(schema, 'DATOS_INVALIDOS'));
    expect(con.cuerpo.codigo).toBe('DATOS_INVALIDOS');
    expect(con.cuerpo.message).toBe('Datos de entrada inválidos');
  });
});
