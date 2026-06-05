import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { parquesApi } from './parques.api';
import { ApiRequestError } from '@/lib/api';

interface Props {
  idParque: string;
  nomParque: string | null;
  onClose: () => void;
  onListo: () => void;
}

/**
 * Agrega N naves a un parque existente. El backend continúa el consecutivo
 * (numNave) desde la última nave del parque; la etiqueta se personaliza después
 * editando cada nave.
 */
export function AgregarNavesModal({
  idParque,
  nomParque,
  onClose,
  onListo,
}: Props) {
  const [cantidad, setCantidad] = useState('1');
  const [error, setError] = useState<string | null>(null);

  const agregar = useMutation({
    mutationFn: () => parquesApi.agregarNaves(idParque, Number(cantidad) || 0),
    onSuccess: onListo,
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo agregar.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const n = Number(cantidad);
    if (!Number.isInteger(n) || n < 1)
      return setError('Indica cuántas naves agregar (mínimo 1).');
    agregar.mutate();
  }

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
        <h2 className="text-lg font-semibold text-gray-800">Agregar naves</h2>
        {nomParque && (
          <p className="text-xs text-gray-400">Parque: {nomParque}</p>
        )}

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <label className="block text-xs text-gray-600">
          ¿Cuántas naves agregar?
          <input
            type="number"
            min={1}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
          />
        </label>
        <p className="text-xs text-gray-400">
          Se crearán en estado «Disponible», numeradas a partir de la última nave
          del parque. Luego puedes renombrarlas (GYM, Coworking, etc.) editándolas.
        </p>

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
            disabled={agregar.isPending}
            className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039] disabled:opacity-50"
          >
            {agregar.isPending ? 'Agregando…' : 'Agregar'}
          </button>
        </div>
      </form>
    </div>
  );
}
