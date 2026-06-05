import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { ConfiguracionService } from '../configuracion/configuracion.service.js';
import type { LoginDto } from './auth.schemas.js';
import type {
  LoginResult,
  PerfilUsuario,
  PermisoUsuario,
} from './auth.types.js';

interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly configuracion: ConfiguracionService,
  ) {}

  /**
   * Resuelve el correo a partir de la entrada del login, que puede ser:
   *  - un correo completo (`usuario@dominio`): se usa directo si el dominio está
   *    autorizado;
   *  - un nombre de usuario corto: se busca en catUsers `usuario@<dominio>` para
   *    cada dominio autorizado. Si hay coincidencia en más de un dominio, es
   *    ambiguo y se pide el correo completo. (Solo lectura.)
   */
  private async resolverEmail(
    entrada: string,
  ): Promise<
    | { tipo: 'ok'; email: string }
    | { tipo: 'ambiguo' }
    | { tipo: 'no_encontrado' }
  > {
    const [dominios, correos] = await Promise.all([
      this.configuracion.obtenerDominios(),
      this.configuracion.obtenerCorreos(),
    ]);
    const valor = entrada.trim().toLowerCase();

    // Caso 1: correo completo. Permitido si su dominio está autorizado o si el
    // correo está en la lista de correos específicos (excepciones).
    if (valor.includes('@')) {
      const dominio = valor.split('@')[1] ?? '';
      const permitido = dominios.includes(dominio) || correos.includes(valor);
      if (!permitido) return { tipo: 'no_encontrado' };
      return { tipo: 'ok', email: valor };
    }

    // Caso 2: nombre de usuario corto -> resolver contra catUsers. Candidatos:
    // usuario@<dominio autorizado> + los correos específicos cuya parte local
    // coincide con el nombre de usuario.
    const candidatos = [
      ...dominios.map((d) => `${valor}@${d}`),
      ...correos.filter((c) => c.split('@')[0] === valor),
    ];
    // Defensa en profundidad: el filtro PostgREST `.or()` se construye por
    // concatenación, así que descartamos cualquier candidato con caracteres que
    // alteren su sintaxis (`,` separa condiciones, `()` agrupan, `*` es wildcard
    // de ilike). El input ya pasa por la regex del schema; esto cierra el vector
    // de inyección de filtro aunque ese schema se relaje en el futuro.
    const candidatosUnicos = [...new Set(candidatos)].filter(
      (c) => !/[,()*]/.test(c),
    );
    if (candidatosUnicos.length === 0) return { tipo: 'no_encontrado' };

    const orFiltro = candidatosUnicos
      .map((c) => `email.ilike.${c}`)
      .join(',');
    const { data, error } = await this.supabase.admin
      .from('catUsers')
      .select('email')
      .or(orFiltro);

    if (error) {
      this.logger.error(`Error resolviendo usuario "${valor}": ${error.message}`);
      return { tipo: 'no_encontrado' };
    }

    const emails = [
      ...new Set(
        (data ?? [])
          .map((r) => r.email?.toLowerCase())
          .filter((e): e is string => Boolean(e)),
      ),
    ];
    if (emails.length === 0) return { tipo: 'no_encontrado' };
    if (emails.length > 1) return { tipo: 'ambiguo' };
    const email0 = emails[0];
    if (!email0) return { tipo: 'no_encontrado' };
    return { tipo: 'ok', email: email0 };
  }

  /**
   * Autentica contra Supabase Auth (server-side, con anon key) y devuelve los
   * tokens + el perfil. El frontend nunca ejecuta esto: pasa por el backend.
   */
  async login(
    dto: LoginDto,
  ): Promise<{ result: LoginResult; refreshToken: string }> {
    const resuelto = await this.resolverEmail(dto.usuario);
    if (resuelto.tipo === 'ambiguo') {
      throw new UnauthorizedException(
        'Hay más de un usuario con ese nombre. Ingresa tu correo completo.',
      );
    }
    if (resuelto.tipo === 'no_encontrado') {
      // Mensaje genérico: no revelar si el usuario existe (evita enumeración).
      throw new UnauthorizedException('Credenciales inválidas.');
    }
    const email = resuelto.email;

    const { data, error } = await this.supabase.auth.auth.signInWithPassword({
      email,
      password: dto.password,
    });

    if (error || !data.session || !data.user) {
      // Mensaje genérico: no revelar si el correo existe (evita enumeración).
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const tokens: SessionTokens = {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at ?? null,
    };

    const { usuario, permisos } = await this.cargarPerfil(data.user.id);

    // Bloqueo de usuarios inactivos (equivalente al flujo "usuario_inactivo" de v1).
    if (usuario.status === false) {
      throw new ForbiddenException('Usuario inactivo. Contacte al administrador.');
    }

    return {
      result: {
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresAt,
        usuario,
        permisos,
      },
      refreshToken: tokens.refreshToken,
    };
  }

  /** Renueva la sesión a partir del refresh token (de la cookie httpOnly). */
  async refresh(
    refreshToken: string,
  ): Promise<{ result: LoginResult; refreshToken: string }> {
    const { data, error } = await this.supabase.auth.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException('Sesión expirada. Inicie sesión de nuevo.');
    }

    const { usuario, permisos } = await this.cargarPerfil(data.user.id);
    if (usuario.status === false) {
      throw new ForbiddenException('Usuario inactivo.');
    }

    return {
      result: {
        accessToken: data.session.access_token,
        expiresAt: data.session.expires_at ?? null,
        usuario,
        permisos,
      },
      refreshToken: data.session.refresh_token,
    };
  }

  /** Invalida el refresh token en Supabase (best-effort). */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    try {
      // Revoca la sesión asociada al refresh token.
      await this.supabase.admin.auth.admin.signOut(refreshToken);
    } catch (err) {
      this.logger.warn(`logout: no se pudo revocar la sesión: ${(err as Error).message}`);
    }
  }

  /** Devuelve el perfil + permisos de un usuario autenticado (para /me). */
  async perfilDeUid(
    uid: string,
  ): Promise<{ usuario: PerfilUsuario; permisos: PermisoUsuario[] }> {
    return this.cargarPerfil(uid);
  }

  /**
   * Contexto (perfil + permisos) de OTRO usuario, para la función "Ver como" de
   * soporte. SOLO disponible si el solicitante es soporte; es de solo lectura
   * (no cambia la sesión ni permite actuar en nombre del otro usuario). La
   * autorización real de cada endpoint sigue siendo la del soporte (servidor).
   */
  async contextoComoSoporte(
    solicitanteUid: string,
    objetivoUid: string,
  ): Promise<{ usuario: PerfilUsuario; permisos: PermisoUsuario[] }> {
    const { data: perfil } = await this.supabase.admin
      .from('catUsers')
      .select('isSupport')
      .eq('uid', solicitanteUid)
      .maybeSingle();
    if (perfil?.isSupport !== true) {
      throw new ForbiddenException('Solo los usuarios de soporte pueden usar "Ver como".');
    }
    return this.cargarPerfil(objetivoUid);
  }

  /**
   * Cambia la propia contraseña: verifica la actual (signInWithPassword) y, si es
   * correcta, actualiza la contraseña con service_role. El correo se toma del JWT
   * (o de catUsers como respaldo); nunca del cliente.
   */
  async cambiarContrasena(
    uid: string,
    emailJwt: string | null,
    actual: string,
    nueva: string,
  ): Promise<void> {
    let email = emailJwt;
    if (!email) {
      const { data } = await this.supabase.admin
        .from('catUsers')
        .select('email')
        .eq('uid', uid)
        .maybeSingle();
      email = data?.email ?? null;
    }
    if (!email) {
      throw new InternalServerErrorException('No se pudo determinar el correo.');
    }

    // Verificar la contraseña actual.
    const { error: errLogin } = await this.supabase.auth.auth.signInWithPassword(
      { email, password: actual },
    );
    if (errLogin) {
      throw new BadRequestException('La contraseña actual es incorrecta.');
    }

    // Actualizar la contraseña (admin).
    const { error } = await this.supabase.admin.auth.admin.updateUserById(uid, {
      password: nueva,
    });
    if (error) {
      throw new InternalServerErrorException(
        `No se pudo cambiar la contraseña: ${error.message}`,
      );
    }
  }

  /**
   * Lee el perfil desde catUsers y los permisos desde segModulosUsuarios usando
   * service_role (server-side). Reemplaza la lectura cliente de v1.
   */
  private async cargarPerfil(
    uid: string,
  ): Promise<{ usuario: PerfilUsuario; permisos: PermisoUsuario[] }> {
    const { data: perfil, error: errPerfil } = await this.supabase.admin
      .from('catUsers')
      .select(
        'uid, email, nombre, apellidos, nomCompleto, idPerfil, rol, isSupport, status, img',
      )
      .eq('uid', uid)
      .maybeSingle();

    if (errPerfil) {
      this.logger.error(`Error cargando catUsers ${uid}: ${errPerfil.message}`);
      throw new UnauthorizedException('No se pudo cargar el perfil.');
    }
    if (!perfil) {
      throw new UnauthorizedException('El usuario no tiene perfil en el sistema.');
    }

    const { data: permisos, error: errPerm } = await this.supabase.admin
      .from('segModulosUsuarios')
      .select('modulo, seccion, clave, acceso')
      .eq('uid', uid);

    if (errPerm) {
      this.logger.error(`Error cargando permisos ${uid}: ${errPerm.message}`);
    }

    return {
      usuario: perfil as PerfilUsuario,
      permisos: (permisos ?? []) as PermisoUsuario[],
    };
  }
}
