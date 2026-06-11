import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, type TabDef } from '@/components/Tabs';
import { useSort } from '@/components/tabla/useSort';
import { SortableTh, THEAD_STICKY, THEAD_TR } from '@/components/tabla/SortableTh';
import {
  arrendatariosApi,
  fechaCorta,
  type CancelacionReporteRow,
} from './arrendatarios.api';
import { exportarCSV, exportarPDF } from './reportes-arre-export';

const TABS: TabDef[] = [{ id: 'cancelaciones', label: 'Cancelaciones Anticipadas' }];

export function ReportesArrePage() {
  const [tab, setTab] = useState('cancelaciones');
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-gray-800">Arrendatarios · Reportes</h1>
      <Tabs tabs={TABS} activo={tab} onChange={setTab} />
      <div className="pt-2">{tab === 'cancelaciones' && <CancelacionesTab />}</div>
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
