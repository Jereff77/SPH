import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parametrosApi } from './parametros.api';
import { Toggle } from '@/components/Toggle';
import {
  SortableTh,
  THEAD_STICKY,
  THEAD_TR,
} from '@/components/tabla/SortableTh';
import { useSort } from '@/components/tabla/useSort';
import { ApiRequestError } from '@/lib/api';

export function FechasCxpTab() {
  const queryClient = useQueryClient();
  const [periodo, setPeriodo] = useState<string>('');
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: periodos = [] } = useQuery({
    queryKey: ['fechas-cxp-periodos'],
    queryFn: () => parametrosApi.listarPeriodos(),
  });

  // Ordenar los periodos como fechas (no alfabéticamente): de más reciente a
  // más antiguo. El formato es "MM-YYYY", así que comparamos año y luego mes.
  const periodosOrdenados = useMemo(() => {
    const peso = (p: string) => {
      const [mm, yyyy] = p.split('-');
      return Number(yyyy) * 100 + Number(mm);
    };
    return [...periodos].sort((a, b) => peso(b) - peso(a));
  }, [periodos]);

  // Seleccionar el periodo más reciente por defecto.
  useEffect(() => {
    if (!periodo && periodosOrdenados.length) setPeriodo(periodosOrdenados[0]!);
  }, [periodosOrdenados, periodo]);

  const fechasKey = ['fechas-cxp', periodo];
  const { data: fechas = [], isLoading } = useQuery({
    queryKey: fechasKey,
    queryFn: () => parametrosApi.listarFechas(periodo || undefined),
    enabled: !!periodo,
  });

  const { ordenados, sortKey, dir, toggle: ordenar } = useSort(
    fechas,
    {
      fecha: (f) => f.fecha,
      dia: (f) => f.dia_semana,
      cfdi: (f) => f.cfdi,
      autorizar: (f) => f.autorizar,
    },
    { key: 'fecha' },
  );

  const invalidar = () => {
    setError(null);
    void queryClient.invalidateQueries({ queryKey: ['fechas-cxp'] });
    void queryClient.invalidateQueries({ queryKey: ['fechas-cxp-periodos'] });
  };
  const onError = (e: unknown) =>
    setError(e instanceof ApiRequestError ? e.message : 'Ocurrió un error.');

  const toggle = useMutation({
    mutationFn: ({
      fecha,
      campo,
      valor,
    }: {
      fecha: string;
      campo: 'cfdi' | 'autorizar';
      valor: boolean;
    }) => parametrosApi.toggleFecha(fecha, { [campo]: valor }),
    onMutate: async ({ fecha, campo, valor }) => {
      await queryClient.cancelQueries({ queryKey: fechasKey });
      const prev = queryClient.getQueryData(fechasKey);
      queryClient.setQueryData(
        fechasKey,
        (old: typeof fechas | undefined) =>
          old?.map((f) => (f.fecha === fecha ? { ...f, [campo]: valor } : f)),
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(fechasKey, ctx.prev);
      onError(e);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: fechasKey }),
  });

  const agregar = useMutation({
    mutationFn: (fecha: string) => parametrosApi.crearFecha({ fecha }),
    onSuccess: () => {
      setNuevaFecha('');
      invalidar();
    },
    onError,
  });

  const eliminar = useMutation({
    mutationFn: (fecha: string) => parametrosApi.eliminarFecha(fecha),
    onSuccess: invalidar,
    onError,
  });

  function onAgregar(e: FormEvent) {
    e.preventDefault();
    if (nuevaFecha) agregar.mutate(nuevaFecha);
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="text-xs text-gray-600">
          Periodo (mes-año)
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="mt-1 block w-40 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
          >
            {periodosOrdenados.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <form onSubmit={onAgregar} className="flex items-end gap-2">
          <label className="text-xs text-gray-600">
            Agregar fecha
            <input
              type="date"
              value={nuevaFecha}
              onChange={(e) => setNuevaFecha(e.target.value)}
              className="mt-1 block rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
            />
          </label>
          <button
            type="submit"
            disabled={!nuevaFecha || agregar.isPending}
            className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039] disabled:opacity-50"
          >
            Agregar
          </button>
        </form>
      </div>

      <div className="max-h-[60vh] overflow-auto rounded-xl border bg-white">
        <table className="w-full min-w-[520px] text-sm">
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <SortableTh campo="fecha" sortKey={sortKey} dir={dir} onSort={ordenar}>
                Fecha
              </SortableTh>
              <SortableTh campo="dia" sortKey={sortKey} dir={dir} onSort={ordenar}>
                Día
              </SortableTh>
              <SortableTh
                campo="cfdi"
                sortKey={sortKey}
                dir={dir}
                onSort={ordenar}
                align="center"
              >
                CFDI
              </SortableTh>
              <SortableTh
                campo="autorizar"
                sortKey={sortKey}
                dir={dir}
                onSort={ordenar}
                align="center"
              >
                Autorizar
              </SortableTh>
              <SortableTh align="right">Acciones</SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  Cargando…
                </td>
              </tr>
            )}
            {!isLoading && fechas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  Sin fechas en este periodo.
                </td>
              </tr>
            )}
            {ordenados.map((f) => (
              <tr key={f.fecha} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-gray-700">{f.fecha}</td>
                <td className="px-4 py-2 text-gray-500">{f.dia_semana}</td>
                <td className="px-4 py-2 text-center">
                  <Toggle
                    checked={f.cfdi}
                    disabled={toggle.isPending}
                    onChange={(valor) =>
                      toggle.mutate({ fecha: f.fecha, campo: 'cfdi', valor })
                    }
                  />
                </td>
                <td className="px-4 py-2 text-center">
                  <Toggle
                    checked={f.autorizar}
                    disabled={toggle.isPending}
                    onChange={(valor) =>
                      toggle.mutate({ fecha: f.fecha, campo: 'autorizar', valor })
                    }
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => eliminar.mutate(f.fecha)}
                    disabled={eliminar.isPending}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
