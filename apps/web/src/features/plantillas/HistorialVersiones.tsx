import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/Badge';
import { Modal } from '@/components/ui/Modal';
import { HojaDocumento, useEditoresHoja, useZoomHoja, ZoomHoja } from './HojaDocumento';
import { formatearFechaHora, plantillasApi, type VersionDetalle } from './plantillas.api';

interface Props {
  idPlantilla: string;
  versionVigente: number;
  puedeRestaurar: boolean;
  hayCambios: boolean;
  onCerrar: () => void;
  /** Ejecuta la restauración; devuelve un mensaje de error o null si salió bien. */
  onRestaurar: (version: number) => Promise<string | null>;
}

const NIVELES = [75, 90, 100, 125, 150];

/** Hoja de solo lectura con el contenido de una versión anterior (zoom y logo respetados). */
function VistaVersion({ v }: { v: VersionDetalle }) {
  const [zoom, setZoom] = useZoomHoja();
  const hoja = useEditoresHoja(v.contenido, false);
  return (
    <div>
      <div className="mb-2 flex items-center justify-end gap-1" role="group" aria-label="Zoom de la hoja">
        {NIVELES.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setZoom(n)}
            aria-pressed={zoom === n}
            className={`rounded px-2 py-1 text-xs ${zoom === n ? 'bg-[#1f2a4d] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            {n} %
          </button>
        ))}
      </div>
      <div className="scrollbar-hide max-h-[60vh] overflow-auto bg-gray-50 p-4">
        <ZoomHoja zoom={zoom}>
          <HojaDocumento hoja={hoja} editable={false} />
        </ZoomHoja>
      </div>
    </div>
  );
}

/** Historial de versiones de una plantilla: lista, vista de solo lectura y restauración. */
export function HistorialVersiones({
  idPlantilla,
  versionVigente,
  puedeRestaurar,
  hayCambios,
  onCerrar,
  onRestaurar,
}: Props) {
  const [ver, setVer] = useState<number | null>(null);
  const [confirmar, setConfirmar] = useState<number | null>(null);
  const [restaurando, setRestaurando] = useState(false);
  const [errorRestaurar, setErrorRestaurar] = useState<string | null>(null);

  const lista = useQuery({
    queryKey: ['plantillas', 'versiones', idPlantilla],
    queryFn: () => plantillasApi.versiones(idPlantilla),
    staleTime: 0,
    gcTime: 0,
  });
  const detalle = useQuery({
    queryKey: ['plantillas', 'version', idPlantilla, ver],
    queryFn: () => plantillasApi.version(idPlantilla, ver as number),
    enabled: ver !== null,
    staleTime: 5 * 60 * 1000,
  });

  async function confirmarRestaurar() {
    if (confirmar === null) return;
    setRestaurando(true);
    setErrorRestaurar(null);
    const msg = await onRestaurar(confirmar);
    setRestaurando(false);
    if (msg) setErrorRestaurar(msg);
  }

  const btnSec = 'rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm';
  let titulo = 'Historial de versiones';
  let pie: ReactNode;
  let cuerpo: ReactNode;

  if (confirmar !== null) {
    titulo = `Restaurar la versión ${confirmar}`;
    pie = (
      <>
        <button
          type="button"
          disabled={restaurando}
          onClick={() => {
            setConfirmar(null);
            setErrorRestaurar(null);
          }}
          className={btnSec}
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={restaurando}
          onClick={() => void confirmarRestaurar()}
          className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {restaurando ? 'Restaurando…' : 'Restaurar'}
        </button>
      </>
    );
    cuerpo = (
      <div className="flex flex-col gap-3 text-sm text-gray-600">
        <p>Se creará una versión nueva con el contenido de la v{confirmar}. Las versiones anteriores se conservan.</p>
        {hayCambios && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">
            Tienes cambios sin guardar en el editor: se perderán al restaurar.
          </p>
        )}
        {errorRestaurar && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-red-700">
            {errorRestaurar}
          </p>
        )}
      </div>
    );
  } else if (ver !== null) {
    titulo = `Versión ${ver} · solo lectura`;
    pie = (
      <>
        <button type="button" onClick={() => setVer(null)} className={btnSec}>
          Volver al historial
        </button>
        {puedeRestaurar && ver !== versionVigente && (
          <button
            type="button"
            onClick={() => setConfirmar(ver)}
            className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white"
          >
            Restaurar
          </button>
        )}
      </>
    );
    cuerpo = detalle.isLoading ? (
      <p className="text-sm text-gray-500" aria-busy="true">
        Cargando versión…
      </p>
    ) : detalle.error || !detalle.data ? (
      <div className="text-sm text-red-600">
        No pudimos cargar esa versión.{' '}
        <button type="button" onClick={() => void detalle.refetch()} className="underline">
          Reintentar
        </button>
      </div>
    ) : (
      <VistaVersion v={detalle.data} />
    );
  } else {
    pie = (
      <button type="button" onClick={onCerrar} className={btnSec}>
        Cerrar
      </button>
    );
    cuerpo = lista.isLoading ? (
      <p className="text-sm text-gray-500" aria-busy="true">
        Cargando historial…
      </p>
    ) : lista.error || !lista.data ? (
      <div className="text-sm text-red-600">
        No pudimos cargar el historial.{' '}
        <button type="button" onClick={() => void lista.refetch()} className="underline">
          Reintentar
        </button>
      </div>
    ) : lista.data.length === 0 ? (
      <p className="text-sm text-gray-500">Aún no hay versiones.</p>
    ) : (
      <ul className="flex flex-col divide-y divide-gray-100">
        {lista.data.map((v) => {
          const vigente = v.version === versionVigente;
          return (
            <li key={v.version} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
              <span className="font-semibold tabular-nums text-gray-800">v{v.version}</span>
              <span className="tabular-nums text-gray-600">{formatearFechaHora(v.fc)}</span>
              <span className="text-gray-600">{v.autor ?? '—'}</span>
              {v.nota && (
                <span className="min-w-0 flex-1 truncate text-gray-500" title={v.nota}>
                  {v.nota}
                </span>
              )}
              {vigente && <Badge color="verde">Vigente</Badge>}
              <span className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => setVer(v.version)}
                  aria-label={`Ver la versión ${v.version}`}
                  className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Ver
                </button>
                {puedeRestaurar && !vigente && (
                  <button
                    type="button"
                    onClick={() => setConfirmar(v.version)}
                    aria-label={`Restaurar la versión ${v.version}`}
                    className="rounded-md bg-[#1f2a4d] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#2a3869]"
                  >
                    Restaurar
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={titulo}
      ancho={ver !== null && confirmar === null ? 'xl' : 'lg'}
      bloqueado={restaurando}
      pie={pie}
    >
      {cuerpo}
    </Modal>
  );
}
