import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  reportesCxpApi,
  ESTADOS_CXP,
  TIPOS_PROVEEDOR,
  type FiltrosReporteCxp,
  type ReporteCxpRow,
} from './reportes.api';
import { exportarReporteExcel, exportarReportePDF } from './reportes-export';
import { InputFecha } from '@/components/InputFecha';
import { MultiSearchSelect } from '@/components/MultiSearchSelect';
import type { OpcionSelect } from '@/components/SearchSelect';
import { useSort, type Accessors } from '@/components/tabla/useSort';
import { SortableTh, THEAD_STICKY, THEAD_TR } from '@/components/tabla/SortableTh';

const moneda = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

function fechaCorta(v: string | null): string {
  if (!v) return '';
  const d = new Date(v.length <= 10 ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-MX');
}

/** yyyy-MM-dd local (sin desfase de zona horaria). */
function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Filtros por defecto: rango = mes actual (igual que v1). */
function filtrosIniciales(): FiltrosReporteCxp {
  const now = new Date();
  return {
    fechaInicio: isoLocal(new Date(now.getFullYear(), now.getMonth(), 1)),
    fechaFin: isoLocal(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    proveedor: [],
    tipoProveedor: [],
    categoria: [],
    seccion: [],
    estados: [],
    urgente: '',
    quienSolicito: [],
    quienAutorizo: [],
    quienPago: [],
    busqueda: '',
  };
}

/** Estilo de badge por estado (colores idénticos a v1). */
const ESTADO_STYLE: Record<string, { bg: string; color: string }> = {
  Guardado: { bg: '#e3f2fd', color: '#1976d2' },
  Enviado: { bg: '#fff3e0', color: '#f57c00' },
  Rechazado: { bg: '#ffebee', color: '#d32f2f' },
  Aprobado: { bg: '#e8f5e8', color: '#388e3c' },
  Reprogramado: { bg: '#f3e5f5', color: '#7b1fa2' },
  Pagado: { bg: '#e0f2f1', color: '#00796b' },
  'Pago T. Bancaria': { bg: '#fce4ec', color: '#c2185b' },
};
const ESTADO_DEFAULT = { bg: '#e3f2fd', color: '#1976d2' };

const PER_PAGE = 20;
const toOpts = (xs: string[]): OpcionSelect[] => xs.map((x) => ({ value: x, label: x }));

export default function ReportesCxpPage() {
  const [draft, setDraft] = useState<FiltrosReporteCxp>(filtrosIniciales);
  const [aplicados, setAplicados] = useState<FiltrosReporteCxp>(draft);
  const [pagina, setPagina] = useState(1);
  const [abiertoFiltros, setAbiertoFiltros] = useState(true);
  const [detalle, setDetalle] = useState<ReporteCxpRow | null>(null);

  const set = <K extends keyof FiltrosReporteCxp>(k: K, v: FiltrosReporteCxp[K]) =>
    setDraft((p) => ({ ...p, [k]: v }));

  const { data: combos } = useQuery({
    queryKey: ['cxp-reportes-combos'],
    queryFn: () => reportesCxpApi.combos(),
  });

  // Secciones dependientes (cascada proveedor/categoría → secciones).
  // Pasa el primer elemento del array (la RPC de dependientes espera un escalar).
  const proveedorCascada = draft.proveedor?.[0];
  const categoriaCascada = draft.categoria?.[0];
  const { data: dependientes } = useQuery({
    queryKey: ['cxp-reportes-dependientes', proveedorCascada, categoriaCascada],
    queryFn: () =>
      reportesCxpApi.dependientes({
        proveedor: proveedorCascada,
        categoria: categoriaCascada,
      }),
    enabled: !!(proveedorCascada || categoriaCascada),
  });

  const seccionesOpts = dependientes?.secciones ?? combos?.secciones ?? [];

  const { data, isLoading, isError } = useQuery({
    queryKey: ['cxp-reportes-estado-cuenta', aplicados],
    queryFn: () => reportesCxpApi.estadoCuenta(aplicados),
  });

  const filas = useMemo(() => data?.filas ?? [], [data]);
  const totales = data?.totales ?? {
    totalRegistros: 0,
    montoTotal: 0,
    montoAplicado: 0,
    balance: 0,
  };

  const accessors: Accessors<ReporteCxpRow> = {
    folio: (r) => r.folio,
    proveedor: (r) => r.proveedor,
    estado: (r) => r.estado,
    categoria: (r) => r.categoria,
    seccion: (r) => r.seccion,
    concepto: (r) => r.concepto,
    fecSolicitud: (r) => r.fecSolicitud,
    fecCFDI: (r) => r.fecCFDI,
    subtotal: (r) => r.subtotal,
    total: (r) => r.total,
    montoAplicado: (r) => r.montoAplicado,
    balance: (r) => r.balance,
    esUrgente: (r) => r.esUrgente,
  };
  const { ordenados, sortKey, dir, toggle } = useSort(filas, accessors, {
    key: 'fecSolicitud',
    dir: 'desc',
  });

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / PER_PAGE));
  const pag = Math.min(pagina, totalPaginas);
  const visibles = ordenados.slice((pag - 1) * PER_PAGE, pag * PER_PAGE);

  function aplicar() {
    setAplicados(draft);
    setPagina(1);
  }
  function limpiar() {
    const ini = filtrosIniciales();
    setDraft(ini);
    setAplicados(ini);
    setPagina(1);
  }
  function toggleEstado(e: string) {
    setDraft((p) => {
      const cur = p.estados ?? [];
      return { ...p, estados: cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e] };
    });
  }

  const inputCls =
    'w-full rounded border px-2 py-1.5 text-sm outline-none focus:border-[#1f2a4d]';
  const lbl = 'mb-1 block text-xs font-medium text-gray-600';

  return (
    <div className="space-y-4 p-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#2c3e50]">Reporte de Cuentas por Pagar</h1>
          <p className="text-xs text-gray-500">Estado de cuenta detallado de CxP.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportarReporteExcel(ordenados)}
            disabled={ordenados.length === 0}
            className="rounded-lg bg-[#27ae60] px-3 py-2 text-sm font-medium text-white hover:bg-[#1e8449] disabled:opacity-40"
          >
            ⬇ Excel
          </button>
          <button
            onClick={() => exportarReportePDF(ordenados, totales)}
            disabled={ordenados.length === 0}
            className="rounded-lg bg-[#e74c3c] px-3 py-2 text-sm font-medium text-white hover:bg-[#c0392b] disabled:opacity-40"
          >
            ⬇ PDF
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border bg-white shadow-sm">
        <button
          onClick={() => setAbiertoFiltros((a) => !a)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700"
        >
          <span>Filtros</span>
          <span className="text-gray-400">{abiertoFiltros ? '▲' : '▼'}</span>
        </button>
        {abiertoFiltros && (
          <div className="space-y-3 border-t px-4 py-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <div>
                <label className={lbl}>Fecha inicio</label>
                <InputFecha value={draft.fechaInicio ?? ''} onChange={(v) => set('fechaInicio', v)} className={inputCls} />
              </div>
              <div>
                <label className={lbl}>Fecha fin</label>
                <InputFecha value={draft.fechaFin ?? ''} onChange={(v) => set('fechaFin', v)} className={inputCls} />
              </div>
              <div>
                <label className={lbl}>Proveedor</label>
                <MultiSearchSelect
                  values={draft.proveedor ?? []}
                  onChange={(v) => set('proveedor', v)}
                  options={toOpts(combos?.proveedores ?? [])}
                  placeholder="Todos los proveedores"
                />
              </div>
              <div>
                <label className={lbl}>Tipo proveedor</label>
                <MultiSearchSelect
                  values={draft.tipoProveedor ?? []}
                  onChange={(v) => set('tipoProveedor', v)}
                  options={TIPOS_PROVEEDOR.map((t) => ({ value: t.value, label: t.label }))}
                  placeholder="Todos"
                />
              </div>
              <div>
                <label className={lbl}>Categoría</label>
                <MultiSearchSelect
                  values={draft.categoria ?? []}
                  onChange={(v) => set('categoria', v)}
                  options={toOpts(combos?.categorias ?? [])}
                  placeholder="Todas las categorías"
                />
              </div>
              <div>
                <label className={lbl}>Sección</label>
                <MultiSearchSelect
                  values={draft.seccion ?? []}
                  onChange={(v) => set('seccion', v)}
                  options={toOpts(seccionesOpts)}
                  placeholder="Todas las secciones"
                />
              </div>
              <div>
                <label className={lbl}>Urgente</label>
                <select value={draft.urgente ?? ''} onChange={(e) => set('urgente', e.target.value as FiltrosReporteCxp['urgente'])} className={inputCls}>
                  <option value="">Todos</option>
                  <option value="true">Urgente</option>
                  <option value="false">No urgente</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Quién solicitó</label>
                <MultiSearchSelect
                  values={draft.quienSolicito ?? []}
                  onChange={(v) => set('quienSolicito', v)}
                  options={toOpts(combos?.solicitantes ?? [])}
                  placeholder="Todos"
                />
              </div>
              <div>
                <label className={lbl}>Quién autorizó</label>
                <MultiSearchSelect
                  values={draft.quienAutorizo ?? []}
                  onChange={(v) => set('quienAutorizo', v)}
                  options={toOpts(combos?.autorizadores ?? [])}
                  placeholder="Todos"
                />
              </div>
              <div>
                <label className={lbl}>Quién pagó</label>
                <MultiSearchSelect
                  values={draft.quienPago ?? []}
                  onChange={(v) => set('quienPago', v)}
                  options={toOpts(combos?.pagadores ?? [])}
                  placeholder="Todos"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Búsqueda (folio, concepto, proveedor)</label>
                <input
                  value={draft.busqueda ?? ''}
                  onChange={(e) => set('busqueda', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && aplicar()}
                  placeholder="Folio, concepto…"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Estados (multi) */}
            <div>
              <label className={lbl}>Estado</label>
              <div className="flex flex-wrap gap-3">
                {ESTADOS_CXP.map((e) => (
                  <label key={e} className="flex items-center gap-1.5 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={(draft.estados ?? []).includes(e)}
                      onChange={() => toggleEstado(e)}
                    />
                    {e}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={aplicar} className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039]">
                Aplicar filtros
              </button>
              <button onClick={limpiar} className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Limpiar filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card titulo="Total Registros" valor={String(totales.totalRegistros)} color="#3498db" />
        <Card titulo="Monto Total" valor={moneda(totales.montoTotal)} color="#f39c12" />
        <Card titulo="Monto Aplicado" valor={moneda(totales.montoAplicado)} color="#27ae60" />
        <Card titulo="Balance" valor={moneda(totales.balance)} color="#e74c3c" />
      </div>

      {/* Tabla */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="max-h-[60vh] overflow-auto rounded-xl">
          <table className="w-full border-collapse text-sm">
            <thead className={THEAD_STICKY}>
              <tr className={THEAD_TR}>
                <SortableTh campo="folio" sortKey={sortKey} dir={dir} onSort={toggle}>Folio</SortableTh>
                <SortableTh campo="proveedor" sortKey={sortKey} dir={dir} onSort={toggle}>Proveedor</SortableTh>
                <SortableTh campo="estado" sortKey={sortKey} dir={dir} onSort={toggle}>Estado</SortableTh>
                <SortableTh campo="categoria" sortKey={sortKey} dir={dir} onSort={toggle}>Categoría</SortableTh>
                <SortableTh campo="seccion" sortKey={sortKey} dir={dir} onSort={toggle}>Sección</SortableTh>
                <SortableTh campo="concepto" sortKey={sortKey} dir={dir} onSort={toggle}>Concepto</SortableTh>
                <SortableTh campo="fecSolicitud" sortKey={sortKey} dir={dir} onSort={toggle}>F. Solicitud</SortableTh>
                <SortableTh campo="fecCFDI" sortKey={sortKey} dir={dir} onSort={toggle}>F. CFDI</SortableTh>
                <SortableTh campo="subtotal" sortKey={sortKey} dir={dir} onSort={toggle} align="right">Subtotal</SortableTh>
                <SortableTh campo="total" sortKey={sortKey} dir={dir} onSort={toggle} align="right">Total</SortableTh>
                <SortableTh campo="montoAplicado" sortKey={sortKey} dir={dir} onSort={toggle} align="right">Monto Aplicado</SortableTh>
                <SortableTh campo="balance" sortKey={sortKey} dir={dir} onSort={toggle} align="right">Balance</SortableTh>
                <SortableTh campo="esUrgente" sortKey={sortKey} dir={dir} onSort={toggle} align="center">Urgente</SortableTh>
                <SortableTh align="center">Acciones</SortableTh>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={14} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
              )}
              {isError && !isLoading && (
                <tr><td colSpan={14} className="px-4 py-8 text-center text-red-600">No se pudo cargar el reporte.</td></tr>
              )}
              {!isLoading && !isError && visibles.length === 0 && (
                <tr><td colSpan={14} className="px-4 py-8 text-center text-gray-400">Sin registros para los filtros.</td></tr>
              )}
              {visibles.map((r) => {
                const est = (r.estado && ESTADO_STYLE[r.estado]) || ESTADO_DEFAULT;
                return (
                  <tr key={r.idCxp} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">{r.folio}</td>
                    <td className="px-4 py-2 text-gray-800">{r.proveedor}</td>
                    <td className="px-4 py-2">
                      <span
                        className="inline-block min-w-[80px] rounded-full px-2 py-0.5 text-center text-xs font-medium"
                        style={{ backgroundColor: est.bg, color: est.color }}
                      >
                        {r.estado}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{r.categoria}</td>
                    <td className="px-4 py-2 text-gray-700">{r.seccion}</td>
                    <td className="px-4 py-2 text-gray-700">{r.concepto}</td>
                    <td className="px-4 py-2 text-gray-700">{fechaCorta(r.fecSolicitud)}</td>
                    <td className="px-4 py-2 text-gray-700">{fechaCorta(r.fecCFDI)}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{moneda(r.subtotal)}</td>
                    <td className="px-4 py-2 text-right text-gray-800">{moneda(r.total)}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{moneda(r.montoAplicado)}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{moneda(r.balance)}</td>
                    <td className="px-4 py-2 text-center">
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: r.esUrgente ? '#e74c3c' : '#95a5a6' }}
                      >
                        {r.esUrgente ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button onClick={() => setDetalle(r)} title="Ver detalle" className="text-[#1f2a4d] hover:opacity-70">👁</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {ordenados.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm text-gray-600">
            <span>
              Mostrando {(pag - 1) * PER_PAGE + 1}-{Math.min(pag * PER_PAGE, ordenados.length)} de {ordenados.length} registros
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pag <= 1} className="rounded border px-2 py-1 disabled:opacity-40">‹ Anterior</button>
              <span>Página {pag} de {totalPaginas}</span>
              <button onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pag >= totalPaginas} className="rounded border px-2 py-1 disabled:opacity-40">Siguiente ›</button>
            </div>
          </div>
        )}
      </div>

      {detalle && <ModalDetalle row={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
}

function Card({ titulo, valor, color }: { titulo: string; valor: string; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
      <span className="h-10 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      <div>
        <div className="text-xs text-gray-500">{titulo}</div>
        <div className="text-xl font-semibold text-gray-800">{valor}</div>
      </div>
    </div>
  );
}

function ModalDetalle({ row, onClose }: { row: ReporteCxpRow; onClose: () => void }) {
  const campos: [string, string][] = [
    ['Folio', row.folio ?? ''],
    ['Proveedor', row.proveedor ?? ''],
    ['Estado', row.estado ?? ''],
    ['Categoría', row.categoria ?? ''],
    ['Sección', row.seccion ?? ''],
    ['Concepto', row.concepto ?? ''],
    ['Fecha Solicitud', fechaCorta(row.fecSolicitud)],
    ['Fecha CFDI', fechaCorta(row.fecCFDI)],
    ['Fecha Pago', fechaCorta(row.fecPago)],
    ['Subtotal', moneda(row.subtotal)],
    ['Total', moneda(row.total)],
    ['Monto Aplicado', moneda(row.montoAplicado)],
    ['Balance', moneda(row.balance)],
    ['Urgente', row.esUrgente ? 'Sí' : 'No'],
    ['Quién solicitó', row.quienSolicito ?? ''],
    ['Quién autorizó', row.quienAutorizo ?? ''],
    ['Quién pagó', row.quienPago ?? ''],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-lg font-semibold text-[#2c3e50]">Detalle del registro</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 px-5 py-4 sm:grid-cols-2">
          {campos.map(([k, v]) => (
            <div key={k} className="flex flex-col border-b py-1.5">
              <span className="text-xs text-gray-500">{k}</span>
              <span className="text-sm text-gray-800">{v || '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
