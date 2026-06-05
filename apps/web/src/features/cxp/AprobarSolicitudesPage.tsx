import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  aprobarApi,
  ESTADOS_APROBAR,
  type SolicitudAprobar,
} from './aprobar.api';
import { ESTADOS_CXP } from './solicitudes.api';
import { AprobarSolicitudModal, type AccionAprobar } from './AprobarSolicitudModal';
import { useCxpRealtime } from './useCxpRealtime';
import {
  SortableTh,
  THEAD_STICKY,
  THEAD_TR,
} from '@/components/tabla/SortableTh';
import { ColumnFilter, type OpcionFiltro } from '@/components/tabla/ColumnFilter';
import { useSort, type Accessors } from '@/components/tabla/useSort';

const moneda = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const fecha = (iso: string | null): string => {
  if (!iso) return '—';
  const p = (iso.split('T')[0] ?? iso).split('-');
  return p.length === 3 ? `${Number(p[2])}/${Number(p[1])}/${p[0]}` : iso;
};
const esUrl = (u: string | null): u is string => !!u && /^https?:\/\//.test(u);

const COLS_ANCHO = [120, 100, 140, 220, 150, 100, 120, 240, 220, 180, 190];
const MIN_W = COLS_ANCHO.reduce((a, b) => a + b, 0);

const ACCESSORS: Accessors<SolicitudAprobar> = {
  nombre: (r) => r.nombreProveedor ?? r.nomCFDI,
  folio: (r) => r.folio,
  fecCFDI: (r) => r.fecCFDI,
  monto: (r) => r.total,
  concepto: (r) => r.concepto,
  justificacion: (r) => r.justificacion,
  cuenta: (r) => r.cuenta,
  solicitado: (r) => r.solicitadoPor,
};

const OPT_ESTADO: OpcionFiltro[] = ESTADOS_APROBAR.map((e) => ({
  value: String(e.value),
  label: e.label,
}));

export function AprobarSolicitudesPage() {
  const queryClient = useQueryClient();
  const [idEstado, setIdEstado] = useState(2);
  const [busqueda, setBusqueda] = useState('');
  const [accionDe, setAccionDe] = useState<{
    solicitud: SolicitudAprobar;
    accion: AccionAprobar;
  } | null>(null);

  const { data = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['aprobar', idEstado],
    queryFn: () => aprobarApi.listar(idEstado),
  });

  const onCambio = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['aprobar'] });
  }, [queryClient]);
  useCxpRealtime('/cxp/aprobar/stream', onCambio);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return data;
    return data.filter((r) =>
      [
        r.nombreProveedor,
        r.nomCFDI,
        r.concepto,
        r.justificacion,
        r.cuenta,
        r.solicitadoPor,
      ]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }, [data, busqueda]);

  const { ordenados, sortKey, dir, toggle } = useSort(filtradas, ACCESSORS, {
    key: 'fecCFDI',
    dir: 'desc',
  });

  return (
    <div className="flex h-[calc(100vh-3.5rem-2rem)] flex-col gap-3 md:h-[calc(100vh-3.5rem-3rem)]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">
          Aprobar Solicitudes
        </h1>
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar proveedor, concepto, justificación, cuenta, solicitante…"
            className="w-80 max-w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
          />
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refrescar"
            className="rounded-lg border px-2.5 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {isFetching ? '↻…' : '↻'}
          </button>
        </div>
      </div>

      {isError && (
        <div className="shrink-0 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudieron cargar las solicitudes.
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border bg-white shadow-sm">
        <table className="table-fixed text-sm" style={{ minWidth: `${MIN_W}px` }}>
          <colgroup>
            {COLS_ANCHO.map((w, i) => (
              <col key={i} style={{ width: `${w}px` }} />
            ))}
          </colgroup>
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <SortableTh>Acciones</SortableTh>
              <SortableTh>Documentos</SortableTh>
              <SortableTh
                filtro={
                  <ColumnFilter
                    opciones={OPT_ESTADO}
                    valor={String(idEstado)}
                    onChange={(v) => setIdEstado(v === '' ? 2 : Number(v))}
                    ancho={170}
                  />
                }
              >
                Estado
              </SortableTh>
              <SortableTh campo="nombre" sortKey={sortKey} dir={dir} onSort={toggle}>Nombre</SortableTh>
              <SortableTh campo="folio" sortKey={sortKey} dir={dir} onSort={toggle}>Folio</SortableTh>
              <SortableTh campo="fecCFDI" sortKey={sortKey} dir={dir} onSort={toggle}>Fecha CFDI</SortableTh>
              <SortableTh campo="monto" sortKey={sortKey} dir={dir} onSort={toggle} align="right">Monto</SortableTh>
              <SortableTh campo="concepto" sortKey={sortKey} dir={dir} onSort={toggle}>Concepto</SortableTh>
              <SortableTh campo="justificacion" sortKey={sortKey} dir={dir} onSort={toggle}>Justificación</SortableTh>
              <SortableTh campo="cuenta" sortKey={sortKey} dir={dir} onSort={toggle}>Cuenta / Clasif.</SortableTh>
              <SortableTh campo="solicitado" sortKey={sortKey} dir={dir} onSort={toggle}>Solicitado por</SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr><td colSpan={11} className="px-3 py-6 text-center text-gray-400">Cargando…</td></tr>
            )}
            {!isLoading && ordenados.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-xs text-gray-300">
                  Sin solicitudes en esta etapa.
                </td>
              </tr>
            )}
            {ordenados.map((r) => (
              <Fila key={r.idCxp} r={r} onAccion={(accion) => setAccionDe({ solicitud: r, accion })} />
            ))}
          </tbody>
        </table>
      </div>

      {accionDe && (
        <AprobarSolicitudModal
          solicitud={accionDe.solicitud}
          accion={accionDe.accion}
          onClose={() => setAccionDe(null)}
          onHecho={() => {
            setAccionDe(null);
            void refetch();
          }}
        />
      )}
    </div>
  );
}

function Fila({
  r,
  onAccion,
}: {
  r: SolicitudAprobar;
  onAccion: (a: AccionAprobar) => void;
}) {
  const est = r.idEstado != null ? ESTADOS_CXP[r.idEstado] : undefined;
  const procesable = r.idEstado === 2; // Enviado
  const btn = (activo: boolean) =>
    activo ? 'hover:opacity-80' : 'cursor-not-allowed text-gray-300';

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2 text-base">
          <button disabled={!procesable} onClick={() => onAccion('regresar')} title="Regresar al solicitante" className={`text-[#3f5b87] ${btn(procesable)}`}>↩</button>
          <button disabled={!procesable} onClick={() => onAccion('rechazar')} title="Rechazar (refacturar)" className={`text-red-500 ${btn(procesable)}`}>🗑</button>
          <button disabled={!procesable} onClick={() => onAccion('aprobar')} title="Aprobar" className={`text-green-600 ${btn(procesable)}`}>✔</button>
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          {esUrl(r.urlCFDI) && (
            <a href={r.urlCFDI} target="_blank" rel="noreferrer" title="PDF" className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600 hover:bg-red-100">PDF</a>
          )}
          {esUrl(r.urlXLM) && (
            <a href={r.urlXLM} target="_blank" rel="noreferrer" title="XML" className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 hover:bg-amber-100">XML</a>
          )}
          {!esUrl(r.urlCFDI) && !esUrl(r.urlXLM) && <span className="text-gray-300">—</span>}
        </div>
      </td>
      <td className="px-3 py-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${est?.clase ?? 'bg-gray-100 text-gray-500'}`}>
          {est?.etiqueta ?? r.estado ?? r.idEstado ?? '—'}
        </span>
        {r.autorizadoFP && (
          <span className="mt-1 block text-[10px] font-semibold uppercase text-amber-600" title="Aprobado fuera de presupuesto">
            Fuera de presup.
          </span>
        )}
      </td>
      <td className="px-3 py-2 font-medium text-gray-800">{r.nombreProveedor ?? r.nomCFDI ?? '—'}</td>
      <td className="max-w-[150px] truncate px-3 py-2 font-mono text-[11px] text-gray-500" title={r.folio ?? ''}>{r.folio ?? '—'}</td>
      <td className="px-3 py-2 text-gray-600">{fecha(r.fecCFDI)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-gray-700">{moneda(r.total)}</td>
      <td className="max-w-[240px] truncate px-3 py-2 text-gray-600" title={r.concepto ?? ''}>{r.concepto ?? '—'}</td>
      <td className="max-w-[220px] truncate px-3 py-2 text-gray-600" title={r.justificacion ?? ''}>{r.justificacion ?? '—'}</td>
      <td className="px-3 py-2 text-gray-600">{[r.cuenta, r.seccion].filter(Boolean).join(' / ') || '—'}</td>
      <td className="px-3 py-2 text-gray-600">{r.solicitadoPor ?? '—'}</td>
    </tr>
  );
}
