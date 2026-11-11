import type { SupabaseService } from '../../common/supabase/supabase.service.js';

/**
 * Cliente Supabase FALSO en memoria para las pruebas del módulo Arrendatarios (traspaso de
 * depósito). No es un spec (no termina en `.spec.ts`: Jest no lo ejecuta) pero su nombre
 * termina en `spec.ts` para que `tsconfig.build.json` lo deje fuera del build.
 *
 * Soporta lo justo: `from(tabla).select/eq/neq/in/not/is/lt/gte/lte/or/order/limit/range/
 * maybeSingle/single/insert/update/delete` sobre filas en memoria, y `rpc(fn, args)` con
 * respuestas configurables. Registra QUIÉN llamó cada RPC (`admin` o `comoActor(uid)`) para
 * verificar que el paquete nunca usa el cliente `admin` en sus funciones.
 */

export type Fila = Record<string, unknown>;

export interface LlamadaRpc {
  fn: string;
  args: Record<string, unknown>;
  /** uid del `comoActor` (null si fue el cliente `admin`). */
  uid: string | null;
  via: 'admin' | 'actor';
}

export interface Escritura {
  tabla: string;
  tipo: 'insert' | 'update' | 'delete';
  fila: unknown;
  uid: string | null;
}

export interface OpcionesFalso {
  tablas?: Record<string, Fila[]>;
  /**
   * Respuesta de cada RPC: un valor fijo o una función de los argumentos. La respuesta es el
   * `data` del RPC; para simular `error` devolver `{ __error: 'texto' }`; si la función lanza,
   * la llamada se rechaza (caída de red).
   */
  rpc?: Record<string, unknown>;
  /** Error a devolver al consultar una tabla. */
  errores?: Record<string, { message: string }>;
}

interface Contexto {
  tablas: Record<string, Fila[]>;
  errores: Record<string, { message: string }>;
  rpcs: LlamadaRpc[];
  escrituras: Escritura[];
  consultas: string[];
}

interface Resultado {
  data: unknown;
  error: { message: string } | null;
  count: number | null;
}

class Consulta implements PromiseLike<Resultado> {
  private filtros: Array<(f: Fila) => boolean> = [];
  private orden: Array<{ col: string; asc: boolean }> = [];
  private rango: [number, number] | null = null;
  private tope: number | null = null;
  private tipo: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private carga: unknown = null;
  private cuenta = false;
  private cabeza = false;
  private una = false;

  constructor(
    private readonly tabla: string,
    private readonly ctx: Contexto,
    private readonly uid: string | null,
  ) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }): this {
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
  delete(_opts?: unknown): this {
    this.tipo = 'delete';
    return this;
  }
  eq(col: string, val: unknown): this {
    this.filtros.push((f) => f[col] === val);
    return this;
  }
  neq(col: string, val: unknown): this {
    this.filtros.push((f) => f[col] !== val);
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
  not(col: string, op: string, val: unknown): this {
    if (op === 'is') this.filtros.push((f) => (f[col] ?? null) !== val);
    return this;
  }
  lt(col: string, val: unknown): this {
    this.filtros.push((f) => String(f[col]) < String(val));
    return this;
  }
  gte(col: string, val: unknown): this {
    this.filtros.push((f) => String(f[col]) >= String(val));
    return this;
  }
  lte(col: string, val: unknown): this {
    this.filtros.push((f) => String(f[col]) <= String(val));
    return this;
  }
  or(_expr: string): this {
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
  range(desde: number, hasta: number): this {
    this.rango = [desde, hasta];
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

  private ejecutar(): Resultado {
    this.ctx.consultas.push(this.tabla);
    const err = this.ctx.errores[this.tabla];
    if (err) return { data: null, error: err, count: null };

    if (this.tipo !== 'select') {
      this.ctx.escrituras.push({ tabla: this.tabla, tipo: this.tipo, fila: this.carga, uid: this.uid });
      return { data: null, error: null, count: null };
    }
    let filas = (this.ctx.tablas[this.tabla] ?? []).filter((f) => this.filtros.every((p) => p(f)));
    for (const o of [...this.orden].reverse()) {
      filas = [...filas].sort((a, b) => {
        const x = String(a[o.col] ?? '');
        const y = String(b[o.col] ?? '');
        return o.asc ? x.localeCompare(y) : y.localeCompare(x);
      });
    }
    const total = filas.length;
    if (this.rango) filas = filas.slice(this.rango[0], this.rango[1] + 1);
    if (this.tope != null) filas = filas.slice(0, this.tope);
    const count = this.cuenta ? total : null;
    if (this.cabeza) return { data: null, error: null, count };
    if (this.una) return { data: filas[0] ?? null, error: null, count };
    return { data: filas, error: null, count };
  }

  then<R1 = Resultado, R2 = never>(
    onFulfilled?: ((v: Resultado) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((r: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve().then(() => this.ejecutar()).then(onFulfilled, onRejected);
  }
}

export function crearSupabaseFalso(op: OpcionesFalso = {}) {
  const ctx: Contexto = {
    tablas: op.tablas ?? {},
    errores: op.errores ?? {},
    rpcs: [],
    escrituras: [],
    consultas: [],
  };

  const cliente = (via: 'admin' | 'actor', uid: string | null) => ({
    from: (tabla: string) => new Consulta(tabla, ctx, uid),
    rpc: (fn: string, args: Record<string, unknown> = {}): Promise<{ data: unknown; error: { message: string } | null }> => {
      ctx.rpcs.push({ fn, args, uid, via });
      if (!(op.rpc && fn in op.rpc))
        return Promise.resolve({ data: null, error: { message: `RPC no configurada en la prueba: ${fn}` } });
      try {
        const h = op.rpc[fn];
        const data = typeof h === 'function' ? (h as (a: Record<string, unknown>) => unknown)(args) : h;
        if (data && typeof data === 'object' && '__error' in (data as Record<string, unknown>))
          return Promise.resolve({ data: null, error: { message: String((data as { __error: unknown }).__error) } });
        return Promise.resolve({ data, error: null });
      } catch (e) {
        return Promise.reject(e);
      }
    },
  });

  const supabase = {
    admin: cliente('admin', null),
    comoActor: (uid: string) => cliente('actor', uid),
  } as unknown as SupabaseService;

  return { supabase, ctx };
}
