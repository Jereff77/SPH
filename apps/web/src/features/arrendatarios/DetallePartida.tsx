import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  arrendatariosApi,
  moneda,
  num,
  type DetallePartida as Partida,
} from './arrendatarios.api';

type CampoEditable = 'pm2' | 'constM2' | 'INPC' | 'ptsINPC';

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
                {moneda(p.cantidad, divisa)}
              </td>
              <td className="px-2 py-1 text-center">
                {p.tieneMesGratis === 'Si' ? '🟡' : p.tieneMesGratis === 'Medio' ? '🟡½' : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
