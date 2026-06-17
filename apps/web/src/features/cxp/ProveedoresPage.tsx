import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { proveedoresApi, type Proveedor } from './proveedores.api';
import { ProveedorModal } from './ProveedorModal';
import { Toggle } from '@/components/Toggle';
import {
  SortableTh,
  THEAD_STICKY,
  THEAD_TR,
} from '@/components/tabla/SortableTh';
import { useSort, type Accessors } from '@/components/tabla/useSort';
import { ApiRequestError } from '@/lib/api';
import { FiltroColumnaOpciones } from '@/components/tabla/FiltroColumnaOpciones';

const QKEY = ['cxp-proveedores'];

const ACCESSORS: Accessors<Proveedor> = {
  razonSocial: (p) => p.razonSocial,
  rfc: (p) => p.rfc,
  banco: (p) => p.nombreBanco,
  tipoCuenta: (p) => p.tipoCuenta,
  status: (p) => p.status,
};

export function ProveedoresPage() {
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [bancoSel, setBancoSel] = useState<Set<string>>(new Set());
  const [tipoCtaSel, setTipoCtaSel] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [editar, setEditar] = useState<Proveedor | null>(null);
  const [alta, setAlta] = useState(false);

  const { data = [], isLoading, isError } = useQuery({
    queryKey: QKEY,
    queryFn: () => proveedoresApi.listar(),
  });

  const invalidar = () =>
    queryClient.invalidateQueries({ queryKey: QKEY });

  const mStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: boolean }) =>
      proveedoresApi.setStatus(id, status),
    onMutate: async ({ id, status }) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: QKEY });
      const prev = queryClient.getQueryData<Proveedor[]>(QKEY);
      queryClient.setQueryData<Proveedor[]>(QKEY, (old) =>
        old?.map((p) => (p.idProveedor === id ? { ...p, status } : p)),
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(QKEY, ctx.prev);
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo actualizar.');
    },
    onSettled: () => invalidar(),
  });

  const optBanco = useMemo(
    () =>
      [...new Set(data.map((p) => p.nombreBanco ?? '').filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, 'es', { numeric: true }),
      ),
    [data],
  );

  const optTipoCta = useMemo(
    () =>
      [...new Set(data.map((p) => p.tipoCuenta ?? '').filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, 'es', { numeric: true }),
      ),
    [data],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return data.filter((p) => {
      if (
        q &&
        !p.razonSocial.toLowerCase().includes(q) &&
        !p.rfc.toLowerCase().includes(q) &&
        !(p.nombreBanco ?? '').toLowerCase().includes(q)
      )
        return false;
      if (bancoSel.size > 0 && !bancoSel.has(p.nombreBanco ?? '')) return false;
      if (tipoCtaSel.size > 0 && !tipoCtaSel.has(p.tipoCuenta ?? '')) return false;
      return true;
    });
  }, [data, busqueda, bancoSel, tipoCtaSel]);

  const { ordenados, sortKey, dir, toggle } = useSort(filtrados, ACCESSORS, {
    key: 'razonSocial',
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">
          Proveedores
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por razón social, RFC o banco…"
            className="w-72 max-w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
          />
          <button
            onClick={() => setAlta(true)}
            className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039]"
          >
            Nuevo proveedor
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="max-h-[calc(100vh-12rem)] overflow-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <SortableTh campo="razonSocial" sortKey={sortKey} dir={dir} onSort={toggle}>
                Razón social
              </SortableTh>
              <SortableTh campo="rfc" sortKey={sortKey} dir={dir} onSort={toggle}>
                RFC
              </SortableTh>
              <SortableTh
                campo="banco"
                sortKey={sortKey}
                dir={dir}
                onSort={toggle}
                filtro={
                  <FiltroColumnaOpciones
                    etiqueta="Banco"
                    opciones={optBanco}
                    seleccion={bancoSel}
                    onChange={setBancoSel}
                  />
                }
              >
                Banco
              </SortableTh>
              <SortableTh
                campo="tipoCuenta"
                sortKey={sortKey}
                dir={dir}
                onSort={toggle}
                filtro={
                  <FiltroColumnaOpciones
                    etiqueta="Tipo cuenta"
                    opciones={optTipoCta}
                    seleccion={tipoCtaSel}
                    onChange={setTipoCtaSel}
                  />
                }
              >
                Tipo cuenta
              </SortableTh>
              <SortableTh>No. cuenta</SortableTh>
              <SortableTh>Teléfono</SortableTh>
              <SortableTh campo="status" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                Activo
              </SortableTh>
              <SortableTh align="center">Editar</SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                  Cargando…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-red-600">
                  No se pudieron cargar los proveedores.
                </td>
              </tr>
            )}
            {ordenados.map((p) => (
              <tr key={p.idProveedor} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-800">
                  {p.razonSocial}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-600">
                  {p.rfc}
                </td>
                <td className="px-4 py-2.5 text-gray-600">{p.nombreBanco}</td>
                <td className="px-4 py-2.5 text-gray-600">{p.tipoCuenta}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">
                  {p.noCuenta ?? '—'}
                </td>
                <td className="px-4 py-2.5 text-gray-600">{p.telefono ?? '—'}</td>
                <td className="px-4 py-2.5 text-center">
                  <Toggle
                    checked={p.status}
                    variant="status"
                    disabled={mStatus.isPending}
                    title={p.status ? 'Activo' : 'Inactivo'}
                    onChange={(status) =>
                      mStatus.mutate({ id: p.idProveedor, status })
                    }
                  />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <button
                    onClick={() => setEditar(p)}
                    title="Editar proveedor"
                    className="text-[#3f5b87] hover:text-[#1f2a4d]"
                  >
                    ✎
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && !isError && ordenados.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                  Sin resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {alta && (
        <ProveedorModal
          onClose={() => setAlta(false)}
          onListo={() => {
            setAlta(false);
            void invalidar();
          }}
        />
      )}
      {editar && (
        <ProveedorModal
          proveedor={editar}
          onClose={() => setEditar(null)}
          onListo={() => {
            setEditar(null);
            void invalidar();
          }}
        />
      )}
    </div>
  );
}
