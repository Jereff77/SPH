import type { SupabaseService } from '../../common/supabase/supabase.service.js';

/**
 * Cliente Supabase FALSO en memoria para las pruebas de integración del módulo CxP (PPD).
 * Sigue el patrón de `arrendatarios/supabase-falso.testing-spec.ts` (que NO se tocó: sus
 * specs de jest dependen de que las escrituras no persistan) pero con lo que PPD necesita:
 *  - Escrituras que SÍ persisten (insert/update/delete) en las tablas en memoria.
 *  - Índices únicos simulados (`unicos`): un insert que repite el valor falla con 23505 y el
 *    mensaje de Postgres (`duplicate key value violates unique constraint "<índice>"`).
 *  - Ganchos `antesDeInsertar` / `despuesDeInsertar` para simular triggers de la BD y
 *    peticiones concurrentes (otra fila que aparece entre la lectura y el insert).
 *  - `like` con el escape de PostgREST, `neq` con semántica SQL (NULL no cuenta), conteo
 *    `count: 'exact', head: true`, `maybeSingle` que falla si hay más de una fila.
 *  - `storage.from(bucket)` que registra `upload` y `remove` (para probar que NO se borra).
 *  - `rpc(fn)` con respuestas configurables.
 * No es un spec (no termina en `.spec.ts`) pero su nombre acaba en `spec.ts` para que
 * `tsconfig.build.json` lo deje fuera del build.
 */

export type Fila = Record<string, unknown>;
export type Tablas = Record<string, Fila[]>;

export interface ErrorPg {
  message: string;
  code?: string;
  details?: string;
}

export interface IndiceUnico {
  tabla: string;
  /** Nombre del índice tal como aparece en el mensaje de Postgres (p. ej. `cxp_folio_key`). */
  nombre: string;
  columnas: string[];
}

export interface Escritura {
  tabla: string;
  tipo: 'insert' | 'update' | 'delete';
  fila: unknown;
  uid: string | null;
  via: 'admin' | 'actor';
}

export interface OpcionesFalsoCxp {
  tablas?: Tablas;
  /** Respuesta de cada RPC: valor fijo o función de los argumentos; `{ __error: 'texto' }` simula error. */
  rpc?: Record<string, unknown>;
  unicos?: IndiceUnico[];
  /** Antes de insertar (tras `unicos` NO: antes). Devuelve un error para simular un trigger/carrera. */
  antesDeInsertar?: (tabla: string, fila: Fila, tablas: Tablas) => ErrorPg | null | undefined | void;
  /** Después de un insert exitoso: simula otra petición que escribe justo después. */
  despuesDeInsertar?: (tabla: string, fila: Fila, tablas: Tablas) => void;
}

export interface Contexto {
  tablas: Tablas;
  escrituras: Escritura[];
  rpcs: { fn: string; args: Record<string, unknown> }[];
  storage: { subidos: { bucket: string; path: string }[]; removidos: { bucket: string; path: string }[] };
  /** Nº de intentos de insert por tabla (incluye los que fallaron). */
  intentosInsert: Record<string, number>;
}

interface Resultado {
  data: unknown;
  error: ErrorPg | null;
  count: number | null;
}

const escaparRegex = (c: string): string => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Convierte un patrón LIKE de PostgREST (con `\` como escape) en RegExp. */
function patronARegex(patron: string): RegExp {
  let r = '';
  for (let i = 0; i < patron.length; i++) {
    const c = patron[i]!;
    if (c === '\\' && i + 1 < patron.length) r += escaparRegex(patron[++i]!);
    else if (c === '%') r += '.*';
    else if (c === '_') r += '.';
    else r += escaparRegex(c);
  }
  return new RegExp(`^${r}$`, 's');
}

class Consulta implements PromiseLike<Resultado> {
  private filtros: Array<(f: Fila) => boolean> = [];
  private orden: Array<{ col: string; asc: boolean }> = [];
  private tope: number | null = null;
  private tipo: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private carga: unknown = null;
  private cuenta = false;
  private cabeza = false;
  private una = false;
  private devolver = false;

  constructor(
    private readonly tabla: string,
    private readonly ctx: Contexto,
    private readonly op: OpcionesFalsoCxp,
    private readonly via: 'admin' | 'actor',
    private readonly uid: string | null,
  ) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }): this {
    if (this.tipo !== 'select') this.devolver = true; // insert/update/delete(...).select() devuelve filas
    if (opts?.count) this.cuenta = true;
    if (opts?.head) this.cabeza = true;
    return this;
  }
  insert(fila: unknown): this {
    this.tipo = 'insert';
    this.carga = fila;
    return this;
  }
  update(fila: unknown): this {
    this.tipo = 'update';
    this.carga = fila;
    return this;
  }
  delete(): this {
    this.tipo = 'delete';
    return this;
  }
  eq(col: string, val: unknown): this {
    this.filtros.push((f) => f[col] === val);
    return this;
  }
  neq(col: string, val: unknown): this {
    // Semántica SQL: `col <> val` no incluye los NULL.
    this.filtros.push((f) => f[col] !== null && f[col] !== undefined && f[col] !== val);
    return this;
  }
  in(col: string, vals: unknown[]): this {
    this.filtros.push((f) => vals.includes(f[col]));
    return this;
  }
  is(col: string, val: unknown): this {
    this.filtros.push((f) => (f[col] ?? null) === val);
    return this;
  }
  not(col: string, operador: string, val: unknown): this {
    if (operador === 'is') this.filtros.push((f) => (f[col] ?? null) !== val);
    return this;
  }
  like(col: string, patron: string): this {
    const re = patronARegex(patron);
    this.filtros.push((f) => typeof f[col] === 'string' && re.test(f[col] as string));
    return this;
  }
  ilike(col: string, patron: string): this {
    const re = new RegExp(patronARegex(patron).source, 'is');
    this.filtros.push((f) => typeof f[col] === 'string' && re.test(f[col] as string));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }): this {
    this.orden.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number): this {
    this.tope = n;
    return this;
  }
  maybeSingle(): this {
    this.una = true;
    return this;
  }
  single(): this {
    this.una = true;
    return this;
  }

  private filas(): Fila[] {
    return (this.ctx.tablas[this.tabla] ??= []);
  }

  private violaUnico(fila: Fila): ErrorPg | null {
    for (const u of (this.op.unicos ?? []).filter((x) => x.tabla === this.tabla)) {
      const valores = u.columnas.map((c) => fila[c]);
      if (valores.some((v) => v === null || v === undefined)) continue;
      const choca = this.filas().some((f) => u.columnas.every((c) => f[c] === fila[c]));
      if (choca)
        return {
          message: `duplicate key value violates unique constraint "${u.nombre}"`,
          code: '23505',
          details: `Key (${u.columnas.join(', ')})=(${valores.join(', ')}) already exists.`,
        };
    }
    return null;
  }

  private ejecutar(): Resultado {
    const tablas = this.ctx.tablas;
    if (this.tipo === 'insert') {
      this.ctx.intentosInsert[this.tabla] = (this.ctx.intentosInsert[this.tabla] ?? 0) + 1;
      const nuevas = (Array.isArray(this.carga) ? this.carga : [this.carga]) as Fila[];
      const insertadas: Fila[] = [];
      for (const n of nuevas) {
        const fila = { ...n };
        const errGancho = this.op.antesDeInsertar?.(this.tabla, fila, tablas);
        if (errGancho) return { data: null, error: errGancho, count: null };
        const errUnico = this.violaUnico(fila);
        if (errUnico) return { data: null, error: errUnico, count: null };
        this.filas().push(fila);
        insertadas.push(fila);
        this.ctx.escrituras.push({ tabla: this.tabla, tipo: 'insert', fila, uid: this.uid, via: this.via });
        this.op.despuesDeInsertar?.(this.tabla, fila, tablas);
      }
      return { data: this.devolver ? insertadas : null, error: null, count: null };
    }

    const coinciden = this.filas().filter((f) => this.filtros.every((p) => p(f)));

    if (this.tipo === 'update') {
      for (const f of coinciden) Object.assign(f, this.carga as Fila);
      this.ctx.escrituras.push({ tabla: this.tabla, tipo: 'update', fila: this.carga, uid: this.uid, via: this.via });
      return { data: this.devolver ? coinciden : null, error: null, count: null };
    }
    if (this.tipo === 'delete') {
      const quitar = new Set(coinciden);
      tablas[this.tabla] = this.filas().filter((f) => !quitar.has(f));
      this.ctx.escrituras.push({ tabla: this.tabla, tipo: 'delete', fila: coinciden, uid: this.uid, via: this.via });
      return { data: this.devolver ? coinciden : null, error: null, count: null };
    }

    // select
    let filas = [...coinciden];
    for (const o of [...this.orden].reverse()) {
      filas.sort((a, b) => {
        const x = String(a[o.col] ?? '');
        const y = String(b[o.col] ?? '');
        return o.asc ? x.localeCompare(y) : y.localeCompare(x);
      });
    }
    const total = filas.length;
    if (this.tope != null) filas = filas.slice(0, this.tope);
    const count = this.cuenta ? total : null;
    if (this.cabeza) return { data: null, error: null, count };
    if (this.una) {
      if (filas.length > 1)
        return {
          data: null,
          error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
          count,
        };
      return { data: filas[0] ?? null, error: null, count };
    }
    return { data: filas, error: null, count };
  }

  then<R1 = Resultado, R2 = never>(
    onFulfilled?: ((v: Resultado) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((r: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve().then(() => this.ejecutar()).then(onFulfilled, onRejected);
  }
}

export function crearSupabaseFalsoCxp(op: OpcionesFalsoCxp = {}) {
  const ctx: Contexto = {
    tablas: op.tablas ?? {},
    escrituras: [],
    rpcs: [],
    storage: { subidos: [], removidos: [] },
    intentosInsert: {},
  };

  const cliente = (via: 'admin' | 'actor', uid: string | null) => ({
    from: (tabla: string) => new Consulta(tabla, ctx, op, via, uid),
    rpc: (fn: string, args: Record<string, unknown> = {}): Promise<{ data: unknown; error: ErrorPg | null }> => {
      ctx.rpcs.push({ fn, args });
      if (!(op.rpc && fn in op.rpc))
        return Promise.resolve({ data: null, error: { message: `RPC no configurada en la prueba: ${fn}` } });
      const h = op.rpc[fn];
      const data = typeof h === 'function' ? (h as (a: Record<string, unknown>) => unknown)(args) : h;
      if (data && typeof data === 'object' && '__error' in (data as Record<string, unknown>))
        return Promise.resolve({ data: null, error: { message: String((data as { __error: unknown }).__error) } });
      return Promise.resolve({ data, error: null });
    },
    storage: {
      from: (bucket: string) => ({
        remove: (paths: string[]) => {
          for (const path of paths) ctx.storage.removidos.push({ bucket, path });
          return Promise.resolve({ data: [], error: null });
        },
        upload: (path: string) => {
          ctx.storage.subidos.push({ bucket, path });
          return Promise.resolve({ data: { path }, error: null });
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://falso.supabase.co/storage/v1/object/public/${bucket}/${path}` },
        }),
        createSignedUrl: (path: string) =>
          Promise.resolve({ data: { signedUrl: `https://falso.supabase.co/firmada/${bucket}/${path}` }, error: null }),
      }),
    },
  });

  const supabase = {
    admin: cliente('admin', null),
    comoActor: (uid: string) => cliente('actor', uid),
  } as unknown as SupabaseService;

  return { supabase, ctx };
}
