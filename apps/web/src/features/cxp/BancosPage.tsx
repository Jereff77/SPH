import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bancosApi, type Banco, type BancoDto } from './bancos.api';
import {
  SortableTh,
  THEAD_STICKY,
  THEAD_TR,
} from '@/components/tabla/SortableTh';
import { useSort, type Accessors } from '@/components/tabla/useSort';
import { FiltroColumnaOpciones } from '@/components/tabla/FiltroColumnaOpciones';
import { ApiRequestError } from '@/lib/api';

const QKEY = ['cxp-bancos'];

const ACCESSORS: Accessors<Banco> = {
  nombre: (b) => b.nombre,
  codigo: (b) => b.codigo,
  tipo: (b) => b.tipo,
};

export function BancosPage() {
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [tipoSel, setTipoSel] = useState<Set<string>>(new Set());
  const [editar, setEditar] = useState<Banco | null>(null);
  const [alta, setAlta] = useState(false);

  const { data = [], isLoading, isError } = useQuery({
    queryKey: QKEY,
    queryFn: () => bancosApi.listar(),
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: QKEY });

  const optTipo = useMemo(
    () =>
      [...new Set(data.map((b) => b.tipo ?? '').filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'es', { numeric: true }),
      ),
    [data],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return data.filter((b) => {
      if (q && !(
        b.nombre.toLowerCase().includes(q) ||
        b.codigo.toLowerCase().includes(q) ||
        (b.tipo ?? '').toLowerCase().includes(q)
      )) return false;
      if (tipoSel.size > 0 && !tipoSel.has(b.tipo ?? '')) return false;
      return true;
    });
  }, [data, busqueda, tipoSel]);

  const { ordenados, sortKey, dir, toggle } = useSort(filtrados, ACCESSORS, {
    key: 'nombre',
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">Bancos</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, código o tipo…"
            className="w-64 max-w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
          />
          <button
            onClick={() => setAlta(true)}
            className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039]"
          >
            Nuevo banco
          </button>
        </div>
      </div>

      <div className="max-h-[calc(100vh-12rem)] overflow-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[560px] text-sm">
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <SortableTh campo="nombre" sortKey={sortKey} dir={dir} onSort={toggle}>
                Nombre
              </SortableTh>
              <SortableTh campo="codigo" sortKey={sortKey} dir={dir} onSort={toggle}>
                Código
              </SortableTh>
              <SortableTh
                campo="tipo"
                sortKey={sortKey}
                dir={dir}
                onSort={toggle}
                filtro={
                  <FiltroColumnaOpciones
                    etiqueta="Tipo"
                    opciones={optTipo}
                    seleccion={tipoSel}
                    onChange={setTipoSel}
                  />
                }
              >
                Tipo
              </SortableTh>
              <SortableTh align="center">Editar</SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  Cargando…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-red-600">
                  No se pudieron cargar los bancos.
                </td>
              </tr>
            )}
            {ordenados.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-800">{b.nombre}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-600">
                  {b.codigo}
                </td>
                <td className="px-4 py-2.5 text-gray-600">{b.tipo ?? '—'}</td>
                <td className="px-4 py-2.5 text-center">
                  <button
                    onClick={() => setEditar(b)}
                    title="Editar banco"
                    className="text-[#3f5b87] hover:text-[#1f2a4d]"
                  >
                    ✎
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && !isError && ordenados.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  Sin resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {alta && (
        <BancoModal
          onClose={() => setAlta(false)}
          onListo={() => {
            setAlta(false);
            void invalidar();
          }}
        />
      )}
      {editar && (
        <BancoModal
          banco={editar}
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

function BancoModal({
  banco,
  onClose,
  onListo,
}: {
  banco?: Banco;
  onClose: () => void;
  onListo: () => void;
}) {
  const esEdicion = !!banco;
  const [nombre, setNombre] = useState(banco?.nombre ?? '');
  const [codigo, setCodigo] = useState(banco?.codigo ?? '');
  const [tipo, setTipo] = useState(banco?.tipo ?? '');
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: async (): Promise<void> => {
      const dto: BancoDto = {
        nombre: nombre.trim(),
        codigo: codigo.trim(),
        tipo: tipo.trim(),
      };
      if (esEdicion) await bancosApi.editar(banco.id, dto);
      else await bancosApi.crear(dto);
    },
    onSuccess: onListo,
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo guardar.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (nombre.trim() === '') return setError('El nombre es obligatorio.');
    if (codigo.trim() === '') return setError('El código es obligatorio.');
    guardar.mutate();
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
        className="w-full max-w-sm space-y-3 rounded-xl bg-white p-5 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-gray-800">
          {esEdicion ? 'Editar banco' : 'Nuevo banco'}
        </h2>
        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <label className="block text-xs text-gray-600">
          Nombre *
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputCls} />
        </label>
        <label className="block text-xs text-gray-600">
          Código *
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} className={inputCls} />
        </label>
        <label className="block text-xs text-gray-600">
          Tipo
          <input
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            placeholder="Opcional"
            className={inputCls}
          />
        </label>
        <div className="flex justify-end gap-2 pt-1">
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
            {guardar.isPending ? 'Guardando…' : esEdicion ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </form>
    </div>
  );
}
