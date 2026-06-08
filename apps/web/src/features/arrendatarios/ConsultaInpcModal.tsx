import { useQuery } from '@tanstack/react-query';
import { arrendatariosApi, MESES, num } from './arrendatarios.api';
import { THEAD_STICKY, THEAD_TR } from '@/components/tabla/SortableTh';

/** Diálogo de consulta del INPC (mes/valor), como en v1 (`consulta_i_n_p_c`). */
export function ConsultaInpcModal({ onClose }: { onClose: () => void }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['arre-inpc'],
    queryFn: () => arrendatariosApi.inpc(),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between bg-[#1f2a4d] px-5 py-3 text-white">
          <h2 className="text-base font-semibold">Consulta INPC</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className={THEAD_STICKY}>
              <tr className={THEAD_TR}>
                <th className="px-4 py-3 text-left">Periodo</th>
                <th className="px-4 py-3 text-right">INPC</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-gray-400">
                    Cargando…
                  </td>
                </tr>
              ) : (
                data.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      {r.mes ? MESES[r.mes - 1] : '—'} {r.anio ?? ''}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{num(r.inpc)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
