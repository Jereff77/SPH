import { BadRequestException } from '@nestjs/common';

/**
 * Validación de archivos subidos por el cliente, en un solo lugar.
 *
 * El mimetype del multipart lo fija el CLIENTE y es falsificable, así que no
 * basta con una allowlist de tipos: se comprueba también que el CONTENIDO real
 * empiece con los magic bytes del formato declarado. Evita guardar contenido
 * arbitrario disfrazado de PDF/imagen.
 *
 * 📌 Deuda: CxP y Ventas tienen su propia copia privada de esta lógica
 * (`solicitudes.service.ts`). Migrarlas a este helper cuando se vuelva a tocar
 * ese módulo — no se hace aquí para no mover código de dinero sin necesidad.
 */

/** Tope de tamaño por archivo (mismo criterio que CxP/Arrendatarios). */
export const LIMITE_ARCHIVO = 15 * 1024 * 1024; // 15 MB

/** Tipos aceptados → extensión con la que se guarda. */
export const EXT_POR_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** ¿El contenido real del buffer corresponde a la extensión declarada? */
export function contenidoCoincide(b: Buffer, ext: string): boolean {
  switch (ext) {
    case 'pdf':
      return b.length >= 4 && b.toString('latin1', 0, 4) === '%PDF';
    case 'jpg':
      return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case 'png':
      return (
        b.length >= 8 &&
        b[0] === 0x89 &&
        b[1] === 0x50 &&
        b[2] === 0x4e &&
        b[3] === 0x47 &&
        b[4] === 0x0d &&
        b[5] === 0x0a &&
        b[6] === 0x1a &&
        b[7] === 0x0a
      );
    case 'webp':
      return (
        b.length >= 12 &&
        b.toString('latin1', 0, 4) === 'RIFF' &&
        b.toString('latin1', 8, 12) === 'WEBP'
      );
    default:
      return false;
  }
}

export interface ArchivoValidado {
  buffer: Buffer;
  contentType: string;
  ext: string;
}

/**
 * Valida tipo declarado + tamaño + contenido real. Devuelve los datos listos
 * para subir, o lanza 400 con un mensaje de negocio (nunca detalles internos).
 */
export function validarArchivo(archivo: {
  buffer: Buffer;
  mimetype: string;
  size?: number;
}): ArchivoValidado {
  const ext = EXT_POR_MIME[archivo.mimetype];
  if (!ext)
    throw new BadRequestException(
      'Formato no permitido. Solo se aceptan PDF, JPG, PNG o WEBP.',
    );
  if ((archivo.size ?? archivo.buffer.length) > LIMITE_ARCHIVO)
    throw new BadRequestException('El archivo supera el límite de 15 MB.');
  if (!contenidoCoincide(archivo.buffer, ext))
    throw new BadRequestException(
      'El contenido del archivo no corresponde a su formato.',
    );
  return { buffer: archivo.buffer, contentType: archivo.mimetype, ext };
}

/**
 * Arma una ruta de storage segura. Ningún segmento puede alterar la ruta
 * (defensa en profundidad contra path traversal, aunque los ids reales sean
 * alfanuméricos).
 */
export function rutaSegura(segmentos: string[], ext: string): string {
  for (const s of segmentos) {
    if (!s || /[/\\]|\.\./.test(s))
      throw new BadRequestException('Identificador inválido.');
  }
  const ym = new Date().toISOString().slice(0, 7); // yyyy-MM
  return `${ym}/${segmentos.join('/')}.${ext}`;
}
