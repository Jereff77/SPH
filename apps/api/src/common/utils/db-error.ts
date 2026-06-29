import { InternalServerErrorException, Logger } from '@nestjs/common';

/**
 * Maneja un error de la capa de datos (Supabase/PostgREST/Postgres) SIN filtrarlo al
 * cliente.
 *
 * ⛔ REGLA DEL PROYECTO: nunca exponer al frontend el mensaje crudo de la BD (nombres de
 * tablas/columnas, constraints, fragmentos de SQL). El detalle REAL se registra
 * server-side (para depurar) y al cliente se le devuelve un mensaje GENÉRICO y seguro.
 *
 * Úsalo en lugar de `throw new InternalServerErrorException(error.message)`:
 *   const { data, error } = await supabase.from('x').select();
 *   if (error) fallaBd(this.logger, 'clientes.listar', error);
 *
 * Para errores de NEGOCIO controlados (4xx) que el usuario SÍ debe leer, sigue usando
 * `BadRequestException` / `ConflictException` / `NotFoundException` con un mensaje
 * redactado a mano (nunca `error.message` crudo).
 */
export function fallaBd(
  logger: Logger,
  contexto: string,
  error: unknown,
  mensajeCliente = 'No se pudo completar la operación. Inténtalo de nuevo.',
): never {
  const detalle =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message)
      : String(error);
  logger.error(`${contexto}: ${detalle}`);
  throw new InternalServerErrorException(mensajeCliente);
}
