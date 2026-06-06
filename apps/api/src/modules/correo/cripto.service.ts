import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import type { Env } from '../../common/config/env.validation.js';

/**
 * Cifrado simétrico (AES-256-GCM) para las contraseñas de las cuentas de correo.
 * La llave de 32 bytes se deriva (sha256) de `EMAIL_ENCRYPTION_KEY`. El formato
 * almacenado es `iv:authTag:ciphertext` (base64). La contraseña en claro NUNCA
 * se persiste ni se devuelve al frontend.
 */
@Injectable()
export class CriptoService {
  private readonly key: Buffer;
  private readonly habilitado: boolean;

  constructor(config: ConfigService<Env, true>) {
    const secret = config.get('EMAIL_ENCRYPTION_KEY', { infer: true });
    this.habilitado = !!secret && secret.length >= 8;
    this.key = createHash('sha256')
      .update(secret || 'clave-no-configurada')
      .digest();
  }

  get disponible(): boolean {
    return this.habilitado;
  }

  cifrar(texto: string): string {
    if (!this.habilitado)
      throw new Error('EMAIL_ENCRYPTION_KEY no está configurada en el servidor.');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
  }

  descifrar(blob: string): string {
    if (!this.habilitado)
      throw new Error('EMAIL_ENCRYPTION_KEY no está configurada en el servidor.');
    const [ivB, tagB, encB] = blob.split(':');
    if (!ivB || !tagB || !encB) throw new Error('Dato cifrado inválido.');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(ivB, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagB, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(encB, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
