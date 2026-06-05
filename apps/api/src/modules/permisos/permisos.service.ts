import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';

function nombre(u: {
  nombre: string | null;
  apellidos: string | null;
  nomCompleto: string | null;
}): string {
  if (u.apellidos && u.nombre) return `${u.apellidos}, ${u.nombre}`;
  return u.nomCompleto ?? u.nombre ?? '—';
}

/**
 * Gestión de permisos (RBAC). Opera sobre las tablas EXISTENTES de seguridad y
 * reutiliza las funciones de negocio (parametrizadas, seguras), igual que Cuentas.
 */
@Injectable()
export class PermisosService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Usuarios activos para el selector. */
  async listarUsuarios() {
    const { data, error } = await this.supabase.admin
      .from('catUsers')
      .select('uid, nombre, apellidos, nomCompleto')
      .eq('status', true)
      .order('apellidos', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []).map((u) => ({ uid: u.uid, nombre: nombre(u) }));
  }

  /** Permisos de un usuario (los 62, vía la función de negocio). */
  async obtenerPermisos(uid: string) {
    const { data, error } = await this.supabase.admin.rpc(
      'segmodulosusuarios_smu',
      { p_uid: uid },
    );
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []).map((r) => ({
      idsegModulos: r.idsegModulos,
      modulo: r.modulo,
      seccion: r.seccion,
      area: r.area,
      clave: r.clave,
      acceso: r.acceso,
    }));
  }

  /** Activa/desactiva un permiso de un usuario. */
  async setAcceso(
    uid: string,
    idsegModulos: string,
    acceso: boolean,
  ): Promise<void> {
    const { error } = await this.supabase.admin
      .from('segModulosUsuarios')
      .update({ acceso })
      .eq('uid', uid)
      .eq('idsegModulos', idsegModulos);
    if (error) throw new InternalServerErrorException(error.message);
  }

  /** Plantillas activas. */
  async listarPlantillas() {
    const { data, error } = await this.supabase.admin
      .from('segPlantillasPermisos')
      .select('idPlantilla, nombrePlantilla, descripcion, categoria')
      .eq('status', true)
      .order('nombrePlantilla', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /** Aplica una plantilla a un usuario (función de negocio). */
  async aplicarPlantilla(
    uid: string,
    idPlantilla: string,
    reemplazarTodos: boolean,
  ): Promise<void> {
    const { error } = await this.supabase.admin.rpc(
      'seg_aplicar_plantilla_a_usuario',
      {
        p_uid_usuario_destino: uid,
        p_id_plantilla: idPlantilla,
        p_reemplazar_todos: reemplazarTodos,
      },
    );
    if (error) throw new InternalServerErrorException(error.message);
  }

  /** Crea una plantilla a partir de los permisos de un usuario (función de negocio). */
  async crearPlantillaDesdeUsuario(
    nombre: string,
    descripcion: string,
    uidOrigen: string,
    categoria: string,
    esPublica: boolean,
    uidCreador: string,
  ): Promise<void> {
    const { error } = await this.supabase.admin.rpc(
      'seg_crear_plantilla_desde_usuario',
      {
        p_nombre_plantilla: nombre,
        p_descripcion: descripcion,
        p_uid_usuario_origen: uidOrigen,
        p_categoria: categoria,
        p_es_publica: esPublica ? 'true' : 'false',
        p_uid_creador: uidCreador,
      },
    );
    if (error) throw new InternalServerErrorException(error.message);
  }
}
