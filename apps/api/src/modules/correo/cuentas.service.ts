import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import type { TablesInsert, TablesUpdate } from '@erp/types';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { CriptoService } from './cripto.service.js';
import type { CuentaDto } from './correo.schemas.js';

/** Credenciales en claro de una cuenta (uso interno IMAP/SMTP). */
export interface Credenciales {
  id: string;
  email: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  usuario: string;
  password: string;
}

const PUB_COLS =
  'id, nombre, email, "imapHost", "imapPort", "smtpHost", "smtpPort", usuario, activo, "ultimoUidSync", fc';

@Injectable()
export class CuentasService {
  private readonly logger = new Logger(CuentasService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly cripto: CriptoService,
  ) {}

  /** Cuentas SIN la contraseña (para el frontend). */
  async listar() {
    const { data, error } = await this.supabase.admin
      .from('correo_cuentas')
      .select(PUB_COLS)
      .order('fc', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /** Cuentas activas (uso interno: sincronización). */
  async activas(): Promise<Credenciales[]> {
    const { data, error } = await this.supabase.admin
      .from('correo_cuentas')
      .select('*')
      .eq('activo', true);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []).map((c) => this.aCredenciales(c));
  }

  private aCredenciales(c: {
    id: string;
    email: string;
    imapHost: string;
    imapPort: number;
    smtpHost: string;
    smtpPort: number;
    usuario: string;
    passwordCifrada: string;
  }): Credenciales {
    return {
      id: c.id,
      email: c.email,
      imapHost: c.imapHost,
      imapPort: c.imapPort,
      smtpHost: c.smtpHost,
      smtpPort: c.smtpPort,
      usuario: c.usuario || c.email,
      password: this.cripto.descifrar(c.passwordCifrada),
    };
  }

  async credencialesDe(id: string): Promise<Credenciales> {
    const { data, error } = await this.supabase.admin
      .from('correo_cuentas')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Cuenta de correo no encontrada.');
    return this.aCredenciales(data);
  }

  async crear(dto: CuentaDto, uid: string): Promise<{ id: string }> {
    if (!this.cripto.disponible)
      throw new BadRequestException(
        'El servidor no tiene configurada la clave de cifrado de correo (EMAIL_ENCRYPTION_KEY).',
      );
    if (!dto.password)
      throw new BadRequestException('La contraseña es obligatoria al crear la cuenta.');
    const fila: TablesInsert<'correo_cuentas'> = {
      nombre: dto.nombre || null,
      email: dto.email,
      imapHost: dto.imapHost,
      imapPort: dto.imapPort,
      smtpHost: dto.smtpHost,
      smtpPort: dto.smtpPort,
      usuario: dto.usuario || dto.email,
      passwordCifrada: this.cripto.cifrar(dto.password),
      activo: dto.activo,
      uidr: uid,
    };
    const { data, error } = await this.supabase
      .comoActor(uid)
      .from('correo_cuentas')
      .insert(fila)
      .select('id')
      .single();
    if (error) {
      this.logger.error(`Error creando cuenta de correo: ${error.message}`);
      throw new InternalServerErrorException('No se pudo crear la cuenta.');
    }
    return { id: data.id };
  }

  async editar(id: string, dto: CuentaDto, uid: string): Promise<void> {
    const cambios: TablesUpdate<'correo_cuentas'> = {
      nombre: dto.nombre || null,
      email: dto.email,
      imapHost: dto.imapHost,
      imapPort: dto.imapPort,
      smtpHost: dto.smtpHost,
      smtpPort: dto.smtpPort,
      usuario: dto.usuario || dto.email,
      activo: dto.activo,
    };
    // Solo recifra la contraseña si se envió una nueva.
    if (dto.password) cambios.passwordCifrada = this.cripto.cifrar(dto.password);
    const { error } = await this.supabase
      .comoActor(uid)
      .from('correo_cuentas')
      .update(cambios)
      .eq('id', id);
    if (error) {
      this.logger.error(`Error editando cuenta ${id}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo actualizar la cuenta.');
    }
  }

  async setActivo(id: string, activo: boolean, uid: string): Promise<void> {
    const { error } = await this.supabase
      .comoActor(uid)
      .from('correo_cuentas')
      .update({ activo })
      .eq('id', id);
    if (error) throw new InternalServerErrorException('No se pudo cambiar el estado.');
  }

  /**
   * Prueba la conexión IMAP (login) y SMTP (verify) con las credenciales dadas.
   * Si `dto.password` viene vacío y `id` existe, usa la contraseña guardada.
   */
  async probar(
    dto: CuentaDto,
    id?: string,
  ): Promise<{ imap: boolean; smtp: boolean; mensaje: string }> {
    let password = dto.password;
    if (!password && id) password = (await this.credencialesDe(id)).password;
    if (!password)
      throw new BadRequestException('Falta la contraseña para probar la conexión.');
    const usuario = dto.usuario || dto.email;

    let imap = false;
    let smtp = false;
    const errores: string[] = [];

    // IMAP
    const client = new ImapFlow({
      host: dto.imapHost,
      port: dto.imapPort,
      secure: dto.imapPort === 993,
      auth: { user: usuario, pass: password },
      logger: false,
    });
    try {
      await client.connect();
      imap = true;
    } catch (e) {
      errores.push(`IMAP: ${(e as Error).message}`);
    } finally {
      try {
        await client.logout();
      } catch {
        /* noop */
      }
    }

    // SMTP
    try {
      const transporter = nodemailer.createTransport({
        host: dto.smtpHost,
        port: dto.smtpPort,
        secure: dto.smtpPort === 465,
        auth: { user: usuario, pass: password },
      });
      await transporter.verify();
      smtp = true;
    } catch (e) {
      errores.push(`SMTP: ${(e as Error).message}`);
    }

    return {
      imap,
      smtp,
      mensaje:
        imap && smtp
          ? 'Conexión IMAP y SMTP correctas.'
          : errores.join(' · ') || 'No se pudo conectar.',
    };
  }
}
