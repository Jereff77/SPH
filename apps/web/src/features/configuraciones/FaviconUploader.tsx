import { useEffect, useState, type ChangeEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configuracionApi } from './configuracion.api';
import { ApiRequestError } from '@/lib/api';

/** Subida del favicon (icono de la pestaña del navegador). */
export function FaviconUploader() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['logos'],
    queryFn: () => configuracionApi.getLogos(),
    staleTime: 5 * 60 * 1000,
  });
  const actual = data?.favicon ?? null;

  const [archivo, setArchivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!archivo) {
      setPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(archivo);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [archivo]);

  const subir = useMutation({
    mutationFn: (f: File) => configuracionApi.subirFavicon(f),
    onSuccess: () => {
      setArchivo(null);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['logos'] });
    },
    onError: (e) =>
      setError(
        e instanceof ApiRequestError ? e.message : 'No se pudo subir el favicon.',
      ),
  });

  function onElegir(e: ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > 2 * 1024 * 1024) {
      setError('El favicon no debe superar 2 MB.');
      setArchivo(null);
      return;
    }
    setArchivo(f);
  }

  const urlPreview = preview ?? actual;

  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-sm font-semibold text-gray-800">Favicon</h3>
      <p className="mt-0.5 text-xs text-gray-500">
        Icono que aparece en la pestaña del navegador. PNG o SVG cuadrado
        (recomendado 64×64). Máx. 2 MB.
      </p>

      {error && (
        <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-3 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg border bg-gray-50 p-2">
          {urlPreview ? (
            <img
              src={urlPreview}
              alt="Favicon"
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </div>
        <div className="space-y-2">
          <input
            type="file"
            accept="image/png,image/svg+xml,image/webp,image/x-icon"
            onChange={onElegir}
            className="block text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-gray-200"
          />
          <button
            type="button"
            onClick={() => archivo && subir.mutate(archivo)}
            disabled={!archivo || subir.isPending}
            className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#172039] disabled:opacity-50"
          >
            {subir.isPending ? 'Subiendo…' : 'Guardar favicon'}
          </button>
        </div>
      </div>
    </div>
  );
}
