import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { THEAD_STICKY, THEAD_TR } from '@/components/tabla/SortableTh';
import { useAuth } from '@/features/auth/useAuth';
import {
  arrendatariosApi,
  fechaCorta,
  montoExacto,
  type DepositoPlanResumen,
  type TraspasoDto,
} from './arrendatarios.api';
import {
  MOTIVO_MAX,
  MOTIVO_MIN,
  etiquetaPlan,
  invalidarTraspasos,
  mensajeError,
  reversaBloqueada,
} from './traspaso-deposito.util';

const BTN_SEC = 'rounded-lg border px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50';
const BTN_PRI =
  'rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Franja azul «Depósito de garantía» sobre la corrida del plan (D14): contractual ·
 * traspasado · por cobrar, con «Ver traspasos» que despliega la lista del plan. Mismo patrón
 * que la franja verde de incrementos INPC. En el **destino** la lista trae «Recibido de …»
 * con [Revertir] (permiso 25); en el **origen** solo una nota gris (se revierte desde el
 * destino). Visible solo si el plan tiene traspasos aplicados.
 */
export function ResumenDeposito({ idArrePdp, divisa }: { idArrePdp: string; divisa: string }) {
  const { tienePermiso } = useAuth();
  const [abierta, setAbierta] = useState(false);
  const [revertir, setRevertir] = useState<TraspasoDto | null>(null);
  const { data } = useQuery({
    queryKey: ['arre-deposito', idArrePdp],
    queryFn: () => arrendatariosApi.depositoPlan(idArrePdp),
  });

  const d = data?.deposito ?? null;
  const traspasos = data?.traspasos ?? [];
  // Solo con traspasos APLICADOS (como destino u origen): los planes sin traspasos no cambian de aspecto.
  if (!d || !traspasos.some((t) => t.estado === 'aplicado')) return null;

  // Moneda de la partida; si viene vacía/sucia ('' o 'null'), la del plan.
  const mon = d.moneda === 'USD' || d.moneda === 'MXN' ? d.moneda : divisa === 'USD' ? 'USD' : 'MXN';
  const recibidos = traspasos.filter((t) => t.direccion === 'recibido');
  const emitidos = traspasos.filter((t) => t.direccion === 'emitido' && t.estado === 'aplicado');
  const marcoPagada = recibidos.find((t) => t.estado === 'aplicado' && t.marcoPagada);
  const puedeRevertir = tienePermiso(25);

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-[#c9d6ee] bg-[#eef3fb] px-4 py-2 text-xs text-[#1f2a4d]">
        <span>
          💼 <b>Depósito de garantía:</b> contractual <b>{montoExacto(d.contractual, mon)}</b>
          {' · '}
          {d.recibido > 0 || d.emitido === 0 ? (
            <>
              traspasado <b>{montoExacto(d.recibido, mon)}</b>
              {' · '}
            </>
          ) : null}
          {d.emitido > 0 && (
            <>
              traspasado a otro contrato <b>{montoExacto(d.emitido, mon)}</b>
              {' · '}
            </>
          )}
          por cobrar <b>{montoExacto(d.porCobrar, mon)}</b>
          {d.pagadaPorTraspaso && marcoPagada && (
            <span className="ml-2 inline-block rounded-full bg-green-100 px-2 py-px text-[11px] font-semibold text-green-700">
              Pagado por traspaso el {fechaCorta(marcoPagada.fecTraspaso)}
            </span>
          )}
        </span>
        {traspasos.length > 0 && (
          <button
            type="button"
            onClick={() => setAbierta((v) => !v)}
            aria-expanded={abierta}
            className="shrink-0 font-medium text-[#3f5b87] hover:underline"
          >
            Ver traspasos {abierta ? '▴' : '▾'}
          </button>
        )}
      </div>

      {abierta && traspasos.length > 0 && (
        <div className="mb-2 space-y-2 rounded-xl border border-gray-200 bg-white p-2">
          {recibidos.length > 0 && (
            <div className="scrollbar-hide max-h-60 overflow-auto">
              <table className="min-w-full border-collapse text-[13px]">
                <thead className={THEAD_STICKY}>
                  <tr className={THEAD_TR}>
                    <th className="px-3 py-2.5">Recibido de</th>
                    <th className="px-3 py-2.5 text-right">Monto</th>
                    <th className="px-3 py-2.5">Fecha</th>
                    <th className="px-3 py-2.5">Nota</th>
                    <th className="px-3 py-2.5">Registró</th>
                    <th className="px-3 py-2.5">Estado</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recibidos.map((t) => {
                    const aplicado = t.estado === 'aplicado';
                    return (
                      <tr key={t.id} className={aplicado ? 'bg-white' : 'bg-gray-50 text-gray-400'}>
                        <td className="px-3 py-1.5">{etiquetaPlan(t.contraparte)}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                          {montoExacto(t.monto, t.moneda === 'USD' ? 'USD' : mon)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">
                          {fechaCorta(t.fecTraspaso)}
                        </td>
                        <td className="max-w-[16rem] truncate px-3 py-1.5" title={t.nota}>
                          {t.nota}
                        </td>
                        <td className="px-3 py-1.5">{t.registro.autor ?? '—'}</td>
                        <td className="px-3 py-1.5">
                          <span
                            title={!aplicado ? (t.reversion?.motivo ?? undefined) : undefined}
                            className={`inline-block rounded-full px-2 py-px text-[11px] font-semibold ${
                              aplicado ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {aplicado ? 'Aplicado' : 'Revertido'}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {aplicado && puedeRevertir && (
                            <button
                              type="button"
                              onClick={() => setRevertir(t)}
                              className="rounded-lg border border-red-500 px-2.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              Revertir
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {emitidos.map((t) => (
            <p key={t.id} className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs text-gray-500">
              Este depósito se traspasó a <b>{etiquetaPlan(t.contraparte)}</b>:{' '}
              {montoExacto(t.monto, t.moneda === 'USD' ? 'USD' : mon)}. Sin acción aquí; se revierte
              desde el contrato destino. Sus datos originales no cambian.
            </p>
          ))}
        </div>
      )}

      {revertir && (
        <RevertirTraspasoModal
          traspaso={revertir}
          deposito={d}
          divisa={mon}
          onClose={() => setRevertir(null)}
        />
      )}
    </>
  );
}

/** Modal «Revertir traspaso»: consecuencia en texto + motivo obligatorio (5–400). */
function RevertirTraspasoModal({
  traspaso,
  deposito,
  divisa,
  onClose,
}: {
  traspaso: TraspasoDto;
  deposito: DepositoPlanResumen;
  divisa: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<{ mensaje: string; bloqueo: boolean } | null>(null);

  const mon = traspaso.moneda === 'USD' ? 'USD' : divisa;
  const valido = motivo.trim().length >= MOTIVO_MIN && motivo.trim().length <= MOTIVO_MAX;

  async function revertir() {
    if (!valido || enviando) return;
    setError(null);
    setEnviando(true);
    try {
      await arrendatariosApi.revertirTraspaso(traspaso.id, motivo.trim());
      invalidarTraspasos(queryClient);
      onClose();
    } catch (err) {
      setError({
        mensaje: mensajeError(err, 'No se pudo revertir el traspaso.'),
        // Una regla de orden/estado lo impide (primero desaplicar el pago, revertir otro…).
        bloqueo: reversaBloqueada(err),
      });
    } finally {
      setEnviando(false);
    }
  }

  if (error?.bloqueo) {
    return (
      <Modal
        abierto
        onCerrar={onClose}
        titulo="Revertir traspaso"
        ancho="md"
        cabeceraAzul
        pie={
          <button type="button" onClick={onClose} className={BTN_PRI}>
            Entendido
          </button>
        }
      >
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
          <b>No se puede revertir todavía.</b> {error.mensaje}
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      abierto
      onCerrar={onClose}
      titulo="Revertir traspaso"
      ancho="md"
      cabeceraAzul
      bloqueado={enviando}
      pie={
        <>
          <button type="button" onClick={onClose} disabled={enviando} className={BTN_SEC}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void revertir()}
            disabled={!valido || enviando}
            className={BTN_PRI}
          >
            {enviando ? 'Revirtiendo…' : 'Revertir'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <table className="w-full border-collapse overflow-hidden rounded-lg border border-gray-200 text-[13px]">
          <tbody className="divide-y divide-gray-200">
            <tr>
              <td className="px-3 py-1.5">Monto</td>
              <td className="px-3 py-1.5 text-right font-bold tabular-nums">
                {montoExacto(traspaso.monto, mon)}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-1.5">Origen</td>
              <td className="px-3 py-1.5 text-right">
                {etiquetaPlan(traspaso.contraparte)}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-1.5">Fecha / nota</td>
              <td className="px-3 py-1.5 text-right">
                {fechaCorta(traspaso.fecTraspaso)} · {traspaso.nota}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          El contrato destino volverá a tener por cobrar <b>{montoExacto(traspaso.monto, mon)} más</b>{' '}
          (quedaría en {montoExacto(deposito.cantidad + traspaso.monto, mon)}). El depósito del origen
          quedará disponible de nuevo.
        </p>

        <label className="block text-xs text-gray-600">
          Motivo (obligatorio, mín. {MOTIVO_MIN} caracteres)
          <input
            type="text"
            value={motivo}
            maxLength={MOTIVO_MAX}
            disabled={enviando}
            onChange={(e) => setMotivo(e.target.value)}
            className="mt-1 block w-full rounded border px-2 py-1.5 text-sm text-gray-800"
          />
        </label>

        {error && <p className="text-xs text-red-600" role="alert">{error.mensaje}</p>}
      </div>
    </Modal>
  );
}
