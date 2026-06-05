import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { TablesInsert, TablesUpdate } from '@erp/types';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type {
  CrearProveedorDto,
  EditarProveedorDto,
} from './proveedores.schemas.js';

const ID_ALFABETO =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const PROVEEDOR_COLS =
  'idProveedor, razonSocial, rfc, nombre, apellidos, email, telefono, nombreBanco, tipoCuenta, noCuenta, personalidad, claveRegimen, tipoIdentificacion, numIdentificacion, status, fc';

/**
 * Catálogo de proveedores (CxP). Opera sobre la tabla EXISTENTE `catProveedores`
 * (compartida con v1; escrituras autorizadas). Las escrituras usan `comoActor`
 * para que la auditoría registre al usuario real.
 */
@Injectable()
export class ProveedoresService {
  private readonly logger = new Logger(ProveedoresService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private generarId(): string {
    const bytes = randomBytes(12);
    let id = '';
    for (let i = 0; i < 12; i++) id += ID_ALFABETO[bytes[i]! % ID_ALFABETO.length];
    return id;
  }

  /** Lista de proveedores (activos e inactivos), ordenados por razón social. */
  async listar() {
    const { data, error } = await this.supabase.admin
      .from('catProveedores')
      .select(PROVEEDOR_COLS)
      .order('razonSocial', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async crear(dto: CrearProveedorDto, uid: string): Promise<{ idProveedor: string }> {
    const idProveedor = this.generarId();
    const fila: TablesInsert<'catProveedores'> = {
      idProveedor,
      status: true,
      razonSocial: dto.razonSocial,
      rfc: dto.rfc,
      nombre: dto.nombre || null,
      apellidos: dto.apellidos || null,
      email: dto.email || null,
      telefono: dto.telefono || null,
      nombreBanco: dto.nombreBanco,
      tipoCuenta: dto.tipoCuenta,
      noCuenta: dto.noCuenta || null,
      personalidad: dto.personalidad ?? null,
      claveRegimen: dto.claveRegimen ?? null,
      tipoIdentificacion: dto.tipoIdentificacion ?? null,
      numIdentificacion: dto.numIdentificacion || null,
    };
    const { error } = await this.supabase
      .comoActor(uid)
      .from('catProveedores')
      .insert(fila);
    if (error) {
      this.logger.error(`Error creando proveedor: ${error.message}`);
      throw new InternalServerErrorException('No se pudo crear el proveedor.');
    }
    return { idProveedor };
  }

  async editar(
    idProveedor: string,
    dto: EditarProveedorDto,
    uid: string,
  ): Promise<void> {
    const cambios: TablesUpdate<'catProveedores'> = {
      razonSocial: dto.razonSocial,
      rfc: dto.rfc,
      nombre: dto.nombre || null,
      apellidos: dto.apellidos || null,
      email: dto.email || null,
      telefono: dto.telefono || null,
      nombreBanco: dto.nombreBanco,
      tipoCuenta: dto.tipoCuenta,
      noCuenta: dto.noCuenta || null,
      personalidad: dto.personalidad ?? null,
      claveRegimen: dto.claveRegimen ?? null,
      tipoIdentificacion: dto.tipoIdentificacion ?? null,
      numIdentificacion: dto.numIdentificacion || null,
    };
    const { error } = await this.supabase
      .comoActor(uid)
      .from('catProveedores')
      .update(cambios)
      .eq('idProveedor', idProveedor);
    if (error) {
      this.logger.error(`Error editando proveedor ${idProveedor}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo actualizar el proveedor.');
    }
  }

  async setStatus(idProveedor: string, status: boolean, uid: string): Promise<void> {
    const { error } = await this.supabase
      .comoActor(uid)
      .from('catProveedores')
      .update({ status })
      .eq('idProveedor', idProveedor);
    if (error) {
      this.logger.error(`Error status proveedor ${idProveedor}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo cambiar el estado.');
    }
  }
}
