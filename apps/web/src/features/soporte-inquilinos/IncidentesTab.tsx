import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  soporteApi,
  type EstadoIncidente,
  type IncidenteResumen,
  type VincularInput,
} from './soporte-inquilinos.api';
import type { MensajeCorreo } from '@/features/correo/correo.api';
import { SearchSelect } from '@/components/SearchSelect';
import { useAuth } from '@/features/auth/useAuth';
import { ApiRequestError } from '@/lib/api';

const ESTADOS: EstadoIncidente[] = ['Nuevo', 'En Proceso', 'Resuelto', 'Detenido', 'Cerrado'];

const COLOR_ESTADO: Record<EstadoIncidente, string> = {
  Nuevo: 'bg-blue-100 text-blue-700',
  'En Proceso': 'bg-amber-100 text-amber-700',
  Resuelto: 'bg-green-100 text-green-700',
  Detenido: 'bg-red-100 text-red-700',
  Cerrado: 'bg-gray-200 text-gray-600',
};

const fechaHora = (iso: string | null): string => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
const esUrl = (u: string | null): u is string => !!u && /^https?:\/\//.test(u);
const esImagen = (ct: string | null): boolean => !!ct && /^image\//i.test(ct);

export function IncidentesTab() {
  const queryClient = useQueryClient();
  const [estadoFiltro, setEstadoFiltro] = useState<string>('');
  const [busqueda, setBusqueda] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const { data: incidentes = [], isLoading } = useQuery({
    queryKey: ['inc-lista', estadoFiltro, busqueda],
    queryFn: () => soporteApi.incidentes(estadoFiltro || undefined, busqueda || undefined),
  });

  const sincronizar = useMutation({
    mutationFn: () => soporteApi.sincronizar(),
    onSuccess: (r) => {
      setAviso(
        r.incidentesNuevos > 0
          ? `${r.incidentesNuevos} incidente(s) nuevo(s).`
          : 'Bandeja al día.',
      );
      void queryClient.invalidateQueries({ queryKey: ['inc-lista'] });
    },
    onError: (e) =>
      setAviso(e instanceof ApiRequestError ? e.message : 'No se pudo sincronizar.'),
  });

  return (
    <div className="flex h-[calc(100vh-3.5rem-11rem)] gap-3">
      {/* Lista de incidentes */}
      <aside className="flex w-96 shrink-0 flex-col rounded-xl border bg-white">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <span className="text-sm font-semibold text-gray-700">Incidentes</span>
          <button
            onClick={() => sincronizar.mutate()}
            disabled={sincronizar.isPending}
            className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
          >
            {sincronizar.isPending ? 'Sincronizando…' : '↻ Sincronizar'}
          </button>
        </div>
        <div className="space-y-2 border-b px-3 py-2">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar folio, asunto, inquilino…"
            className="w-full rounded-md border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
          />
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="w-full rounded-md border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {aviso && <div className="px-3 py-1.5 text-xs text-[#3f5b87]">{aviso}</div>}
        <div className="flex-1 divide-y overflow-auto">
          {isLoading && <p className="px-3 py-4 text-sm text-gray-400">Cargando…</p>}
          {!isLoading && incidentes.length === 0 && (
            <p className="px-3 py-4 text-xs text-gray-400">
              No hay incidentes. Pulsa "Sincronizar" para traer los correos.
            </p>
          )}
          {incidentes.map((i) => (
            <IncidenteItem
              key={i.id}
              i={i}
              activo={i.id === sel}
              onClick={() => setSel(i.id)}
            />
          ))}
        </div>
      </aside>

      {/* Detalle */}
      <section className="flex min-w-0 flex-1 flex-col rounded-xl border bg-white">
        {sel ? (
          <DetalleIncidente id={sel} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
            Selecciona un incidente para verlo.
          </div>
        )}
      </section>
    </div>
  );
}

function IncidenteItem({
  i,
  activo,
  onClick,
}: {
  i: IncidenteResumen;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full px-3 py-2.5 text-left hover:bg-gray-50 ${activo ? 'bg-[#3f5b87]/10' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-gray-500">{i.folio}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${COLOR_ESTADO[i.estado]}`}>
          {i.estado}
          {i.estado === 'Detenido' && i.detenidoOrigen === 'auto' ? ' (auto)' : ''}
        </span>
      </div>
      <div className="mt-0.5 truncate text-sm font-medium text-gray-800">
        {i.asunto ?? '(sin asunto)'}
      </div>
      <div className="truncate text-xs text-gray-500">
        {i.inquilino ?? i.remitente ?? '—'}
        {i.nave ? ` · ${i.nave}` : ''}
      </div>
      {(i.categoria || i.prioridad) && (
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {i.categoria && (
            <span className="rounded bg-sky-50 px-1.5 text-[10px] text-sky-700">{i.categoria}</span>
          )}
          {i.prioridad && (
            <span
              className={`rounded px-1.5 text-[10px] ${
                i.prioridad === 'Alta'
                  ? 'bg-red-50 text-red-700'
                  : i.prioridad === 'Baja'
                    ? 'bg-gray-100 text-gray-500'
                    : 'bg-amber-50 text-amber-700'
              }`}
            >
              {i.prioridad}
            </span>
          )}
        </div>
      )}
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="text-[10px] text-gray-400">{fechaHora(i.ultimaActividad)}</span>
        {i.asignado && (
          <span className="truncate rounded bg-indigo-50 px-1.5 text-[10px] text-indigo-700">
            👤 {i.asignado}
          </span>
        )}
      </div>
    </button>
  );
}

export function DetalleIncidente({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const puedeResponder = tienePermiso(32);
  const puedeClasificar = tienePermiso(33);
  const puedeAsignar = tienePermiso(35);
  const [respuesta, setRespuesta] = useState('');
  const [archivos, setArchivos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['inc-detalle', id],
    queryFn: () => soporteApi.detalle(id),
  });

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ['inc-detalle', id] });
    void queryClient.invalidateQueries({ queryKey: ['inc-lista'] });
  };

  const agentesQ = useQuery({
    queryKey: ['inc-agentes'],
    queryFn: () => soporteApi.agentes(),
    enabled: puedeAsignar,
  });
  const asignar = useMutation({
    mutationFn: (uid: string | null) => soporteApi.asignar(id, uid),
    onSuccess: invalidar,
  });
  const guardarNota = useMutation({
    mutationFn: () => soporteApi.agregarNota(id, nota),
    onSuccess: () => {
      setNota('');
      invalidar();
    },
  });
  const clasificar = useMutation({
    mutationFn: () => soporteApi.clasificar(id),
    onSuccess: invalidar,
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo clasificar con IA.'),
  });

  const enviar = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('body', respuesta);
      archivos.forEach((a) => fd.append('adjuntos', a));
      return soporteApi.responder(id, fd);
    },
    onSuccess: () => {
      setError(null);
      setRespuesta('');
      setArchivos([]);
      invalidar();
    },
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo enviar.'),
  });

  const cambiarEstado = useMutation({
    mutationFn: (estado: EstadoIncidente) => soporteApi.cambiarEstado(id, estado),
    onSuccess: invalidar,
  });

  if (isLoading || !data)
    return <div className="flex flex-1 items-center justify-center text-sm text-gray-400">Cargando…</div>;

  const inc = data.incidente;

  return (
    <div className="flex h-full flex-col">
      {/* Encabezado del incidente */}
      <div className="border-b px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate font-semibold text-gray-800">
            <span className="mr-2 font-mono text-xs text-gray-400">{inc.folio}</span>
            {inc.asunto ?? '(sin asunto)'}
          </h2>
          <select
            value={inc.estado}
            disabled={!puedeClasificar || cambiarEstado.isPending}
            onChange={(e) => cambiarEstado.mutate(e.target.value as EstadoIncidente)}
            className={`rounded-md border px-2 py-1 text-xs font-semibold outline-none disabled:opacity-60 ${COLOR_ESTADO[inc.estado]}`}
          >
            {ESTADOS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-1 text-xs text-gray-500">
          De: {inc.remitente ?? '—'}
          {inc.estado === 'Detenido' && (
            <span className="ml-2 text-red-600">
              · Detenido ({inc.detenidoOrigen === 'auto' ? 'sin avance >7 días' : 'manual'})
            </span>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Hilo */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 space-y-3 overflow-auto p-4">
            {data.hilo.map((m) => (
              <MensajeBloque key={m.id} m={m} />
            ))}
          </div>
          {/* Responder con firma */}
          {puedeResponder ? (
            <div className="border-t p-3">
              {error && (
                <div className="mb-2 rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-700">{error}</div>
              )}
              <textarea
                value={respuesta}
                onChange={(e) => setRespuesta(e.target.value)}
                rows={3}
                placeholder="Escribe tu respuesta… (se anexa la firma corporativa automáticamente)"
                className="block w-full resize-none rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <input
                  type="file"
                  multiple
                  onChange={(e) => setArchivos(Array.from(e.target.files ?? []))}
                  className="text-xs"
                />
                <button
                  onClick={() => enviar.mutate()}
                  disabled={enviar.isPending || !respuesta.trim()}
                  className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039] disabled:opacity-50"
                >
                  {enviar.isPending ? 'Enviando…' : 'Responder'}
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t px-4 py-3 text-xs text-gray-400">
              No tienes permiso para responder (clave 32).
            </div>
          )}
        </div>

        {/* Panel lateral: clasificación + asignación + vínculo + seguimientos */}
        <aside className="w-80 shrink-0 space-y-4 overflow-auto border-l bg-gray-50/50 p-3">
          {/* Clasificación (IA, clave 33) */}
          <div className="space-y-1.5 text-xs">
            <h3 className="font-semibold text-gray-700">Clasificación</h3>
            <div className="flex flex-wrap items-center gap-1.5">
              {inc.categoria ? (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] text-sky-700">
                  {inc.categoria}
                </span>
              ) : (
                <span className="text-gray-400">Sin categoría</span>
              )}
              {inc.prioridad && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    inc.prioridad === 'Alta'
                      ? 'bg-red-100 text-red-700'
                      : inc.prioridad === 'Baja'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  Prioridad {inc.prioridad}
                </span>
              )}
            </div>
            {puedeClasificar && (
              <button
                onClick={() => clasificar.mutate()}
                disabled={clasificar.isPending}
                className="rounded-md border px-2 py-1 text-xs hover:bg-white disabled:opacity-50"
              >
                {clasificar.isPending ? 'Clasificando…' : '🤖 Clasificar con IA'}
              </button>
            )}
          </div>

          {/* Asignación (gerente, clave 35) */}
          <div className="space-y-1.5 text-xs">
            <h3 className="font-semibold text-gray-700">Asignación</h3>
            {puedeAsignar ? (
              <select
                value={inc.asignadoA ?? ''}
                disabled={asignar.isPending}
                onChange={(e) => asignar.mutate(e.target.value || null)}
                className="w-full rounded-md border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
              >
                <option value="">— Sin asignar —</option>
                {(agentesQ.data ?? []).map((a) => (
                  <option key={a.uid} value={a.uid}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-gray-600">
                {data.asignado ?? <span className="text-amber-600">Sin asignar</span>}
              </p>
            )}
          </div>

          <PanelVinculo
            inc={inc}
            inquilino={data.inquilino}
            puede={puedeClasificar}
            onGuardado={invalidar}
          />

          {/* Árbol de seguimientos */}
          <div className="space-y-2 text-xs">
            <h3 className="font-semibold text-gray-700">Seguimientos</h3>
            <ol className="space-y-2 border-l-2 border-gray-200 pl-3">
              {data.seguimientos.length === 0 && (
                <li className="text-gray-400">Sin movimientos aún.</li>
              )}
              {data.seguimientos.map((s) => (
                <li key={s.id} className="relative">
                  <span
                    className={`absolute -left-[1.07rem] top-1 h-2 w-2 rounded-full ${s.tipo === 'nota' ? 'bg-indigo-400' : 'bg-gray-300'}`}
                  />
                  <div className={s.tipo === 'nota' ? 'text-gray-800' : 'text-gray-600'}>
                    {s.tipo === 'nota' && <span className="mr-1">📝</span>}
                    {s.texto}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {s.autor ?? 'Sistema'} · {fechaHora(s.fc)}
                  </div>
                </li>
              ))}
            </ol>
            <div className="space-y-1.5 pt-1">
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={2}
                placeholder="Nota interna (no se envía al inquilino)…"
                className="block w-full resize-none rounded-md border px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
              />
              <button
                onClick={() => guardarNota.mutate()}
                disabled={guardarNota.isPending || !nota.trim()}
                className="rounded-md border px-3 py-1 text-xs hover:bg-white disabled:opacity-50"
              >
                {guardarNota.isPending ? 'Guardando…' : 'Agregar nota'}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PanelVinculo({
  inc,
  inquilino,
  puede,
  onGuardado,
}: {
  inc: { id: string; idArrendador: string | null; idNavArrend: string | null };
  inquilino: string | null;
  puede: boolean;
  onGuardado: () => void;
}) {
  const [editar, setEditar] = useState(false);
  const [idArrendador, setIdArrendador] = useState(inc.idArrendador ?? '');
  const [idNavArrend, setIdNavArrend] = useState(inc.idNavArrend ?? '');
  const [error, setError] = useState<string | null>(null);

  const { data: inquilinos = [] } = useQuery({
    queryKey: ['inc-inquilinos'],
    queryFn: () => soporteApi.inquilinos(),
    enabled: editar,
  });
  const { data: naves = [] } = useQuery({
    queryKey: ['inc-naves', idArrendador],
    queryFn: () => soporteApi.naves(idArrendador),
    enabled: editar && !!idArrendador,
  });

  const guardar = useMutation({
    mutationFn: () => {
      const nave = naves.find((n) => n.idNavArrend === idNavArrend);
      const dto: VincularInput = {
        idArrendador: idArrendador || null,
        idNavArrend: idNavArrend || null,
        idNave: nave?.idNave ?? null,
        idParque: nave?.idParque ?? null,
      };
      return soporteApi.vincular(inc.id, dto);
    },
    onSuccess: () => {
      setError(null);
      setEditar(false);
      onGuardado();
    },
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo vincular.'),
  });

  if (!editar) {
    return (
      <div className="space-y-2 text-xs">
        <h3 className="font-semibold text-gray-700">Vínculo</h3>
        <p className="text-gray-600">
          <span className="text-gray-400">Inquilino:</span>{' '}
          {inquilino ?? <span className="text-amber-600">Sin vincular</span>}
        </p>
        {puede && (
          <button
            onClick={() => setEditar(true)}
            className="rounded-md border px-2 py-1 text-xs hover:bg-white"
          >
            {inquilino ? 'Cambiar vínculo' : 'Vincular inquilino/nave'}
          </button>
        )}
        {inquilino && (
          <p className="text-[10px] text-gray-400">
            El vínculo se recuerda: futuros correos de este remitente se vincularán solos.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 text-xs">
      <h3 className="font-semibold text-gray-700">Vincular</h3>
      {error && <div className="rounded bg-red-50 px-2 py-1 text-red-700">{error}</div>}
      <label className="block text-gray-500">Inquilino</label>
      <SearchSelect
        value={idArrendador}
        onChange={(v) => {
          setIdArrendador(v);
          setIdNavArrend('');
        }}
        options={inquilinos.map((i) => ({ value: i.idArrendador, label: i.nombre }))}
        placeholder="Selecciona inquilino…"
      />
      <label className="block text-gray-500">Nave</label>
      <SearchSelect
        value={idNavArrend}
        onChange={setIdNavArrend}
        options={naves.map((n) => ({
          value: n.idNavArrend,
          label: n.nomDescriptivo || `${n.nomParque ?? ''} ${n.numNaveNAME ?? ''}`.trim() || n.idNavArrend,
        }))}
        placeholder={idArrendador ? 'Selecciona nave…' : 'Elige inquilino primero'}
        disabled={!idArrendador}
      />
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => guardar.mutate()}
          disabled={guardar.isPending || !idArrendador}
          className="rounded-md bg-[#1f2a4d] px-3 py-1 text-white hover:bg-[#172039] disabled:opacity-50"
        >
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </button>
        <button onClick={() => setEditar(false)} className="rounded-md border px-3 py-1 hover:bg-white">
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** Renderiza el HTML del correo en un <iframe> aislado (XSS bloqueado, sin scripts). */
function CuerpoHtml({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const srcDoc = useMemo(
    () =>
      `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank">` +
      `<style>html,body{margin:0}body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;` +
      `font-size:14px;line-height:1.5;color:#374151;word-break:break-word;overflow-x:hidden}` +
      `img{max-width:100%;height:auto}table{max-width:100%}</style></head><body>${html}</body></html>`,
    [html],
  );
  const ajustar = () => {
    const ifr = ref.current;
    try {
      const alto = ifr?.contentWindow?.document.body.scrollHeight;
      if (alto) ifr!.style.height = `${alto + 16}px`;
    } catch {
      /* noop */
    }
  };
  return (
    <iframe
      ref={ref}
      title="Contenido del correo"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={srcDoc}
      onLoad={ajustar}
      className="w-full"
      style={{ height: 120, border: 0 }}
    />
  );
}

function MensajeBloque({ m }: { m: MensajeCorreo }) {
  const esEnviado = m.tipo === 'sent';
  const tieneHtml = !!m.bodyHtml && m.bodyHtml.trim().length > 0;
  const imagenes = m.adjuntos.filter((a) => esUrl(a.url) && esImagen(a.contentType));
  const otros = m.adjuntos.filter((a) => esUrl(a.url) && !esImagen(a.contentType));
  return (
    <div className={`rounded-lg border p-3 ${esEnviado ? 'border-[#3f5b87]/30 bg-[#3f5b87]/5' : 'bg-white'}`}>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-gray-700">{esEnviado ? 'SPH (Operaciones)' : (m.fromEmail ?? '—')}</span>
        <span className="text-gray-400">{fechaHora(m.fecha)}</span>
      </div>
      {tieneHtml ? (
        <CuerpoHtml html={m.bodyHtml!} />
      ) : (
        <div className="whitespace-pre-wrap break-words text-sm text-gray-700">
          {m.bodyText?.trim() ? m.bodyText : '(sin contenido)'}
        </div>
      )}
      {imagenes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {imagenes.map((a) => (
            <a key={a.id} href={a.url!} target="_blank" rel="noreferrer" title={a.filename ?? 'imagen'}>
              <img
                src={a.url!}
                alt={a.filename ?? 'imagen'}
                className="h-24 w-24 rounded border object-cover hover:opacity-90"
              />
            </a>
          ))}
        </div>
      )}
      {otros.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {otros.map((a) => (
            <a
              key={a.id}
              href={a.url!}
              target="_blank"
              rel="noreferrer"
              className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700 hover:bg-amber-100"
            >
              📎 {a.filename ?? 'adjunto'}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
