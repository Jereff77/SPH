import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/types';
import type { Env } from '../config/env.validation.js';

/**
 * Punto de acceso ÚNICO a Supabase desde el servidor. Opera SOBRE el esquema de
 * producción ya existente (mismas tablas/RPCs) y está tipado con `Database`.
 *
 * - `admin`: cliente service_role (acceso total, salta RLS). Para datos, SIEMPRE
 *   detrás de la autorización (JwtAuthGuard + PermisoGuard).
 * - `auth`: cliente con anon key, usado SOLO para el flujo de autenticación
 *   (login/refresh) server-side. No se usa para acceso a datos.
 *
 * El frontend nunca recibe estas claves ni habla con Supabase directamente: esa
 * es la frontera de confianza que faltaba en v1.
 */
@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private _admin!: SupabaseClient<Database>;
  private _auth!: SupabaseClient<Database>;
  // Clientes "con identidad" cacheados por uid (para la auditoría server-side).
  private readonly actorCache = new Map<
    string,
    { client: SupabaseClient<Database>; exp: number }
  >();

  constructor(private readonly config: ConfigService<Env, true>) {}

  onModuleInit(): void {
    const url = this.config.get('SUPABASE_URL', { infer: true });
    const serviceRoleKey = this.config.get('SUPABASE_SERVICE_ROLE_KEY', {
      infer: true,
    });
    const anonKey = this.config.get('SUPABASE_ANON_KEY', { infer: true });

    this._admin = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    this._auth = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    this.logger.log('Clientes Supabase (service_role + auth) inicializados.');
  }

  /** Cliente administrador (service_role). Usar solo tras autorizar la petición. */
  get admin(): SupabaseClient<Database> {
    return this._admin;
  }

  /** Cliente para el flujo de autenticación (anon key). */
  get auth(): SupabaseClient<Database> {
    return this._auth;
  }

  /**
   * Cliente service_role "con identidad": las peticiones llevan un JWT firmado
   * con `role: service_role` (acceso total, salta RLS) y `sub: <uid>`, de modo
   * que los triggers de auditoría capturan QUIÉN realizó el cambio (auth.uid()).
   * Usar este cliente en TODA escritura (insert/update/delete) — regla de oro de
   * trazabilidad. Las lecturas pueden seguir usando `admin`.
   */
  comoActor(uid: string): SupabaseClient<Database> {
    if (!uid) return this._admin;
    const now = Math.floor(Date.now() / 1000);
    const cached = this.actorCache.get(uid);
    if (cached && cached.exp - now > 300) return cached.client;

    const url = this.config.get('SUPABASE_URL', { infer: true });
    const serviceRoleKey = this.config.get('SUPABASE_SERVICE_ROLE_KEY', {
      infer: true,
    });
    const exp = now + 3600;
    const jwt = this.firmarJwtActor(uid, now, exp);
    const client = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    this.actorCache.set(uid, { client, exp });
    return client;
  }

  /** ¿El usuario es de soporte? (para habilitar "Ver como"). */
  async esSoporte(uid: string): Promise<boolean> {
    const { data } = await this._admin
      .from('catUsers')
      .select('isSupport')
      .eq('uid', uid)
      .maybeSingle();
    return data?.isSupport === true;
  }

  /**
   * Resuelve el uid "efectivo" para consultas dependientes del usuario. Si llega
   * un uid de "Ver como" (`verComoUid`) y el actor es soporte, devuelve ese uid;
   * en cualquier otro caso, el del propio actor. Así soporte ve los datos del
   * usuario observado sin que un usuario normal pueda suplantar a otro.
   */
  async uidEfectivo(actorUid: string, verComoUid?: string): Promise<string> {
    if (!verComoUid || verComoUid === actorUid) return actorUid;
    return (await this.esSoporte(actorUid)) ? verComoUid : actorUid;
  }

  /** Firma un JWT HS256 (mismo secreto que verifica v2/v1) con role+sub. */
  private firmarJwtActor(uid: string, iat: number, exp: number): string {
    const secret = this.config.get('SUPABASE_JWT_SECRET', { infer: true });
    const enc = (o: unknown): string =>
      Buffer.from(JSON.stringify(o)).toString('base64url');
    const data = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({
      role: 'service_role',
      sub: uid,
      iat,
      exp,
    })}`;
    const sig = createHmac('sha256', secret).update(data).digest('base64url');
    return `${data}.${sig}`;
  }
}
