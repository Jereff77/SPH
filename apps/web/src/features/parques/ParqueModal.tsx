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
  // DOTACIÓN: los KVA que le tocan a CADA nave por disposición del parque.
  // En alta se propone 5 de baja, que es lo que pidió el negocio. ⚠️ Es un valor
  // PRECARGADO del formulario, no el default de la columna: el de la BD es 0,
  // porque un 5 heredado habría roto los parques que hoy tienen capacidad 0.
  const [dotMt, setDotMt] = useState(String(parque?.dotacionMtNave ?? (parque ? 0 : 0)));
  const [dotBt, setDotBt] = useState(String(parque?.dotacionBtNave ?? (parque ? 0 : 5)));
  const [error, setError] = useState<string | null>(null);

  const nNaves = Number(naves) || 0;
  const nDotBt = Number(dotBt) || 0;
  const nDotMt = Number(dotMt) || 0;
  const nCapBt = Number(kvasBt) || 0;
  const nCapMt = Number(kvasMt) || 0;
  // Cálculo en vivo: nadie debe descubrir al guardar que no cabe.
  const excedeBt = !esEdicion && nNaves * nDotBt > nCapBt;
  const excedeMt = !esEdicion && nNaves * nDotMt > nCapMt;
  const excede = excedeBt || excedeMt;

  const guardar = useMutation({
    mutationFn: async (): Promise<void> => {
      if (esEdicion) {
        await parquesApi.editar(parque.idParque, {
          direccion,
          kvasMt: nCapMt,
          kvasBt: nCapBt,
          dotacionMtNave: nDotMt,
          dotacionBtNave: nDotBt,
        });
        return;
      }
      await parquesApi.crear({
        nomParque: nomParque.trim(),
        direccion,
        naves: nNaves,
        kvasMt: nCapMt,
        kvasBt: nCapBt,
        dotacionMtNave: nDotMt,
        dotacionBtNave: nDotBt,
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
      if (!Number.isInteger(nNaves) || nNaves < 1)
        return setError('Indica cuántas naves generar (mínimo 1).');
      if (excede)
        return setError('La dotación por nave no cabe en la capacidad del parque.');
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

        {/* DOTACIÓN por nave: lo que le toca a cada una por disposición. */}
        <fieldset className="rounded-lg border bg-gray-50/70 p-3">
          <legend className="px-1 text-xs font-medium text-gray-600">
            KVA's por nave
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-gray-600">
              Media tensión
              <input
                type="number"
                step="0.01"
                value={dotMt}
                onChange={(e) => setDotMt(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block text-xs text-gray-600">
              Baja tensión
              <input
                type="number"
                step="0.01"
                value={dotBt}
                onChange={(e) => setDotBt(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>
          <p className="mt-2 text-[11px] text-gray-500">
            Es lo que le toca a cada nave por disposición. Se puede cambiar nave por
            nave después.
            {esEdicion && ' Al editar, solo aplica a las naves que se agreguen luego.'}
          </p>

          {!esEdicion && nNaves > 0 && (
            <p
              className={`mt-2 text-[11px] ${excede ? 'font-medium text-red-600' : 'text-gray-500'}`}
            >
              {nNaves} naves ×{' '}
              {nDotBt.toLocaleString('es-MX', { maximumFractionDigits: 2 })} ={' '}
              {(nNaves * nDotBt).toLocaleString('es-MX', { maximumFractionDigits: 2 })} de
              baja
              {excedeBt
                ? ` · exceden la capacidad en ${(nNaves * nDotBt - nCapBt).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`
                : ` · quedan ${(nCapBt - nNaves * nDotBt).toLocaleString('es-MX', { maximumFractionDigits: 2 })} sin dotar`}
              {nDotMt > 0 &&
                (excedeMt
                  ? ` · media excede en ${(nNaves * nDotMt - nCapMt).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`
                  : ` · media: ${(nNaves * nDotMt).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`)}
            </p>
          )}
        </fieldset>

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
            disabled={guardar.isPending || excede}
            title={excede ? 'La dotación por nave no cabe en la capacidad.' : undefined}
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
