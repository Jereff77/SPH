import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  pagosApi,
  MESES,
  type PagoRow,
  type ListarPagosParams,
} from './pagos.api';
import { ESTADOS_CXP } from './solicitudes.api';
import { AplicarPagoModal } from './AplicarPagoModal';
import { TransferenciaModal } from './TransferenciaModal';
import { usePagosRealtime } from './usePagosRealtime';
import {
  SortableTh,
  THEAD_STICKY,
  THEAD_TR,
} from '@/components/tabla/SortableTh';
import { ColumnFilter, type OpcionFiltro } from '@/components/tabla/ColumnFilter';
import { useSort, type Accessors } from '@/components/tabla/useSort';
import { useAuth } from '@/features/auth/useAuth';

/** Anchos fijos por columna (px) — el orden coincide con thead/colgroup. */
const COLS_ANCHO = [
  110, 95, 100, 140, 110, 190, 300, 100, 120, 110, 240, 240, 150, 150, 210,
];
const MIN_W = COLS_ANCHO.reduce((a, b) => a + b, 0);

const ACCESSORS: Accessors<PagoRow> = {
  fecSol: (r) => r.fecSolicitud,
  fecAut: (r) => r.fecAutorizacion,
  semana: (r) => r.numSem,
  estado: (r) => r.idEstado,
  folio: (r) => r.folio,
  proveedor: (r) => r.nombreProveedor,
  fecCFDI: (r) => r.fecCFDI,
  monto: (r) => r.total,
  aplicado: (r) => r.montoAplicado,
  concepto: (r) => r.concepto,
  justificacion: (r) => r.justificacion,
  categoria: (r) => r.cuenta,
  clasificacion: (r) => r.seccion,
  solicito: (r) => r.solicitoNombre,
};

const moneda = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const fecha = (iso: string | null): string => {
  if (!iso) return '—';
  const p = (iso.split('T')[0] ?? iso).split('-');
  return p.length === 3 ? `${Number(p[2])}/${Number(p[1])}/${p[0]}` : iso;
};

const esUrl = (u: string | null): u is string => !!u && /^https?:\/\//.test(u);

// Estados que se pueden mostrar/filtrar en la pantalla de pagos.
const ESTADOS_FILTRO = [4, 2, 3, 5, 6, 7, 99];

export function PagarSolicitudesPage() {
  const { tienePermiso } = useAuth();
  const queryClient = useQueryClient();
  const ahora = new Date();
  const [anio, setAnio] = useState(ahora.getFullYear());
  const [mes, setMes] = useState(ahora.getMonth() + 1);
  const [idEstado, setIdEstado] = useState<number | ''>(4);
  const [idProveedor, setIdProveedor] = useState('');
  const [cuenta, setCuenta] = useState('');
  const [seccion, setSeccion] = useState('');
  const [pagarDe, setPagarDe] = useState<PagoRow | null>(null);
  const [verPagoDe, setVerPagoDe] = useState<PagoRow | null>(null);

  const { data: opts } = useQuery({
    queryKey: ['cxp-pagos-filtros'],
    queryFn: () => pagosApi.filtros(),
    staleTime: 5 * 60 * 1000,
  });

  const params: ListarPagosParams = {
    anio,
    mes,
    idEstado: idEstado === '' ? undefined : idEstado,
    idProveedor: idProveedor || undefined,
    cuenta: cuenta || undefined,
    seccion: seccion || undefined,
  };

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['cxp-pagos', params],
    queryFn: () => pagosApi.listar(params),
  });

  // Tiempo real: ante cualquier cambio en cxp (incluso desde v1), refresca.
  const onCambio = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['cxp-pagos'] });
  }, [queryClient]);
  usePagosRealtime(onCambio);

  const filas = data?.filas ?? [];
  const totales = data?.totales ?? { subtotal: 0, total: 0, montoAplicado: 0 };
  const { ordenados, sortKey, dir, toggle } = useSort(filas, ACCESSORS, {
    key: 'fecSol',
    dir: 'desc',
  });

  const cuentas = useMemo(
    () =>
      [...new Set((opts?.categorias ?? []).map((c) => c.cuenta).filter(Boolean))] as string[],
    [opts],
  );
  const secciones = useMemo(
    () =>
      [...new Set((opts?.categorias ?? []).map((c) => c.seccion).filter(Boolean))] as string[],
    [opts],
  );

  const selCls =
    'rounded-lg border px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30';

  // Opciones para los filtros de columna (estilo Excel).
  const optEstado: OpcionFiltro[] = ESTADOS_FILTRO.map((e) => ({
    value: String(e),
    label: ESTADOS_CXP[e]?.etiqueta ?? String(e),
  }));
  const optProveedor: OpcionFiltro[] = (opts?.proveedores ?? []).map((p) => ({
    value: p.idProveedor,
    label: p.razonSocial,
  }));
  const optCuenta: OpcionFiltro[] = cuentas.map((c) => ({ value: c, label: c }));
  const optSeccion: OpcionFiltro[] = secciones.map((s) => ({ value: s, label: s }));

  return (
    <div className="flex h-[calc(100vh-3.5rem-2rem)] flex-col gap-3 md:h-[calc(100vh-3.5rem-3rem)]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">
          Pagar solicitudes
        </h1>
        <div className="flex items-center gap-2">
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className={selCls}>
            {(opts?.anios?.length ? opts.anios : [anio]).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className={selCls}>
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          {tienePermiso(402) && (
            <AprobadosSinPagoBtn mes={mes} anio={anio} onDone={() => refetch()} />
          )}
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
          No se pudieron cargar los pagos.
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
              <SortableTh>Documentos</SortableTh>
              <SortableTh campo="fecSol" sortKey={sortKey} dir={dir} onSort={toggle}>Fecha Sol.</SortableTh>
              <SortableTh campo="fecAut" sortKey={sortKey} dir={dir} onSort={toggle}>Fecha Autoriz.</SortableTh>
              <SortableTh campo="semana" sortKey={sortKey} dir={dir} onSort={toggle}>Semana</SortableTh>
              <SortableTh
                campo="estado"
                sortKey={sortKey}
                dir={dir}
                onSort={toggle}
                filtro={
                  <ColumnFilter
                    opciones={optEstado}
                    valor={idEstado === '' ? '' : String(idEstado)}
                    onChange={(v) => setIdEstado(v === '' ? '' : Number(v))}
                    ancho={190}
                  />
                }
              >
                Estado
              </SortableTh>
              <SortableTh campo="folio" sortKey={sortKey} dir={dir} onSort={toggle}>Folio</SortableTh>
              <SortableTh
                campo="proveedor"
                sortKey={sortKey}
                dir={dir}
                onSort={toggle}
                filtro={
                  <ColumnFilter
                    opciones={optProveedor}
                    valor={idProveedor}
                    onChange={setIdProveedor}
                    ancho={300}
                  />
                }
              >
                Proveedor
              </SortableTh>
              <SortableTh campo="fecCFDI" sortKey={sortKey} dir={dir} onSort={toggle}>Fecha CFDI</SortableTh>
              <SortableTh campo="monto" sortKey={sortKey} dir={dir} onSort={toggle} align="right">Monto</SortableTh>
              <SortableTh campo="aplicado" sortKey={sortKey} dir={dir} onSort={toggle} align="right">M. aplicado</SortableTh>
              <SortableTh campo="concepto" sortKey={sortKey} dir={dir} onSort={toggle}>Concepto</SortableTh>
              <SortableTh campo="justificacion" sortKey={sortKey} dir={dir} onSort={toggle}>Justificación</SortableTh>
              <SortableTh
                campo="categoria"
                sortKey={sortKey}
                dir={dir}
                onSort={toggle}
                filtro={
                  <ColumnFilter
                    opciones={optCuenta}
                    valor={cuenta}
                    onChange={setCuenta}
                    ancho={200}
                  />
                }
              >
                Categoría
              </SortableTh>
              <SortableTh
                campo="clasificacion"
                sortKey={sortKey}
                dir={dir}
                onSort={toggle}
                filtro={
                  <ColumnFilter
                    opciones={optSeccion}
                    valor={seccion}
                    onChange={setSeccion}
                    ancho={200}
                  />
                }
              >
                Clasificación
              </SortableTh>
              <SortableTh campo="solicito" sortKey={sortKey} dir={dir} onSort={toggle}>Solicitó / Autorizó</SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td colSpan={15} className="px-3 py-6 text-center text-gray-400">Cargando…</td>
              </tr>
            )}
            {!isLoading && ordenados.length === 0 && (
              <tr>
                <td colSpan={15} className="px-3 py-6 text-center text-xs text-gray-300">
                  Sin registros para los filtros seleccionados.
                </td>
              </tr>
            )}
            {ordenados.map((r) => (
              <Fila
                key={r.idCxp}
                r={r}
                onPagar={() => setPagarDe(r)}
                onVerPago={() => setVerPagoDe(r)}
              />
            ))}
          </tbody>
          {ordenados.length > 0 && (
            <tfoot className="sticky bottom-0 z-10">
              <tr className="border-t-2 bg-gray-100 text-sm font-semibold text-gray-700 [&>td]:bg-gray-100">
                <td className="px-3 py-2" colSpan={8}>Totales ({ordenados.length})</td>
                <td className="px-3 py-2 text-right tabular-nums">{moneda(totales.total)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{moneda(totales.montoAplicado)}</td>
                <td colSpan={5} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {pagarDe && (
        <AplicarPagoModal
          solicitud={pagarDe}
          onClose={() => setPagarDe(null)}
          onPagada={() => {
            setPagarDe(null);
            void refetch();
          }}
        />
      )}
      {verPagoDe && (
        <TransferenciaModal
          solicitud={verPagoDe}
          puedeDesaplicar={tienePermiso(401)}
          onClose={() => setVerPagoDe(null)}
          onDesaplicada={() => {
            setVerPagoDe(null);
            void refetch();
          }}
        />
      )}
    </div>
  );
}

function Fila({
  r,
  onPagar,
  onVerPago,
}: {
  r: PagoRow;
  onPagar: () => void;
  onVerPago: () => void;
}) {
  const est = r.idEstado != null ? ESTADOS_CXP[r.idEstado] : undefined;
  const pagada = !!r.idMovBancarios || r.idEstado === 6 || r.idEstado === 7;
  const pagable = r.idEstado === 4 && !pagada;

  return (
    <tr className="hover:bg-gray-50">
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
      <td className="px-3 py-2 text-gray-600">{fecha(r.fecSolicitud)}</td>
      <td className="px-3 py-2 text-gray-600">{fecha(r.fecAutorizacion)}</td>
      <td className="px-3 py-2 text-gray-500">{r.rangoSemana ?? '—'}</td>
      <td className="px-3 py-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${est?.clase ?? 'bg-gray-100 text-gray-500'}`}>
          {est?.etiqueta ?? r.estado ?? r.idEstado ?? '—'}
        </span>
      </td>
      <td className="max-w-[160px] truncate px-3 py-2 font-mono text-[11px] text-gray-500" title={r.folio ?? ''}>{r.folio ?? '—'}</td>
      <td className="px-3 py-2">
        <div className="flex items-start gap-2">
          {pagable && (
            <button
              onClick={onPagar}
              title="Aplicar pago"
              className="mt-0.5 shrink-0 rounded bg-green-50 px-1.5 py-0.5 text-sm text-green-700 hover:bg-green-100"
            >
              💵
            </button>
          )}
          {pagada && (
            <button
              onClick={onVerPago}
              title="Ver pago / transferencia"
              className="mt-0.5 shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-sm text-blue-700 hover:bg-blue-100"
            >
              🏦
            </button>
          )}
          <span className="font-medium text-gray-800">{r.nombreProveedor ?? '—'}</span>
        </div>
      </td>
      <td className="px-3 py-2 text-gray-600">{fecha(r.fecCFDI)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-gray-700">{moneda(r.total)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-gray-600">{moneda(r.montoAplicado)}</td>
      <td className="max-w-[240px] truncate px-3 py-2 text-gray-600" title={r.concepto ?? ''}>{r.concepto ?? '—'}</td>
      <td className="max-w-[220px] truncate px-3 py-2 text-gray-600" title={r.justificacion ?? ''}>{r.justificacion ?? '—'}</td>
      <td className="px-3 py-2 text-gray-600">{r.cuenta ?? '—'}</td>
      <td className="px-3 py-2 text-gray-600">{r.seccion ?? '—'}</td>
      <td className="px-3 py-2 text-xs text-gray-600">
        <div><span className="text-gray-400">Sol:</span> {r.solicitoNombre ?? '—'}</div>
        <div><span className="text-gray-400">Aut:</span> {r.autorizoNombre ?? '—'}</div>
      </td>
    </tr>
  );
}

function AprobadosSinPagoBtn({
  mes,
  anio,
  onDone,
}: {
  mes: number;
  anio: number;
  onDone: () => void;
}) {
  const [cargando, setCargando] = useState(false);
  return (
    <button
      disabled={cargando}
      onClick={async () => {
        if (!window.confirm('¿Marcar como "Aprobado sin pago aplicado" las solicitudes del mes?')) return;
        setCargando(true);
        try {
          await pagosApi.aprobadosSinPago(mes, anio);
          onDone();
        } finally {
          setCargando(false);
        }
      }}
      title="Aprobados sin pago aplicado (mes)"
      className="rounded-lg bg-[#1f2a4d] px-2.5 py-1.5 text-sm font-medium text-white hover:bg-[#172039] disabled:opacity-50"
    >
      {cargando ? '…' : '✨'}
    </button>
  );
}
