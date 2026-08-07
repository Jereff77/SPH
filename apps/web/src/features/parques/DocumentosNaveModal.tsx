import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/features/auth/useAuth';
import { kvasApi } from './kvas.api';

const inputCls =
  'mt-1 w-full rounded-lg border px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#1f2a4d]';

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

interface Props {
  idNave: string;
  nave: string;
  ocupante: string | null;
  onClose: () => void;
}

/**
 * Expediente de documentos de KVA de una nave: contrato, carta de compra de
 * KVA, actas… Se abre al hacer clic en el número de nave del tablero, tal como
 * en el control operativo en Excel.
 *
 * Los documentos se cuelgan de la NAVE (no de una asignación concreta) porque
 * un mismo contrato suele cubrir la baja y la media a la vez.
 */
export function DocumentosNaveModal({ idNave, nave, ocupante, onClose }: Props) {
  const { tienePermiso } = useAuth();
  const puedeEditar = tienePermiso(723);
  const qc = useQueryClient();

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: docs, isLoading } = useQuery({
    queryKey: ['kvas', 'docs', idNave],
    queryFn: () => kvasApi.documentosDeNave(idNave),
  });

  function refrescar() {
    return Promise.all([
      qc.invalidateQueries({ queryKey: ['kvas', 'docs', idNave] }),
      // El contador del tablero se calcula en el mismo endpoint de asignaciones.
      qc.invalidateQueries({ queryKey: ['kvas', 'parque'] }),
    ]);
  }

  const subir = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append('titulo', titulo.trim());
      if (descripcion.trim()) form.append('descripcion', descripcion.trim());
      form.append('archivo', archivo!);
      return kvasApi.subirDocumento(idNave, form);
    },
    onSuccess: async () => {
      setTitulo('');
      setDescripcion('');
      setArchivo(null);
      setError(null);
      await refrescar();
    },
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo subir el documento.'),
  });

  const darDeBaja = useMutation({
    mutationFn: async (idDoc: string) => {
      const motivo = window.prompt('¿Por qué se da de baja este documento?');
      if (!motivo?.trim()) return;
      await kvasApi.bajaDocumento(idDoc, motivo.trim());
    },
    onSuccess: () => void refrescar(),
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo dar de baja.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!titulo.trim()) return setError('Ponle un título al documento.');
    if (!archivo) return setError('Adjunta el archivo.');
    subir.mutate();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl"
      >
        <header className="border-b px-5 py-4">
          <h2 className="text-base font-semibold text-gray-800">
            Documentos de la nave {nave}
          </h2>
          <p className="text-xs text-gray-500">
            {ocupante ?? 'Sin ocupante registrado'} · contratos, cartas de compra de KVA
            y demás respaldos.
          </p>
        </header>

        {error && (
          <p className="mx-5 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
          {isLoading ? (
            <p className="text-sm text-gray-400">Cargando…</p>
          ) : (docs ?? []).length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-gray-400">
              Todavía no hay documentos para esta nave.
            </p>
          ) : (
            <ul className="space-y-2">
              {(docs ?? []).map((d) => (
                <li
                  key={d.idDoc}
                  className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">{d.titulo}</p>
                    {d.descripcion && (
                      <p className="truncate text-xs text-gray-500">{d.descripcion}</p>
                    )}
                    <p className="mt-0.5 text-[11px] text-gray-400">{fecha(d.fc)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    {d.urldoc && (
                      <a
                        href={d.urldoc}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border px-2 py-0.5 text-[#1f2a4d] hover:bg-gray-50"
                      >
                        Abrir
                      </a>
                    )}
                    {puedeEditar && (
                      <button
                        onClick={() => darDeBaja.mutate(d.idDoc)}
                        className="rounded border border-red-200 px-2 py-0.5 text-red-600 hover:bg-red-50"
                      >
                        Baja
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {puedeEditar && (
          <form onSubmit={onSubmit} className="space-y-3 border-t bg-gray-50 px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-gray-600">
                Título
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Contrato de compra de KVA"
                  className={inputCls}
                />
              </label>
              <label className="block text-xs text-gray-600">
                Archivo (PDF o imagen, máx. 15 MB)
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                  className="mt-1 w-full text-xs text-gray-600"
                />
              </label>
            </div>
            <label className="block text-xs text-gray-600">
              Descripción (opcional)
              <input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className={inputCls}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-white"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={subir.isPending}
                className="rounded-lg bg-[#1f2a4d] px-3 py-1.5 text-sm text-white hover:bg-[#172039] disabled:opacity-50"
              >
                {subir.isPending ? 'Subiendo…' : 'Subir documento'}
              </button>
            </div>
          </form>
        )}

        {!puedeEditar && (
          <footer className="flex justify-end border-t px-5 py-3">
            <button
              onClick={onClose}
              className="rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cerrar
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
