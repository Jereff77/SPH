import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api';

interface Props {
  titulo: string;
  descripcion: string;
  placeholder: string;
  queryKey: string;
  listar: () => Promise<string[]>;
  agregar: (valor: string) => Promise<string[]>;
  quitar: (valor: string) => Promise<string[]>;
  /** Prefijo visual (p. ej. "@" para dominios). */
  prefijo?: string;
  /** Mínimo de elementos (deshabilita "Quitar" si se alcanza). */
  minimo?: number;
  /** Normaliza el valor antes de agregar. */
  normalizar?: (v: string) => string;
  textoVacio?: string;
}

/** Lista editable de valores (dominios o correos) persistidos en el backend. */
export function ListaAutorizados({
  titulo,
  descripcion,
  placeholder,
  queryKey,
  listar,
  agregar,
  quitar,
  prefijo = '',
  minimo = 0,
  normalizar = (v) => v.trim().toLowerCase(),
  textoVacio,
}: Props) {
  const queryClient = useQueryClient();
  const [nuevo, setNuevo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: [queryKey],
    queryFn: listar,
  });

  const invalidar = () =>
    queryClient.invalidateQueries({ queryKey: [queryKey] });

  const mAgregar = useMutation({
    mutationFn: agregar,
    onSuccess: () => {
      setNuevo('');
      setError(null);
      void invalidar();
    },
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo agregar.'),
  });

  const mQuitar = useMutation({
    mutationFn: quitar,
    onSuccess: () => {
      setError(null);
      void invalidar();
    },
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo quitar.'),
  });

  const ocupado = mAgregar.isPending || mQuitar.isPending;

  function onAgregar(e: FormEvent) {
    e.preventDefault();
    const v = normalizar(nuevo);
    if (v) mAgregar.mutate(v);
  }

  return (
    <section className="max-w-xl rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-800">{titulo}</h2>
      <p className="mt-1 text-sm text-gray-500">{descripcion}</p>

      {error && (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading && <p className="mt-4 text-sm text-gray-400">Cargando…</p>}
      {isError && (
        <p className="mt-4 text-sm text-red-600">No se pudo cargar la lista.</p>
      )}

      {!isLoading && !isError && (
        <ul className="mt-4 space-y-2">
          {items.length === 0 && textoVacio && (
            <li className="text-sm text-gray-400">{textoVacio}</li>
          )}
          {items.map((it) => (
            <li
              key={it}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
            >
              <span className="text-gray-700">
                {prefijo}
                {it}
              </span>
              <button
                type="button"
                onClick={() => mQuitar.mutate(it)}
                disabled={ocupado || items.length <= minimo}
                title={
                  items.length <= minimo
                    ? 'Debe quedar al menos uno'
                    : 'Quitar'
                }
                className="text-xs font-medium text-red-600 hover:underline disabled:text-gray-300 disabled:no-underline"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onAgregar} className="mt-4 flex gap-2">
        <input
          type="text"
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
        />
        <button
          type="submit"
          disabled={ocupado || !nuevo.trim()}
          className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#172039] disabled:opacity-50"
        >
          {mAgregar.isPending ? 'Agregando…' : 'Agregar'}
        </button>
      </form>
    </section>
  );
}
