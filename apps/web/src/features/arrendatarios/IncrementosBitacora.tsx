import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { incrementosApi, type IncrementoBitacora } from './incrementos.api';
import { fechaCorta } from './arrendatarios.api';
import { ApiRequestError } from '@/lib/api';

function dinero(n: number | undefined, moneda = 'MXN'): string {
  if (typeof n !== 'number') return '—';
  try {
    return n.toLocaleString('es-MX', { style: 'currency', currency: moneda });
  } catch {
    return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`;
  }
}

const ORIGEN_LABEL: Record<IncrementoBitacora['origen'], string> = {
  automatico: 'Automático',
  manual: 'Manual',
  reaplicacion: 'Re-aplicación',
};

/**
 * Bitácora de incrementos INPC (tabla `arre_incrementos`), filtrable por plan
 * (Planes de Renta, clave 20) o por captura (Parámetros → INPC, 212). Acciones
 * (solo con permiso 212 server-side): revertir con motivo, re-aplicar cuando
 * el valor aplicado difiere del vigente, y reenviar el correo.
 */
export function IncrementosBitacora({
  filtro,
  conPlan = false,
}: {
  filtro: { idArrePdp?: string; idInpc?: string };
  /** Mostrar columnas Empresa/Nave (vista por captura). */
  conPlan?: boolean;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  /** Mensaje de resultado de la última acción (reenviar/revertir/re-aplicar). */
  const [aviso, setAviso] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ['incrementos-bitacora', filtro.idArrePdp ?? '', filtro.idInpc ?? ''],
    queryFn: () => incrementosApi.bitacora(filtro),
  });

  const invalidar = () => {
    setError(null);
    void queryClient.invalidateQueries({ queryKey: ['incrementos-bitacora'] });
    void queryClient.invalidateQueries({ queryKey: ['incrementos-preview'] });
    void queryClient.invalidateQueries({ queryKey: ['arre-resumen'] });
  };
  const onError = (e: unknown) => {
    setAviso(null);
    setError(e instanceof ApiRequestError ? e.message : 'Ocurrió un error.');
  };

  const revertir = useMutation({
    mutationFn: (v: { id: string; motivo: string }) => incrementosApi.revertir(v.id, v.motivo),
    onSuccess: (r) => {
      setAviso(
        r.filasRestauradas > 0
          ? `✅ Incremento revertido: ${r.filasRestauradas} fila(s) de la corrida restauradas a su valor previo.`
          : '✅ Reserva incompleta liberada (la corrida no se había modificado).',
      );
      invalidar();
    },
    onError,
  });
  const reaplicar = useMutation({
    mutationFn: (id: string) => incrementosApi.reaplicar(id),
    onSuccess: (r) => {
      const fallo = r.fallidos[0] ?? null;
      const manual = r.manuales[0] ?? null;
      setAviso(
        r.aplicados.length > 0
          ? `✅ Re-aplicado con el INPC vigente (${r.aplicados.length} plan(es)). ${r.notificacion.correosEnviados > 0 ? `📧 Correo de corrección a: ${r.notificacion.destinatarios.join(', ')}` : ''}`
          : `⚠️ Se revirtió pero NO se re-aplicó: ${fallo?.motivo ?? manual?.motivo ?? 'revisa la vista previa del INPC'}. El plan quedó con la renta previa.`,
      );
      invalidar();
    },
    onError,
  });
  const reenviar = useMutation({
    mutationFn: (id: string) => incrementosApi.reenviarCorreo(id),
    onSuccess: (r) => {
      if (r.notificacion.sinSmtp)
        setAviso('⚠️ No se envió: el correo del sistema (SMTP) no está configurado en el servidor.');
      else if (r.notificacion.correosEnviados === 0)
        setAviso('⚠️ No se envió: no hay responsables ni gerente con correo válido para estos parques (asígnalos en Arrendatarios → Responsables).');
      else
        setAviso(`📧 Correo reenviado a: ${r.notificacion.destinatarios.join(', ')}.`);
      invalidar();
    },
    onError,
  });

  function pedirReversion(r: IncrementoBitacora) {
    const motivo = window.prompt(
      `Se restaurará la renta previa del plan (año ${r.anioAplicado}) desde el snapshot.\nMotivo de la reversión:`,
    );
    if (motivo && motivo.trim().length >= 5) revertir.mutate({ id: r.id, motivo: motivo.trim() });
    else if (motivo != null) setError('Describe el motivo de la reversión (mínimo 5 caracteres).');
  }

  if (isLoading) return <p className="py-4 text-center text-sm text-gray-400">Cargando bitácora…</p>;
  if (!data.length)
    return <p className="py-4 text-center text-sm text-gray-400">Sin incrementos registrados.</p>;

  return (
    <div className="space-y-2">
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {aviso && (
        <div
          className={`rounded-md px-3 py-2 text-sm ${
            aviso.startsWith('⚠️') ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-800'
          }`}
        >
          {aviso}
        </div>
      )}
      <div className="overflow-auto rounded-xl border">
        <table className="w-full min-w-[820px] text-xs">
          <thead>
            <tr className="bg-[#1f2a4d] text-white">
              <th className="px-3 py-2 text-left">Fecha</th>
              {conPlan && <th className="px-3 py-2 text-left">Arrendatario</th>}
              {conPlan && <th className="px-3 py-2 text-left">Nave</th>}
              <th className="px-3 py-2 text-center">Año</th>
              <th className="px-3 py-2 text-center">INPC + pts</th>
              <th className="px-3 py-2 text-right">Renta</th>
              <th className="px-3 py-2 text-center">Origen</th>
              <th className="px-3 py-2 text-center">Estado</th>
              <th className="px-3 py-2 text-left">Aplicó</th>
              <th className="px-3 py-2 text-left">Correo</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((r) => (
              <tr key={r.id} className={r.estado === 'revertido' ? 'bg-gray-50 text-gray-400' : ''}>
                <td className="px-3 py-2 whitespace-nowrap">{fechaCorta(r.fc)}</td>
                {conPlan && (
                  <td className="px-3 py-2">{(r as IncrementoBitacora & { empresa?: string }).empresa ?? '—'}</td>
                )}
                {conPlan && (
                  <td className="px-3 py-2">{(r as IncrementoBitacora & { nave?: string }).nave ?? '—'}</td>
                )}
                <td className="px-3 py-2 text-center">{r.anioAplicado}</td>
                <td className="px-3 py-2 text-center tabular-nums">
                  {r.idInpc === 'MANUAL' ? (
                    <span title="Edición manual desde la corrida">✍️ manual</span>
                  ) : (
                    <>
                      {r.inpcAplicado} + {r.ptsAplicados}
                      {r.desactualizado && (
                        <span
                          className="ml-1 cursor-help text-amber-600"
                          title={`El INPC vigente de ${r.inpcPeriodo} es ${r.inpcVigente}, distinto al aplicado`}
                        >
                          ⚠️
                        </span>
                      )}
                    </>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                  {r.detalle?.montoActual != null
                    ? `${dinero(r.detalle.montoActual, r.detalle.moneda)} → ${dinero(r.detalle.montoNuevo, r.detalle.moneda)}${r.detalle.moneda && r.detalle.moneda !== 'MXN' ? ` (${r.detalle.moneda})` : ''}`
                    : '—'}
                </td>
                <td className="px-3 py-2 text-center">{ORIGEN_LABEL[r.origen]}</td>
                <td className="px-3 py-2 text-center">
                  {r.estado === 'aplicado' ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">Aplicado</span>
                  ) : (
                    <span
                      className="cursor-help rounded-full bg-gray-200 px-2 py-0.5"
                      title={`Revertido por ${r.revertidoPorNombre ?? '—'} el ${fechaCorta(r.fecReversion)} — ${r.motivoReversion ?? ''}`}
                    >
                      Revertido
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">{r.aplicadoPor}</td>
                <td className="px-3 py-2">
                  {r.fecNotificacion ? (
                    <span
                      className="cursor-help"
                      title={(r.correoNotificado ?? []).join(', ')}
                    >
                      📧 {fechaCorta(r.fecNotificacion)} ({r.correoNotificado?.length ?? 0})
                    </span>
                  ) : r.estado === 'aplicado' && r.idInpc !== 'MANUAL' ? (
                    <span className="text-amber-600">Sin notificar</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {r.estado === 'aplicado' && r.idInpc !== 'MANUAL' && (
                    <>
                      {r.desactualizado && (
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                `Se revertirá el incremento (aplicado con ${r.inpcAplicado}) y se re-aplicará con el INPC vigente ${r.inpcVigente}. ¿Continuar?`,
                              )
                            )
                              reaplicar.mutate(r.id);
                          }}
                          disabled={reaplicar.isPending}
                          className="mr-2 font-medium text-amber-700 hover:underline disabled:opacity-40"
                        >
                          {reaplicar.isPending ? 'Re-aplicando…' : 'Re-aplicar'}
                        </button>
                      )}
                      <button
                        onClick={() => reenviar.mutate(r.id)}
                        disabled={reenviar.isPending}
                        className="mr-2 font-medium text-[#3f5b87] hover:underline disabled:opacity-40"
                        title="Reenviar el correo a responsables y gerente"
                      >
                        {reenviar.isPending ? 'Enviando…' : 'Reenviar correo'}
                      </button>
                      <button
                        onClick={() => pedirReversion(r)}
                        disabled={revertir.isPending}
                        className="font-medium text-red-600 hover:underline disabled:opacity-40"
                      >
                        {revertir.isPending ? 'Revirtiendo…' : 'Revertir'}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Modal contenedor de la bitácora (historial por plan en Planes de Renta). */
export function IncrementosBitacoraModal({
  filtro,
  titulo,
  onClose,
}: {
  filtro: { idArrePdp?: string; idInpc?: string };
  titulo: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between bg-[#1f2a4d] px-5 py-3 text-white">
          <h2 className="text-base font-semibold">{titulo}</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="scrollbar-hide overflow-auto p-5">
          <IncrementosBitacora filtro={filtro} conPlan={!filtro.idArrePdp} />
        </div>
      </div>
    </div>
  );
}
