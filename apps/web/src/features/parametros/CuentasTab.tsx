import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parametrosApi, type CuentaItem } from './parametros.api';
import { PresupuestoMensualModal } from './PresupuestoMensualModal';
import { Toggle } from '@/components/Toggle';
import { IconGear } from '@/components/icons';
import {
  SortableTh,
  THEAD_STICKY,
  THEAD_TR,
} from '@/components/tabla/SortableTh';
import { useSort, type Accessors } from '@/components/tabla/useSort';
import { ApiRequestError } from '@/lib/api';

const QKEY = ['cuentas'];
const moneda = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const ACCESSORS_CUENTAS: Accessors<CuentaItem> = {
  clave: (c) => c.idCategoria,
  cuenta: (c) => c.cuenta,
  seccion: (c) => c.seccion,
  presupuesto: (c) => c.presupuestoAnual,
  consumido: (c) => c.consumido,
  responsable: (c) => c.nombreResponsable,
  presupuestable: (c) => c.presupuestable,
};

export function CuentasTab() {
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [presupuestoDe, setPresupuestoDe] = useState<CuentaItem | null>(null);
  const [showAlta, setShowAlta] = useState(false);

  const { data: cuentas = [], isLoading } = useQuery({
    queryKey: QKEY,
    queryFn: () => parametrosApi.listarCuentas(),
  });
  const { data: responsables = [] } = useQuery({
    queryKey: ['responsables'],
    queryFn: () => parametrosApi.listarResponsables(),
    staleTime: 5 * 60 * 1000,
  });

  const invalidar = () => {
    setError(null);
    void queryClient.invalidateQueries({ queryKey: QKEY });
  };
  const onError = (e: unknown) =>
    setError(e instanceof ApiRequestError ? e.message : 'Ocurrió un error.');

  // Mutación optimista genérica sobre un campo de la cuenta.
  function useCampo<T>(
    campo: keyof CuentaItem,
    fn: (id: string, valor: T) => Promise<unknown>,
  ) {
    return useMutation({
      mutationFn: ({ id, valor }: { id: string; valor: T }) => fn(id, valor),
      onMutate: async ({ id, valor }) => {
        setError(null);
        await queryClient.cancelQueries({ queryKey: QKEY });
        const prev = queryClient.getQueryData<CuentaItem[]>(QKEY);
        queryClient.setQueryData<CuentaItem[]>(QKEY, (old) =>
          old?.map((c) => (c.idCategoria === id ? { ...c, [campo]: valor } : c)),
        );
        return { prev };
      },
      onError: (e, _v, ctx) => {
        if (ctx?.prev) queryClient.setQueryData(QKEY, ctx.prev);
        onError(e);
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey: QKEY }),
    });
  }

  const mResponsable = useCampo<string>('uidResponsable', (id, v) =>
    parametrosApi.cambiarResponsable(id, v),
  );
  const mPresupuestable = useCampo<boolean>('presupuestable', (id, v) =>
    parametrosApi.setPresupuestable(id, v),
  );
  const mStatus = useCampo<boolean>('status', (id, v) =>
    parametrosApi.setStatusCuenta(id, v),
  );
  const eliminar = useMutation({
    mutationFn: (id: string) => parametrosApi.eliminarCuenta(id),
    onSuccess: invalidar,
    onError,
  });

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return cuentas;
    return cuentas.filter(
      (c) =>
        (c.cuenta ?? '').toLowerCase().includes(q) ||
        (c.seccion ?? '').toLowerCase().includes(q) ||
        c.idCategoria.toLowerCase().includes(q),
    );
  }, [cuentas, busqueda]);

  const { ordenados, sortKey, dir, toggle } = useSort(
    filtradas,
    ACCESSORS_CUENTAS,
    { key: 'cuenta' },
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por cuenta, sección o ID…"
          className="w-72 max-w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
        />
        <button
          onClick={() => setShowAlta(true)}
          className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039]"
        >
          Nueva cuenta
        </button>
      </div>

      <div className="max-h-[60vh] overflow-auto rounded-xl border bg-white">
        <table className="w-full min-w-[980px] text-sm">
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <SortableTh campo="clave" sortKey={sortKey} dir={dir} onSort={toggle}>
                Clave
              </SortableTh>
              <SortableTh campo="cuenta" sortKey={sortKey} dir={dir} onSort={toggle}>
                Cuenta
              </SortableTh>
              <SortableTh campo="seccion" sortKey={sortKey} dir={dir} onSort={toggle}>
                Sección
              </SortableTh>
              <SortableTh>Descripción</SortableTh>
              <SortableTh
                campo="presupuesto"
                sortKey={sortKey}
                dir={dir}
                onSort={toggle}
                align="right"
              >
                Presupuesto
              </SortableTh>
              <SortableTh
                campo="consumido"
                sortKey={sortKey}
                dir={dir}
                onSort={toggle}
                align="right"
              >
                Consumido
              </SortableTh>
              <SortableTh
                campo="responsable"
                sortKey={sortKey}
                dir={dir}
                onSort={toggle}
              >
                Responsable
              </SortableTh>
              <SortableTh
                campo="presupuestable"
                sortKey={sortKey}
                dir={dir}
                onSort={toggle}
                align="center"
              >
                Presup.
              </SortableTh>
              <SortableTh align="center">Acciones</SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-gray-400">
                  Cargando…
                </td>
              </tr>
            )}
            {ordenados.map((c) => (
              <tr key={c.idCategoria} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs text-gray-500">
                  {c.idCategoria}
                </td>
                <td className="px-3 py-2 font-medium text-gray-700">
                  {c.cuenta}
                </td>
                <td className="px-3 py-2 text-gray-500">{c.seccion}</td>
                <td
                  className="max-w-[260px] truncate px-3 py-2 text-gray-500"
                  title={c.descripcion ?? ''}
                >
                  {c.descripcion}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="tabular-nums">
                      {moneda(c.presupuestoAnual)}
                    </span>
                    <button
                      onClick={() =>
                        c.idPresupuesto && setPresupuestoDe(c)
                      }
                      disabled={!c.idPresupuesto}
                      title="Ajustar presupuesto mensual"
                      className="text-[#3f5b87] hover:text-[#1f2a4d] disabled:text-gray-300"
                    >
                      <IconGear className="h-4 w-4" />
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                  {moneda(c.consumido)}
                </td>
                <td className="px-3 py-2">
                  <select
                    value={c.uidResponsable ?? ''}
                    disabled={mResponsable.isPending}
                    onChange={(e) =>
                      mResponsable.mutate({
                        id: c.idCategoria,
                        valor: e.target.value,
                      })
                    }
                    className="w-44 rounded-md border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
                  >
                    {!responsables.some((r) => r.uid === c.uidResponsable) && (
                      <option value={c.uidResponsable ?? ''}>
                        {c.nombreResponsable ?? '—'}
                      </option>
                    )}
                    {responsables.map((r) => (
                      <option key={r.uid} value={r.uid}>
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-center">
                  <Toggle
                    checked={!!c.presupuestable}
                    disabled={mPresupuestable.isPending}
                    title="Presupuestable"
                    onChange={(valor) =>
                      mPresupuestable.mutate({ id: c.idCategoria, valor })
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-3">
                    <Toggle
                      checked={!!c.status}
                      variant="status"
                      disabled={mStatus.isPending}
                      title={c.status ? 'Activa' : 'Inactiva'}
                      onChange={(valor) =>
                        mStatus.mutate({ id: c.idCategoria, valor })
                      }
                    />
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            `¿Eliminar la cuenta "${c.cuenta ?? c.idCategoria}"? Esta acción no se puede deshacer.`,
                          )
                        ) {
                          eliminar.mutate(c.idCategoria);
                        }
                      }}
                      disabled={eliminar.isPending}
                      title="Eliminar cuenta"
                      className="text-red-600 hover:text-red-700 disabled:opacity-40"
                    >
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {presupuestoDe?.idPresupuesto && (
        <PresupuestoMensualModal
          idCategoria={presupuestoDe.idCategoria}
          cuenta={presupuestoDe.cuenta ?? presupuestoDe.idCategoria}
          seccion={presupuestoDe.seccion}
          idPresupuesto={presupuestoDe.idPresupuesto}
          onClose={() => setPresupuestoDe(null)}
        />
      )}

      {showAlta && (
        <AltaCuenta
          responsables={responsables}
          onClose={() => setShowAlta(false)}
          onCreada={() => {
            setShowAlta(false);
            invalidar();
          }}
        />
      )}
    </div>
  );
}

function AltaCuenta({
  responsables,
  onClose,
  onCreada,
}: {
  responsables: { uid: string; nombre: string }[];
  onClose: () => void;
  onCreada: () => void;
}) {
  const [idCategoria, setIdCategoria] = useState('');
  const [cuenta, setCuenta] = useState('');
  const [seccion, setSeccion] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [uidResponsable, setUidResponsable] = useState('');
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: () =>
      parametrosApi.crearCuenta({
        idCategoria,
        cuenta,
        seccion,
        descripcion,
        uidResponsable,
      }),
    onSuccess: onCreada,
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo crear.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (idCategoria.trim() && cuenta.trim() && uidResponsable) crear.mutate();
  }

  const inputCls =
    'mt-1 block w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-gray-800">Nueva cuenta</h2>
        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <label className="block text-xs text-gray-600">
          ID de cuenta
          <input value={idCategoria} onChange={(e) => setIdCategoria(e.target.value)} className={inputCls} />
        </label>
        <label className="block text-xs text-gray-600">
          Cuenta
          <input value={cuenta} onChange={(e) => setCuenta(e.target.value)} className={inputCls} />
        </label>
        <label className="block text-xs text-gray-600">
          Sección
          <input value={seccion} onChange={(e) => setSeccion(e.target.value)} className={inputCls} />
        </label>
        <label className="block text-xs text-gray-600">
          Descripción
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={inputCls} />
        </label>
        <label className="block text-xs text-gray-600">
          Responsable
          <select value={uidResponsable} onChange={(e) => setUidResponsable(e.target.value)} className={inputCls}>
            <option value="">Selecciona…</option>
            {responsables.map((r) => (
              <option key={r.uid} value={r.uid}>
                {r.nombre}
              </option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={crear.isPending}
            className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039] disabled:opacity-50"
          >
            {crear.isPending ? 'Creando…' : 'Crear'}
          </button>
        </div>
      </form>
    </div>
  );
}
