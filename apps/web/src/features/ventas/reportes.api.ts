import { api } from '@/lib/api';

export interface EstadoCuentaRow {
  anio: string | number | null;
  mes: string | number | null;
  fecha: string | null;
  pago_fecha: string | null;
  nomParque: string | null;
  numPago: number | null;
  tipoPago: string | null;
  razonsocial: string | null;
  nompropiedad: string | null;
  suma_monto: number | null;
  suma_pago_monto: number | null;
  balance: number | null;
  pago_vencido: boolean | null;
  dias_vencimiento: number | null;
  avance: string | number | null;
  esTicket: boolean | null;
}

export interface VencidoRow {
  anio: string | number | null;
  mes: string | number | null;
  fecha: string | null;
  nomParque: string | null;
  numPago: number | null;
  tipoPago: string | null;
  razonsocial: string | null;
  nompropiedad: string | null;
  saldo_vencido: number | null;
  dias_vencimiento: number | null;
}

export interface ResumenParqueRow {
  parque: string | null;
  total_saldo_vencido: number | null;
  cantidad_registros: number | null;
  porcentaje_del_total: string | number | null;
}

export interface EvolucionRow {
  anio: string | number | null;
  parque: string | null;
  total_saldo_vencido: number | null;
}

/** Filtros multi-valor de los reportes (regla 7c). Vacío/ausente = sin filtro. */
export interface FiltrosReporte {
  anios?: number[];
  meses?: number[];
  razonsocial?: string[];
  parque?: string[];
  propiedad?: string[];
}

/** Serializa params; los arreglos se mandan como query repetido (`?x=a&x=b`). */
function qs(params: Record<string, string | number | (string | number)[] | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    if (Array.isArray(v)) {
      for (const it of v) if (it !== undefined && it !== '') sp.append(k, String(it));
    } else {
      sp.set(k, String(v));
    }
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Combinación única para la cascada de filtros. */
export interface ComboFiltro {
  razonsocial: string;
  parque: string;
  propiedad: string;
  anio: string;
}

export const reportesApi = {
  /** Combinaciones únicas (razón social/parque/propiedad/año) para la cascada. */
  combos: (sinA3 = false) =>
    api.get<ComboFiltro[]>(`/ventas/reportes/combos${qs({ sinA3: sinA3 ? 'true' : '' })}`),
  /** tipo: 1=razón social, 2=parque, 3=propiedad, 4=año, 5=tipo pago. */
  filtros: (tipo: number, sinA3 = false) =>
    api.get<string[]>(`/ventas/reportes/filtros${qs({ tipo, sinA3: sinA3 ? 'true' : '' })}`),
  edoCuenta: (f: FiltrosReporte) =>
    api.get<EstadoCuentaRow[]>(
      `/ventas/reportes/edo-cuenta${qs({
        anio: f.anios,
        mes: f.meses,
        razonsocial: f.razonsocial,
        parque: f.parque,
        propiedad: f.propiedad,
      })}`,
    ),
  vencidos: (f: FiltrosReporte) =>
    api.get<VencidoRow[]>(
      `/ventas/reportes/vencidos${qs({
        anio: f.anios,
        mes: f.meses,
        razonsocial: f.razonsocial,
        parque: f.parque,
        propiedad: f.propiedad,
      })}`,
    ),
  vencidosResumen: (f: FiltrosReporte) =>
    api.get<ResumenParqueRow[]>(
      `/ventas/reportes/vencidos-resumen${qs({
        anio: f.anios,
        mes: f.meses,
        razonsocial: f.razonsocial,
      })}`,
    ),
  vencidosEvolucion: (razonsocial?: string[], parque?: string[]) =>
    api.get<EvolucionRow[]>(
      `/ventas/reportes/vencidos-evolucion${qs({ razonsocial, parque })}`,
    ),
};
