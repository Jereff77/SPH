import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  arrendatariosApi,
  MESES,
  num,
  fechaCorta,
  type ContratoPorVencer,
} from './arrendatarios.api';
import { AplicarPagoModal } from './AplicarPagoModal';
import { useArrendatariosRealtime } from './useArrendatariosRealtime';
import { exportarCSV } from './csv-export';
import { FiltroColumnaOpciones } from '@/components/tabla/FiltroColumnaOpciones';

type EstadoFiltro = 'all' | 'pend' | 'paid';
type SortCol = 'nave' | 'parque' | 'razon_social';

interface ConceptoDesglose {
  pend: number;
  paid: number;
  div: string;
}

interface Grupo {
  nave: string;
  parque: string;
  razon_social: string;
  mxnPend: number;
  mxnPaid: number;
  usdPend: number;
  usdPaid: number;
  cntPend: number;
  cntPaid: number;
  conceptos: Record<string, ConceptoDesglose>;
}

interface TipState {
  x: number;
  y: number;
  titulo: string;
  filas: { conc: string; monto: number; div: string }[];
}

const esMXN = (d: string | null): boolean => d !== 'USD';

/** Normaliza el nombre de un concepto (sin acentos, minúsculas) para clasificarlo. */
const normConc = (c: string): string =>
  c
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/** Monto legible para la columna Nota (entero sin decimales si aplica). */
const montoTxt = (n: number): string => {
  const r = Math.round(n * 100) / 100;
  return String(r);
};

/** Parsea YYYY-MM-DD como fecha local (evita el corrimiento UTC). */
const parseLocal = (s: string | null): Date | null => {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const addMonths = (date: Date, n: number): Date => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
};

/** Ordena en español (con numérico) — para las opciones de los filtros de columna. */
const ordenarEs = (xs: string[]): string[] =>
  [...xs].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));

export function DashboardCobranzaPage() {
  const queryClient = useQueryClient();
  const ahora = new Date();
  const [anio, setAnio] = useState(ahora.getFullYear());
  const [mes, setMes] = useState<number>(ahora.getMonth() + 1); // 0 = Todos
  const [estado, setEstado] = useState<EstadoFiltro>('all');
  const [divisaFiltro, setDivisaFiltro] = useState<'ambos' | 'MXN' | 'USD'>('ambos');
  // Mostrar montos con IVA (lo que cuadra con la transferencia) o sin IVA (base).
  const [incluirIva, setIncluirIva] = useState(true);
  // Filtros de columna multi-selección (regla de diseño 7c).
  const [naveSel, setNaveSel] = useState<Set<string>>(new Set());
  const [parqueSel, setParqueSel] = useState<Set<string>>(new Set());
  const [rsSel, setRsSel] = useState<Set<string>>(new Set());
  const [concSel, setConcSel] = useState<Set<string>>(new Set());
  const [sortCol, setSortCol] = useState<SortCol>('parque');
  const [sortAsc, setSortAsc] = useState(true);
  const [tip, setTip] = useState<TipState | null>(null);
  const [modalRS, setModalRS] = useState<string | null>(null);
  const [colapso, setColapso] = useState<Record<string, boolean>>({});

  const { data: filtros } = useQuery({
    queryKey: ['arre-cob-filtros'],
    queryFn: () => arrendatariosApi.filtrosCobranza(),
    staleTime: 5 * 60 * 1000,
  });

  // Se carga TODO el periodo (sin filtro de estado/columna); el filtrado, la
  // agrupación y el orden se hacen en cliente, como el dashboard de v1.
  const { data: filas = [], isLoading } = useQuery({
    queryKey: ['arre-cob-pagos', anio, mes],
    queryFn: () => arrendatariosApi.cobranza({ anio, mes: mes || undefined }),
  });

  const { data: porVencer = [] } = useQuery({
    queryKey: ['arre-cob-porvencer'],
    queryFn: () => arrendatariosApi.contratosPorVencer(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: vencidos = [] } = useQuery({
    queryKey: ['arre-cob-vencidos'],
    queryFn: () => arrendatariosApi.contratosVencidos(),
    staleTime: 5 * 60 * 1000,
  });

  const onCambio = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['arre-cob-pagos'] });
  }, [queryClient]);
  useArrendatariosRealtime(onCambio);

  // Opciones distintas para los filtros de columna (valores presentes).
  const optNave = useMemo(() => ordenarEs([...new Set(filas.map((r) => r.nave ?? '').filter(Boolean))]), [filas]);
  const optParque = useMemo(() => ordenarEs([...new Set(filas.map((r) => r.parque ?? '').filter(Boolean))]), [filas]);
  const optRS = useMemo(() => ordenarEs([...new Set(filas.map((r) => r.razon_social ?? '').filter(Boolean))]), [filas]);
  const optConc = useMemo(() => ordenarEs([...new Set(filas.map((r) => r.concepto ?? '').filter(Boolean))]), [filas]);

  // 1) Filtro por divisa + estado + columnas (sobre las filas individuales).
  const filasFiltradas = useMemo(() => {
    return filas.filter((r) => {
      if (divisaFiltro !== 'ambos' && (r.divisa || 'MXN') !== divisaFiltro) return false;
      if (estado === 'pend' && r.fec_pago) return false;
      if (estado === 'paid' && !r.fec_pago) return false;
      if (naveSel.size > 0 && !naveSel.has(r.nave ?? '')) return false;
      if (parqueSel.size > 0 && !parqueSel.has(r.parque ?? '')) return false;
      if (rsSel.size > 0 && !rsSel.has(r.razon_social ?? '')) return false;
      if (concSel.size > 0 && !concSel.has(r.concepto ?? '')) return false;
      return true;
    });
  }, [filas, divisaFiltro, estado, naveSel, parqueSel, rsSel, concSel]);

  // 2) Agrupación por nave+parque+razón social, con desglose por concepto.
  const grupos = useMemo(() => {
    const map = new Map<string, Grupo>();
    for (const r of filasFiltradas) {
      const key = `${r.nave}||${r.parque}||${r.razon_social}`;
      let g = map.get(key);
      if (!g) {
        g = {
          nave: r.nave ?? '—',
          parque: r.parque ?? '—',
          razon_social: r.razon_social ?? '—',
          mxnPend: 0,
          mxnPaid: 0,
          usdPend: 0,
          usdPaid: 0,
          cntPend: 0,
          cntPaid: 0,
          conceptos: {},
        };
        map.set(key, g);
      }
      const m = (incluirIva ? r.monto : (r.base ?? r.monto)) ?? 0;
      const mxn = esMXN(r.divisa);
      if (!r.fec_pago) {
        if (mxn) g.mxnPend += m;
        else g.usdPend += m;
        g.cntPend++;
      } else {
        if (mxn) g.mxnPaid += m;
        else g.usdPaid += m;
        g.cntPaid++;
      }
      const conc = r.concepto || 'Sin concepto';
      const c = g.conceptos[conc] ?? { pend: 0, paid: 0, div: r.divisa ?? 'MXN' };
      if (!r.fec_pago) c.pend += m;
      else c.paid += m;
      g.conceptos[conc] = c;
    }
    return [...map.values()];
  }, [filasFiltradas, incluirIva]);

  // 3) Orden (por defecto parque, luego nave).
  const gruposOrden = useMemo(() => {
    const arr = [...grupos];
    arr.sort((a, b) => {
      const cmp =
        a[sortCol].localeCompare(b[sortCol], 'es') ||
        a.parque.localeCompare(b.parque, 'es') ||
        a.nave.localeCompare(b.nave, 'es');
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [grupos, sortCol, sortAsc]);

  // 4) Stats + totales del pie.
  const stats = useMemo(() => {
    const naves = new Set<string>();
    const navesPend = new Set<string>();
    let mxnPend = 0;
    let mxnPaid = 0;
    let usdPend = 0;
    let usdPaid = 0;
    for (const g of grupos) {
      const key = `${g.nave}||${g.parque}||${g.razon_social}`;
      naves.add(key);
      if (g.cntPend > 0) navesPend.add(key);
      mxnPend += g.mxnPend;
      mxnPaid += g.mxnPaid;
      usdPend += g.usdPend;
      usdPaid += g.usdPaid;
    }
    return {
      naves: naves.size,
      navesPend: navesPend.size,
      mxnPend,
      mxnPaid,
      usdPend,
      usdPaid,
      hayUsd: usdPend > 0 || usdPaid > 0,
    };
  }, [grupos]);

  const sortBy = (col: SortCol) => {
    if (sortCol === col) setSortAsc((s) => !s);
    else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  const ind = (col: SortCol) => (sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : ' ↕');

  function mostrarTip(e: React.MouseEvent, g: Grupo, tipo: 'pend' | 'paid') {
    const filasTip = Object.entries(g.conceptos)
      .filter(([, v]) => (tipo === 'pend' ? v.pend > 0 : v.paid > 0))
      .sort((a, b) => (tipo === 'pend' ? b[1].pend - a[1].pend : b[1].paid - a[1].paid))
      .map(([conc, v]) => ({ conc, monto: tipo === 'pend' ? v.pend : v.paid, div: v.div }));
    if (filasTip.length === 0) {
      setTip(null);
      return;
    }
    // Posición fija en el punto de entrada, ajustada para no salir de la pantalla.
    const w = 280;
    const h = 44 + filasTip.length * 22;
    let x = e.clientX + 12;
    let y = e.clientY + 12;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - 12;
    if (y + h > window.innerHeight - 8) y = e.clientY - h - 12;
    setTip({
      x,
      y,
      titulo: tipo === 'pend' ? 'Desglose pendiente' : 'Desglose cobrado',
      filas: filasTip,
    });
  }

  const anios = filtros?.anios?.length ? filtros.anios : [anio];

  // Filas pendientes de la razón social activa (para el modal).
  const pendientesModal = useMemo(
    () => (modalRS ? filas.filter((r) => r.razon_social === modalRS && !r.fec_pago) : []),
    [filas, modalRS],
  );

  /**
   * Exporta el tablero a CSV (respeta los filtros activos): una fila por nave y
   * divisa, con Pago (pendiente) / Cobrado y el desglose por concepto
   * (Renta/Vig/Admin/Mtto/Otros + Nota con el detalle de "otros").
   */
  function exportar() {
    const cols = [
      'Nave',
      'Parque',
      'Razon Social',
      'Divisa',
      'Pago',
      'Cobrado',
      'Renta',
      'Vig',
      'Admin',
      'Mtto',
      'Otros Conceptos',
      'Nota',
    ];
    const filasCsv: (string | number)[][] = [];
    for (const g of gruposOrden) {
      const divisas: ('MXN' | 'USD')[] = [];
      if (g.mxnPend > 0 || g.mxnPaid > 0) divisas.push('MXN');
      if (g.usdPend > 0 || g.usdPaid > 0) divisas.push('USD');
      if (divisas.length === 0) divisas.push('MXN');

      for (const D of divisas) {
        let renta = 0;
        let vig = 0;
        let admin = 0;
        let mtto = 0;
        let otros = 0;
        const detalle: string[] = [];
        for (const [conc, v] of Object.entries(g.conceptos)) {
          if ((esMXN(v.div) ? 'MXN' : 'USD') !== D) continue;
          const total = v.pend + v.paid;
          if (total === 0) continue;
          const n = normConc(conc);
          if (n === 'renta') renta += total;
          else if (n === 'vigilancia') vig += total;
          else if (n === 'administracion') admin += total;
          else if (n === 'mantenimiento') mtto += total;
          else {
            otros += total;
            detalle.push(`${montoTxt(total)} ${conc}`);
          }
        }
        const pend = D === 'MXN' ? g.mxnPend : g.usdPend;
        const paid = D === 'MXN' ? g.mxnPaid : g.usdPaid;
        filasCsv.push([
          g.nave,
          g.parque,
          g.razon_social,
          D,
          pend || '',
          paid || '',
          renta || '',
          vig || '',
          admin || '',
          mtto || '',
          otros || '',
          detalle.join(', '),
        ]);
      }
    }
    exportarCSV('cobranza-arrendatarios', cols, filasCsv);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-800">Arrendatarios · Gestión de Pagos</h1>
          <p className="text-xs text-gray-400">{incluirIva ? 'Montos con IVA incluido' : 'Montos sin IVA (base)'}</p>
        </div>
        <button
          type="button"
          onClick={exportar}
          disabled={gruposOrden.length === 0}
          title="Exporta a CSV lo que se ve en la tabla (respeta filtros)"
          className="rounded-lg border border-[#1f2a4d] px-3 py-2 text-sm font-medium text-[#1f2a4d] hover:bg-[#1f2a4d] hover:text-white disabled:opacity-40"
        >
          ⬇ Export CSV
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap items-stretch gap-2">
        <Stat label="Naves" valor={stats.naves.toLocaleString('es-MX')} />
        <Stat label="Naves pendientes" valor={stats.navesPend.toLocaleString('es-MX')} clase="text-red-600" />
        <Stat label="Monto pendiente MXN" valor={num(stats.mxnPend)} clase="text-red-600" />
        <Stat label="Cobrado MXN" valor={num(stats.mxnPaid)} clase="text-green-600" />

        {/* Toggle estado */}
        <div className="flex items-stretch overflow-hidden rounded-lg border">
          {([
            { v: 'all', label: 'Todos', activo: 'bg-[#1f2a4d] text-white' },
            { v: 'pend', label: 'Pendientes', activo: 'bg-red-600 text-white' },
            { v: 'paid', label: 'Pagados', activo: 'bg-green-600 text-white' },
          ] as const).map((b) => (
            <button
              key={b.v}
              type="button"
              onClick={() => setEstado(b.v)}
              className={`border-r px-3 text-xs font-semibold last:border-r-0 ${
                estado === b.v ? b.activo : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* Periodo */}
        <div className="ml-auto flex flex-col justify-center gap-1 rounded-lg border px-3 py-1.5">
          <div className="flex items-center gap-2">
            <span className="w-8 text-[11px] font-semibold text-gray-400">Mes</span>
            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className="rounded border px-2 py-0.5 text-sm font-semibold text-[#1f2a4d]"
            >
              <option value={0}>Todos</option>
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 text-[11px] font-semibold text-gray-400">Año</span>
            <select
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              className="rounded border px-2 py-0.5 text-sm font-semibold text-[#1f2a4d]"
            >
              {anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filtro divisa */}
        <div className="flex items-stretch overflow-hidden rounded-lg border">
          {(['ambos', 'MXN', 'USD'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDivisaFiltro(d)}
              className={`border-r px-3 text-xs font-semibold last:border-r-0 ${
                divisaFiltro === d ? 'bg-[#1f2a4d] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {d === 'ambos' ? 'Ambos' : d}
            </button>
          ))}
        </div>

        {/* Toggle IVA: con IVA (lo que cobra la transferencia) o sin IVA (base) */}
        <div className="flex items-stretch overflow-hidden rounded-lg border" title="Mostrar los montos con IVA incluido o sin IVA">
          {([
            { v: true, label: 'Con IVA' },
            { v: false, label: 'Sin IVA' },
          ] as const).map((b) => (
            <button
              key={String(b.v)}
              type="button"
              onClick={() => setIncluirIva(b.v)}
              className={`border-r px-3 text-xs font-semibold last:border-r-0 ${
                incluirIva === b.v ? 'bg-[#1f2a4d] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* Filtro de Concepto (no tiene columna propia en la tabla agrupada) */}
        <div className="flex items-center gap-1.5 rounded-lg bg-[#1f2a4d] px-3 text-xs font-semibold text-white">
          <span>Concepto</span>
          <FiltroColumnaOpciones etiqueta="Concepto" opciones={optConc} seleccion={concSel} onChange={setConcSel} />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_250px]">
        {/* Tabla agrupada */}
        <div className="overflow-auto rounded-xl border bg-white" style={{ maxHeight: '70vh' }}>
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#1f2a4d] text-left text-xs font-semibold uppercase tracking-wide text-white [&>th]:sticky [&>th]:top-0 [&>th]:z-20 [&>th]:bg-[#1f2a4d] [&>th]:px-3 [&>th]:py-2">
                <th className="hover:bg-[#2a376a]">
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => sortBy('nave')} className="uppercase tracking-wide hover:text-white/80">Nave{ind('nave')}</button>
                    <FiltroColumnaOpciones etiqueta="Nave" opciones={optNave} seleccion={naveSel} onChange={setNaveSel} />
                  </div>
                </th>
                <th className="hover:bg-[#2a376a]">
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => sortBy('parque')} className="uppercase tracking-wide hover:text-white/80">Parque{ind('parque')}</button>
                    <FiltroColumnaOpciones etiqueta="Parque" opciones={optParque} seleccion={parqueSel} onChange={setParqueSel} />
                  </div>
                </th>
                <th className="hover:bg-[#2a376a]">
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => sortBy('razon_social')} className="uppercase tracking-wide hover:text-white/80">Razón Social{ind('razon_social')}</button>
                    <FiltroColumnaOpciones etiqueta="Razón Social" opciones={optRS} seleccion={rsSel} onChange={setRsSel} />
                  </div>
                </th>
                <th className="text-right">Pendiente</th>
                <th className="text-right">Cobrado</th>
                <th className="text-center">Opciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Cargando datos…
                  </td>
                </tr>
              ) : gruposOrden.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Sin registros para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                gruposOrden.map((g) => {
                  const allPend = g.cntPaid === 0;
                  const allPaid = g.cntPend === 0;
                  const bg = allPend ? 'bg-[#FDE8E8]' : allPaid ? 'bg-[#F0FAF1]' : '';
                  return (
                    <tr key={`${g.nave}|${g.parque}|${g.razon_social}`} className={`${bg} hover:bg-blue-50`}>
                      <td className="px-3 py-1.5 font-bold text-[#1f2a4d]">{g.nave}</td>
                      <td className="px-3 py-1.5">{g.parque}</td>
                      <td className="px-3 py-1.5">{g.razon_social}</td>
                      <td
                        className="px-3 py-1.5 text-right"
                        onMouseEnter={(e) => mostrarTip(e, g, 'pend')}
                        onMouseLeave={() => setTip(null)}
                      >
                        <MontoDivisa mxn={g.mxnPend} usd={g.usdPend} clase="text-red-600" />
                      </td>
                      <td
                        className="px-3 py-1.5 text-right"
                        onMouseEnter={(e) => mostrarTip(e, g, 'paid')}
                        onMouseLeave={() => setTip(null)}
                      >
                        <MontoDivisa mxn={g.mxnPaid} usd={g.usdPaid} clase="text-green-600" />
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {g.cntPend > 0 ? (
                          <button
                            type="button"
                            onClick={() => setModalRS(g.razon_social)}
                            title="Aplicar pago"
                            className="rounded bg-amber-500 px-2 py-0.5 text-xs text-white hover:bg-amber-600"
                          >
                            💲
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">✓</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {gruposOrden.length > 0 && (
              <tfoot className="[&>tr>td]:sticky [&>tr>td]:bottom-0 [&>tr>td]:z-10 [&>tr>td]:bg-[#1f2a4d]">
                <tr className="font-bold text-white">
                  <td className="px-3 py-2 text-right text-[11px] opacity-85" colSpan={3}>
                    TOTALES
                  </td>
                  <td className="px-3 py-2 text-right">
                    <MontoDivisa mxn={stats.mxnPend} usd={stats.usdPend} clase="text-white" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <MontoDivisa mxn={stats.mxnPaid} usd={stats.usdPaid} clase="text-white" />
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Sidebar de vencimientos */}
        <div className="space-y-2">
          <p className="px-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
            Contratos vencidos
          </p>
          <PanelVenc
            id="venc"
            titulo="Sin renovación"
            color="bg-red-700"
            count={vencidos.length}
            colapsado={!!colapso.venc}
            onToggle={() => setColapso((c) => ({ ...c, venc: !c.venc }))}
          >
            {vencidos.length === 0 ? (
              <Vacio />
            ) : (
              vencidos.map((v, i) => (
                <ItemVenc key={i} c={v} extra={`${v.dias_vencido ?? 0} día(s) vencido`} />
              ))
            )}
          </PanelVenc>

          <p className="px-1 pt-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
            Próximos vencimientos
          </p>
          <Vencimientos porVencer={porVencer} colapso={colapso} setColapso={setColapso} />
        </div>
      </div>

      {/* Tooltip desglose */}
      {tip && (
        <div
          className="pointer-events-none fixed z-[9000] min-w-[200px] max-w-[280px] rounded-lg bg-[#1e2d3d] px-3.5 py-2.5 text-xs text-gray-100 shadow-xl"
          style={{ left: tip.x, top: tip.y }}
        >
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-white/50">
            {tip.titulo}
          </div>
          <table className="w-full">
            <tbody>
              {tip.filas.map((f, i) => (
                <tr key={i} className="border-t border-white/10 first:border-t-0">
                  <td className="py-0.5">{f.conc}</td>
                  <td className="py-0.5 pl-3 text-right font-semibold tabular-nums">
                    {num(f.monto)} <span className="text-[10px] opacity-60">{f.div}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalRS && (
        <AplicarPagoModal
          razonSocial={modalRS}
          filasPendientes={pendientesModal}
          anio={anio}
          mes={mes}
          onClose={() => setModalRS(null)}
          onAplicado={onCambio}
        />
      )}
    </div>
  );
}

/**
 * Muestra el/los montos de una celda en una sola columna, con la moneda como
 * etiqueta al lado. Si hay MXN y USD a la vez, se apilan; si no hay nada, "—".
 */
function MontoDivisa({ mxn, usd, clase }: { mxn: number; usd: number; clase?: string }) {
  if (mxn <= 0 && usd <= 0) return <span className="text-gray-400">—</span>;
  const linea = (monto: number, div: string) => (
    <div className={`tabular-nums font-medium ${clase ?? 'text-gray-800'}`}>
      {num(monto)} <span className="text-[10px] font-normal opacity-60">{div}</span>
    </div>
  );
  return (
    <div className="flex flex-col items-end gap-0.5">
      {mxn > 0 && linea(mxn, 'MXN')}
      {usd > 0 && linea(usd, 'USD')}
    </div>
  );
}

function Stat({ label, valor, clase }: { label: string; valor: string; clase?: string }) {
  return (
    <div className="flex min-w-[130px] flex-col gap-0.5 rounded-lg border bg-white px-3.5 py-1.5">
      <span className="text-[10px] uppercase tracking-wide text-gray-400">{label}</span>
      <span className={`text-base font-bold ${clase ?? 'text-[#1f2a4d]'}`}>{valor}</span>
    </div>
  );
}

/** Agrupa los contratos por vencer en rangos 1m / 2m / 3m según `fec_fin`. */
function Vencimientos({
  porVencer,
  colapso,
  setColapso,
}: {
  porVencer: ContratoPorVencer[];
  colapso: Record<string, boolean>;
  setColapso: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  const { b1, b2, b3 } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const m1 = addMonths(now, 1);
    const m2 = addMonths(now, 2);
    const m3 = addMonths(now, 3);
    const en = (r: ContratoPorVencer, a: Date, b: Date) => {
      const d = parseLocal(r.fec_fin);
      return d ? d >= a && d < b : false;
    };
    return {
      b1: porVencer.filter((r) => en(r, now, m1)),
      b2: porVencer.filter((r) => en(r, m1, m2)),
      b3: porVencer.filter((r) => en(r, m2, m3)),
    };
  }, [porVencer]);

  const paneles = [
    { id: '1m', titulo: '1 mes', color: 'bg-[#e67e22]', filas: b1 },
    { id: '2m', titulo: '2 meses', color: 'bg-[#f39c12]', filas: b2 },
    { id: '3m', titulo: '3 meses', color: 'bg-[#27ae60]', filas: b3 },
  ];

  return (
    <>
      {paneles.map((p) => (
        <PanelVenc
          key={p.id}
          id={p.id}
          titulo={p.titulo}
          color={p.color}
          count={p.filas.length}
          colapsado={!!colapso[p.id]}
          onToggle={() => setColapso((c) => ({ ...c, [p.id]: !c[p.id] }))}
        >
          {p.filas.length === 0 ? (
            <Vacio />
          ) : (
            p.filas.map((c, i) => <ItemVenc key={i} c={c} extra={`${c.moneda ?? 'MXN'}`} />)
          )}
        </PanelVenc>
      ))}
    </>
  );
}

function PanelVenc({
  titulo,
  color,
  count,
  colapsado,
  onToggle,
  children,
}: {
  id: string;
  titulo: string;
  color: string;
  count: number;
  colapsado: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center justify-between px-3 py-1.5 text-xs font-bold text-white ${color}`}
      >
        <span>
          {titulo}{' '}
          <span className="ml-1 rounded-full bg-white/30 px-1.5 text-[11px]">{count}</span>
        </span>
        <span className={`text-[10px] transition-transform ${colapsado ? '-rotate-90' : ''}`}>▼</span>
      </button>
      {!colapsado && <div className="max-h-56 overflow-auto bg-white">{children}</div>}
    </div>
  );
}

function ItemVenc({ c, extra }: { c: ContratoPorVencer & { dias_vencido?: number | null }; extra: string }) {
  return (
    <div className="border-b px-2 py-1.5 text-[11px] leading-tight last:border-b-0">
      <div className="font-bold text-[#1f2a4d]">
        {c.nave ?? '—'} · {c.parque ?? '—'}
      </div>
      <div className="truncate text-gray-600">{c.razon_social ?? '—'}</div>
      <div className="flex justify-between text-gray-400">
        <span>Vence: {fechaCorta(c.fec_fin)}</span>
        <span className={c.dias_vencido != null ? 'font-bold text-red-700' : ''}>{extra}</span>
      </div>
    </div>
  );
}

function Vacio() {
  return <p className="px-2 py-2.5 text-center text-[11px] text-gray-400">Sin vencimientos</p>;
}
