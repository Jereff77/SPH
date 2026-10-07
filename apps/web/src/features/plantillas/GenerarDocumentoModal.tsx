import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Logo } from '@/components/Logo';
import { Modal } from '@/components/ui/Modal';
import { BarraFormato, HojaDocumento, htmlDeHoja, useEditoresHoja, useZoomHoja, ZoomHoja } from './HojaDocumento';
import { IconImprimir } from './iconos';
import { contenidoInicial } from './contenido-inicial';
import { plantillasApi, type ContenidoPlantilla } from './plantillas.api';

/** Parques → KVA's → «Generar documento» (versión light: sin campos automáticos ni guardado). */
export function GenerarDocumentoModal({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const [idPlantilla, setIdPlantilla] = useState('');

  const lista = useQuery({
    queryKey: ['plantillas', 'lista', false],
    queryFn: () => plantillasApi.listar(false),
    enabled: abierto,
  });
  const activas = (lista.data ?? []).filter((p) => p.status);

  const detalle = useQuery({
    queryKey: ['plantillas', 'detalle', idPlantilla],
    queryFn: () => plantillasApi.obtener(idPlantilla),
    enabled: abierto && !!idPlantilla,
    staleTime: 0,
  });

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Generar documento" ancho="xl" cabeceraAzul>
      <div className="flex flex-col gap-4">
        <label className="flex max-w-md flex-col gap-1 text-sm text-gray-700">
          Plantilla
          <select
            value={idPlantilla}
            onChange={(e) => setIdPlantilla(e.target.value)}
            disabled={lista.isLoading}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1f2a4d]"
          >
            <option value="">{lista.isLoading ? 'Cargando…' : 'Elige una plantilla'}</option>
            {activas.map((p) => (
              <option key={p.idPlantilla} value={p.idPlantilla}>
                {p.nombre} · v{p.versionActual}
              </option>
            ))}
          </select>
        </label>
        {lista.error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            No pudimos cargar las plantillas. Reintenta.
          </p>
        )}
        {!lista.isLoading && !lista.error && activas.length === 0 && (
          <p className="text-sm text-gray-500">No hay plantillas activas.</p>
        )}
        {idPlantilla && detalle.isLoading && <p className="text-sm text-gray-400">Cargando plantilla…</p>}
        {idPlantilla && detalle.error && (
          <p className="text-sm text-red-600">No pudimos abrir la plantilla.</p>
        )}
        {idPlantilla && detalle.data && (
          <Documento
            key={`${detalle.data.idPlantilla}-${detalle.data.versionActual}`}
            contenido={detalle.data.contenido}
            onCerrar={onCerrar}
          />
        )}
        {!idPlantilla && (
          <p className="rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-400">
            Elige una plantilla para ver el documento.
          </p>
        )}
      </div>
    </Modal>
  );
}

function Documento({ contenido, onCerrar }: { contenido: ContenidoPlantilla; onCerrar: () => void }) {
  const hoja = useEditoresHoja(contenido ?? contenidoInicial(), true);
  const [zoom, setZoom] = useZoomHoja();
  const [impresion, setImpresion] = useState<{ encabezado: string; cuerpo: string; pie: string } | null>(null);

  useEffect(() => {
    if (!impresion) return;
    const t = setTimeout(() => window.print(), 150);
    return () => clearTimeout(t);
  }, [impresion]);

  return (
    <div className="flex flex-col gap-3">
      <div role="status" className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <span aria-hidden>⚠</span>
        Versión preliminar: aún sin campos automáticos ni guardado en el expediente. Lo que edites aquí no modifica la plantilla.
      </div>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <BarraFormato editor={hoja.activo} habilitada zoom={zoom} onZoom={setZoom} />
        <div className="scrollbar-hide max-h-[55vh] overflow-auto bg-gray-50 p-4">
          <ZoomHoja zoom={zoom}>
            <HojaDocumento hoja={hoja} editable />
          </ZoomHoja>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCerrar} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700">
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            setImpresion(null);
            setTimeout(() => setImpresion(htmlDeHoja(hoja)), 0);
          }}
          className="flex items-center gap-2 rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a3869]"
        >
          <IconImprimir width={16} height={16} /> Imprimir / guardar PDF
        </button>
      </div>
      {impresion &&
        createPortal(
          <div className="solo-impresion hoja-doc">
            <div className="impresion-membrete">
              <Logo />
              <div className="ProseMirror" style={{ width: 270, fontSize: 10 }} dangerouslySetInnerHTML={{ __html: impresion.encabezado }} />
            </div>
            <div className="ProseMirror" dangerouslySetInnerHTML={{ __html: impresion.cuerpo }} />
            <div className="impresion-pie ProseMirror" dangerouslySetInnerHTML={{ __html: impresion.pie }} />
          </div>,
          document.body,
        )}
    </div>
  );
}
