import { Injectable, Logger } from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import { simpleParser, type ParsedMail } from 'mailparser';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type { Credenciales } from './cuentas.service.js';

const BUCKET = 'email_attachments';
/** Carpetas a sincronizar: recibidos y enviados (Hostinger usa INBOX.Sent). */
const CARPETAS: { folder: string; tipo: 'received' | 'sent' }[] = [
  { folder: 'INBOX', tipo: 'received' },
  { folder: 'INBOX.Sent', tipo: 'sent' },
];
/** En la primera sincronización de una carpeta, traer a lo más estos correos. */
const MAX_PRIMERA = 40;

/**
 * Sincroniza correos por IMAP (imapflow) hacia las tablas `correo_*`. Deduplica
 * por `messageId`, descarga adjuntos al bucket y agrupa hilos por `conversationId`
 * (raíz de References/In-Reply-To). Reemplaza el flujo N8N de recepción.
 */
@Injectable()
export class ImapService {
  private readonly logger = new Logger(ImapService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private conversationId(p: ParsedMail): string | null {
    const refs = p.references;
    if (refs) {
      const arr = Array.isArray(refs) ? refs : [refs];
      if (arr[0]) return arr[0];
    }
    if (p.inReplyTo) return p.inReplyTo;
    return p.messageId ?? null;
  }

  private sanitizar(nombre: string): string {
    return (nombre || 'archivo').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  }

  /** Sincroniza una cuenta. Devuelve cuántos correos nuevos se guardaron. */
  async sincronizar(cred: Credenciales): Promise<{ nuevos: number }> {
    // Estado de sincronización (último UID por carpeta).
    const { data: cuenta } = await this.supabase.admin
      .from('correo_cuentas')
      .select('ultimoUidSync')
      .eq('id', cred.id)
      .maybeSingle();
    const estado: Record<string, number> =
      (cuenta?.ultimoUidSync as Record<string, number>) ?? {};

    const client = new ImapFlow({
      host: cred.imapHost,
      port: cred.imapPort,
      secure: cred.imapPort === 993,
      auth: { user: cred.usuario, pass: cred.password },
      logger: false,
    });

    let nuevos = 0;
    try {
      await client.connect();
      for (const { folder, tipo } of CARPETAS) {
        try {
          nuevos += await this.sincronizarCarpeta(client, cred, folder, tipo, estado);
        } catch (e) {
          this.logger.warn(`Carpeta ${folder} de ${cred.email}: ${(e as Error).message}`);
        }
      }
    } catch (e) {
      this.logger.error(`IMAP ${cred.email}: ${(e as Error).message}`);
      throw e;
    } finally {
      try {
        await client.logout();
      } catch {
        /* noop */
      }
    }

    // Persistir el último UID por carpeta.
    await this.supabase.admin
      .from('correo_cuentas')
      .update({ ultimoUidSync: estado })
      .eq('id', cred.id);

    return { nuevos };
  }

  private async sincronizarCarpeta(
    client: ImapFlow,
    cred: Credenciales,
    folder: string,
    tipo: 'received' | 'sent',
    estado: Record<string, number>,
  ): Promise<number> {
    const lock = await client.getMailboxLock(folder);
    let nuevos = 0;
    let maxUid = estado[folder] ?? 0;
    try {
      const exists =
        typeof client.mailbox === 'object' ? (client.mailbox.exists ?? 0) : 0;
      if (exists === 0) return 0;

      const ultimo = estado[folder] ?? 0;
      // Rango: por UID si ya hubo sync; si no, los últimos N por secuencia.
      let range: string;
      let porUid: boolean;
      if (ultimo > 0) {
        range = `${ultimo + 1}:*`;
        porUid = true;
      } else {
        range = `${Math.max(1, exists - MAX_PRIMERA + 1)}:*`;
        porUid = false;
      }

      const opts = porUid ? { uid: true } : undefined;
      for await (const msg of client.fetch(
        range,
        { uid: true, source: true },
        opts,
      )) {
        const uid = msg.uid;
        if (uid <= (estado[folder] ?? 0)) continue;
        if (uid > maxUid) maxUid = uid;
        if (!msg.source) continue;
        try {
          const guardado = await this.guardarMensaje(cred, folder, tipo, msg.source);
          if (guardado) nuevos++;
        } catch (e) {
          this.logger.warn(`Mensaje uid ${uid}: ${(e as Error).message}`);
        }
      }
    } finally {
      lock.release();
    }
    estado[folder] = maxUid;
    return nuevos;
  }

  /** Parsea e inserta un mensaje (si no existe). Devuelve true si era nuevo. */
  private async guardarMensaje(
    cred: Credenciales,
    folder: string,
    tipo: 'received' | 'sent',
    source: Buffer,
  ): Promise<boolean> {
    const p = await simpleParser(source);
    const messageId = p.messageId ?? null;
    const adjuntos = (p.attachments ?? []).filter((a) => a.content);

    const { data, error } = await this.supabase.admin
      .from('correo_mensajes')
      .insert({
        idCuenta: cred.id,
        messageId,
        conversationId: this.conversationId(p),
        fromEmail: p.from?.text ?? null,
        toEmail: Array.isArray(p.to) ? p.to.map((t) => t.text).join(', ') : (p.to?.text ?? null),
        cc: Array.isArray(p.cc) ? p.cc.map((t) => t.text).join(', ') : (p.cc?.text ?? null),
        subject: p.subject ?? null,
        bodyText: p.text ?? null,
        bodyHtml: typeof p.html === 'string' ? p.html : null,
        fecha: p.date ? p.date.toISOString() : null,
        tipo,
        folder,
        tieneAdjuntos: adjuntos.length > 0,
      })
      .select('id')
      .single();

    if (error) {
      // 23505 = duplicado (ya sincronizado): no es error.
      if (error.code === '23505') return false;
      throw new Error(error.message);
    }

    // Adjuntos → bucket + correo_adjuntos.
    for (const a of adjuntos) {
      const filename = this.sanitizar(a.filename ?? `adjunto-${a.contentType ?? 'bin'}`);
      const path = `${cred.id}/${data.id}/${filename}`;
      const { error: upErr } = await this.supabase.admin.storage
        .from(BUCKET)
        .upload(path, a.content, {
          contentType: a.contentType ?? 'application/octet-stream',
          upsert: true,
        });
      if (upErr) {
        this.logger.warn(`Adjunto ${filename}: ${upErr.message}`);
        continue;
      }
      const url = this.supabase.admin.storage.from(BUCKET).getPublicUrl(path)
        .data.publicUrl;
      await this.supabase.admin.from('correo_adjuntos').insert({
        idMensaje: data.id,
        filename,
        url,
        contentType: a.contentType ?? null,
        tamano: a.size ?? null,
      });
    }
    return true;
  }
}
