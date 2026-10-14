import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  arrendatariosApi,
  moneda,
  num,
  type DetallePartida as Partida,
} from './arrendatarios.api';

import { ApiRequestError } from '@/lib/api';

type CampoEditable = 'pm2' | 'constM2' | 'INPC' | 'ptsINPC';
type Moneda = 'MXN' | 'USD';

const esMoneda = (m: string | null | undefined): m is Moneda => m === 'MXN' || m === 'USD';

/** Resalta los meses de cortesía (gracia), como v1 (amarillo). */
const filaGracia = (g: Partida['tieneMesGratis']): string =>
  g === 'Si' ? 'bg-[#FCF3C6]' : g === 'Medio' ? 'bg-[#FCF8E0]' : '';

/**
 * Detalle (conceptos) de una partida del plan. Muestra cada concepto con su
 * pm2/constM2/INPC/ptsINPC y monto; resalta los meses de gracia. Si el plan es
 * modificable, permite editar un campo con doble clic (RPC server-side que
 * recalcula desde ese año). Réplica de `det_arre_pdp_widget` de v1.
 */
export function DetallePartida({
  idArrePdp,
  numPartida,
  divisa,
  modificable,
}: {
  idArrePdp: string;
  numPartida: number;
  divisa: string;
  modificable: boolean;
}) {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['arre-detalle', idArrePdp, numPartida],
    queryFn: () => arrendatariosApi.detalle(idArrePdp, numPartida),
  });

  const [editando, setEditando] = useState<{ id: string; campo: CampoEditable } | null>(null);
  const [valor, setValor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Moneda por concepto (desde el año de esta partida hacia abajo).
  const [editandoMoneda, setEditandoMoneda] = useState<string | null>(null);
  const [confirmarMoneda, setConfirmarMoneda] = useState<{
    p: Partida;
    moneda: Moneda;
    alcance: number;
  } | null>(null);
  // `pago`: el servidor respondió 409 (PAGO_APLICADO); solo entonces se sugiere desaplicar el pago.
  const [bloqueoMoneda, setBloqueoMoneda] = useState<{
    concepto: string;
    mensaje: string;
    pago: boolean;
  } | null>(null);

  const refrescar = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['arre-detalle', idArrePdp] }),
      queryClient.invalidateQueries({ queryKey: ['arre-resumen', idArrePdp] }),
      queryClient.invalidateQueries({ queryKey: ['notas'] }),
    ]);

  function cancelarMoneda() {
    setEditandoMoneda(null);
    setConfirmarMoneda(null);
    setBloqueoMoneda(null);
  }

  /** Al elegir otra moneda: revisa alcance y pagos SIN cambiar nada (confirmación / bloqueo). */
  async function elegirMoneda(p: Partida, nueva: Moneda) {
    setError(null);
    setConfirmarMoneda(null);
    setBloqueoMoneda(null);
    if (nueva === p.moneda) return;
    setGuardando(true);
    try {
      const r = await arrendatariosApi.cambiarMoneda(idArrePdp, {
        anioDesde: p.anio ?? 0,
        concepto: p.concepto ?? '',
        moneda: nueva,
        simular: true,
      });
      setConfirmarMoneda({ p, moneda: nueva, alcance: r.partidasAlcance });
    } catch (err) {
      setBloqueoMoneda({
        concepto: p.concepto ?? '',
        mensaje: err instanceof Error ? err.message : 'No se pudo revisar el cambio.',
        pago: err instanceof ApiRequestError && err.status === 409,
      });
    } finally {
      setGuardando(false);
    }
  }

  async function aplicarMoneda() {
    if (!confirmarMoneda) return;
    const { p, moneda: nueva } = confirmarMoneda;
    setGuardando(true);
    try {
      await arrendatariosApi.cambiarMoneda(idArrePdp, {
        anioDesde: p.anio ?? 0,
        concepto: p.concepto ?? '',
        moneda: nueva,
      });
      cancelarMoneda();
      await refrescar();
    } catch (err) {
      setConfirmarMoneda(null);
      setBloqueoMoneda({
        concepto: p.concepto ?? '',
        mensaje: err instanceof Error ? err.message : 'No se pudo cambiar la moneda.',
        pago: err instanceof ApiRequestError && err.status === 409,
      });
    } finally {
      setGuardando(false);
    }
  }

  function iniciar(p: Partida, campo: CampoEditable, actual: number | null) {
    if (!modificable) return;
    setError(null);
    setEditando({ id: p.idArrePdpDet, campo });
    setValor(actual != null ? String(actual) : '');
  }

  async function guardar(p: Partida, campo: CampoEditable) {
    const v = Number(valor);
    if (!Number.isFinite(v)) {
      setError('Valor inválido.');
      return;
    }
    setGuardando(true);
    try {
      await arrendatariosApi.editarCampo(idArrePdp, {
        anioDesde: p.anio ?? 0,
        concepto: p.concepto ?? '',
        campo,
        valor: v,
      });
      setEditando(null);
      // El cambio recalcula desde el año: refrescar detalle y corrida.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['arre-detalle', idArrePdp] }),
        queryClient.invalidateQueries({ queryKey: ['arre-resumen', idArrePdp] }),
        // MontseAI avisa del cambio manual en el chat del plan.
        queryClient.invalidateQueries({ queryKey: ['notas'] }),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  const celdaEditable = (p: Partida, campo: CampoEditable, actual: number | null) => {
    const enEdicion = editando?.id === p.idArrePdpDet && editando.campo === campo;
    if (enEdicion) {
      return (
        <div className="flex items-center justify-end gap-1">
          <input
            autoFocus
            type="number"
            step="0.0001"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-20 rounded border px-1 py-0.5 text-right text-xs"
          />
          <button
            type="button"
            disabled={guardando}
            onClick={() => guardar(p, campo)}
            className="rounded bg-[#1f2a4d] px-1.5 py-0.5 text-[10px] font-bold text-white disabled:opacity-50"
          >
            ✓
          </button>
          <button
            type="button"
            onClick={() => setEditando(null)}
            className="rounded border px-1.5 py-0.5 text-[10px] text-gray-500"
          >
            ✕
          </button>
        </div>
      );
    }
    return (
      <span
        onDoubleClick={() => iniciar(p, campo, actual)}
        title={modificable ? 'Doble clic para editar' : 'Plan no editable'}
        className={`tabular-nums ${modificable ? 'cursor-pointer hover:underline' : ''}`}
      >
        {num(actual)}
      </span>
    );
  };

  const celdaMoneda = (p: Partida) => {
    if (editandoMoneda === p.idArrePdpDet) {
      return (
        <select
          autoFocus
          disabled={guardando}
          value={esMoneda(p.moneda) ? p.moneda : ''}
          onChange={(e) => elegirMoneda(p, e.target.value as Moneda)}
          onBlur={() => {
            if (!confirmarMoneda && !guardando) cancelarMoneda();
          }}
          className="w-24 rounded-md border-2 border-[#1f2a4d] bg-white px-1.5 py-0.5 text-xs font-semibold text-[#1f2a4d]"
        >
          {!esMoneda(p.moneda) && (
            <option value="" disabled>
              Elegir…
            </option>
          )}
          <option value="MXN">MXN</option>
          <option value="USD">USD</option>
        </select>
      );
    }
    return (
      <span
        onDoubleClick={() => {
          if (!modificable || p.anio == null) return;
          cancelarMoneda();
          setEditandoMoneda(p.idArrePdpDet);
        }}
        title={
          !modificable
            ? 'Plan no editable'
            : p.anio == null
              ? 'La partida no tiene año: no se puede cambiar la moneda desde aquí'
              : 'Doble clic para editar'
        }
        className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${
          esMoneda(p.moneda)
            ? 'bg-[#e8ecf7] text-[#1f2a4d]'
            : 'border border-dashed border-amber-500 bg-amber-50 text-amber-700'
        } ${modificable ? 'cursor-pointer hover:underline' : ''}`}
      >
        {esMoneda(p.moneda) ? p.moneda : 'Sin moneda'}
      </span>
    );
  };

  if (isLoading) return <p className="text-xs text-gray-400">Cargando detalle…</p>;
  if (data.length === 0) return <p className="text-xs text-gray-400">Sin conceptos en esta partida.</p>;

  return (
    <div className="space-y-1">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr className="text-left uppercase tracking-wide text-gray-400">
            <th className="px-2 py-1">Concepto</th>
            <th className="px-2 py-1 text-right">$ × m²</th>
            <th className="px-2 py-1 text-right">const m²</th>
            <th className="px-2 py-1 text-right">INPC</th>
            <th className="px-2 py-1 text-right">pts INPC</th>
            <th className="px-2 py-1 text-right">Monto</th>
            <th className="px-2 py-1 text-left text-[#1f2a4d]">Moneda</th>
            <th className="px-2 py-1 text-center">Cortesía</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.idArrePdpDet} className={`border-t ${filaGracia(p.tieneMesGratis)}`}>
              <td className="px-2 py-1">{p.concepto ?? '—'}</td>
              <td className="px-2 py-1 text-right">{celdaEditable(p, 'pm2', p.pm2)}</td>
              <td className="px-2 py-1 text-right">{celdaEditable(p, 'constM2', p.constM2)}</td>
              <td className="px-2 py-1 text-right">{celdaEditable(p, 'INPC', p.INPC)}</td>
              <td className="px-2 py-1 text-right">{celdaEditable(p, 'ptsINPC', p.ptsINPC)}</td>
              <td className="px-2 py-1 text-right tabular-nums font-medium">
                {moneda(p.cantidad, esMoneda(p.moneda) ? p.moneda : divisa)}
              </td>
              <td className="px-2 py-1 text-left">{celdaMoneda(p)}</td>
              <td className="px-2 py-1 text-center">
                {p.tieneMesGratis === 'Si' ? '🟡' : p.tieneMesGratis === 'Medio' ? '🟡½' : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {confirmarMoneda && (
        <div className="mt-2 flex items-center justify-between gap-4 rounded-lg border border-[#1f2a4d] bg-white p-3">
          <div className="space-y-0.5">
            <p className="text-sm font-bold text-[#1f2a4d]">
              Cambiar la moneda de «{confirmarMoneda.p.concepto}» a {confirmarMoneda.moneda}
            </p>
            <p className="text-xs text-gray-500">
              Aplica desde el año {confirmarMoneda.p.anio ?? 0} hacia abajo:{' '}
              {confirmarMoneda.alcance} partidas. Ninguna tiene pagos aplicados.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={guardando}
              onClick={cancelarMoneda}
              className="rounded-lg border border-[#1f2a4d] px-3 py-1.5 text-xs font-semibold text-[#1f2a4d] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={guardando}
              onClick={aplicarMoneda}
              className="rounded-lg bg-[#1f2a4d] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Aplicar cambio
            </button>
          </div>
        </div>
      )}
      {bloqueoMoneda && (
        <div className="mt-2 flex items-start justify-between gap-4 rounded-lg border border-red-600 bg-red-50 p-3">
          <div className="space-y-0.5">
            <p className="text-sm font-bold text-red-600">
              No se puede cambiar la moneda de «{bloqueoMoneda.concepto}»
            </p>
            <p className="text-xs text-gray-800">
              {bloqueoMoneda.mensaje}
              {bloqueoMoneda.pago &&
                ' Cambiarla descuadraría la cobranza: desaplica el pago desde Cobranza o pide apoyo a soporte.'}
            </p>
          </div>
          <button
            type="button"
            onClick={cancelarMoneda}
            className="shrink-0 rounded-lg border border-red-600 px-3 py-1.5 text-xs font-semibold text-red-600"
          >
            Entendido
          </button>
        </div>
      )}
    </div>
  );
}
