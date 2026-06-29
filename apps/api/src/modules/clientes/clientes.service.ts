import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { fallaBd } from '../../common/utils/db-error.js';
import type { ClienteDto, TipoCliente } from './clientes.schemas.js';
import {
  baseRfc,
  esRfcGenerico,
  letrasBaseRfc,
  normalizarRfc,
} from './rfc.util.js';

/**
 * Una coincidencia de RFC en la verificación de duplicados: lo mínimo para el aviso
 * (sin PII innecesaria de terceros). Para editar el existente se recarga con `obtener`.
 */
export interface RfcCoincidencia {
  idInversionista: string;
  razonsocial: string | null;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  RFC: string | null;
  inversionista: boolean;
  arrendatario: boolean;
  ticket: boolean;
  usuarioFinal: boolean;
  pruebas: boolean;
  /** 'exacto' = RFC completo igual; 'base' = misma base, homoclave distinta/faltante. */
  tipoCoincidencia: 'exacto' | 'base';
}

const ID_ALFABETO =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const COLS =
  'idInversionista, personalidad, idContpac, razonsocial, nombre, apellido1, apellido2, fecNacimiento, telefono, correo, RFC, CURP, inversionista, arrendatario, ticket, usuarioFinal, pruebas';

/**
 * Columnas mínimas para la verificación de RFC: lo justo para el aviso de duplicado
 * (identificar a la persona y sus tipos). NO expone PII innecesaria de terceros
 * (CURP/correo/teléfono/fecha de nacimiento); para editar el existente se recarga
 * por `obtener(id)`.
 */
const COLS_VERIF =
  'idInversionista, razonsocial, nombre, apellido1, apellido2, RFC, inversionista, arrendatario, ticket, usuarioFinal, pruebas';

/**
 * Clientes (clave 300). Migra la pantalla "Clientes" del CRM de v1 a una sección
 * directa. Opera sobre la tabla `inversionista` (un mismo registro puede ser
 * inversionista, arrendatario, ticket y/o usuario final). Escrituras auditadas.
 */
@Injectable()
export class ClientesService {
  private readonly logger = new Logger(ClientesService.name);

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
    if (error) fallaBd(this.logger, 'clientes.listar', error);
    return data ?? [];
  }

  /** Carga un cliente completo por id (para abrir/editar el existente desde un aviso). */
  async obtener(id: string) {
    const { data, error } = await this.supabase.admin
      .from('inversionista')
      .select(COLS)
      .eq('idInversionista', id)
      .maybeSingle();
    if (error) fallaBd(this.logger, 'clientes.obtener', error);
    if (!data) throw new NotFoundException('Cliente no encontrado.');
    return data;
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

  /**
   * Busca clientes con el MISMO RFC (por base) en TODA la tabla `inversionista`,
   * sin filtrar por tipo ni por `pruebas`. Soporta homoclave faltante/distinta.
   */
  async verificarRfc(
    rfc: string,
    excluirId?: string,
  ): Promise<{ generico: boolean; coincidencias: RfcCoincidencia[] }> {
    const base = baseRfc(rfc);
    const generico = esRfcGenerico(rfc);
    if (!base) return { generico, coincidencias: [] };

    // Acotamos por la parte alfabética de la base (3-4 letras) y afinamos por base.
    const { data, error } = await this.supabase.admin
      .from('inversionista')
      .select(COLS_VERIF)
      .ilike('RFC', `${letrasBaseRfc(rfc)}%`);
    if (error) fallaBd(this.logger, 'clientes.verificarRfc', error);

    const rfcNorm = normalizarRfc(rfc);
    const coincidencias: RfcCoincidencia[] = [];
    for (const r of data ?? []) {
      if (excluirId && r.idInversionista === excluirId) continue;
      if (baseRfc(r.RFC) !== base) continue;
      coincidencias.push({
        ...(r as Omit<RfcCoincidencia, 'tipoCoincidencia'>),
        tipoCoincidencia:
          normalizarRfc(r.RFC) === rfcNorm ? 'exacto' : 'base',
      });
    }
    return { generico, coincidencias };
  }

  /**
   * Red de seguridad server-side: rechaza RFC genérico y duplicados. El match
   * EXACTO siempre se bloquea (es el mismo cliente → editarlo, no recrearlo). El
   * match de solo BASE (homoclave distinta) se permite si el usuario lo confirmó.
   */
  private async asegurarRfcUnico(
    rfc: string,
    permitirSimilar: boolean,
    excluirId?: string,
  ): Promise<void> {
    if (esRfcGenerico(rfc)) {
      throw new BadRequestException(
        'El RFC genérico no está permitido. Captura el RFC real del cliente.',
      );
    }
    const { coincidencias } = await this.verificarRfc(rfc, excluirId);
    const nombreDe = (c: RfcCoincidencia) =>
      c.razonsocial?.trim() ||
      [c.nombre, c.apellido1, c.apellido2].filter(Boolean).join(' ') ||
      'otro cliente';

    const exacta = coincidencias.find((c) => c.tipoCoincidencia === 'exacto');
    if (exacta) {
      throw new ConflictException(
        `Ya existe un cliente con este RFC: ${nombreDe(exacta)}. Abre su registro y edítalo en lugar de crear uno nuevo.`,
      );
    }
    const similar = coincidencias.find((c) => c.tipoCoincidencia === 'base');
    if (similar && !permitirSimilar) {
      throw new ConflictException(
        `Hay un cliente con un RFC muy parecido: ${nombreDe(similar)} (difiere la homoclave). Verifica si es la misma persona.`,
      );
    }
  }

  async crear(dto: ClienteDto, actorUid: string): Promise<{ idInversionista: string }> {
    await this.asegurarRfcUnico(dto.RFC, dto.permitirSimilar);
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
    if (error) fallaBd(this.logger, 'clientes.crear', error);
    return { idInversionista };
  }

  async actualizar(id: string, dto: ClienteDto, actorUid: string): Promise<void> {
    await this.asegurarRfcUnico(dto.RFC, dto.permitirSimilar, id);
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('inversionista')
      .update(this.camposDe(dto))
      .eq('idInversionista', id);
    if (error) fallaBd(this.logger, 'clientes.actualizar', error);
  }

  /** Mueve el cliente a la papelera (replica v1: limpia tipos y marca prueba). */
  async moverPapelera(id: string, actorUid: string): Promise<void> {
    const { data, error: selErr } = await this.supabase.admin
      .from('inversionista')
      .select('idInversionista')
      .eq('idInversionista', id)
      .maybeSingle();
    if (selErr) fallaBd(this.logger, 'clientes.moverPapelera (select)', selErr);
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
    if (error) fallaBd(this.logger, 'clientes.moverPapelera', error);
  }
}
