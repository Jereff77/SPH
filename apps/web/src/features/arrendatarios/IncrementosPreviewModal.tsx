import { Fragment, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  incrementosApi,
  type PlanPreview,
  type ResultadoAplicar,
} from './incrementos.api';
import { fechaCorta } from './arrendatarios.api';
import { IncrementosBitacora } from './IncrementosBitacora';
import { ApiRequestError } from '@/lib/api';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function dinero(n: number, moneda = 'MXN'): string {
  try {
    return n.toLocaleString('es-MX', { style: 'currency', currency: moneda });
  } catch {
    return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`;
  }
}

/**
 * Vista previa + confirmación de los incrementos de renta de un INPC capturado
 * (Parámetros → INPC, permiso 212). Nada se aplica sin el clic en «Aplicar
 * incrementos»; al terminar muestra el informe (aplicados/fallidos/correos).
 * Los planes ya aplicados con un valor distinto al vigente ofrecen
 * «Revertir y re-aplicar» (flujo de corrección).
 */
export function IncrementosPreviewModal({
  idInpc,
  onClose,
}: {
  idInpc: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [resultado, setResultado] = useState<ResultadoAplicar | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [verHistorial, setVerHistorial] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: prev, isLoading } = useQuery({
    queryKey: ['incrementos-preview', idInpc],
    queryFn: () => incrementosApi.preview(idInpc),
    staleTime: 0,
  });

  // Selección inicial: todos los aplicables
  useEffect(() => {
    if (prev) setSeleccion(new Set(prev.aplicables.map((p) => p.idArrePdp)));
  }, [prev]);

  const onError = (e: unknown) =>
    setError(e instanceof ApiRequestError ? e.message : 'Ocurrió un error.');

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ['incrementos-preview'] });
    void queryClient.invalidateQueries({ queryKey: ['incrementos-bitacora'] });
  };

  const aplicar = useMutation({
    mutationFn: () => incrementosApi.aplicar(idInpc, [...seleccion]),
    onSuccess: (r) => {
      setResultado(r);
      setError(null);
      invalidar();
    },
    onError,
  });

  const reaplicar = useMutation({
    mutationFn: (idIncremento: string) => incrementosApi.reaplicar(idIncremento),
    onSuccess: (r) => {
      setResultado(r);
      setError(null);
      invalidar();
    },
    onError,
  });

  const periodo = prev ? `${MESES[prev.inpc.mes - 1]} ${prev.inpc.anio}` : '';
  const mesAplic = prev ? `${MESES[prev.mesAplicacion.mes - 1]} ${prev.mesAplicacion.anio}` : '';
  const totalSel = useMemo(
    () => (prev ? prev.aplicables.filter((p) => seleccion.has(p.idArrePdp)) : []),
    [prev, seleccion],
  );

  function toggleSel(id: string) {
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const thCls = 'px-3 py-2 text-left text-xs font-semibold';

  function tablaPlanes(planes: PlanPreview[], conCheckbox: boolean) {
    return (
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="bg-[#1f2a4d] text-white">
            {conCheckbox && <th className={thCls} />}
            <th className={thCls}>Arrendatario</th>
            <th className={thCls}>Parque</th>
            <th className={thCls}>Nave</th>
            <th className={thCls}>Aniversario</th>
            <th className={`${thCls} text-center`}>Moneda</th>
            <th className={`${thCls} text-right`}>Renta actual</th>
            <th className={`${thCls} text-center`}>%</th>
            <th className={`${thCls} text-right`}>Renta nueva</th>
            <th className={thCls} />
          </tr>
        </thead>
        <tbody className="divide-y">
          {planes.map((p) => (
            <Fragment key={p.idArrePdp}>
              <tr className="hover:bg-gray-50">
                {conCheckbox && (
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={seleccion.has(p.idArrePdp)}
                      onChange={() => toggleSel(p.idArrePdp)}
                    />
                  </td>
                )}
                <td className="px-3 py-2">{p.empresa}</td>
                <td className="px-3 py-2">{p.parque}</td>
                <td className="px-3 py-2 text-center">{p.nave}</td>
                <td className="px-3 py-2">{fechaCorta(p.aniversario)}</td>
                <td className="px-3 py-2 text-center font-medium text-gray-500">{p.moneda}</td>
                <td className="px-3 py-2 text-right tabular-nums">{dinero(p.montoActual, p.moneda)}</td>
                <td className="px-3 py-2 text-center tabular-nums">
                  {p.incrementoPct ? `${p.incrementoPct.toFixed(2)}%` : '—'}
                </td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">
                  {p.montoNuevo ? dinero(p.montoNuevo, p.moneda) : '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  {p.conceptos.length > 0 && (
                    <button
                      onClick={() =>
                        setExpandido(expandido === p.idArrePdp ? null : p.idArrePdp)
                      }
                      className="text-xs text-[#3f5b87] hover:underline"
                    >
                      {expandido === p.idArrePdp ? 'Ocultar' : 'Conceptos'}
                    </button>
                  )}
                </td>
              </tr>
              {expandido === p.idArrePdp && (
                <tr>
                  <td colSpan={conCheckbox ? 10 : 9} className="bg-gray-50 px-6 py-2">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500">
                          <th className="py-1 text-left">Concepto</th>
                          <th className="py-1 text-right">Mensual actual</th>
                          <th className="py-1 text-center">Pts</th>
                          <th className="py-1 text-right">Mensual nuevo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.conceptos.map((c) => (
                          <tr key={c.concepto}>
                            <td className="py-0.5">{c.concepto}</td>
                            <td className="py-0.5 text-right tabular-nums">{dinero(c.montoActual, p.moneda)}</td>
                            <td className="py-0.5 text-center tabular-nums">{c.pts}</td>
                            <td className="py-0.5 text-right tabular-nums">{dinero(c.montoNuevo, p.moneda)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between bg-[#1f2a4d] px-5 py-3 text-white">
          <h2 className="text-base font-semibold">
            Incrementos de renta — INPC {periodo}
            {prev && (
              <span className="ml-2 text-sm font-normal text-white/70">
                ({prev.inpc.valor} · aniversarios de {mesAplic}, desfase {prev.desfaseMeses} meses)
              </span>
            )}
          </h2>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="scrollbar-hide flex-1 space-y-5 overflow-auto p-5">
          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          {isLoading && <p className="py-10 text-center text-gray-400">Calculando vista previa…</p>}

          {/* ================= Informe post-aplicación ================= */}
          {resultado && (
            <div className="space-y-3">
              <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                <p className="font-semibold text-green-800">
                  ✅ {resultado.aplicados.length} incremento(s) aplicado(s)
                </p>
                <ul className="mt-2 space-y-1 text-sm text-green-900">
                  {resultado.aplicados.map((a) => {
                    const mon = prev?.aplicables.find((p) => p.idArrePdp === a.idArrePdp)?.moneda;
                    return (
                      <li key={a.idIncremento}>
                        {a.empresa}: {dinero(a.montoActual, mon)} →{' '}
                        <strong>{dinero(a.montoNuevo, mon)}</strong>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-xs text-green-700">
                  {resultado.notificacion.sinSmtp
                    ? '⚠️ El correo del sistema no está configurado; los responsables NO fueron notificados (usa "Reenviar correo" desde la bitácora cuando se configure).'
                    : `📧 ${resultado.notificacion.correosEnviados} correo(s) enviado(s) a: ${resultado.notificacion.destinatarios.join(', ') || '—'}`}
                </p>
              </div>
              {resultado.fallidos.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
                  <p className="font-semibold text-red-800">
                    ❌ {resultado.fallidos.length} fallido(s)
                  </p>
                  <ul className="mt-1 space-y-1 text-red-900">
                    {resultado.fallidos.map((f) => (
                      <li key={f.idArrePdp}>
                        {f.empresa}: {f.motivo}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="text-right">
                <button
                  onClick={onClose}
                  className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039]"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}

          {/* ================= Vista previa ================= */}
          {prev && !resultado && (
            <>
              {prev.aplicables.length === 0 &&
                prev.manuales.length === 0 &&
                prev.omitidos.length === 0 && (
                  <p className="py-8 text-center text-gray-500">
                    Ningún plan vigente cumple aniversario en {mesAplic}.
                  </p>
                )}

              {prev.aplicables.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-gray-700">
                    ✅ Se aplicará el incremento a {totalSel.length} de {prev.aplicables.length}{' '}
                    plan(es)
                  </h3>
                  <div className="overflow-auto rounded-xl border">
                    {tablaPlanes(prev.aplicables, true)}
                  </div>
                </section>
              )}

              {prev.manuales.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-amber-700">
                    ⚠️ Requieren decisión manual ({prev.manuales.length}) — el automático no los
                    toca
                  </h3>
                  <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
                    {prev.manuales.map((p) => (
                      <p key={p.idArrePdp}>
                        <strong>{p.empresa}</strong> ({p.parque} · {p.nave}): {p.motivo}
                      </p>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <button
                  onClick={() => setVerHistorial((v) => !v)}
                  className="text-xs font-medium text-[#3f5b87] hover:underline"
                >
                  {verHistorial ? '▾ Ocultar historial de esta captura' : '▸ Historial de esta captura'}
                </button>
                {verHistorial && (
                  <div className="mt-2">
                    <IncrementosBitacora filtro={{ idInpc }} conPlan />
                  </div>
                )}
              </section>

              {prev.omitidos.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-gray-500">
                    Omitidos ({prev.omitidos.length})
                  </h3>
                  <div className="space-y-1 rounded-xl border bg-gray-50 p-3 text-sm text-gray-600">
                    {prev.omitidos.map((p) => (
                      <p key={p.idArrePdp} className="flex items-center justify-between gap-3">
                        <span>
                          <strong>{p.empresa}</strong> ({p.parque} · {p.nave}): {p.motivo}
                        </span>
                        {p.requiereReaplicacion && p.idIncremento && (
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Se revertirá el incremento aplicado con ${p.inpcAplicadoPrevio} y se re-aplicará con el INPC vigente ${prev.inpc.valor}. ¿Continuar?`,
                                )
                              )
                                reaplicar.mutate(p.idIncremento!);
                            }}
                            disabled={reaplicar.isPending}
                            className="shrink-0 rounded-lg border border-amber-400 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                          >
                            Revertir y re-aplicar
                          </button>
                        )}
                      </p>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {prev && !resultado && prev.aplicables.length > 0 && (
          <div className="flex items-center justify-end gap-3 border-t bg-gray-50 px-5 py-3">
            <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-white">
              Ahora no
            </button>
            <button
              onClick={() => aplicar.mutate()}
              disabled={aplicar.isPending || totalSel.length === 0}
              className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039] disabled:opacity-50"
            >
              {aplicar.isPending
                ? 'Aplicando…'
                : `Aplicar incrementos (${totalSel.length})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
