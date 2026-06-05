import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Filtro global de errores: respuesta JSON uniforme y logging server-side SIN
 * filtrar datos sensibles (a diferencia de v1, que imprimía SQL y tokens en
 * consola del navegador). Nunca devuelve stack traces al cliente en producción.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Error interno del servidor';

    if (status >= 500) {
      // El mensaje crudo (que puede incluir nombres de tablas/columnas o
      // restricciones de PostgREST/Supabase) se registra SOLO server-side.
      this.logger.error(
        `${req.method} ${req.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${req.method} ${req.url} -> ${status}`);
    }

    // En errores 5xx nunca se filtra el detalle interno al cliente: se devuelve
    // un mensaje genérico. Para 4xx (errores de negocio/validación controlados)
    // sí se conserva el mensaje, que es informativo y seguro.
    const clientMessage =
      status >= 500
        ? 'Error interno del servidor'
        : typeof message === 'string'
          ? message
          : ((message as Record<string, unknown>)['message'] ?? message);

    res.status(status).json({
      statusCode: status,
      path: req.url,
      message: clientMessage,
    });
  }
}
