import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  aprobarApi,
  type SolicitudAprobar,
  type PresupuestoAprobacion,
} from './aprobar.api';
import { ApiRequestError } from '@/lib/api';

const moneda = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

export type AccionAprobar = 'regresar' | 'rechazar' | 'aprobar';

const META: Record<
  AccionAprobar,
  { titulo: string; boton: string; label: string; color: string }
> = {
  regresar: {
    titulo: 'Regresar solicitud',
    boton: 'Regresar',
    label: 'Motivo (qué debe corregir o completar) *',
    color: 'bg-amber-600 hover:bg-amber-700',
  },
  rechazar: {
    titulo: 'Rechazar solicitud',
    boton: 'Rechazar',
    label: 'Motivo del rechazo *',
    color: 'bg-red-600 hover:bg-red-700',
  },
  aprobar: {
    titulo: 'Aprobar solicitud',
    boton: 'Aprobar',
    label: 'Comentario (opcional)',
    color: 'bg-[#1f2a4d] hover:bg-[#172039]',
  },
};

/**
 * Modal de Regresar / Rechazar / Aprobar una solicitud. Muestra el panel de
 * presupuesto de la categoría; al aprobar, valida vía la RPC y muestra el mensaje.
 * Si está fuera de presupuesto y el usuario no es el aprobador FP, ofrece
 * reasignarla al aprobador autorizado a aprobar fuera de presupuesto.
 */
export function AprobarSolicitudModal({
  solicitud,
  accion,
  onClose,
  onHecho,
}: {
  solicitud: SolicitudAprobar;
  accion: AccionAprobar;
  onClose: () => void;
  onHecho: () => void;
}) {
  const meta = META[accion];
  const [comentario, setComentario] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null);

  const { data: pres } = useQuery<PresupuestoAprobacion>({
    queryKey: ['aprobar-presupuesto', solicitud.idCxp],
    queryFn: () => aprobarApi.presupuesto(solicitud.idCxp),
  });

  const onErr = (e: unknown) =>
    setError(e instanceof ApiRequestError ? e.message : 'Ocurrió un error.');

  const mAccion = useMutation({
    mutationFn: async () => {
      setError(null);
      if (accion === 'regresar') return aprobarApi.regresar(solicitud.idCxp, comentario);
      if (accion === 'rechazar') return aprobarApi.rechazar(solicitud.idCxp, comentario);
      return aprobarApi.aprobar(solicitud.idCxp, comentario);
    },
    onSuccess: (res) => {
      if (accion === 'aprobar') {
        const r = res as { autorizado: boolean; mensaje: string };
        if (r.autorizado) onHecho();
        else setResultado({ ok: false, msg: r.mensaje });
      } else {
        onHecho();
      }
    },
    onError: onErr,
  });

  const mFuera = useMutation({
    mutationFn: () => aprobarApi.fueraPresupuesto(solicitud.idCxp),
    onSuccess: onHecho,
    onError: onErr,
  });

  const requiereMotivo = accion !== 'aprobar';
  const comentarioOk = !requiereMotivo || comentario.trim().length >= 3;
  const puedeReasignar = accion === 'aprobar' && pres?.puedeReasignar;

  const fila = 'flex justify-between gap-3 text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-lg font-semibold text-gray-800">{meta.titulo}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          {/* Datos de la solicitud */}
          <div className="space-y-1 rounded-lg bg-gray-50 p-3">
            <div className={fila}>
              <span className="text-gray-500">Nombre</span>
              <span className="font-medium text-gray-800">{solicitud.nombreProveedor ?? solicitud.nomCFDI ?? '—'}</span>
            </div>
            <div className={fila}>
              <span className="text-gray-500">Folio</span>
              <span className="font-mono text-xs text-gray-600">{solicitud.folio ?? 'n/a'}</span>
            </div>
            <div className={fila}>
              <span className="text-gray-500">Concepto</span>
              <span className="text-right text-gray-700">{solicitud.concepto ?? '—'}</span>
            </div>
            <div className={fila}>
              <span className="text-gray-500">Cuenta</span>
              <span className="text-right text-gray-700">
                {[solicitud.cuenta, solicitud.seccion].filter(Boolean).join(' / ') || solicitud.idCategoria}
              </span>
            </div>
            <div className={fila}>
              <span className="text-gray-500">Subtotal</span>
              <span className="font-semibold text-gray-800">{moneda(solicitud.subtotal)}</span>
            </div>
          </div>

          {/* Panel de presupuesto */}
          {pres && pres.presupuestable && (
            <div className={`space-y-1 rounded-lg border p-3 ${pres.fuera ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Presupuesto de la categoría
              </p>
              <div className={fila}>
                <span className="text-gray-500">Presupuesto acumulado</span>
                <span className="tabular-nums text-gray-700">{moneda(pres.presupuestoAcumulado)}</span>
              </div>
              <div className={fila}>
                <span className="text-gray-500">Consumido</span>
                <span className="tabular-nums text-gray-700">{moneda(pres.subtotalGastado)}</span>
              </div>
              <div className={fila}>
                <span className="text-gray-500">Comprometido</span>
                <span className="tabular-nums text-gray-700">{moneda(pres.subtotalComprometido)}</span>
              </div>
              <div className={`${fila} border-t pt-1`}>
                <span className="font-medium text-gray-600">Gasto + esta solicitud</span>
                <span className={`font-semibold tabular-nums ${pres.fuera ? 'text-red-700' : 'text-gray-800'}`}>
                  {moneda(pres.gasto)} ({pres.avanceTotal.toFixed(0)}%)
                </span>
              </div>
              {pres.fuera && (
                <p className="pt-1 text-xs font-medium text-red-700">
                  ⚠️ Excede el presupuesto disponible.
                </p>
              )}
            </div>
          )}

          {/* Resultado del intento de aprobación (mensaje de la RPC) */}
          {resultado && (
            <div className={`rounded-md px-3 py-2 text-sm ${resultado.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {resultado.msg}
            </div>
          )}

          {/* Justificación */}
          <label className="block text-xs text-gray-600">
            {meta.label}
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={accion === 'aprobar' ? 'Comentario para el solicitante…' : 'Explica el motivo…'}
              className="mt-1 block w-full resize-none rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3">
          {puedeReasignar && (
            <button
              onClick={() => mFuera.mutate()}
              disabled={mFuera.isPending}
              className="mr-auto rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              {mFuera.isPending ? 'Solicitando…' : 'Solicitar aprobar fuera de presupuesto'}
            </button>
          )}
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={() => mAccion.mutate()}
            disabled={mAccion.isPending || !comentarioOk}
            title={!comentarioOk ? 'Indica el motivo' : undefined}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${meta.color}`}
          >
            {mAccion.isPending ? 'Procesando…' : meta.boton}
          </button>
        </div>
      </div>
    </div>
  );
}
