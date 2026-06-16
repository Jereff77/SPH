import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, type TabDef } from '@/components/Tabs';
import { useSort } from '@/components/tabla/useSort';
import { SortableTh, THEAD_STICKY, THEAD_TR } from '@/components/tabla/SortableTh';
import {
  arrendatariosApi,
  fechaCorta,
  hoyMexico,
  moneda,
  num,
  type CancelacionReporteRow,
  type EstadoCuentaPartida,
  type VencimientoReporteRow,
} from './arrendatarios.api';
import { configuracionApi } from '@/features/configuraciones/configuracion.api';
import { exportarCSV } from './csv-export';
import { exportarPDF, exportarPDFEstadoCuenta } from './reportes-arre-export';

const TABS: TabDef[] = [
  { id: 'vencimientos', label: 'Vencimientos' },
  { id: 'estado', label: 'Estado de Cuenta' },
  { id: 'cancelaciones', label: 'Cancelaciones Anticipadas' },
];

export function ReportesArrePage() {
  const [tab, setTab] = useState('vencimientos');
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-gray-800">Arrendatarios · Reportes</h1>
      <Tabs tabs={TABS} activo={tab} onChange={setTab} />
      <div className="pt-2">
        {tab === 'vencimientos' && <VencimientosTab />}
        {tab === 'estado' && <EstadoCuentaTab />}
        {tab === 'cancelaciones' && <CancelacionesTab />}
      </div>
    </div>
  );
}

function EstadoCuentaTab() {
  const { data: opciones = [] } = useQuery({
    queryKey: ['arre-rep-ec-opciones'],
    queryFn: () => arrendatariosApi.estadoCuentaOpciones(),
  });
  const { data: logos } = useQuery({
    queryKey: ['logos'],
    queryFn: () => configuracionApi.getLogos(),
    staleTime: 5 * 60 * 1000,
  });

  const [idParque, setIdParque] = useState('');
  const [idNavArrend, setIdNavArrend] = useState('');
  const [idArrePdp, setIdArrePdp] = useState('');
  const [generandoPdf, setGenerandoPdf] = useState(false);

  // Parques con naves arrendadas (con plan).
  const parques = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of opciones) if (n.idParque) m.set(n.idParque, n.parque);
    return [...m.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [opciones]);

  const naves = useMemo(
    () => opciones.filter((n) => !idParque || n.idParque === idParque),
    [opciones, idParque],
  );
  const naveSel = useMemo(
    () => naves.find((n) => n.idNavArrend === idNavArrend) ?? null,
    [naves, idNavArrend],
  );
  const planes = naveSel?.planes ?? [];

  // Corrida del plan seleccionado.
  const { data: corrida, isLoading: cargandoCorrida } = useQuery({
    queryKey: ['arre-rep-ec-corrida', idArrePdp],
    queryFn: () => arrendatariosApi.estadoCuentaCorrida(idArrePdp),
    enabled: !!idArrePdp,
  });

  const cab = corrida?.cabecera ?? null;
  const partidas = useMemo(() => corrida?.partidas ?? [], [corrida]);
  const divisa = cab?.moneda ?? 'MXN';

  // Totales (pie de la corrida).
  const tot = useMemo(() => {
    const t = { renta: 0, admin: 0, mtto: 0, vig: 0, otros: 0, total: 0, pagado: 0 };
    for (const p of partidas) {
      t.renta += p.renta;
      t.admin += p.admin;
      t.mtto += p.mtto;
      t.vig += p.vig;
      t.otros += p.otros;
      t.total += p.total;
      t.pagado += p.montoPagado;
    }
    return t;
  }, [partidas]);

  function onParque(id: string) {
    setIdParque(id);
    setIdNavArrend('');
    setIdArrePdp('');
  }
  function onNave(idNav: string) {
    setIdNavArrend(idNav);
    const n = opciones.find((o) => o.idNavArrend === idNav);
    setIdArrePdp(n?.planes[0]?.idArrePdp ?? '');
  }

  // ----- Export -----
  const COLS_CSV = [
    'Nave',
    'Parque',
    'Razon Social',
    'Divisa',
    '#',
    'Año',
    'Fecha',
    'INPC total',
    'Renta',
    'Admin',
    'Mtto',
    'Vig',
    'Otros Servicios',
    'Nota',
    'Total',
    'Pagado',
    'Fecha pago',
    'Estado',
  ];
  const COLS_PDF = COLS_CSV.slice(4); // sin Nave/Parque/Razón Social/Divisa (van en el encabezado)

  // CSV: número a 2 decimales (Excel lo trata como número). PDF: formato moneda.
  const csvMonto = (n: number): string | number => (n > 0 ? Math.round(n * 100) / 100 : '');
  const pdfMonto = (n: number): string => (n > 0 ? moneda(n, divisa) : '');

  const filaPartida = (
    p: EstadoCuentaPartida,
    fmt: (n: number) => string | number,
  ): (string | number)[] => [
    p.numPartida,
    p.anio ?? '',
    fechaCorta(p.fecha),
    p.inpcTotal > 0 ? num(p.inpcTotal) : '',
    fmt(p.renta),
    fmt(p.admin),
    fmt(p.mtto),
    fmt(p.vig),
    fmt(p.otros),
    p.nota,
    fmt(p.total),
    fmt(p.montoPagado),
    fechaCorta(p.fecPago),
    p.pagado ? 'Pagado' : 'Pendiente',
  ];

  const archivo = cab ? `estado-cuenta-${cab.nave}`.replace(/[^\w-]+/g, '_') : 'estado-cuenta';

  function exportarCsv() {
    if (!cab) return;
    const filas = partidas.map((p) => [
      cab.nave,
      cab.parque,
      cab.arrendatario,
      cab.moneda,
      ...filaPartida(p, csvMonto),
    ]);
    exportarCSV(archivo, COLS_CSV, filas);
  }

  async function exportarPdf() {
    if (!cab) return;
    setGenerandoPdf(true);
    try {
      await exportarPDFEstadoCuenta({
        archivo,
        titulo: 'Estado de Cuenta · Arrendatarios',
        generado: fechaCorta(hoyMexico()),
        estado: cab.estado,
        logoUrl: logos?.claro?.url ?? null,
        // Mismo grid que la tarjeta de la pantalla.
        datos: [
          { etiqueta: 'Arrendatario', valor: cab.arrendatario },
          { etiqueta: 'Parque', valor: cab.parque },
          { etiqueta: 'Nave', valor: cab.nave },
          { etiqueta: 'Moneda', valor: cab.moneda },
          { etiqueta: 'Inicio', valor: fechaCorta(cab.fecInicio) },
          { etiqueta: 'Fin', valor: fechaCorta(cab.fecFin) },
          { etiqueta: 'Plazo', valor: `${cab.plazo ?? '—'} meses` },
          { etiqueta: 'Vigencia', valor: cab.vigencia ?? '—' },
          { etiqueta: 'Depósito', valor: moneda(cab.deposito, divisa) },
          { etiqueta: 'Renta $×m²', valor: num(cab.precioM2) },
          { etiqueta: 'Const. m²', valor: num(cab.construccionM2) },
          { etiqueta: 'INPC adic.', valor: num(cab.inpcPlus) },
        ],
        columnas: COLS_PDF,
        filas: partidas.map((p) => filaPartida(p, pdfMonto)),
      });
    } finally {
      setGenerandoPdf(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Selectores */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-600">
          Parque
          <select
            value={idParque}
            onChange={(e) => onParque(e.target.value)}
            className="mt-1 block w-52 rounded border px-2 py-1.5 text-sm"
          >
            <option value="">Selecciona…</option>
            {parques.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Nave
          <select
            value={idNavArrend}
            onChange={(e) => onNave(e.target.value)}
            disabled={!idParque && parques.length > 1}
            className="mt-1 block w-56 rounded border px-2 py-1.5 text-sm disabled:bg-gray-100"
          >
            <option value="">Selecciona…</option>
            {naves.map((n) => (
              <option key={n.idNavArrend} value={n.idNavArrend}>
                {n.nave} · {n.arrendatario}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Plan
          <select
            value={idArrePdp}
            onChange={(e) => setIdArrePdp(e.target.value)}
            disabled={!naveSel}
            className="mt-1 block w-72 rounded border px-2 py-1.5 text-sm disabled:bg-gray-100"
          >
            <option value="">Selecciona…</option>
            {planes.map((pl) => (
              <option key={pl.idArrePdp} value={pl.idArrePdp}>
                {fechaCorta(pl.fecInicio)} → {fechaCorta(pl.fecFin)} ·{' '}
                {pl.vigencia === 'No' ? 'Terminado' : 'Vigente'} · {pl.moneda ?? 'MXN'}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            disabled={!cab || partidas.length === 0}
            onClick={exportarCsv}
            className="rounded-lg border border-[#1f2a4d] px-3 py-2 text-sm font-medium text-[#1f2a4d] hover:bg-[#1f2a4d] hover:text-white disabled:opacity-40"
          >
            Export CSV
          </button>
          <button
            type="button"
            disabled={!cab || partidas.length === 0 || generandoPdf}
            onClick={exportarPdf}
            className="rounded-lg border border-[#1f2a4d] px-3 py-2 text-sm font-medium text-[#1f2a4d] hover:bg-[#1f2a4d] hover:text-white disabled:opacity-40"
          >
            {generandoPdf ? 'Generando…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {!idArrePdp ? (
        <div className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-gray-400">
          Selecciona parque, nave y plan para ver el estado de cuenta.
        </div>
      ) : cargandoCorrida || !cab ? (
        <div className="rounded-xl border bg-white p-6 text-center text-sm text-gray-400">
          Cargando estado de cuenta…
        </div>
      ) : (
        <>
          {/* Cabecera: datos del plan + estado del contrato */}
          <div className="flex flex-col gap-4 rounded-xl border bg-white p-4 lg:flex-row lg:items-stretch">
            <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-4">
              <Dato etq="Arrendatario" val={cab.arrendatario} />
              <Dato etq="Parque" val={cab.parque} />
              <Dato etq="Nave" val={cab.nave} />
              <Dato etq="Moneda" val={cab.moneda} />
              <Dato etq="Inicio" val={fechaCorta(cab.fecInicio)} />
              <Dato etq="Fin" val={fechaCorta(cab.fecFin)} />
              <Dato etq="Plazo" val={`${cab.plazo ?? '—'} meses`} />
              <Dato etq="Vigencia" val={cab.vigencia ?? '—'} />
              <Dato etq="Depósito" val={moneda(cab.deposito, divisa)} />
              <Dato etq="Renta $×m²" val={num(cab.precioM2)} />
              <Dato etq="Const. m²" val={num(cab.construccionM2)} />
              <Dato etq="INPC adic." val={num(cab.inpcPlus)} />
            </div>
            <BadgeEstado estado={cab.estado} />
          </div>

          {/* Corrida desglosada */}
          <div className="overflow-auto rounded-xl border bg-white" style={{ maxHeight: '60vh' }}>
            <table className="min-w-full border-collapse text-sm">
              <thead className={THEAD_STICKY}>
                <tr className={THEAD_TR}>
                  <SortableTh align="center">#</SortableTh>
                  <SortableTh align="center">Año</SortableTh>
                  <SortableTh>Fecha</SortableTh>
                  <SortableTh align="right">INPC total</SortableTh>
                  <SortableTh align="right">Renta</SortableTh>
                  <SortableTh align="right">Admin</SortableTh>
                  <SortableTh align="right">Mtto</SortableTh>
                  <SortableTh align="right">Vig</SortableTh>
                  <SortableTh align="right">Otros Serv.</SortableTh>
                  <SortableTh>Nota</SortableTh>
                  <SortableTh align="right">Total</SortableTh>
                  <SortableTh align="right">Pagado</SortableTh>
                  <SortableTh>Fecha pago</SortableTh>
                  <SortableTh align="center">Estado</SortableTh>
                </tr>
              </thead>
              <tbody className="divide-y">
                {partidas.map((p) => (
                  <tr key={p.numPartida} className={p.pagado ? 'bg-[#F0FAF1]' : 'hover:bg-gray-50'}>
                    <td className="px-3 py-1.5 text-center font-medium">{p.numPartida}</td>
                    <td className="px-3 py-1.5 text-center">{p.anio ?? '—'}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{fechaCorta(p.fecha)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{p.inpcTotal > 0 ? num(p.inpcTotal) : '—'}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{p.renta > 0 ? num(p.renta) : '—'}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{p.admin > 0 ? num(p.admin) : '—'}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{p.mtto > 0 ? num(p.mtto) : '—'}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{p.vig > 0 ? num(p.vig) : '—'}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{p.otros > 0 ? num(p.otros) : '—'}</td>
                    <td className="px-3 py-1.5 max-w-[16rem] truncate text-gray-500" title={p.nota}>
                      {p.nota || '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                      {p.total > 0 ? num(p.total) : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-green-700">
                      {p.montoPagado > 0 ? num(p.montoPagado) : '—'}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{fechaCorta(p.fecPago)}</td>
                    <td className="px-3 py-1.5 text-center">
                      {p.pagado ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                          Pagado
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                          Pendiente
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="[&>tr>td]:sticky [&>tr>td]:bottom-0 [&>tr>td]:bg-[#1f2a4d]">
                <tr className="font-bold text-white">
                  <td className="px-3 py-2 text-right" colSpan={3}>
                    TOTALES
                  </td>
                  <td />
                  <td className="px-3 py-2 text-right tabular-nums">{num(tot.renta)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(tot.admin)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(tot.mtto)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(tot.vig)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(tot.otros)}</td>
                  <td />
                  <td className="px-3 py-2 text-right tabular-nums">{num(tot.total)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(tot.pagado)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Dato({ etq, val }: { etq: string; val: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-gray-400">{etq}</span>
      <span className="font-medium text-gray-700">{val}</span>
    </div>
  );
}

/** Badge grande con el estado del contrato (VIGENTE / TERMINADO / CANCELADO). */
function BadgeEstado({ estado }: { estado: 'VIGENTE' | 'TERMINADO' | 'CANCELADO' }) {
  const estilo: Record<typeof estado, string> = {
    VIGENTE: 'border-green-500 bg-green-50 text-green-700',
    TERMINADO: 'border-gray-400 bg-gray-50 text-gray-600',
    CANCELADO: 'border-red-500 bg-red-50 text-red-700',
  };
  return (
    <div
      className={`flex min-w-[180px] flex-col items-center justify-center rounded-xl border-2 px-6 py-3 ${estilo[estado]}`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest opacity-70">
        Estado del contrato
      </span>
      <span className="text-2xl font-extrabold tracking-wide">{estado}</span>
    </div>
  );
}

function CancelacionesTab() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['arre-rep-cancelaciones'],
    queryFn: () => arrendatariosApi.reporteCancelaciones({}),
  });

  const [anio, setAnio] = useState<number | ''>('');
  const [parque, setParque] = useState('');
  const [busqueda, setBusqueda] = useState('');

  // Opciones de filtro derivadas de los datos.
  const anios = useMemo(
    () =>
      [
        ...new Set(
          data
            .map((r) => (r.fecCancelacion ? Number(r.fecCancelacion.slice(0, 4)) : null))
            .filter((n): n is number => n != null),
        ),
      ].sort((a, b) => b - a),
    [data],
  );
  const parques = useMemo(
    () => [...new Set(data.map((r) => r.parque).filter((p): p is string => !!p))].sort(),
    [data],
  );

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return data.filter((r) => {
      if (anio && (!r.fecCancelacion || Number(r.fecCancelacion.slice(0, 4)) !== anio)) return false;
      if (parque && r.parque !== parque) return false;
      if (q && !`${r.arrendatario} ${r.nave ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, anio, parque, busqueda]);

  const { ordenados, sortKey, dir, toggle } = useSort<CancelacionReporteRow>(filtradas, {
    arrendatario: (r) => r.arrendatario,
    parque: (r) => r.parque,
    nave: (r) => r.nave,
    fecInicio: (r) => r.fecInicio,
    fecFin: (r) => r.fecFin,
    fecCancelacion: (r) => r.fecCancelacion,
    motivo: (r) => r.motivo,
    cancelo: (r) => r.cancelo,
    moneda: (r) => r.moneda,
  });

  const COLS = [
    'Arrendatario',
    'Parque',
    'Nave',
    'Inicio',
    'Fin contractual',
    'Fecha cancelación',
    'Motivo',
    'Canceló',
    'Moneda',
  ];
  const toRow = (r: CancelacionReporteRow) => [
    r.arrendatario,
    r.parque ?? '',
    r.nave ?? '',
    fechaCorta(r.fecInicio),
    fechaCorta(r.fecFin),
    fechaCorta(r.fecCancelacion),
    r.motivo ?? '',
    r.cancelo ?? '',
    r.moneda ?? '',
  ];

  return (
    <div className="space-y-3">
      {/* Filtros + export */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-600">
          Año cancelación
          <select
            value={anio}
            onChange={(e) => setAnio(e.target.value ? Number(e.target.value) : '')}
            className="mt-1 block w-40 rounded border px-2 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            {anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Parque
          <select
            value={parque}
            onChange={(e) => setParque(e.target.value)}
            className="mt-1 block w-56 rounded border px-2 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            {parques.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Buscar
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Arrendatario o nave…"
            className="mt-1 block w-56 rounded border px-2 py-1.5 text-sm"
          />
        </label>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            disabled={ordenados.length === 0}
            onClick={() => exportarCSV('cancelaciones-anticipadas', COLS, ordenados.map(toRow))}
            className="rounded-lg border border-[#1f2a4d] px-3 py-2 text-sm font-medium text-[#1f2a4d] hover:bg-[#1f2a4d] hover:text-white disabled:opacity-40"
          >
            Export CSV
          </button>
          <button
            type="button"
            disabled={ordenados.length === 0}
            onClick={() => exportarPDF('Cancelaciones Anticipadas', COLS, ordenados.map(toRow))}
            className="rounded-lg border border-[#1f2a4d] px-3 py-2 text-sm font-medium text-[#1f2a4d] hover:bg-[#1f2a4d] hover:text-white disabled:opacity-40"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-auto rounded-xl border bg-white" style={{ maxHeight: '65vh' }}>
        <table className="min-w-full border-collapse text-sm">
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <SortableTh campo="arrendatario" sortKey={sortKey} dir={dir} onSort={toggle}>
                Arrendatario
              </SortableTh>
              <SortableTh campo="parque" sortKey={sortKey} dir={dir} onSort={toggle}>
                Parque
              </SortableTh>
              <SortableTh campo="nave" sortKey={sortKey} dir={dir} onSort={toggle}>
                Nave
              </SortableTh>
              <SortableTh campo="fecInicio" sortKey={sortKey} dir={dir} onSort={toggle}>
                Inicio
              </SortableTh>
              <SortableTh campo="fecFin" sortKey={sortKey} dir={dir} onSort={toggle}>
                Fin contractual
              </SortableTh>
              <SortableTh campo="fecCancelacion" sortKey={sortKey} dir={dir} onSort={toggle}>
                Fecha cancelación
              </SortableTh>
              <SortableTh campo="motivo" sortKey={sortKey} dir={dir} onSort={toggle}>
                Motivo
              </SortableTh>
              <SortableTh campo="cancelo" sortKey={sortKey} dir={dir} onSort={toggle}>
                Canceló
              </SortableTh>
              <SortableTh campo="moneda" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                Moneda
              </SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  Cargando…
                </td>
              </tr>
            ) : ordenados.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  No hay cancelaciones anticipadas con los filtros actuales.
                </td>
              </tr>
            ) : (
              ordenados.map((r) => (
                <tr key={r.idArrePdp} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{r.arrendatario}</td>
                  <td className="px-4 py-2">{r.parque ?? '—'}</td>
                  <td className="px-4 py-2">{r.nave ?? '—'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{fechaCorta(r.fecInicio)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{fechaCorta(r.fecFin)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{fechaCorta(r.fecCancelacion)}</td>
                  <td className="px-4 py-2 max-w-xs truncate" title={r.motivo ?? ''}>
                    {r.motivo ?? '—'}
                  </td>
                  <td className="px-4 py-2">{r.cancelo ?? '—'}</td>
                  <td className="px-4 py-2 text-center">{r.moneda ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----------------------------- Vencimientos -----------------------------

/** Etiqueta amigable del estado de vigencia. */
const ESTADO_LABEL: Record<string, string> = {
  No: 'Vencido',
  '1 Mes': '1 mes',
  '2 Meses': '2 meses',
  '3 Meses': '3 meses',
};

/** Días entre hoy (México) y la fecha de fin: <0 vencido, 0 hoy, >0 por vencer. */
function diasFin(fecFin: string | null): number | null {
  if (!fecFin) return null;
  const f = Date.parse(`${fecFin.slice(0, 10)}T00:00:00Z`);
  const h = Date.parse(`${hoyMexico()}T00:00:00Z`);
  if (Number.isNaN(f) || Number.isNaN(h)) return null;
  return Math.round((f - h) / 86400000);
}

function diasTexto(fecFin: string | null): string {
  const d = diasFin(fecFin);
  if (d == null) return '—';
  if (d < 0) return `Venció hace ${Math.abs(d)} d`;
  if (d === 0) return 'Vence hoy';
  return `Vence en ${d} d`;
}

function BadgeVigencia({ estado }: { estado: string }) {
  const estilo: Record<string, string> = {
    No: 'bg-red-100 text-red-700',
    '1 Mes': 'bg-orange-100 text-orange-700',
    '2 Meses': 'bg-amber-100 text-amber-700',
    '3 Meses': 'bg-yellow-100 text-yellow-800',
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${estilo[estado] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {ESTADO_LABEL[estado] ?? estado}
    </span>
  );
}

function VencimientosTab() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['arre-rep-vencimientos'],
    queryFn: () => arrendatariosApi.reporteVencimientos(),
  });

  const [estado, setEstado] = useState('');
  const [parque, setParque] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const parques = useMemo(
    () => [...new Set(data.map((r) => r.parque).filter((p): p is string => !!p))].sort(),
    [data],
  );

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return data.filter((r) => {
      if (estado && r.estado !== estado) return false;
      if (parque && r.parque !== parque) return false;
      if (q && !`${r.arrendatario} ${r.nave ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, estado, parque, busqueda]);

  const urgencia: Record<string, number> = { No: 0, '1 Mes': 1, '2 Meses': 2, '3 Meses': 3 };
  const { ordenados, sortKey, dir, toggle } = useSort<VencimientoReporteRow>(filtradas, {
    arrendatario: (r) => r.arrendatario,
    parque: (r) => r.parque,
    nave: (r) => r.nave,
    fecInicio: (r) => r.fecInicio,
    fecFin: (r) => r.fecFin,
    estado: (r) => urgencia[r.estado] ?? 9,
    dias: (r) => diasFin(r.fecFin) ?? 999999,
    renta: (r) => r.rentaBase,
  });

  // Conteos por estado (tarjetas resumen).
  const conteo = useMemo(() => {
    const c: Record<string, number> = { No: 0, '1 Mes': 0, '2 Meses': 0, '3 Meses': 0 };
    for (const r of data) c[r.estado] = (c[r.estado] ?? 0) + 1;
    return c;
  }, [data]);

  const COLS = ['Arrendatario', 'Parque', 'Nave', 'Inicio', 'Fin', 'Estado', 'Días', 'Renta base', 'Moneda'];
  const toRow = (r: VencimientoReporteRow) => [
    r.arrendatario,
    r.parque ?? '',
    r.nave ?? '',
    fechaCorta(r.fecInicio),
    fechaCorta(r.fecFin),
    ESTADO_LABEL[r.estado] ?? r.estado,
    diasTexto(r.fecFin),
    r.rentaBase > 0 ? Math.round(r.rentaBase * 100) / 100 : '',
    r.moneda ?? '',
  ];

  return (
    <div className="space-y-3">
      {/* Tarjetas resumen por estado */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['No', '1 Mes', '2 Meses', '3 Meses'] as const).map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEstado(estado === e ? '' : e)}
            className={`rounded-xl border p-3 text-left transition ${
              estado === e ? 'border-[#1f2a4d] bg-[#1f2a4d]/5' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl font-bold text-gray-800">{conteo[e]}</div>
            <div className="mt-0.5">
              <BadgeVigencia estado={e} />
            </div>
          </button>
        ))}
      </div>

      {/* Filtros + export */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-600">
          Estado
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="mt-1 block w-40 rounded border px-2 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            <option value="No">Vencido</option>
            <option value="1 Mes">1 mes</option>
            <option value="2 Meses">2 meses</option>
            <option value="3 Meses">3 meses</option>
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Parque
          <select
            value={parque}
            onChange={(e) => setParque(e.target.value)}
            className="mt-1 block w-56 rounded border px-2 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            {parques.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Buscar
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Arrendatario o nave…"
            className="mt-1 block w-56 rounded border px-2 py-1.5 text-sm"
          />
        </label>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            disabled={ordenados.length === 0}
            onClick={() => exportarCSV('vencimientos-contratos', COLS, ordenados.map(toRow))}
            className="rounded-lg border border-[#1f2a4d] px-3 py-2 text-sm font-medium text-[#1f2a4d] hover:bg-[#1f2a4d] hover:text-white disabled:opacity-40"
          >
            Export CSV
          </button>
          <button
            type="button"
            disabled={ordenados.length === 0}
            onClick={() => exportarPDF('Vencimientos de Contratos', COLS, ordenados.map(toRow))}
            className="rounded-lg border border-[#1f2a4d] px-3 py-2 text-sm font-medium text-[#1f2a4d] hover:bg-[#1f2a4d] hover:text-white disabled:opacity-40"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-auto rounded-xl border bg-white" style={{ maxHeight: '60vh' }}>
        <table className="min-w-full border-collapse text-sm">
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <SortableTh campo="arrendatario" sortKey={sortKey} dir={dir} onSort={toggle}>
                Arrendatario
              </SortableTh>
              <SortableTh campo="parque" sortKey={sortKey} dir={dir} onSort={toggle}>
                Parque
              </SortableTh>
              <SortableTh campo="nave" sortKey={sortKey} dir={dir} onSort={toggle}>
                Nave
              </SortableTh>
              <SortableTh campo="fecInicio" sortKey={sortKey} dir={dir} onSort={toggle}>
                Inicio
              </SortableTh>
              <SortableTh campo="fecFin" sortKey={sortKey} dir={dir} onSort={toggle}>
                Fin
              </SortableTh>
              <SortableTh campo="estado" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                Estado
              </SortableTh>
              <SortableTh campo="dias" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                Días
              </SortableTh>
              <SortableTh campo="renta" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                Renta base
              </SortableTh>
              <SortableTh align="center">Moneda</SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  Cargando…
                </td>
              </tr>
            ) : ordenados.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  No hay contratos vencidos ni por vencer con los filtros actuales.
                </td>
              </tr>
            ) : (
              ordenados.map((r) => {
                const d = diasFin(r.fecFin);
                return (
                  <tr key={r.idArrePdp} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{r.arrendatario}</td>
                    <td className="px-4 py-2">{r.parque ?? '—'}</td>
                    <td className="px-4 py-2">{r.nave ?? '—'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{fechaCorta(r.fecInicio)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{fechaCorta(r.fecFin)}</td>
                    <td className="px-4 py-2 text-center">
                      <BadgeVigencia estado={r.estado} />
                    </td>
                    <td
                      className={`px-4 py-2 text-right whitespace-nowrap tabular-nums ${
                        d != null && d < 0 ? 'font-semibold text-red-600' : 'text-gray-600'
                      }`}
                    >
                      {diasTexto(r.fecFin)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {r.rentaBase > 0 ? moneda(r.rentaBase, r.moneda ?? 'MXN') : '—'}
                    </td>
                    <td className="px-4 py-2 text-center">{r.moneda ?? '—'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
