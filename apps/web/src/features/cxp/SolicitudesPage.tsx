import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  solicitudesApi,
  ESTADOS_CXP,
  type SolicitudCxP,
} from './solicitudes.api';
import { EditarSolicitudModal } from './EditarSolicitudModal';
import { NuevaSolicitudPago } from './NuevaSolicitudPago';
import {
  NuevaUrgente,
  NuevaLineaCaptura,
  NuevaDevolucion,
  NuevaSinXml,
} from './NuevaSolicitudEspecial';
import { ApiRequestError } from '@/lib/api';

/** Tipos de solicitud (menú lateral). */
const TIPOS_SOLICITUD: { id: string; label: string; disponible: boolean }[] = [
  { id: 'pago', label: 'Solicitud de Pago', disponible: true },
  { id: 'urgente', label: 'Solicitudes Urgentes', disponible: true },
  { id: 'captura', label: 'Línea de Captura', disponible: true },
  { id: 'devolucion', label: 'Devoluciones', disponible: true },
  { id: 'sinxml', label: 'Facturas sin XML', disponible: true },
];

function fecha(iso: string | null): string {
  if (!iso) return '—';
  const p = (iso.split('T')[0] ?? iso).split('-');
  if (p.length < 3) return iso;
  return `${Number(p[2])}/${Number(p[1])}/${p[0]}`;
}

const esUrl = (u: string | null): u is string => !!u && /^https?:\/\//.test(u);

interface Acciones {
  onEditar: (s: SolicitudCxP) => void;
  onEnviar: (s: SolicitudCxP) => void;
  onEliminar: (s: SolicitudCxP) => void;
  ocupado: boolean;
}

export function SolicitudesPage() {
  const queryClient = useQueryClient();
  const [rango, setRango] = useState('');
  const [editarDe, setEditarDe] = useState<SolicitudCxP | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuTipos, setMenuTipos] = useState(false);
  const [tipoAlta, setTipoAlta] = useState<string | null>(null);

  const { data: semanas = [] } = useQuery({
    queryKey: ['cxp-sol-semanas'],
    queryFn: () => solicitudesApi.semanas(),
  });

  useEffect(() => {
    if (!rango && semanas[0]) setRango(semanas[0]);
  }, [semanas, rango]);

  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['cxp-solicitudes', rango],
    queryFn: () => solicitudesApi.listar(rango),
    enabled: rango !== '',
  });

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ['cxp-solicitudes', rango] });
    void queryClient.invalidateQueries({ queryKey: ['cxp-sol-semanas'] });
  };
  const onErr = (e: unknown) =>
    setError(e instanceof ApiRequestError ? e.message : 'Ocurrió un error.');

  const mEliminar = useMutation({
    mutationFn: (id: string) => solicitudesApi.eliminar(id),
    onSuccess: () => {
      setError(null);
      invalidar();
    },
    onError: onErr,
  });
  const mEnviar = useMutation({
    mutationFn: (id: string) => solicitudesApi.enviar(id),
    onSuccess: () => {
      setError(null);
      invalidar();
    },
    onError: onErr,
  });

  const acciones: Acciones = {
    onEditar: (s) => setEditarDe(s),
    onEnviar: (s) => {
      if (window.confirm('¿Enviar la solicitud a aprobación?')) mEnviar.mutate(s.idCxp);
    },
    onEliminar: (s) => {
      if (
        window.confirm(
          `¿Eliminar la solicitud${s.folio ? ` ${s.folio}` : ''}? Esta acción no se puede deshacer.`,
        )
      )
        mEliminar.mutate(s.idCxp);
    },
    ocupado: mEliminar.isPending || mEnviar.isPending,
  };

  // Clasificación en las 4 etapas (cada solicitud va a una sola).
  const urgentes = data.filter((s) => s.esUrgente);
  const noUrg = data.filter((s) => !s.esUrgente);
  const guardadosRech = noUrg.filter((s) => s.idEstado === 1 || s.idEstado === 3);
  const enviadosAprob = noUrg.filter((s) => s.idEstado === 2 || s.idEstado === 4);
  const reprogPagados = noUrg.filter((s) => s.idEstado === 5 || s.idEstado === 6);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">
          Solicitudes de pago
        </h1>
        <div className="flex items-center gap-2">
          <select
            value={rango}
            onChange={(e) => setRango(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
          >
            {semanas.length === 0 && <option value="">Sin semanas</option>}
            {semanas.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            onClick={() => setMenuTipos(true)}
            className="flex items-center gap-2 rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039]"
          >
            <span className="text-base leading-none">＋</span> Nueva solicitud
          </button>
        </div>
      </div>

      {(error || isError) && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error ?? 'No se pudieron cargar las solicitudes.'}
        </div>
      )}

      <Seccion titulo="Devolución o Pagos Urgentes" items={urgentes} cargando={isLoading} acciones={acciones} />
      <Seccion titulo="Guardados o Rechazados" items={guardadosRech} cargando={isLoading} acciones={acciones} />
      <Seccion titulo="Enviados o Aprobados" items={enviadosAprob} cargando={isLoading} acciones={acciones} />
      <Seccion titulo="Reprogramados o Pagados" items={reprogPagados} cargando={isLoading} acciones={acciones} />

      {editarDe && (
        <EditarSolicitudModal
          solicitud={editarDe}
          onClose={() => setEditarDe(null)}
          onGuardada={() => {
            setEditarDe(null);
            invalidar();
          }}
        />
      )}

      {menuTipos && (
        <MenuTipos
          onElegir={(id) => {
            setMenuTipos(false);
            setTipoAlta(id);
          }}
          onClose={() => setMenuTipos(false)}
        />
      )}

      {tipoAlta && (() => {
        const cerrar = () => setTipoAlta(null);
        const creada = () => {
          setTipoAlta(null);
          invalidar();
        };
        switch (tipoAlta) {
          case 'pago':
            return <NuevaSolicitudPago onClose={cerrar} onCreada={creada} />;
          case 'urgente':
            return <NuevaUrgente onClose={cerrar} onCreada={creada} />;
          case 'captura':
            return <NuevaLineaCaptura onClose={cerrar} onCreada={creada} />;
          case 'devolucion':
            return <NuevaDevolucion onClose={cerrar} onCreada={creada} />;
          case 'sinxml':
            return <NuevaSinXml onClose={cerrar} onCreada={creada} />;
          default:
            return null;
        }
      })()}
    </div>
  );
}

/** Menú lateral (drawer) para elegir el tipo de solicitud a crear. */
function MenuTipos({
  onElegir,
  onClose,
}: {
  onElegir: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-72 max-w-[85vw] flex-col bg-[#1f2a4d] text-white shadow-xl"
      >
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-base font-semibold">Solicitudes</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            ✕
          </button>
        </div>
        <nav className="flex flex-col">
          {TIPOS_SOLICITUD.map((t) => (
            <button
              key={t.id}
              disabled={!t.disponible}
              onClick={() => t.disponible && onElegir(t.id)}
              className={`flex items-center justify-between px-5 py-3.5 text-left text-sm transition ${
                t.disponible
                  ? 'hover:bg-white/10'
                  : 'cursor-not-allowed text-white/40'
              }`}
            >
              {t.label}
              {!t.disponible && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                  Próx.
                </span>
              )}
            </button>
          ))}
        </nav>
      </aside>
    </div>
  );
}

function Seccion({
  titulo,
  items,
  cargando,
  acciones,
}: {
  titulo: string;
  items: SolicitudCxP[];
  cargando: boolean;
  acciones: Acciones;
}) {
  return (
    <section>
      <h2 className="mb-1.5 text-base font-semibold text-[#1f2a4d]">{titulo}</h2>
      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full min-w-[1400px] text-sm">
          <thead>
            <tr className="bg-[#1f2a4d] text-left text-xs font-semibold uppercase tracking-wide text-white">
              <th className="px-3 py-2.5">Editar</th>
              <th className="px-3 py-2.5">Documentos</th>
              <th className="px-3 py-2.5">Estatus</th>
              <th className="px-3 py-2.5">Folio</th>
              <th className="px-3 py-2.5">Proveedor</th>
              <th className="px-3 py-2.5">Nombre en CFDI</th>
              <th className="px-3 py-2.5">Fecha CFDI</th>
              <th className="px-3 py-2.5">Concepto</th>
              <th className="px-3 py-2.5">Categoría / Clasif.</th>
              <th className="px-3 py-2.5">Justificación</th>
              <th className="px-3 py-2.5">Asignado a</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {cargando && (
              <tr>
                <td colSpan={11} className="px-3 py-5 text-center text-gray-400">
                  Cargando…
                </td>
              </tr>
            )}
            {!cargando && items.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-4 text-center text-xs text-gray-300">
                  Sin registros en esta etapa.
                </td>
              </tr>
            )}
            {items.map((s) => (
              <Fila key={s.idCxp} s={s} acciones={acciones} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Fila({ s, acciones }: { s: SolicitudCxP; acciones: Acciones }) {
  const est = s.idEstado != null ? ESTADOS_CXP[s.idEstado] : undefined;
  // Acciones disponibles solo en estado Guardado (idEstado=1).
  const guardada = s.idEstado === 1;
  const editable = guardada && s.tipoOperacion < 4;
  const { onEditar, onEnviar, onEliminar, ocupado } = acciones;

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2 text-base">
          <button
            type="button"
            disabled={!guardada || ocupado}
            onClick={() => onEliminar(s)}
            title={guardada ? 'Eliminar' : 'Solo se elimina en Guardado'}
            className={guardada ? 'text-red-500 hover:text-red-700' : 'cursor-not-allowed text-gray-300'}
          >
            🗑
          </button>
          <button
            type="button"
            disabled={!editable || ocupado}
            onClick={() => onEditar(s)}
            title={editable ? 'Editar' : 'No editable'}
            className={editable ? 'text-[#3f5b87] hover:text-[#1f2a4d]' : 'cursor-not-allowed text-gray-300'}
          >
            ✎
          </button>
          <button
            type="button"
            disabled={!guardada || ocupado}
            onClick={() => onEnviar(s)}
            title={guardada ? 'Enviar a aprobación' : 'Solo se envía en Guardado'}
            className={guardada ? 'text-green-600 hover:text-green-700' : 'cursor-not-allowed text-gray-300'}
          >
            ✔
          </button>
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          {esUrl(s.urlCFDI) ? (
            <a href={s.urlCFDI} target="_blank" rel="noreferrer" title="PDF / CFDI" className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600 hover:bg-red-100">
              PDF
            </a>
          ) : null}
          {esUrl(s.urlXLM) ? (
            <a href={s.urlXLM} target="_blank" rel="noreferrer" title="XML" className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 hover:bg-amber-100">
              XML
            </a>
          ) : null}
          {!esUrl(s.urlCFDI) && !esUrl(s.urlXLM) && <span className="text-gray-300">—</span>}
        </div>
      </td>
      <td className="px-3 py-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${est?.clase ?? 'bg-gray-100 text-gray-500'}`}>
          {est?.etiqueta ?? s.idEstado ?? '—'}
        </span>
      </td>
      <td className="px-3 py-2 font-mono text-xs text-gray-500">{s.folio ?? '—'}</td>
      <td className="px-3 py-2 font-medium text-gray-800">{s.nombreProveedor ?? '—'}</td>
      <td className="px-3 py-2 text-gray-600">
        {s.nomCFDI && s.nomCFDI !== '' ? s.nomCFDI : '—'}
      </td>
      <td className="px-3 py-2 text-gray-600">{fecha(s.fecCFDI)}</td>
      <td className="max-w-[280px] truncate px-3 py-2 text-gray-600" title={s.concepto ?? ''}>
        {s.concepto ?? '—'}
      </td>
      <td className="px-3 py-2 text-gray-600">
        {[s.categoria, s.clasificacion].filter(Boolean).join(' / ') || '—'}
      </td>
      <td className="max-w-[240px] truncate px-3 py-2 text-gray-600" title={s.justificacion ?? ''}>
        {s.justificacion ?? '—'}
      </td>
      <td className="px-3 py-2 text-gray-600">{s.asignadoA ?? '—'}</td>
    </tr>
  );
}
