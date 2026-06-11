import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, type TabDef } from '@/components/Tabs';
import { useSort } from '@/components/tabla/useSort';
import { SortableTh, THEAD_STICKY, THEAD_TR } from '@/components/tabla/SortableTh';
import {
  arrendatariosApi,
  fechaCorta,
  hoyMexico,
  num,
  type CancelacionReporteRow,
  type EstadoCuentaArreRow,
} from './arrendatarios.api';
import { configuracionApi } from '@/features/configuraciones/configuracion.api';
import { exportarCSV } from './csv-export';
import { exportarPDF, exportarPDFConEncabezado } from './reportes-arre-export';

const TABS: TabDef[] = [
  { id: 'estado', label: 'Estado de Cuenta' },
  { id: 'cancelaciones', label: 'Cancelaciones Anticipadas' },
];

export function ReportesArrePage() {
  const [tab, setTab] = useState('estado');
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-gray-800">Arrendatarios · Reportes</h1>
      <Tabs tabs={TABS} activo={tab} onChange={setTab} />
      <div className="pt-2">
        {tab === 'estado' && <EstadoCuentaTab />}
        {tab === 'cancelaciones' && <CancelacionesTab />}
      </div>
    </div>
  );
}

function EstadoCuentaTab() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['arre-rep-estado-cuenta'],
    queryFn: () => arrendatariosApi.reporteEstadoCuenta(),
  });
  const { data: logos } = useQuery({
    queryKey: ['logos'],
    queryFn: () => configuracionApi.getLogos(),
    staleTime: 5 * 60 * 1000,
  });

  const [parque, setParque] = useState('');
  const [nave, setNave] = useState('');
  const [cliente, setCliente] = useState('');
  const [divisa, setDivisa] = useState<'' | 'MXN' | 'USD'>('');
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const parques = useMemo(
    () => [...new Set(data.map((r) => r.parque).filter((p): p is string => !!p && p !== '—'))].sort(),
    [data],
  );

  const filtradas = useMemo(() => {
    const qn = nave.trim().toLowerCase();
    const qc = cliente.trim().toLowerCase();
    return data.filter((r) => {
      if (parque && r.parque !== parque) return false;
      if (divisa && r.divisa !== divisa) return false;
      if (qn && !r.nave.toLowerCase().includes(qn)) return false;
      if (qc && !r.razonSocial.toLowerCase().includes(qc)) return false;
      return true;
    });
  }, [data, parque, nave, cliente, divisa]);

  const { ordenados, sortKey, dir, toggle } = useSort<EstadoCuentaArreRow>(filtradas, {
    nave: (r) => r.nave,
    parque: (r) => r.parque,
    razonSocial: (r) => r.razonSocial,
    divisa: (r) => r.divisa,
    pendiente: (r) => r.pendiente,
    cobrado: (r) => r.cobrado,
    renta: (r) => r.renta,
    vig: (r) => r.vig,
    admin: (r) => r.admin,
    mtto: (r) => r.mtto,
    otros: (r) => r.otros,
  });

  const COLS = [
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
  const toRow = (r: EstadoCuentaArreRow): (string | number)[] => [
    r.nave,
    r.parque,
    r.razonSocial,
    r.divisa,
    r.pendiente || '',
    r.cobrado || '',
    r.renta || '',
    r.vig || '',
    r.admin || '',
    r.mtto || '',
    r.otros || '',
    r.nota,
  ];

  async function exportarPdf() {
    setGenerandoPdf(true);
    try {
      await exportarPDFConEncabezado({
        archivo: 'estado-cuenta-arrendatarios',
        titulo: 'Estado de Cuenta · Arrendatarios',
        subtitulo: `Generado el ${fechaCorta(hoyMexico())}`,
        logoUrl: logos?.claro?.url ?? null,
        columnas: COLS,
        filas: ordenados.map(toRow),
      });
    } finally {
      setGenerandoPdf(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-600">
          Parque
          <select
            value={parque}
            onChange={(e) => setParque(e.target.value)}
            className="mt-1 block w-52 rounded border px-2 py-1.5 text-sm"
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
          Nave
          <input
            type="text"
            value={nave}
            onChange={(e) => setNave(e.target.value)}
            placeholder="Buscar nave…"
            className="mt-1 block w-44 rounded border px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600">
          Cliente
          <input
            type="text"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            placeholder="Buscar cliente…"
            className="mt-1 block w-52 rounded border px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600">
          Divisa
          <select
            value={divisa}
            onChange={(e) => setDivisa(e.target.value as '' | 'MXN' | 'USD')}
            className="mt-1 block w-32 rounded border px-2 py-1.5 text-sm"
          >
            <option value="">Ambos</option>
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            disabled={ordenados.length === 0}
            onClick={() => exportarCSV('estado-cuenta-arrendatarios', COLS, ordenados.map(toRow))}
            className="rounded-lg border border-[#1f2a4d] px-3 py-2 text-sm font-medium text-[#1f2a4d] hover:bg-[#1f2a4d] hover:text-white disabled:opacity-40"
          >
            Export CSV
          </button>
          <button
            type="button"
            disabled={ordenados.length === 0 || generandoPdf}
            onClick={exportarPdf}
            className="rounded-lg border border-[#1f2a4d] px-3 py-2 text-sm font-medium text-[#1f2a4d] hover:bg-[#1f2a4d] hover:text-white disabled:opacity-40"
          >
            {generandoPdf ? 'Generando…' : 'Export PDF'}
          </button>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border bg-white" style={{ maxHeight: '65vh' }}>
        <table className="min-w-full border-collapse text-sm">
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <SortableTh campo="nave" sortKey={sortKey} dir={dir} onSort={toggle}>
                Nave
              </SortableTh>
              <SortableTh campo="parque" sortKey={sortKey} dir={dir} onSort={toggle}>
                Parque
              </SortableTh>
              <SortableTh campo="razonSocial" sortKey={sortKey} dir={dir} onSort={toggle}>
                Razón Social
              </SortableTh>
              <SortableTh campo="divisa" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                Divisa
              </SortableTh>
              <SortableTh campo="pendiente" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                Pago
              </SortableTh>
              <SortableTh campo="cobrado" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                Cobrado
              </SortableTh>
              <SortableTh campo="renta" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                Renta
              </SortableTh>
              <SortableTh campo="vig" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                Vig
              </SortableTh>
              <SortableTh campo="admin" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                Admin
              </SortableTh>
              <SortableTh campo="mtto" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                Mtto
              </SortableTh>
              <SortableTh campo="otros" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                Otros
              </SortableTh>
              <SortableTh sortKey={sortKey} dir={dir}>
                Nota
              </SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-gray-400">
                  Cargando…
                </td>
              </tr>
            ) : ordenados.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-gray-400">
                  Sin registros para los filtros actuales.
                </td>
              </tr>
            ) : (
              ordenados.map((r, i) => (
                <tr key={`${r.nave}|${r.razonSocial}|${r.divisa}|${i}`} className="hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-bold text-[#1f2a4d]">{r.nave}</td>
                  <td className="px-3 py-1.5">{r.parque}</td>
                  <td className="px-3 py-1.5">{r.razonSocial}</td>
                  <td className="px-3 py-1.5 text-center">{r.divisa}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-red-600">
                    {r.pendiente > 0 ? num(r.pendiente) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-green-600">
                    {r.cobrado > 0 ? num(r.cobrado) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.renta > 0 ? num(r.renta) : '—'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.vig > 0 ? num(r.vig) : '—'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.admin > 0 ? num(r.admin) : '—'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.mtto > 0 ? num(r.mtto) : '—'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.otros > 0 ? num(r.otros) : '—'}</td>
                  <td className="px-3 py-1.5 max-w-xs truncate" title={r.nota}>
                    {r.nota || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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
