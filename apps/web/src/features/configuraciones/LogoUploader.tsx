import {
  useEffect,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  configuracionApi,
  LOGO_DEFAULT,
  type FondoLogo,
} from './configuracion.api';
import { ApiRequestError } from '@/lib/api';

interface Props {
  fondo: FondoLogo;
  titulo: string;
  descripcion: string;
}

/** Subida + dimensiones de un logotipo, con vista previa sobre el fondo real. */
export function LogoUploader({ fondo, titulo, descripcion }: Props) {
  const queryClient = useQueryClient();
  const esOscuro = fondo === 'oscuro';

  const { data } = useQuery({
    queryKey: ['logos'],
    queryFn: () => configuracionApi.getLogos(),
    staleTime: 5 * 60 * 1000,
  });
  const actual = esOscuro ? data?.oscuro : data?.claro;

  const [archivo, setArchivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [ancho, setAncho] = useState('');
  const [alto, setAlto] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Cargar dimensiones actuales cuando llegan del servidor.
  useEffect(() => {
    setAncho(actual?.ancho != null ? String(actual.ancho) : '');
    setAlto(actual?.alto != null ? String(actual.alto) : '');
  }, [actual?.ancho, actual?.alto]);

  // Vista previa del archivo seleccionado.
  useEffect(() => {
    if (!archivo) {
      setPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(archivo);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [archivo]);

  const guardar = useMutation({
    mutationFn: async () => {
      if (archivo) await configuracionApi.subirLogo(archivo, fondo);
      const a = ancho.trim() ? parseInt(ancho, 10) : null;
      const h = alto.trim() ? parseInt(alto, 10) : null;
      await configuracionApi.setDimensionesLogo(fondo, a, h);
    },
    onSuccess: () => {
      setArchivo(null);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['logos'] });
    },
    onError: (e) =>
      setError(
        e instanceof ApiRequestError ? e.message : 'No se pudo guardar el logo.',
      ),
  });

  function onElegir(e: ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > 2 * 1024 * 1024) {
      setError('El logo no debe superar 2 MB.');
      setArchivo(null);
      return;
    }
    setArchivo(f);
  }

  const def = LOGO_DEFAULT[fondo];
  const urlPreview = preview ?? actual?.url ?? null;
  // Mismas reglas que el componente Logo: auto cuando una dimensión está vacía.
  const aIn = ancho.trim() ? Number(ancho) : (actual?.ancho ?? null);
  const hIn = alto.trim() ? Number(alto) : (actual?.alto ?? null);
  const previewStyle: CSSProperties = { maxWidth: '100%', maxHeight: 160 };
  if (aIn == null && hIn == null) {
    previewStyle.width = def.ancho;
    previewStyle.height = 'auto';
  } else {
    previewStyle.width = aIn ?? 'auto';
    previewStyle.height = hIn ?? 'auto';
  }

  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-sm font-semibold text-gray-800">{titulo}</h3>
      <p className="mt-0.5 text-xs text-gray-500">{descripcion}</p>

      {error && (
        <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Vista previa sobre el fondo real */}
      <div
        className={`mt-3 flex items-center justify-center rounded-lg border p-3 ${
          esOscuro ? 'bg-[#1f2a4d]' : 'bg-gray-50'
        }`}
        style={{ minHeight: 96 }}
      >
        {urlPreview ? (
          <img
            src={urlPreview}
            alt="Vista previa"
            style={previewStyle}
            className="object-contain"
          />
        ) : (
          <span className={esOscuro ? 'text-white/50' : 'text-gray-400'}>
            Sin logo
          </span>
        )}
      </div>

      <div className="mt-3 space-y-3">
        <input
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          onChange={onElegir}
          className="block text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-gray-200"
        />

        <div className="flex items-end gap-3">
          <label className="text-xs text-gray-600">
            Ancho (px)
            <input
              type="number"
              min={8}
              max={2000}
              value={ancho}
              onChange={(e) => setAncho(e.target.value)}
              placeholder="auto"
              className="mt-1 block w-24 rounded-md border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
            />
          </label>
          <label className="text-xs text-gray-600">
            Alto (px)
            <input
              type="number"
              min={8}
              max={2000}
              value={alto}
              onChange={(e) => setAlto(e.target.value)}
              placeholder="auto"
              className="mt-1 block w-24 rounded-md border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
            />
          </label>
          <button
            type="button"
            onClick={() => guardar.mutate()}
            disabled={guardar.isPending || (!archivo && !actual?.url && !ancho && !alto)}
            className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#172039] disabled:opacity-50"
          >
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
