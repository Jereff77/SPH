import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  pendientesApi,
  ESTADOS_FILTRO,
  type PendienteCxP,
} from './pendientes.api';
import { ESTADOS_CXP } from './solicitudes.api';
import { ApiRequestError } from '@/lib/api';
import { useSort, type Accessors } from '@/components/tabla/useSort';
import {
  SortableTh,
  THEAD_STICKY,
  THEAD_TR,
} from '@/components/tabla/SortableTh';

/** Normaliza para buscar sin acentos ni mayúsculas. */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const moneda = (n: number, m = 'MXN') =>
  n.toLocaleString('es-MX', { style: 'currency', currency: m || 'MXN' });

function fecha(iso: string | null): string {
  if (!iso) return '—';
  const p = (iso.split('T')[0] ?? iso).split('-');
  if (p.length < 3) return iso;
  return `${Number(p[2])}/${Number(p[1])}/${p[0]}`;
}

const esUrl = (u: string | null): u is string => !!u && /^https?:\/\//.test(u);

export function PendientesPage() {
  const queryClient = useQueryClient();
  const anioActual = new Date().getFullYear();
  const mesActual = new Date().getMonth() + 1;
  const [anio, setAnio] = useState<number | ''>('');
  const [mes, setMes] = useState<number | ''>(mesActual);
  const [idEstado, setIdEstado] = useState<number | ''>('');
  const [numSem, setNumSem] = useState<number | ''>('');
  const [uidGerente, setUidGerente] = useState('');
  const [busca, setBusca] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: anios = [] } = useQuery({
    queryKey: ['cxp-pend-anios'],
    queryFn: () => pendientesApi.anios(),
  });
  const { data: responsables = [] } = useQuery({
    queryKey: ['cxp-pend-responsables'],
    queryFn: () => pendientesApi.responsables(),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (anio === '' && anios.length > 0) {
      setAnio(anios.includes(anioActual) ? anioActual : anios[0]!);
    }
  }, [anios, anio, anioActual]);

  const filtros = { anio: anio || undefined, mes: mes || undefined, idEstado: idEstado === '' ? undefined : idEstado, numSem: numSem || undefined, uidGerente: uidGerente || undefined };
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['cxp-pendientes', anio, mes, idEstado, numSem, uidGerente],
    queryFn: () => pendientesApi.listar(filtros),
    enabled: anio !== '',
  });

  const invalidar = () =>
    queryClient.invalidateQueries({ queryKey: ['cxp-pendientes'] });
  const onErr = (e: unknown) =>
    setError(e instanceof ApiRequestError ? e.message : 'Ocurrió un error.');

  const mResponsable = useMutation({
    mutationFn: ({ id, uid }: { id: string; uid: string }) =>
      pendientesApi.cambiarResponsable(id, uid),
    onMutate: async ({ id, uid }) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: ['cxp-pendientes'] });
      const key = ['cxp-pendientes', anio, mes, idEstado, numSem, uidGerente];
      const prev = queryClient.getQueryData<PendienteCxP[]>(key);
      queryClient.setQueryData<PendienteCxP[]>(key, (old) =>
        old?.map((r) => (r.idCxp === id ? { ...r, uidGerente: uid } : r)),
      );
      return { prev, key };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
      onErr(e);
    },
    onSettled: () => invalidar(),
  });

  const mDevolver = useMutation({
    mutationFn: (id: string) => pendientesApi.devolver(id),
    onSuccess: () => {
      setError(null);
      invalidar();
    },
    onError: onErr,
  });

  // Semanas presentes en los resultados (para el filtro). Se basa en todos los
  // resultados del query (no en el texto buscado).
  const semanas = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of data) if (r.numSem != null) m.set(r.numSem, r.rangoSemana ?? `Sem ${r.numSem}`);
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [data]);

  // Buscador por Nombre CFDI, Solicitado por, Cuenta y Clasificación (Sección).
  const filtrados = useMemo(() => {
    const q = norm(busca);
    if (!q) return data;
    return data.filter((r) =>
      [r.nomCFDI, r.nombreProveedor, r.nomSolicitante, r.cuenta, r.seccion]
        .filter(Boolean)
        .some((v) => norm(String(v)).includes(q)),
    );
  }, [data, busca]);

  // Ordenamiento por columnas (regla de diseño 7).
  const accessors = useMemo<Accessors<PendienteCxP>>(
    () => ({
      estado: (r) => r.idEstado,
      fechaSol: (r) => r.fecSolicitud,
      semana: (r) => r.numSem,
      folio: (r) => r.folio,
      nomCFDI: (r) => r.nomCFDI || r.nombreProveedor,
      fechaCFDI: (r) => r.fecCFDI,
      concepto: (r) => r.concepto,
      monto: (r) => (idEstado === 6 ? r.montoAplicado : r.total),
      cuenta: (r) => r.cuenta,
      seccion: (r) => r.seccion,
      solicitante: (r) => r.nomSolicitante,
    }),
    [idEstado],
  );
  const { ordenados, sortKey, dir, toggle } = useSort(filtrados, accessors);

  const totalMostrado = useMemo(
    () =>
      filtrados.reduce(
        (acc, r) => acc + (idEstado === 6 ? r.montoAplicado || 0 : r.total || 0),
        0,
      ),
    [filtrados, idEstado],
  );

  const selCls =
    'rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">
          Solicitudes pendientes
        </h1>
        <span className="text-sm text-gray-500">
          {filtrados.length}
          {busca && filtrados.length !== data.length ? ` de ${data.length}` : ''}{' '}
          solicitudes · Total{' '}
          <strong className="text-gray-700">{moneda(totalMostrado)}</strong>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className={selCls}>
          {anios.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select value={mes} onChange={(e) => setMes(e.target.value ? Number(e.target.value) : '')} className={selCls}>
          <option value="">Todos los meses</option>
          {MESES.map((nom, i) => (
            <option key={nom} value={i + 1}>{nom}</option>
          ))}
        </select>
        <select value={idEstado} onChange={(e) => setIdEstado(e.target.value === '' ? '' : Number(e.target.value))} className={selCls}>
          <option value="">Todos los estados</option>
          {ESTADOS_FILTRO.map((e) => (
            <option key={e.id} value={e.id}>{e.etiqueta}</option>
          ))}
        </select>
        <select value={numSem} onChange={(e) => setNumSem(e.target.value ? Number(e.target.value) : '')} className={selCls}>
          <option value="">Todas las semanas</option>
          {semanas.map(([n, etq]) => (
            <option key={n} value={n}>{etq}</option>
          ))}
        </select>
        <select value={uidGerente} onChange={(e) => setUidGerente(e.target.value)} className={selCls}>
          <option value="">Todos los responsables</option>
          {responsables.map((r) => (
            <option key={r.uid} value={r.uid}>{r.nombre}</option>
          ))}
        </select>
        <div className="relative min-w-[18rem] flex-1">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por CFDI, solicitante, cuenta o clasificación…"
            className={`${selCls} w-full pr-8`}
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {(error || isError) && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error ?? 'No se pudieron cargar las solicitudes.'}
        </div>
      )}

      <div className="max-h-[calc(100vh-14rem)] overflow-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[1500px] text-sm">
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <SortableTh>Acciones</SortableTh>
              <SortableTh campo="estado" sortKey={sortKey} dir={dir} onSort={toggle}>Estado</SortableTh>
              <SortableTh campo="fechaSol" sortKey={sortKey} dir={dir} onSort={toggle}>Fecha sol.</SortableTh>
              <SortableTh campo="semana" sortKey={sortKey} dir={dir} onSort={toggle}>Semana</SortableTh>
              <SortableTh campo="folio" sortKey={sortKey} dir={dir} onSort={toggle}>Folio</SortableTh>
              <SortableTh campo="nomCFDI" sortKey={sortKey} dir={dir} onSort={toggle}>Nombre CFDI</SortableTh>
              <SortableTh campo="fechaCFDI" sortKey={sortKey} dir={dir} onSort={toggle}>Fecha CFDI</SortableTh>
              <SortableTh campo="concepto" sortKey={sortKey} dir={dir} onSort={toggle}>Concepto</SortableTh>
              <SortableTh campo="monto" align="right" sortKey={sortKey} dir={dir} onSort={toggle}>Monto</SortableTh>
              <SortableTh campo="cuenta" sortKey={sortKey} dir={dir} onSort={toggle}>Cuenta</SortableTh>
              <SortableTh campo="seccion" sortKey={sortKey} dir={dir} onSort={toggle}>Sección</SortableTh>
              <SortableTh campo="solicitante" sortKey={sortKey} dir={dir} onSort={toggle}>Solicitado por</SortableTh>
              <SortableTh>Responsable</SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr><td colSpan={13} className="px-3 py-6 text-center text-gray-400">Cargando…</td></tr>
            )}
            {!isLoading && ordenados.length === 0 && (
              <tr><td colSpan={13} className="px-3 py-6 text-center text-gray-400">
                {busca ? 'Sin coincidencias para la búsqueda.' : 'Sin solicitudes para los filtros.'}
              </td></tr>
            )}
            {ordenados.map((r) => {
              const est = r.idEstado != null ? ESTADOS_CXP[r.idEstado] : undefined;
              const devolvible = (r.idEstado ?? 0) > 1 && (r.idEstado ?? 0) <= 4;
              return (
                <tr key={r.idCxp} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!devolvible || mDevolver.isPending}
                        onClick={() => {
                          if (window.confirm('¿Devolver la solicitud a Guardado?'))
                            mDevolver.mutate(r.idCxp);
                        }}
                        title={devolvible ? 'Devolver a Guardado' : 'No aplica'}
                        className={devolvible ? 'text-orange-500 hover:text-orange-700' : 'cursor-not-allowed text-gray-300'}
                      >
                        ↩
                      </button>
                      {esUrl(r.urlCFDI) ? (
                        <a href={r.urlCFDI} target="_blank" rel="noreferrer" title="PDF" className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600 hover:bg-red-100">PDF</a>
                      ) : null}
                      {esUrl(r.urlXLM) ? (
                        <a href={r.urlXLM} target="_blank" rel="noreferrer" title="XML" className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 hover:bg-amber-100">XML</a>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${est?.clase ?? 'bg-gray-100 text-gray-500'}`}>
                      {est?.etiqueta ?? r.estado ?? r.idEstado ?? '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{fecha(r.fecSolicitud)}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{r.rangoSemana ?? `Sem ${r.numSem ?? '—'}`}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">{r.folio ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-700">{r.nomCFDI || r.nombreProveedor || '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{fecha(r.fecCFDI)}</td>
                  <td className="max-w-[280px] truncate px-3 py-2 text-gray-600" title={r.concepto ?? ''}>{r.concepto ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700">{moneda(r.total, r.moneda)}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{r.cuenta ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{r.seccion ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{r.nomSolicitante ?? '—'}</td>
                  <td className="px-3 py-2">
                    <select
                      value={r.uidGerente ?? ''}
                      disabled={mResponsable.isPending}
                      onChange={(e) =>
                        mResponsable.mutate({ id: r.idCxp, uid: e.target.value })
                      }
                      className="w-48 rounded-md border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
                      title="Cambiar responsable de esta solicitud"
                    >
                      {/* Conserva el responsable actual si no está en la lista activa. */}
                      {!responsables.some((u) => u.uid === r.uidGerente) && (
                        <option value={r.uidGerente ?? ''}>{r.nomGerente ?? '—'}</option>
                      )}
                      {responsables.map((u) => (
                        <option key={u.uid} value={u.uid}>{u.nombre}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
