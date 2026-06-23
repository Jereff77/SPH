import { useQuery } from '@tanstack/react-query';
import { type ComentarioCxP } from './solicitudes.api';

/** Fecha + hora del comentario (dd/mm/aaaa hh:mm). */
function fechaHora(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
}

/**
 * Modal con el hilo de comentarios de una solicitud. Sirve para leer los
 * mensajes que el aprobador dejó al **rechazar** o **regresar** la solicitud
 * (también muestra la justificación del solicitante). Los comentarios del
 * aprobador se resaltan en ámbar; los del solicitante en gris.
 *
 * Es reutilizable: cada pantalla pasa su `fetcher`/`queryKey` (Solicitudes de
 * pago valida pertenencia; Solicitudes pendientes es vista de gestión).
 */
export function ComentariosSolicitudModal({
  idCxp,
  titulo,
  queryKey,
  fetcher,
  onClose,
}: {
  idCxp: string;
  titulo: string;
  queryKey: readonly unknown[];
  fetcher: (idCxp: string) => Promise<ComentarioCxP[]>;
  onClose: () => void;
}) {
  const { data = [], isLoading, isError } = useQuery<ComentarioCxP[]>({
    queryKey,
    queryFn: () => fetcher(idCxp),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Comentarios</h2>
            <p className="text-xs text-gray-500">{titulo}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          {isLoading && (
            <p className="py-6 text-center text-sm text-gray-400">Cargando…</p>
          )}
          {isError && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              No se pudieron cargar los comentarios.
            </div>
          )}
          {!isLoading && !isError && data.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400">
              Esta solicitud no tiene comentarios.
            </p>
          )}
          {data.map((c) => (
            <div
              key={c.idCxpComentarios}
              className={`rounded-lg border p-3 ${
                c.esSolicitante
                  ? 'border-gray-200 bg-gray-50'
                  : 'border-amber-200 bg-amber-50'
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-700">
                  {c.autor ?? 'Usuario'}
                  {!c.esSolicitante && (
                    <span className="ml-1.5 rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800">
                      Aprobador
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[11px] text-gray-400">
                  {fechaHora(c.fc)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-gray-700">
                {c.comentario ?? '—'}
              </p>
            </div>
          ))}
        </div>

        <div className="flex justify-end border-t px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
