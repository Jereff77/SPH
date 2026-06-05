import { useQuery } from '@tanstack/react-query';
import { auditoriaApi, type RegistroAuditoria } from './auditoria.api';

interface Props {
  uid: string;
  nombre: string;
  onClose: () => void;
}

const ACCIONES: Record<string, { texto: string; clase: string }> = {
  INSERT: { texto: 'Creó', clase: 'bg-green-100 text-green-700' },
  UPDATE: { texto: 'Modificó', clase: 'bg-amber-100 text-amber-700' },
  DELETE: { texto: 'Eliminó', clase: 'bg-red-100 text-red-700' },
  LEGACY: { texto: 'Actividad', clase: 'bg-gray-100 text-gray-600' },
};

const ORIGEN: Record<number, string> = { 1: 'v1', 2: 'v2', 3: 'directo' };

function fmtFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtValor(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function HistorialPanel({ uid, nombre, onClose }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['auditoria', uid],
    queryFn: () => auditoriaApi.historial(uid),
  });

  return (
    <aside className="flex w-full flex-col rounded-xl border bg-white shadow-sm lg:w-96">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-gray-800">
            Historial
          </h2>
          <p className="truncate text-xs text-gray-400">{nombre}</p>
        </div>
        <button
          onClick={onClose}
          title="Cerrar"
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      <div className="max-h-[calc(100vh-14rem)] flex-1 space-y-2 overflow-y-auto p-3">
        {isLoading && (
          <p className="py-6 text-center text-sm text-gray-400">Cargando…</p>
        )}
        {isError && (
          <p className="py-6 text-center text-sm text-red-600">
            No se pudo cargar el historial.
          </p>
        )}
        {!isLoading && !isError && (data?.length ?? 0) === 0 && (
          <p className="py-6 text-center text-sm text-gray-400">
            Sin actividad registrada.
          </p>
        )}
        {data?.map((r) => (
          <RegistroCard key={r.id} registro={r} />
        ))}
      </div>
    </aside>
  );
}

function RegistroCard({ registro }: { registro: RegistroAuditoria }) {
  const accion = ACCIONES[registro.accion] ?? ACCIONES.LEGACY;
  const cambios = registro.cambios ? Object.entries(registro.cambios) : [];

  return (
    <article className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${accion!.clase}`}
        >
          {accion!.texto}
        </span>
        <span className="text-xs text-gray-400">{fmtFecha(registro.fc)}</span>
      </div>

      <p className="mt-1 text-sm text-gray-700">
        <span className="font-medium">{registro.entidad}</span>
        {registro.id_entidad && (
          <span className="ml-1 font-mono text-xs text-gray-400">
            #{registro.id_entidad}
          </span>
        )}
      </p>

      {cambios.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {cambios.map(([campo, c]) => (
            <li key={campo} className="text-xs text-gray-600">
              <span className="font-medium text-gray-500">{campo}:</span>{' '}
              <span className="text-red-600 line-through">
                {fmtValor(c.antes)}
              </span>{' '}
              <span className="text-gray-400">→</span>{' '}
              <span className="text-green-700">{fmtValor(c.despues)}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Registros legacy (v1) traen un comentario legible en vez de diff. */}
      {registro.comentario && (
        <p className="mt-1 text-xs text-gray-600">{registro.comentario}</p>
      )}

      <p className="mt-1 text-[10px] uppercase tracking-wide text-gray-300">
        {ORIGEN[registro.origen] ?? '—'}
      </p>
    </article>
  );
}
