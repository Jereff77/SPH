import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  solicitudesApi,
  type SolicitudCxP,
  type EditarSolicitudDto,
} from './solicitudes.api';
import { ApiRequestError } from '@/lib/api';

interface Props {
  solicitud: SolicitudCxP;
  onClose: () => void;
  onGuardada: () => void;
}

const inputCls =
  'mt-1 block w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30';

export function EditarSolicitudModal({ solicitud, onClose, onGuardada }: Props) {
  const { data: cat } = useQuery({
    queryKey: ['cxp-solicitudes-catalogos'],
    queryFn: () => solicitudesApi.catalogos(),
    staleTime: 5 * 60 * 1000,
  });

  const [idProveedor, setIdProveedor] = useState(solicitud.idProveedor);
  const [idCategoria, setIdCategoria] = useState(solicitud.idCategoria);
  const [concepto, setConcepto] = useState(solicitud.concepto ?? '');
  const [folio, setFolio] = useState(solicitud.folio ?? '');
  const [subtotal, setSubtotal] = useState(String(solicitud.subtotal ?? 0));
  const [total, setTotal] = useState(String(solicitud.total ?? 0));
  const [fecCFDI, setFecCFDI] = useState(solicitud.fecCFDI ?? '');
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () => {
      const prov = cat?.proveedores.find((p) => p.idProveedor === idProveedor);
      const dto: EditarSolicitudDto = {
        idProveedor,
        nombreProveedor: prov?.razonSocial ?? solicitud.nombreProveedor ?? '',
        nomCFDI: solicitud.nomCFDI ?? '',
        idCategoria,
        concepto: concepto.trim(),
        folio: folio.trim(),
        subtotal: Number(subtotal) || 0,
        total: Number(total) || 0,
        moneda: solicitud.moneda || 'MXN',
        fecCFDI: fecCFDI.trim() === '' ? null : fecCFDI,
      };
      return solicitudesApi.editar(solicitud.idCxp, dto);
    },
    onSuccess: onGuardada,
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo guardar.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!idProveedor) return setError('Selecciona un proveedor.');
    if (!idCategoria) return setError('Selecciona una cuenta.');
    if (concepto.trim() === '') return setError('El concepto es obligatorio.');
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
        className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-gray-800">Editar solicitud</h2>
        <p className="text-xs text-gray-400">
          Edición de datos (los archivos CFDI no se modifican aquí).
        </p>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <label className="block text-xs text-gray-600">
          Proveedor *
          <select
            value={idProveedor}
            onChange={(e) => setIdProveedor(e.target.value)}
            className={inputCls}
          >
            {/* Conserva el proveedor actual aunque no esté en el catálogo activo. */}
            {!cat?.proveedores.some((p) => p.idProveedor === idProveedor) && (
              <option value={idProveedor}>
                {solicitud.nombreProveedor ?? idProveedor}
              </option>
            )}
            {cat?.proveedores.map((p) => (
              <option key={p.idProveedor} value={p.idProveedor}>
                {p.razonSocial}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-gray-600">
          Cuenta (categoría) *
          <select
            value={idCategoria}
            onChange={(e) => setIdCategoria(e.target.value)}
            className={inputCls}
          >
            {!cat?.categorias.some((c) => c.idCategoria === idCategoria) && (
              <option value={idCategoria}>{idCategoria}</option>
            )}
            {cat?.categorias.map((c) => (
              <option key={c.idCategoria} value={c.idCategoria}>
                {c.cuenta ?? c.idCategoria}
                {c.seccion ? ` · ${c.seccion}` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-gray-600">
          Concepto *
          <textarea
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            rows={2}
            className={inputCls}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-gray-600">
            Folio
            <input value={folio} onChange={(e) => setFolio(e.target.value)} className={inputCls} />
          </label>
          <label className="block text-xs text-gray-600">
            Fecha CFDI
            <input
              type="date"
              value={fecCFDI}
              onChange={(e) => setFecCFDI(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-xs text-gray-600">
            Subtotal
            <input
              type="number"
              step="0.01"
              value={subtotal}
              onChange={(e) => setSubtotal(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-xs text-gray-600">
            Total
            <input
              type="number"
              step="0.01"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>

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
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
