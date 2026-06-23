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
import { ComentariosSolicitudModal } from './ComentariosSolicitudModal';
import { usePagosRealtime } from './usePagosRealtime';
import {
  SortableTh,
  THEAD_STICKY,
  THEAD_TR,
} from '@/components/tabla/SortableTh';
import { FiltroColumnaOpciones } from '@/components/tabla/FiltroColumnaOpciones';
import { useSort, type Accessors } from '@/components/tabla/useSort';
import { useAuth } from '@/features/auth/useAuth';
import { MultiSearchSelect } from '@/components/MultiSearchSelect';

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

/** Etiqueta de estado de una fila (para el filtro de columna por valor visible). */
const estadoLabel = (r: PagoRow) =>
  r.idEstado != null ? (ESTADOS_CXP[r.idEstado]?.etiqueta ?? String(r.idEstado)) : '';

export function PagarSolicitudesPage() {
  const { tienePermiso } = useAuth();
  const queryClient = useQueryClient();
  const ahora = new Date();
  const [anios, setAnios] = useState<number[]>([ahora.getFullYear()]);
  const [meses, setMeses] = useState<number[]>([ahora.getMonth() + 1]);
  // Filtros de columna multi-selección (client-side — regla de diseño 7c).
  // El estado arranca en "Aprobado" (equivale al default idEstado=4 de antes).
  const [estadoSel, setEstadoSel] = useState<Set<string>>(
    () => new Set([ESTADOS_CXP[4]?.etiqueta ?? 'Aprobado']),
  );
  const [proveedorSel, setProveedorSel] = useState<Set<string>>(new Set());
  const [categoriaSel, setCategoriaSel] = useState<Set<string>>(new Set());
  const [clasifSel, setClasifSel] = useState<Set<string>>(new Set());
  const [pagarDe, setPagarDe] = useState<PagoRow | null>(null);
  const [verPagoDe, setVerPagoDe] = useState<PagoRow | null>(null);
  const [comentariosDe, setComentariosDe] = useState<PagoRow | null>(null);

  const { data: opts } = useQuery({
    queryKey: ['cxp-pagos-filtros'],
    queryFn: () => pagosApi.filtros(),
    staleTime: 5 * 60 * 1000,
  });

  // Se carga el periodo completo (todos los estados); los filtros de columna
  // (Estado/Proveedor/Categoría/Clasificación) se aplican en cliente.
  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['cxp-pagos', anios, meses],
    queryFn: () => pagosApi.listar({ anio: anios, mes: meses } satisfies ListarPagosParams),
  });

  // Tiempo real: ante cualquier cambio en cxp (incluso desde v1), refresca.
  const onCambio = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['cxp-pagos'] });
  }, [queryClient]);
  usePagosRealtime(onCambio);

  const filas = useMemo(() => data?.filas ?? [], [data]);

  // Opciones de los filtros de columna (valores presentes en el periodo cargado).
  const optEstado = useMemo(() => {
    const presentes = new Set(filas.map((r) => r.idEstado));
    return ESTADOS_FILTRO.filter((e) => presentes.has(e)).map(
      (e) => ESTADOS_CXP[e]?.etiqueta ?? String(e),
    );
  }, [filas]);
  const optProveedor = useMemo(
    () => [...new Set(filas.map((r) => r.nombreProveedor ?? '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [filas],
  );
  const optCategoria = useMemo(
    () => [...new Set(filas.map((r) => r.cuenta ?? '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [filas],
  );
  const optClasif = useMemo(
    () => [...new Set(filas.map((r) => r.seccion ?? '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [filas],
  );

  const filtradas = useMemo(
    () =>
      filas.filter((r) => {
        if (estadoSel.size > 0 && !estadoSel.has(estadoLabel(r))) return false;
        if (proveedorSel.size > 0 && !proveedorSel.has(r.nombreProveedor ?? '')) return false;
        if (categoriaSel.size > 0 && !categoriaSel.has(r.cuenta ?? '')) return false;
        if (clasifSel.size > 0 && !clasifSel.has(r.seccion ?? '')) return false;
        return true;
      }),
    [filas, estadoSel, proveedorSel, categoriaSel, clasifSel],
  );

  const { ordenados, sortKey, dir, toggle } = useSort(filtradas, ACCESSORS, {
    key: 'fecSol',
    dir: 'desc',
  });

  // Totales del pie sobre lo filtrado (cuadran con la tabla).
  const totales = useMemo(
    () =>
      filtradas.reduce(
        (t, r) => {
          t.total += r.total ?? 0;
          t.montoAplicado += r.montoAplicado ?? 0;
          return t;
        },
        { total: 0, montoAplicado: 0 },
      ),
    [filtradas],
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem-2rem)] flex-col gap-3 md:h-[calc(100vh-3.5rem-3rem)]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">
          Pagar solicitudes
        </h1>
        <div className="flex items-center gap-2">
          <MultiSearchSelect
            values={anios.map(String)}
            onChange={(vs) => setAnios(vs.map(Number))}
            options={(opts?.anios?.length ? opts.anios : anios).map((a) => ({ value: String(a), label: String(a) }))}
            ordenarAlfabetico={false}
            placeholder="Todos los años"
          />
          <MultiSearchSelect
            values={meses.map(String)}
            onChange={(vs) => setMeses(vs.map(Number))}
            options={MESES.map((m, i) => ({ value: String(i + 1), label: m }))}
            ordenarAlfabetico={false}
            placeholder="Todos los meses"
          />
          {tienePermiso(402) && (
            <AprobadosSinPagoBtn
              mes={meses[0] ?? (new Date().getMonth() + 1)}
              anio={anios[0] ?? new Date().getFullYear()}
              onDone={() => refetch()}
            />
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
                  <FiltroColumnaOpciones
                    etiqueta="Estado" opciones={optEstado}
                    seleccion={estadoSel} onChange={setEstadoSel}
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
                  <FiltroColumnaOpciones
                    etiqueta="Proveedor" opciones={optProveedor}
                    seleccion={proveedorSel} onChange={setProveedorSel}
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
                  <FiltroColumnaOpciones
                    etiqueta="Categoría" opciones={optCategoria}
                    seleccion={categoriaSel} onChange={setCategoriaSel}
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
                  <FiltroColumnaOpciones
                    etiqueta="Clasificación" opciones={optClasif}
                    seleccion={clasifSel} onChange={setClasifSel}
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
                onComentarios={() => setComentariosDe(r)}
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
      {comentariosDe && (
        <ComentariosSolicitudModal
          idCxp={comentariosDe.idCxp}
          titulo={`${comentariosDe.nombreProveedor ?? comentariosDe.nomCFDI ?? 'Solicitud'}${
            comentariosDe.folio ? ` · ${comentariosDe.folio}` : ''
          }`}
          queryKey={['cxp-pagos-comentarios', comentariosDe.idCxp]}
          fetcher={pagosApi.comentarios}
          onClose={() => setComentariosDe(null)}
        />
      )}
    </div>
  );
}

function Fila({
  r,
  onPagar,
  onVerPago,
  onComentarios,
}: {
  r: PagoRow;
  onPagar: () => void;
  onVerPago: () => void;
  onComentarios: () => void;
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
          <button
            type="button"
            onClick={onComentarios}
            title={
              r.tieneRespuestaGerente
                ? 'Ver comentarios del aprobador (rechazo/regreso)'
                : 'Ver comentarios'
            }
            className={`relative text-sm leading-none ${
              r.tieneRespuestaGerente
                ? 'text-amber-600 hover:text-amber-700'
                : 'text-gray-400 hover:text-[#1f2a4d]'
            }`}
          >
            💬
            {r.tieneRespuestaGerente && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-1 ring-white" />
            )}
          </button>
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
