import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type { ReporteEstadoCuentaDto } from './reportes.schemas.js';

/** Devuelve el único elemento si el arreglo trae exactamente uno (para filtrar en la RPC). */
function uno<T>(a?: T[]): T | undefined {
  return a && a.length === 1 ? a[0] : undefined;
}

/** Fila del reporte (RPC `cxp_get_estado_cuenta_detalle_v2`). camelCase real. */
export interface ReporteCxpRow {
  idCxp: string;
  folio: string | null;
  proveedor: string | null;
  estado: string | null;
  idEstado: number | null;
  categoria: string | null;
  seccion: string | null;
  concepto: string | null;
  fecSolicitud: string | null;
  fecCFDI: string | null;
  fecPago: string | null;
  subtotal: number | null;
  total: number | null;
  montoAplicado: number | null;
  quienSolicito: string | null;
  quienAutorizo: string | null;
  quienPago: string | null;
  esUrgente: boolean | null;
  tipoProveedor: number | null;
  anio: number | null;
  mes: number | null;
  balance: number | null;
}

export interface TotalesReporteCxp {
  totalRegistros: number;
  montoTotal: number;
  montoAplicado: number;
  balance: number;
}

/**
 * CxP > Reportes (clave 460). Réplica del reporte HTML "Estado de Cuenta" de v1,
 * pero **seguro**: el backend invoca las RPCs EXISTENTES `cxp_get_*_v2`
 * (parametrizadas) con `service_role`. El navegador ya NO usa la publishable key
 * embebida de v1 ni filtra en cliente. Las 3 RPCs son de solo lectura y NO se
 * modifican (coexistencia con Flutter — autorizado por el usuario, regla 1/2).
 *
 * Correcciones vs v1: (1) búsqueda REAL por folio/concepto (v1 reusaba el filtro
 * de proveedor); (2) rango de fechas, estados (multi) y búsqueda se aplican
 * server-side, no en el navegador.
 */
@Injectable()
export class ReportesCxpService {
  constructor(private readonly supabase: SupabaseService) {}

  private norm(v?: string | null): string | undefined {
    return v && v.trim() !== '' ? v : undefined;
  }

  /**
   * Valores únicos para los combos de filtros (RPC `cxp_get_unique_values_v2`).
   * tipo_dato: 1=Proveedores, 2=Categorías, 3=Secciones, 5=Solicitantes,
   * 6=Autorizadores, 7=Pagadores.
   */
  async valoresUnicos(tipo: number): Promise<string[]> {
    const { data, error } = await this.supabase.admin.rpc(
      'cxp_get_unique_values_v2',
      { tipo_dato: tipo },
    );
    if (error) throw new InternalServerErrorException(error.message);
    return ((data ?? []) as { valor: string | null }[])
      .map((r) => r.valor)
      .filter((v): v is string => !!v);
  }

  /** Todos los combos de una vez (para poblar el panel de filtros). */
  async combos(): Promise<{
    proveedores: string[];
    categorias: string[];
    secciones: string[];
    solicitantes: string[];
    autorizadores: string[];
    pagadores: string[];
  }> {
    const [proveedores, categorias, secciones, solicitantes, autorizadores, pagadores] =
      await Promise.all([
        this.valoresUnicos(1),
        this.valoresUnicos(2),
        this.valoresUnicos(3),
        this.valoresUnicos(5),
        this.valoresUnicos(6),
        this.valoresUnicos(7),
      ]);
    return { proveedores, categorias, secciones, solicitantes, autorizadores, pagadores };
  }

  /**
   * Filtros dependientes (cascada): al elegir proveedor/categoría recalcula las
   * secciones disponibles. RPC `cxp_get_filtros_dependientes_v2`.
   */
  async dependientes(proveedor?: string, categoria?: string, seccion?: string) {
    const { data, error } = await this.supabase.admin.rpc(
      'cxp_get_filtros_dependientes_v2',
      {
        p_proveedor: this.norm(proveedor),
        p_categoria: this.norm(categoria),
        p_seccion: this.norm(seccion),
      },
    );
    if (error) throw new InternalServerErrorException(error.message);
    const filas = (data ?? []) as {
      proveedor: string | null;
      categoria: string | null;
      seccion: string | null;
      anio: number | null;
    }[];
    const unico = (xs: (string | null)[]) =>
      [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) =>
        a.localeCompare(b, 'es'),
      );
    return {
      proveedores: unico(filas.map((f) => f.proveedor)),
      categorias: unico(filas.map((f) => f.categoria)),
      secciones: unico(filas.map((f) => f.seccion)),
    };
  }

  /**
   * Consulta principal del reporte. Llama a la RPC con los filtros que ésta
   * soporta:
   * - Con exactamente 1 valor en un campo multi, lo pasa a la RPC (filtro en BD).
   * - Con 0 o más de 1 valores, pasa `undefined` a la RPC y filtra en memoria.
   * Devuelve el dataset YA filtrado + totales.
   */
  async estadoCuenta(
    f: ReporteEstadoCuentaDto,
  ): Promise<{ filas: ReporteCxpRow[]; totales: TotalesReporteCxp }> {
    const urgente =
      f.urgente === 'true' ? true : f.urgente === 'false' ? false : undefined;

    // tipoProveedor llega como string[]; la RPC espera un entero o null.
    const tipoProveedorRpc =
      f.tipoProveedor?.length === 1
        ? (() => { const n = Number(f.tipoProveedor[0]); return Number.isFinite(n) ? n : undefined; })()
        : undefined;

    const { data, error } = await this.supabase.admin.rpc(
      'cxp_get_estado_cuenta_detalle_v2',
      {
        p_anio: undefined,
        p_mes: undefined,
        // Pasar a la RPC solo cuando hay exactamente 1 valor (caso común, sin traer de más).
        p_proveedor: uno(f.proveedor?.filter(Boolean)),
        p_categoria: uno(f.categoria?.filter(Boolean)),
        p_seccion: uno(f.seccion?.filter(Boolean)),
        p_estado: undefined, // estados multi → se filtran abajo
        p_quien_solicito: uno(f.quienSolicito?.filter(Boolean)),
        p_quien_autorizo: uno(f.quienAutorizo?.filter(Boolean)),
        p_quien_pago: uno(f.quienPago?.filter(Boolean)),
        p_tipo_proveedor: tipoProveedorRpc,
        p_urgente: urgente,
      },
    );
    if (error) throw new InternalServerErrorException(error.message);

    let filas = (data ?? []) as unknown as ReporteCxpRow[];

    // --- Filtros server-side adicionales ---

    // Rango de fechas.
    const desde = this.norm(f.fechaInicio);
    const hasta = this.norm(f.fechaFin);
    if (desde || hasta) {
      filas = filas.filter((r) => {
        if (!r.fecSolicitud) return false;
        const d = r.fecSolicitud.slice(0, 10); // yyyy-MM-dd
        if (desde && d < desde) return false;
        if (hasta && d > hasta) return false;
        return true;
      });
    }

    // Multi-valor: proveedores (solo aplica filtrado en memoria cuando hay > 1).
    const proveedores = (f.proveedor ?? []).filter(Boolean);
    if (proveedores.length > 1) {
      const set = new Set(proveedores);
      filas = filas.filter((r) => r.proveedor != null && set.has(r.proveedor));
    }

    // Multi-valor: categorías.
    const categorias = (f.categoria ?? []).filter(Boolean);
    if (categorias.length > 1) {
      const set = new Set(categorias);
      filas = filas.filter((r) => r.categoria != null && set.has(r.categoria));
    }

    // Multi-valor: secciones.
    const secciones = (f.seccion ?? []).filter(Boolean);
    if (secciones.length > 1) {
      const set = new Set(secciones);
      filas = filas.filter((r) => r.seccion != null && set.has(r.seccion));
    }

    // Multi-valor: quién solicitó.
    const solicitantes = (f.quienSolicito ?? []).filter(Boolean);
    if (solicitantes.length > 1) {
      const set = new Set(solicitantes);
      filas = filas.filter((r) => r.quienSolicito != null && set.has(r.quienSolicito));
    }

    // Multi-valor: quién autorizó.
    const autorizadores = (f.quienAutorizo ?? []).filter(Boolean);
    if (autorizadores.length > 1) {
      const set = new Set(autorizadores);
      filas = filas.filter((r) => r.quienAutorizo != null && set.has(r.quienAutorizo));
    }

    // Multi-valor: quién pagó.
    const pagadores = (f.quienPago ?? []).filter(Boolean);
    if (pagadores.length > 1) {
      const set = new Set(pagadores);
      filas = filas.filter((r) => r.quienPago != null && set.has(r.quienPago));
    }

    // Multi-valor: tipo proveedor (> 1 valor → filtro en memoria).
    const tiposProveedor = (f.tipoProveedor ?? [])
      .map(Number)
      .filter((n) => Number.isFinite(n));
    if (tiposProveedor.length > 1) {
      const set = new Set(tiposProveedor);
      filas = filas.filter((r) => r.tipoProveedor != null && set.has(r.tipoProveedor));
    }

    // Estados (multi).
    const estados = (f.estados ?? []).filter((e) => e && e.trim() !== '');
    if (estados.length > 0) {
      const set = new Set(estados);
      filas = filas.filter((r) => r.estado != null && set.has(r.estado));
    }

    // Búsqueda real por folio / concepto / proveedor.
    const q = this.norm(f.busqueda)?.toLowerCase();
    if (q) {
      filas = filas.filter((r) =>
        [r.folio, r.concepto, r.proveedor]
          .some((v) => (v ?? '').toLowerCase().includes(q)),
      );
    }

    const totales = filas.reduce<TotalesReporteCxp>(
      (acc, r) => {
        acc.totalRegistros += 1;
        acc.montoTotal += r.total ?? 0;
        acc.montoAplicado += r.montoAplicado ?? 0;
        return acc;
      },
      { totalRegistros: 0, montoTotal: 0, montoAplicado: 0, balance: 0 },
    );
    totales.balance = totales.montoTotal - totales.montoAplicado;

    return { filas, totales };
  }
}
