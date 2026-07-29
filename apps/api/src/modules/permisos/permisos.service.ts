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

/** Un permiso del catálogo `segModulos` (columna de la matriz). */
export interface PermisoCatalogo {
  clave: number;
  modulo: string;
  seccion: string;
  area: string;
}

/** Un usuario con las claves que tiene concedidas (fila de la matriz). */
export interface UsuarioMatriz {
  nombre: string;
  correo: string;
  activo: boolean;
  soporte: boolean;
  claves: number[];
}

export interface MatrizPermisos {
  permisos: PermisoCatalogo[];
  usuarios: UsuarioMatriz[];
  generado: string;
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

  /**
   * Matriz completa usuarios × permisos, para el reporte descargable de la
   * pantalla (clave 220). Devuelve el catálogo `segModulos` (columnas) y **todos**
   * los usuarios —activos e inactivos, para que el reporte muestre también a quién
   * se le retiró el acceso— con las claves que tienen concedidas (`acceso = true`).
   *
   * No amplía la superficie de datos: quien tiene la clave 220 ya puede consultar
   * los permisos de cualquier usuario uno por uno; esto solo los agrega en una
   * sola lectura. Es **solo lectura** y no toca `segModulosUsuarios`.
   *
   * ⚠️ `isSupport` hace **bypass** del RBAC (super-admin): esos usuarios entran a
   * todo sin importar sus marcas, por eso viajan señalados aparte y el reporte los
   * pinta distinto — si no, la matriz mentiría sobre su alcance real.
   */
  async matriz(): Promise<MatrizPermisos> {
    // ⚠️ `range` explícito en las TRES lecturas: PostgREST corta en 1000 filas por
    // defecto y lo hace **en silencio** (sin error), así que un reporte que crezca
    // por encima del tope saldría incompleto y nadie lo notaría. `segModulosUsuarios`
    // es la que más crece (usuario × permiso: hoy ~3.4k filas, ~560 con acceso).
    const [usuariosRes, catalogoRes, accesosRes] = await Promise.all([
      this.supabase.admin
        .from('catUsers')
        .select('uid, nombre, apellidos, nomCompleto, email, status, isSupport')
        .order('status', { ascending: false })
        .order('apellidos', { ascending: true })
        .range(0, 9999),
      this.supabase.admin
        .from('segModulos')
        .select('clave, modulo, seccion, area')
        .order('clave', { ascending: true })
        .range(0, 9999),
      this.supabase.admin
        .from('segModulosUsuarios')
        .select('uid, clave')
        .eq('acceso', true)
        .range(0, 49999),
    ]);
    if (usuariosRes.error)
      throw new InternalServerErrorException(usuariosRes.error.message);
    if (catalogoRes.error)
      throw new InternalServerErrorException(catalogoRes.error.message);
    if (accesosRes.error)
      throw new InternalServerErrorException(accesosRes.error.message);

    const permisos: PermisoCatalogo[] = (catalogoRes.data ?? [])
      .filter((p): p is typeof p & { clave: number } => p.clave != null)
      .map((p) => ({
        clave: p.clave,
        modulo: String(p.modulo ?? '—'),
        seccion: p.seccion ?? '—',
        area: p.area ?? '—',
      }));

    const clavesPorUid = new Map<string, Set<number>>();
    for (const a of accesosRes.data ?? []) {
      if (!a.uid || a.clave == null) continue;
      const set = clavesPorUid.get(a.uid) ?? new Set<number>();
      set.add(a.clave);
      clavesPorUid.set(a.uid, set);
    }

    const usuarios: UsuarioMatriz[] = (usuariosRes.data ?? []).map((u) => ({
      nombre: nombre(u),
      correo: u.email ?? '—',
      activo: u.status === true,
      soporte: u.isSupport === true,
      claves: [...(clavesPorUid.get(u.uid) ?? [])].sort((a, b) => a - b),
    }));

    return { permisos, usuarios, generado: new Date().toISOString() };
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
