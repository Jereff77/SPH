import { num, fechaCorta, type ImportarEstadoCuentaResultado } from './arrendatarios.api';

/**
 * Modal con el resumen de una importación de estado de cuenta: cuántos SPEI
 * recibidos se registraron, cuántos ya existían y el detalle de los nuevos.
 */
export function ImportarEstadoCuentaModal({
  resultado,
  onClose,
}: {
  resultado: ImportarEstadoCuentaResultado;
  onClose: () => void;
}) {
  const { totalSpei, nuevos, yaExistian, montoNuevos, filas } = resultado;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between bg-[#1f2a4d] px-5 py-3 text-white">
          <h2 className="text-base font-semibold">Importación de estado de cuenta</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3 overflow-auto p-5">
          {/* Resumen */}
          <div className="flex flex-wrap gap-2">
            <Resumen label="SPEI en archivo" valor={String(totalSpei)} />
            <Resumen label="Nuevos registrados" valor={String(nuevos)} clase="text-green-600" />
            <Resumen label="Ya existían" valor={String(yaExistian)} clase="text-gray-500" />
            <Resumen label="Monto nuevo (MXN)" valor={num(montoNuevos)} clase="text-[#1f2a4d]" />
          </div>

          {totalSpei === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              No se encontraron «SPEI Recibido» en el archivo. Verifica que sea el estado de cuenta
              de BanBajío.
            </p>
          ) : nuevos === 0 ? (
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
              Todos los SPEI recibidos del archivo ya estaban registrados. No se duplicó nada.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Se registraron <b>{nuevos}</b> movimiento(s) nuevo(s). Ya puedes aplicarlos a las
                rentas con el botón <span className="font-semibold text-amber-600">💲</span>.
              </p>
              <div className="overflow-auto rounded-lg border">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-left text-gray-500">
                    <tr className="[&>th]:px-3 [&>th]:py-1.5">
                      <th>Fecha</th>
                      <th>Banco</th>
                      <th>Ordenante</th>
                      <th>Concepto</th>
                      <th className="text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filas.map((f) => (
                      <tr key={f.rastreo} className="[&>td]:px-3 [&>td]:py-1.5">
                        <td className="whitespace-nowrap">{fechaCorta(f.fecOperacion)}</td>
                        <td className="whitespace-nowrap">{f.bancoEmisor ?? '—'}</td>
                        <td>{f.ordenante ?? '—'}</td>
                        <td>{f.cancepto ?? '—'}</td>
                        <td className="whitespace-nowrap text-right font-semibold tabular-nums">
                          {num(f.importe)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end border-t px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a]"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function Resumen({ label, valor, clase }: { label: string; valor: string; clase?: string }) {
  return (
    <div className="flex min-w-[120px] flex-1 flex-col gap-0.5 rounded-lg border bg-white px-3 py-2">
      <span className="text-[10px] uppercase tracking-wide text-gray-400">{label}</span>
      <span className={`text-lg font-bold ${clase ?? 'text-[#1f2a4d]'}`}>{valor}</span>
    </div>
  );
}
