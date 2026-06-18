import { BadRequestException, ForbiddenException } from '@nestjs/common';

/**
 * Traduce los errores que lanzan los triggers de validación de la tabla `cxp`
 * (mensajes con prefijo `CXP_…`) a excepciones HTTP claras (403/400) con un
 * mensaje en español para el usuario, en vez del genérico "Error interno del
 * servidor" (500) que se mostraba al perder el mensaje de Postgres.
 *
 * Uso: en cada escritura a `cxp`, antes de lanzar el error genérico:
 *   if (error) { mapearErrorCxp(error); throw new InternalServerErrorException(...); }
 * Si el error NO es de un trigger CxP, `mapearErrorCxp` no hace nada y deja que
 * el llamador maneje el caso como hasta ahora.
 *
 * Códigos cubiertos (trigger `cxp_trigger_validar_fecha` y
 * `cxp_validar_y_actualizar_proveedor`). Ver
 * `base-conocimiento/modulos/cxp.md` y el diagnóstico del 2026-06-18.
 */
interface ErrorBd {
  message?: string | null;
  code?: string | null;
}

type Http = 'forbidden' | 'bad';

const MENSAJES_CXP: Record<string, { http: Http; mensaje: string }> = {
  // cxp_trigger_validar_fecha (cambios de estado / alta de CFDI)
  CXP_ESTADO_NO_AUTORIZADO: {
    http: 'forbidden',
    mensaje:
      'No tienes permiso para autorizar o rechazar esta solicitud (se requiere la clave 430).',
  },
  CXP_AUTORIZACION_NO_HABILITADA: {
    http: 'bad',
    mensaje:
      'Hoy no es un día habilitado para autorizar o rechazar solicitudes. Intenta en una fecha habilitada.',
  },
  CXP_CFDI_NO_HABILITADO: {
    http: 'bad',
    mensaje:
      'Hoy no es un día habilitado para registrar comprobantes (CFDI) en Cuentas por Pagar.',
  },
  // cxp_validar_y_actualizar_proveedor (contraparte de la solicitud)
  CXP_TIPO_PROVEEDOR_REQUERIDO: {
    http: 'bad',
    mensaje: 'Falta el tipo de proveedor (1 = Proveedor, 2 = Inversionista).',
  },
  CXP_ID_PROVEEDOR_REQUERIDO: {
    http: 'bad',
    mensaje: 'Falta indicar el proveedor o inversionista de la solicitud.',
  },
  CXP_ENTIDAD_NO_EXISTE: {
    http: 'bad',
    mensaje: 'El proveedor o inversionista indicado no existe o está inactivo.',
  },
  CXP_COMISIONISTA_NO_IMPLEMENTADO: {
    http: 'bad',
    mensaje: 'Los comisionistas aún no están disponibles; usa Proveedor o Inversionista.',
  },
  CXP_TIPO_PROVEEDOR_INVALIDO: {
    http: 'bad',
    mensaje: 'El tipo de proveedor no es válido (debe ser Proveedor o Inversionista).',
  },
};

/**
 * Si `error` proviene de un trigger de validación de CxP, relanza una excepción
 * HTTP adecuada (no retorna). En cualquier otro caso no hace nada.
 */
export function mapearErrorCxp(error: ErrorBd | null | undefined): void {
  const msg = error?.message ?? '';
  const m = /^(CXP_[A-Z_]+)/.exec(msg);
  if (!m) return;

  const conf = MENSAJES_CXP[m[1]!];
  if (!conf) {
    // Código CXP_ no catalogado: usar el texto del trigger tras ": ".
    const detalle = msg.split(': ').slice(1).join(': ').trim();
    throw new BadRequestException(detalle || msg);
  }
  if (conf.http === 'forbidden') throw new ForbiddenException(conf.mensaje);
  throw new BadRequestException(conf.mensaje);
}
