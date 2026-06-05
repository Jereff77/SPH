import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  clavesSatApi,
  type ClaveSat,
  type ClaveSatInput,
} from './clavesSat.api';
import { Toggle } from '@/components/Toggle';
import {
  SortableTh,
  THEAD_STICKY,
  THEAD_TR,
} from '@/components/tabla/SortableTh';
import { useSort, type Accessors } from '@/components/tabla/useSort';
import { ApiRequestError } from '@/lib/api';

const QKEY = ['claves-sat'];

const ACCESSORS: Accessors<ClaveSat> = {
  clave: (c) => c.claveProdServ,
  descripcion: (c) => c.descripcion,
  iva: (c) => c.retieneIVA,
  isr: (c) => c.retieneISR,
  status: (c) => c.status,
};

export function ClavesSatTab() {
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editarDe, setEditarDe] = useState<ClaveSat | null>(null);
  const [showAlta, setShowAlta] = useState(false);

  const { data: claves = [], isLoading } = useQuery({
    queryKey: QKEY,
    queryFn: () => clavesSatApi.listar(),
  });

  const invalidar = () => {
    setError(null);
    void queryClient.invalidateQueries({ queryKey: QKEY });
  };
  const onError = (e: unknown) =>
    setError(e instanceof ApiRequestError ? e.message : 'Ocurrió un error.');

  // Mutación optimista de un campo booleano (retieneIVA/retieneISR/status).
  function useBool(
    campo: 'retieneIVA' | 'retieneISR' | 'status',
    fn: (id: string, valor: boolean) => Promise<unknown>,
  ) {
    return useMutation({
      mutationFn: ({ id, valor }: { id: string; valor: boolean }) =>
        fn(id, valor),
      onMutate: async ({ id, valor }) => {
        setError(null);
        await queryClient.cancelQueries({ queryKey: QKEY });
        const prev = queryClient.getQueryData<ClaveSat[]>(QKEY);
        queryClient.setQueryData<ClaveSat[]>(QKEY, (old) =>
          old?.map((c) => (c.idClave === id ? { ...c, [campo]: valor } : c)),
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

  const mIva = useBool('retieneIVA', (id, v) =>
    clavesSatApi.editar(id, { retieneIVA: v }),
  );
  const mIsr = useBool('retieneISR', (id, v) =>
    clavesSatApi.editar(id, { retieneISR: v }),
  );
  const mStatus = useBool('status', (id, v) => clavesSatApi.setStatus(id, v));

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return claves;
    return claves.filter(
      (c) =>
        c.claveProdServ.toLowerCase().includes(q) ||
        (c.descripcion ?? '').toLowerCase().includes(q),
    );
  }, [claves, busqueda]);

  const { ordenados, sortKey, dir, toggle } = useSort(filtradas, ACCESSORS, {
    key: 'clave',
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Catálogo de claves Producto/Servicio del SAT. Define si cada concepto
        retiene IVA y/o ISR; se usa para validar las facturas en Cuentas por
        Pagar (regímenes 612, 626 y 606).
      </p>

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
          placeholder="Buscar por clave o descripción…"
          className="w-72 max-w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
        />
        <button
          onClick={() => setShowAlta(true)}
          className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039]"
        >
          Nueva clave
        </button>
      </div>

      <div className="max-h-[60vh] overflow-auto rounded-xl border bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <SortableTh campo="clave" sortKey={sortKey} dir={dir} onSort={toggle}>
                Clave SAT
              </SortableTh>
              <SortableTh
                campo="descripcion"
                sortKey={sortKey}
                dir={dir}
                onSort={toggle}
              >
                Descripción
              </SortableTh>
              <SortableTh campo="iva" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                Retiene IVA
              </SortableTh>
              <SortableTh campo="isr" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                Retiene ISR
              </SortableTh>
              <SortableTh campo="status" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                Activa
              </SortableTh>
              <SortableTh align="center">Editar</SortableTh>
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
            {!isLoading && ordenados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-xs text-gray-300">
                  Sin claves registradas.
                </td>
              </tr>
            )}
            {ordenados.map((c) => (
              <tr key={c.idClave} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs text-gray-700">
                  {c.claveProdServ}
                </td>
                <td
                  className="max-w-[320px] truncate px-3 py-2 text-gray-600"
                  title={c.descripcion ?? ''}
                >
                  {c.descripcion || '—'}
                </td>
                <td className="px-3 py-2 text-center">
                  <Toggle
                    checked={c.retieneIVA}
                    disabled={mIva.isPending}
                    title="Retiene IVA"
                    onChange={(valor) => mIva.mutate({ id: c.idClave, valor })}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <Toggle
                    checked={c.retieneISR}
                    disabled={mIsr.isPending}
                    title="Retiene ISR"
                    onChange={(valor) => mIsr.mutate({ id: c.idClave, valor })}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <Toggle
                    checked={c.status}
                    variant="status"
                    disabled={mStatus.isPending}
                    title={c.status ? 'Activa' : 'Inactiva'}
                    onChange={(valor) => mStatus.mutate({ id: c.idClave, valor })}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => setEditarDe(c)}
                    title="Editar clave/descripción"
                    className="text-[#3f5b87] hover:text-[#1f2a4d]"
                  >
                    ✎
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(showAlta || editarDe) && (
        <ClaveModal
          clave={editarDe}
          onClose={() => {
            setShowAlta(false);
            setEditarDe(null);
          }}
          onGuardada={() => {
            setShowAlta(false);
            setEditarDe(null);
            invalidar();
          }}
        />
      )}
    </div>
  );
}

function ClaveModal({
  clave,
  onClose,
  onGuardada,
}: {
  clave: ClaveSat | null;
  onClose: () => void;
  onGuardada: () => void;
}) {
  const esEdicion = !!clave;
  const [claveProdServ, setClaveProdServ] = useState(clave?.claveProdServ ?? '');
  const [descripcion, setDescripcion] = useState(clave?.descripcion ?? '');
  const [retieneIVA, setRetieneIVA] = useState(clave?.retieneIVA ?? false);
  const [retieneISR, setRetieneISR] = useState(clave?.retieneISR ?? false);
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: async (): Promise<void> => {
      const dto: ClaveSatInput = {
        claveProdServ: claveProdServ.trim(),
        descripcion: descripcion.trim(),
        retieneIVA,
        retieneISR,
      };
      if (esEdicion) await clavesSatApi.editar(clave!.idClave, dto);
      else await clavesSatApi.crear(dto);
    },
    onSuccess: onGuardada,
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo guardar.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (claveProdServ.trim()) guardar.mutate();
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
        <h2 className="text-lg font-semibold text-gray-800">
          {esEdicion ? 'Editar clave SAT' : 'Nueva clave SAT'}
        </h2>
        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <label className="block text-xs text-gray-600">
          Clave Producto/Servicio (SAT)
          <input
            value={claveProdServ}
            onChange={(e) => setClaveProdServ(e.target.value)}
            placeholder="Ej. 80101500"
            className={inputCls}
          />
        </label>
        <label className="block text-xs text-gray-600">
          Descripción
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej. Servicios de consultoría"
            className={inputCls}
          />
        </label>
        <div className="flex items-center gap-6 pt-1">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <Toggle checked={retieneIVA} title="Retiene IVA" onChange={setRetieneIVA} />
            Retiene IVA
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <Toggle checked={retieneISR} title="Retiene ISR" onChange={setRetieneISR} />
            Retiene ISR
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardar.isPending}
            className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039] disabled:opacity-50"
          >
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
