import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parametrosApi, type InpcItem } from './parametros.api';
import { incrementosApi } from '@/features/arrendatarios/incrementos.api';
import { IncrementosPreviewModal } from '@/features/arrendatarios/IncrementosPreviewModal';
import {
  SortableTh,
  THEAD_STICKY,
  THEAD_TR,
} from '@/components/tabla/SortableTh';
import { useSort, type Accessors } from '@/components/tabla/useSort';
import { ApiRequestError } from '@/lib/api';

const QKEY = ['inpc'];

const ACCESSORS_INPC: Accessors<InpcItem> = {
  periodo: (r) => r.id,
  anio: (r) => r.anio,
  mes: (r) => r.mes,
  inpc: (r) => r.inpc,
};

export function InpcTab() {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<number | null>(null);
  const [anio, setAnio] = useState('');
  const [mes, setMes] = useState('');
  const [inpc, setInpc] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  /** idInpc con la vista previa de incrementos abierta (tras guardar o manual). */
  const [previewDe, setPreviewDe] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: QKEY,
    queryFn: () => parametrosApi.listarInpc(),
  });

  // Banner de pendientes: ¿el INPC más reciente tiene incrementos sin aplicar?
  const masReciente = useMemo(() => {
    if (!data.length) return null;
    return [...data].sort((a, b) => b.anio * 100 + b.mes - (a.anio * 100 + a.mes))[0] ?? null;
  }, [data]);
  const { data: pendientes } = useQuery({
    queryKey: ['incrementos-preview', masReciente?.id],
    queryFn: () => incrementosApi.preview(masReciente!.id),
    enabled: !!masReciente,
    staleTime: 60_000,
  });

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        (r.nota ?? '').toLowerCase().includes(q),
    );
  }, [data, busqueda]);

  const { ordenados, sortKey, dir, toggle } = useSort(
    filtrados,
    ACCESSORS_INPC,
    { key: 'periodo', dir: 'desc' },
  );

  const reset = () => {
    setEditando(null);
    setAnio('');
    setMes('');
    setInpc('');
    setNota('');
  };
  const invalidar = () => {
    setError(null);
    void queryClient.invalidateQueries({ queryKey: QKEY });
  };
  const onError = (e: unknown) =>
    setError(e instanceof ApiRequestError ? e.message : 'Ocurrió un error.');

  const guardar = useMutation({
    mutationFn: () => {
      const payload = { inpc: Number(inpc), nota };
      if (editando != null) return parametrosApi.editarInpc(editando, payload);
      return parametrosApi.crearInpc({
        anio: Number(anio),
        mes: Number(mes),
        ...payload,
      });
    },
    onSuccess: async () => {
      // Disparo del flujo de incrementos: localizar el registro guardado y
      // abrir la vista previa (nada se aplica sin confirmación explícita).
      const anioNum = Number(anio);
      const mesNum = Number(mes);
      const consecutivoEditado = editando;
      reset();
      invalidar();
      const lista = await queryClient.fetchQuery({
        queryKey: QKEY,
        queryFn: () => parametrosApi.listarInpc(),
      });
      const registro =
        consecutivoEditado != null
          ? lista.find((r) => r.consecutivo === consecutivoEditado)
          : lista.find((r) => r.anio === anioNum && r.mes === mesNum);
      if (registro) {
        void queryClient.invalidateQueries({ queryKey: ['incrementos-preview', registro.id] });
        setPreviewDe(registro.id);
      }
    },
    onError,
  });

  const eliminar = useMutation({
    mutationFn: (consecutivo: number) => parametrosApi.eliminarInpc(consecutivo),
    onSuccess: invalidar,
    onError,
  });

  function cargar(r: InpcItem) {
    setEditando(r.consecutivo);
    setAnio(String(r.anio));
    setMes(String(r.mes));
    setInpc(String(r.inpc));
    setNota(r.nota ?? '');
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!inpc.trim()) return;
    if (editando == null && (!anio.trim() || !mes.trim())) return;
    guardar.mutate();
  }

  const inputCls =
    'rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30';

  const nPendientes = pendientes?.aplicables.length ?? 0;
  const nReaplicables = pendientes?.omitidos.filter((o) => o.requiereReaplicacion).length ?? 0;

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {masReciente && (nPendientes > 0 || nReaplicables > 0) && (
        <div className="flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>
            ⚠️ El INPC <strong>{masReciente.id}</strong> tiene{' '}
            {nPendientes > 0 && <strong>{nPendientes} incremento(s) de renta sin aplicar</strong>}
            {nPendientes > 0 && nReaplicables > 0 && ' y '}
            {nReaplicables > 0 && (
              <strong>{nReaplicables} plan(es) aplicados con un valor distinto al vigente</strong>
            )}
            .
          </span>
          <button
            onClick={() => setPreviewDe(masReciente.id)}
            className="shrink-0 rounded-lg bg-[#1f2a4d] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#172039]"
          >
            Revisar y aplicar
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-600">
          Año
          <input
            type="number"
            value={anio}
            disabled={editando != null}
            onChange={(e) => setAnio(e.target.value)}
            className={`mt-1 block w-24 ${inputCls} disabled:bg-gray-100`}
          />
        </label>
        <label className="text-xs text-gray-600">
          Mes
          <input
            type="number"
            min={1}
            max={12}
            value={mes}
            disabled={editando != null}
            onChange={(e) => setMes(e.target.value)}
            className={`mt-1 block w-20 ${inputCls} disabled:bg-gray-100`}
          />
        </label>
        <label className="text-xs text-gray-600">
          INPC
          <input
            type="number"
            step="0.0001"
            value={inpc}
            onChange={(e) => setInpc(e.target.value)}
            className={`mt-1 block w-28 ${inputCls}`}
          />
        </label>
        <label className="flex-1 text-xs text-gray-600">
          Nota
          <input
            type="text"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            className={`mt-1 block w-full ${inputCls}`}
          />
        </label>
        <button
          type="submit"
          disabled={guardar.isPending}
          className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039] disabled:opacity-50"
        >
          {editando != null ? 'Actualizar' : 'Agregar'}
        </button>
        {editando != null && (
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Cancelar
          </button>
        )}
      </form>

      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por periodo o nota…"
        className="w-64 max-w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
      />

      <div className="max-h-[60vh] overflow-auto rounded-xl border bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <SortableTh campo="periodo" sortKey={sortKey} dir={dir} onSort={toggle}>
                Periodo
              </SortableTh>
              <SortableTh campo="anio" sortKey={sortKey} dir={dir} onSort={toggle}>
                Año
              </SortableTh>
              <SortableTh campo="mes" sortKey={sortKey} dir={dir} onSort={toggle}>
                Mes
              </SortableTh>
              <SortableTh campo="inpc" sortKey={sortKey} dir={dir} onSort={toggle}>
                INPC
              </SortableTh>
              <SortableTh>Nota</SortableTh>
              <SortableTh align="right">Acciones</SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  Cargando…
                </td>
              </tr>
            )}
            {ordenados.map((r) => (
              <tr key={r.consecutivo} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-gray-700">{r.id}</td>
                <td className="px-4 py-2">{r.anio}</td>
                <td className="px-4 py-2">{r.mes}</td>
                <td className="px-4 py-2">{r.inpc}</td>
                <td className="px-4 py-2 text-gray-500">{r.nota}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => cargar(r)}
                    className="mr-3 text-xs font-medium text-[#3f5b87] hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setPreviewDe(r.id)}
                    className="mr-3 text-xs font-medium text-[#3f5b87] hover:underline"
                    title="Incrementos de renta de este INPC"
                  >
                    Incrementos
                  </button>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          `¿Eliminar el registro de INPC ${r.id} (valor ${r.inpc})?\n\nLos incrementos de renta ya aplicados con este INPC NO se revierten (siguen en la bitácora); solo se borra el registro del catálogo.`,
                        )
                      )
                        eliminar.mutate(r.consecutivo);
                    }}
                    disabled={eliminar.isPending}
                    className="text-xs font-medium text-red-600 hover:underline disabled:opacity-40"
                  >
                    {eliminar.isPending ? 'Eliminando…' : 'Eliminar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {previewDe && (
        <IncrementosPreviewModal idInpc={previewDe} onClose={() => setPreviewDe(null)} />
      )}
    </div>
  );
}
