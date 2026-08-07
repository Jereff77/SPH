import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api';
import { parquesApi } from './parques.api';
import {
  kvasApi,
  type AsignacionKva,
  type EtapaKva,
  type FiguraKva,
  type NivelKva,
} from './kvas.api';

const inputCls =
  'mt-1 w-full rounded-lg border px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#1f2a4d]';

interface Props {
  idParque: string;
  /** `null` = alta nueva. */
  asignacion: AsignacionKva | null;
  /** Si el alta se abre DESDE una nave, viene fija y no se elige. */
  idNaveFijo?: string;
  naveEtiqueta?: string;
  onClose: () => void;
  onListo: () => void;
}

/**
 * Alta/edición de una asignación de KVA a una nave.
 *
 * La etapa «Asignado» significa que YA hay contrato con CFE, así que el número
 * de contrato se vuelve obligatorio (misma regla que valida el backend).
 *
 * ⛔ Al **bajar la cantidad de una VENTA** o **pasarla a RENTA** se pide un
 * motivo: los dos aflojan el candado de devolución de la nave. El backend lo
 * revalida — esto es solo para no hacer viajar al usuario.
 */
export function AsignacionKvaModal({
  idParque,
  asignacion,
  idNaveFijo,
  naveEtiqueta,
  onClose,
  onListo,
}: Props) {
  const esEdicion = !!asignacion;
  const [idNave, setIdNave] = useState(asignacion?.idNave ?? idNaveFijo ?? '');
  const [motivoAjuste, setMotivoAjuste] = useState('');
  const [nivel, setNivel] = useState<NivelKva>(asignacion?.nivel ?? 'BT');
  const [figura, setFigura] = useState<FiguraKva>(asignacion?.figura ?? 'VENTA');
  const [etapa, setEtapa] = useState<EtapaKva>(asignacion?.etapa ?? 'POR_ASIGNAR');
  const [cantKvas, setCantKvas] = useState(String(asignacion?.cantKvas ?? ''));
  const [contratoCfe, setContratoCfe] = useState(asignacion?.contratoCfe ?? '');
  const [fechaContratoCfe, setFechaContratoCfe] = useState(
    asignacion?.fechaContratoCfe ?? '',
  );
  const [error, setError] = useState<string | null>(null);

  const { data: naves } = useQuery({
    queryKey: ['parques', idParque, 'naves'],
    queryFn: () => parquesApi.naves(idParque),
    enabled: !esEdicion && !idNaveFijo,
  });

  // Los dos cambios que reducen lo pendiente por devolver sin documento.
  const eraVenta = asignacion?.figura === 'VENTA';
  const bajaCantidad = eraVenta && Number(cantKvas) < asignacion.cantKvas;
  const dejaDeSerVenta = eraVenta && figura !== 'VENTA';
  const exigeMotivo = !!(bajaCantidad || dejaDeSerVenta);

  const guardar = useMutation({
    mutationFn: async () => {
      const datos = {
        nivel,
        figura,
        etapa,
        cantKvas: Number(cantKvas),
        contratoCfe: contratoCfe.trim() || null,
        fechaContratoCfe: fechaContratoCfe || null,
      };
      if (esEdicion) {
        await kvasApi.editar(asignacion.idKvas, {
          ...datos,
          motivoAjuste: exigeMotivo ? motivoAjuste.trim() : null,
        });
        return;
      }
      await kvasApi.crear({ ...datos, idNave });
    },
    onSuccess: onListo,
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo guardar.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!esEdicion && !idNave) return setError('Selecciona la nave.');
    const n = Number(cantKvas);
    if (!Number.isFinite(n) || n <= 0)
      return setError('La cantidad de KVA debe ser mayor a 0.');
    if (etapa === 'ASIGNADO' && !contratoCfe.trim())
      return setError('Para marcar «Asignado» captura el contrato de CFE.');
    if (exigeMotivo && !motivoAjuste.trim())
      return setError('Escribe el motivo del ajuste.');
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
        <h2 className="text-base font-semibold text-gray-800">
          {esEdicion ? 'Editar asignación de KVA' : 'Asignar KVA'}
          {naveEtiqueta && (
            <span className="ml-1 font-normal text-gray-500">· nave {naveEtiqueta}</span>
          )}
        </h2>

        {!esEdicion && !idNaveFijo && (
          <label className="block text-xs text-gray-600">
            Nave
            <select
              value={idNave}
              onChange={(e) => setIdNave(e.target.value)}
              className={inputCls}
            >
              <option value="">Selecciona…</option>
              {(naves ?? []).map((n) => (
                <option key={n.idNave} value={n.idNave}>
                  {n.numNaveNAME ?? n.numNave}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-gray-600">
            Nivel de tensión
            <select
              value={nivel}
              onChange={(e) => setNivel(e.target.value as NivelKva)}
              className={inputCls}
            >
              <option value="MT">Media</option>
              <option value="BT">Baja</option>
            </select>
          </label>
          <label className="block text-xs text-gray-600">
            Figura
            <select
              value={figura}
              onChange={(e) => setFigura(e.target.value as FiguraKva)}
              className={inputCls}
            >
              <option value="VENTA">Vendido</option>
              <option value="RENTA">Rentado</option>
            </select>
          </label>
          <label className="block text-xs text-gray-600">
            Etapa
            <select
              value={etapa}
              onChange={(e) => setEtapa(e.target.value as EtapaKva)}
              className={inputCls}
            >
              <option value="POR_ASIGNAR">Por asignar</option>
              <option value="COMPROMETIDO">Comprometido</option>
              <option value="ASIGNADO">Asignado (con CFE)</option>
            </select>
          </label>
          <label className="block text-xs text-gray-600">
            Cantidad de KVA
            <input
              type="number"
              step="0.01"
              value={cantKvas}
              onChange={(e) => setCantKvas(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-xs text-gray-600">
            Contrato CFE
            <input
              value={contratoCfe}
              onChange={(e) => setContratoCfe(e.target.value)}
              placeholder="Nº de servicio"
              className={inputCls}
            />
          </label>
          <label className="block text-xs text-gray-600">
            Fecha del contrato
            <input
              type="date"
              value={fechaContratoCfe}
              onChange={(e) => setFechaContratoCfe(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>

        {figura === 'VENTA' && !exigeMotivo && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Los KVA vendidos se van con la nave: solo regresan al parque cuando se
            registra su devolución con documento.
          </p>
        )}

        {exigeMotivo && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
            <p className="text-xs font-medium text-amber-800">
              {dejaDeSerVenta
                ? 'Pasar esta venta a renta libera los KVA sin devolución acreditada.'
                : `Bajar la venta de ${asignacion!.cantKvas} a ${cantKvas || 0} KVA reduce lo pendiente por devolver, sin documento.`}
            </p>
            <p className="mt-0.5 text-[11px] text-amber-700">
              Si los KVA sí regresaron al parque, cierra esto y usa{' '}
              <strong>Devolución</strong>: ahí se adjunta el comprobante.
            </p>
            <label className="mt-2 block text-xs text-amber-900">
              Motivo del ajuste (queda en la auditoría)
              <input
                value={motivoAjuste}
                onChange={(e) => setMotivoAjuste(e.target.value)}
                placeholder="Se capturó de más por error"
                className={inputCls}
              />
            </label>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardar.isPending}
            className="rounded-lg bg-[#1f2a4d] px-3 py-1.5 text-sm text-white hover:bg-[#172039] disabled:opacity-50"
          >
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
