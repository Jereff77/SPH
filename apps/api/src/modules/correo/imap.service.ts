import { Injectable, Logger } from '@nestjs/common';
import { ImapFlow, type ListResponse } from 'imapflow';
import { simpleParser, type ParsedMail } from 'mailparser';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type { Credenciales } from './cuentas.service.js';

const BUCKET = 'email_attachments';
/** En la primera sincronización de una carpeta, traer a lo más estos correos. */
const MAX_PRIMERA = 40;
/** Carpetas especiales que NO se sincronizan (papelera, spam, borradores, "todos"). */
const SPECIAL_EXCLUIDAS = new Set(['\\Trash', '\\Junk', '\\Drafts', '\\All']);
/** Nombres (último segmento) que tampoco se sincronizan, por si el servidor no los marca. */
const NOMBRES_EXCLUIDOS = /(trash|papelera|spam|junk|drafts|borradores)/i;

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

  /** ¿Esta carpeta NO debe sincronizarse? (no seleccionable, papelera, spam, borradores). */
  private carpetaExcluida(b: {
    specialUse?: string;
    flags?: Set<string>;
    name?: string;
  }): boolean {
    if (b.flags?.has('\\Noselect')) return true;
    if (b.specialUse && SPECIAL_EXCLUIDAS.has(b.specialUse)) return true;
    return NOMBRES_EXCLUIDOS.test(b.name ?? '');
  }

  /** Clasifica la carpeta como enviados o recibidos (para el campo `tipo`). */
  private tipoDeCarpeta(b: {
    specialUse?: string;
    name?: string;
  }): 'received' | 'sent' {
    if (b.specialUse === '\\Sent') return 'sent';
    return /sent|enviad/i.test(b.name ?? '') ? 'sent' : 'received';
  }

  /** De la lista cruda de buzones, deja solo las carpetas sincronizables (path + tipo). */
  private filtrarSincronizables(
    buzones: ListResponse[],
  ): { folder: string; tipo: 'received' | 'sent' }[] {
    return buzones
      .filter((b) => !this.carpetaExcluida(b))
      .map((b) => ({ folder: b.path, tipo: this.tipoDeCarpeta(b) }));
  }

  /**
   * Lista EN VIVO (IMAP) las carpetas sincronizables de la cuenta. Refleja la
   * estructura real del buzón: incluye carpetas personalizadas y las recién creadas
   * (aunque estén vacías). No descarga correos, solo el árbol de carpetas.
   */
  async listarCarpetas(
    cred: Credenciales,
  ): Promise<{ folder: string; tipo: 'received' | 'sent' }[]> {
    const client = new ImapFlow({
      host: cred.imapHost,
      port: cred.imapPort,
      secure: cred.imapPort === 993,
      auth: { user: cred.usuario, pass: cred.password },
      logger: false,
    });
    try {
      await client.connect();
      return this.filtrarSincronizables(await client.list());
    } finally {
      try {
        await client.logout();
      } catch {
        /* noop */
      }
    }
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
      // Descubre TODAS las carpetas de la cuenta y sincroniza las relevantes.
      // Así, si un correo se mueve a otra carpeta tras procesarlo, sigue apareciendo.
      const aSincronizar = this.filtrarSincronizables(await client.list());
      this.logger.log(
        `${cred.email}: ${aSincronizar.length} carpeta(s) a sincronizar: ${aSincronizar
          .map((c) => c.folder)
          .join(', ')}`,
      );
      for (const { folder, tipo } of aSincronizar) {
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

  /**
   * Refleja el MOVIMIENTO de un correo entre carpetas: si ya existe en la BD pero
   * ahora se encontró en otra carpeta, actualiza `folder` (y `tipo`). Solo escribe
   * cuando realmente cambió de carpeta (`neq`), para no generar UPDATEs/auditoría inútiles.
   */
  private async actualizarUbicacion(
    idCuenta: string,
    messageId: string | null,
    folder: string,
    tipo: 'received' | 'sent',
  ): Promise<void> {
    if (!messageId) return; // sin messageId no se puede identificar con fiabilidad
    const { error } = await this.supabase.admin
      .from('correo_mensajes')
      .update({ folder, tipo })
      .eq('idCuenta', idCuenta)
      .eq('messageId', messageId)
      .neq('folder', folder);
    if (error)
      this.logger.warn(
        `No se pudo reubicar el correo ${messageId} a ${folder}: ${error.message}`,
      );
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
      // 23505 = duplicado (ya sincronizado). El correo pudo MOVERSE de carpeta (p. ej.
      // un proceso externo lo cataloga en Procesado/BanBajio tras registrar la
      // transferencia): reflejamos su ubicación actual en lugar de ignorarlo.
      if (error.code === '23505') {
        await this.actualizarUbicacion(cred.id, messageId, folder, tipo);
        return false;
      }
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
