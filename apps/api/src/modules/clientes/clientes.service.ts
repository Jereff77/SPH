import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type { ClienteDto, TipoCliente } from './clientes.schemas.js';

const ID_ALFABETO =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const COLS =
  'idInversionista, personalidad, idContpac, razonsocial, nombre, apellido1, apellido2, fecNacimiento, telefono, correo, RFC, CURP, inversionista, arrendatario, ticket, usuarioFinal, pruebas';

/**
 * Clientes (clave 300). Migra la pantalla "Clientes" del CRM de v1 a una sección
 * directa. Opera sobre la tabla `inversionista` (un mismo registro puede ser
 * inversionista, arrendatario, ticket y/o usuario final). Escrituras auditadas.
 */
@Injectable()
export class ClientesService {
  constructor(private readonly supabase: SupabaseService) {}

  private generarId(n = 15): string {
    const bytes = randomBytes(n);
    let id = '';
    for (let i = 0; i < n; i++) id += ID_ALFABETO[bytes[i]! % ID_ALFABETO.length];
    return id;
  }

  /** Listado por tipo (chip), ordenado por razón social. */
  async listar(tipo: TipoCliente) {
    let q = this.supabase.admin.from('inversionista').select(COLS);
    switch (tipo) {
      case 'inversionistas':
        q = q.eq('inversionista', true);
        break;
      case 'arrendatarios':
        q = q.eq('arrendatario', true);
        break;
      case 'ticket':
        q = q.eq('ticket', true);
        break;
      case 'usuarioFinal':
        q = q.eq('usuarioFinal', true);
        break;
      case 'papelera':
        // Papelera = de prueba, o sin ningún tipo asignado (como v1).
        q = q.or(
          'pruebas.eq.true,and(inversionista.eq.false,arrendatario.eq.false,ticket.eq.false)',
        );
        break;
    }
    const { data, error } = await q.order('razonsocial', {
      ascending: true,
      nullsFirst: false,
    });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /** Campos editables del cliente (sin las llaves ni auditoría). */
  private camposDe(dto: ClienteDto) {
    return {
      nombre: dto.nombre,
      apellido1: dto.apellido1,
      apellido2: dto.apellido2,
      telefono: dto.telefono,
      correo: dto.correo || null,
      RFC: dto.RFC,
      CURP: dto.CURP,
      idContpac: dto.idContpac,
      razonsocial: dto.razonsocial || null,
      personalidad: dto.personalidad || null,
      fecNacimiento: dto.fecNacimiento || null,
      inversionista: dto.inversionista,
      arrendatario: dto.arrendatario,
      ticket: dto.ticket,
      usuarioFinal: dto.usuarioFinal,
    };
  }

  async crear(dto: ClienteDto, actorUid: string): Promise<{ idInversionista: string }> {
    const idInversionista = this.generarId(15);
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('inversionista')
      .insert({
        idInversionista,
        idUser: actorUid,
        status: true,
        pruebas: false,
        ...this.camposDe(dto),
      });
    if (error) throw new InternalServerErrorException(error.message);
    return { idInversionista };
  }

  async actualizar(id: string, dto: ClienteDto, actorUid: string): Promise<void> {
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('inversionista')
      .update(this.camposDe(dto))
      .eq('idInversionista', id);
    if (error) throw new InternalServerErrorException(error.message);
  }

  /** Mueve el cliente a la papelera (replica v1: limpia tipos y marca prueba). */
  async moverPapelera(id: string, actorUid: string): Promise<void> {
    const { data, error: selErr } = await this.supabase.admin
      .from('inversionista')
      .select('idInversionista')
      .eq('idInversionista', id)
      .maybeSingle();
    if (selErr) throw new InternalServerErrorException(selErr.message);
    if (!data) throw new NotFoundException('Cliente no encontrado.');

    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('inversionista')
      .update({
        pruebas: true,
        tipoCliente: '0001',
        inversionista: false,
        arrendatario: false,
        ticket: false,
        usuarioFinal: false,
      })
      .eq('idInversionista', id);
    if (error) throw new InternalServerErrorException(error.message);
  }
}
