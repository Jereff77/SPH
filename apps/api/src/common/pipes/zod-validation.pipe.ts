import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Pipe de validación con Zod. Uso por endpoint:
 *
 *   @Post()
 *   crear(@Body(new ZodValidationPipe(crearInversionistaSchema)) dto: CrearInversionistaDto) { ... }
 *
 * Toda entrada del cliente se valida/normaliza server-side antes de tocar la BD
 * (a diferencia de v1, donde el cliente construía la consulta directamente).
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Datos de entrada inválidos',
        issues: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    return result.data;
  }
}
