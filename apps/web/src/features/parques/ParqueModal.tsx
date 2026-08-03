import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { parquesApi, type ParqueListado } from './parques.api';
import { ApiRequestError } from '@/lib/api';

interface Props {
  // Si se pasa `parque`, es edición; si no, es alta.
  parque?: ParqueListado | null;
  onClose: () => void;
  onListo: () => void;
}

const inputCls =
  'mt-1 block w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30 disabled:bg-gray-100';

/**
 * Alta/edición de parque. En alta se captura la cantidad de naves a generar (el
 * backend las crea automáticamente). En edición, el nombre y el nº de naves son
 * de solo lectura (igual que en v1: no se regeneran naves al editar).
 */
export function ParqueModal({ parque, onClose, onListo }: Props) {
  const esEdicion = !!parque;
  const [nomParque, setNomParque] = useState(parque?.nomParque ?? '');
  const [direccion, setDireccion] = useState(parque?.direccion ?? '');
  const [naves, setNaves] = useState(String(parque?.naves ?? ''));
  // Los dos niveles del negocio: MEDIA (mt) y BAJA (bt) tensión.
  const [kvasMt, setKvasMt] = useState(String(parque?.kvasMt ?? ''));
  const [kvasBt, setKvasBt] = useState(String(parque?.kvasBt ?? ''));
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: async (): Promise<void> => {
      if (esEdicion) {
        await parquesApi.editar(parque.idParque, {
          direccion,
          kvasMt: Number(kvasMt) || 0,
          kvasBt: Number(kvasBt) || 0,
        });
        return;
      }
      await parquesApi.crear({
        nomParque: nomParque.trim(),
        direccion,
        naves: Number(naves) || 0,
        kvasMt: Number(kvasMt) || 0,
        kvasBt: Number(kvasBt) || 0,
      });
    },
    onSuccess: onListo,
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo guardar.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!esEdicion) {
      if (nomParque.trim() === '') return setError('El nombre es obligatorio.');
      const n = Number(naves);
      if (!Number.isInteger(n) || n < 1)
        return setError('Indica cuántas naves generar (mínimo 1).');
    }
    guardar.mutate();
  }

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
          {esEdicion ? 'Editar parque' : 'Nuevo parque'}
        </h2>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <label className="block text-xs text-gray-600">
          Nombre del parque
          <input
            value={nomParque}
            onChange={(e) => setNomParque(e.target.value)}
            disabled={esEdicion}
            className={inputCls}
          />
        </label>

        <label className="block text-xs text-gray-600">
          Domicilio
          <input
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            className={inputCls}
          />
        </label>

        <div className="grid grid-cols-3 gap-3">
          <label className="block text-xs text-gray-600">
            Naves
            <input
              type="number"
              value={naves}
              onChange={(e) => setNaves(e.target.value)}
              disabled={esEdicion}
              title={
                esEdicion
                  ? 'El número de naves no se modifica al editar.'
                  : 'Se generarán automáticamente.'
              }
              className={inputCls}
            />
          </label>
          <label className="block text-xs text-gray-600">
            KVA's Media tensión
            <input
              type="number"
              step="0.01"
              value={kvasMt}
              onChange={(e) => setKvasMt(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-xs text-gray-600">
            KVA's Baja tensión
            <input
              type="number"
              step="0.01"
              value={kvasBt}
              onChange={(e) => setKvasBt(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>

        {!esEdicion && (
          <p className="text-xs text-gray-400">
            Se crearán {naves || '—'} naves en estado «Disponible».
          </p>
        )}

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
            {guardar.isPending
              ? esEdicion
                ? 'Guardando…'
                : 'Creando…'
              : esEdicion
                ? 'Guardar'
                : 'Crear parque'}
          </button>
        </div>
      </form>
    </div>
  );
}
