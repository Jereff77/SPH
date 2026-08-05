import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { SortableTh, THEAD_STICKY, THEAD_TR } from '@/components/tabla/SortableTh';
import { useSort } from '@/components/tabla/useSort';
import { fechaHora, soporteAdminApi } from './soporte-admin.api';
import type {
  EstadoTicket,
  RecordatorioEnviado,
  SesionAdmin,
  TicketAdmin,
} from './types';

type Tab = 'conversaciones' | 'tickets' | 'recordatorios' | 'agente';

const moneda = (n: number, divisa = 'MXN') =>
  (n ?? 0).toLocaleString('es-MX', {
    style: 'currency',
    currency: divisa || 'MXN',
  });

export function SoporteAdminPage() {
  const { esSoporte } = useAuth();
  const [tab, setTab] = useState<Tab>('conversaciones');

  if (!esSoporte) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          Esta sección está restringida al personal de soporte.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">Soporte — Auditoría y tickets</h1>
        <p className="mt-1 text-sm text-gray-500">
          Revisa las conversaciones del agente de soporte con los usuarios y atiende
          los tickets levantados. Solo visible para personal de soporte.
        </p>
      </header>

      <div className="flex gap-1 border-b border-gray-200">
        <BotonTab activo={tab === 'conversaciones'} onClick={() => setTab('conversaciones')}>
          Conversaciones
        </BotonTab>
        <BotonTab activo={tab === 'tickets'} onClick={() => setTab('tickets')}>
          Tickets
        </BotonTab>
        <BotonTab activo={tab === 'recordatorios'} onClick={() => setTab('recordatorios')}>
          Recordatorios enviados
        </BotonTab>
        <BotonTab activo={tab === 'agente'} onClick={() => setTab('agente')}>
          Agente de Soporte
        </BotonTab>
      </div>

      {tab === 'conversaciones' ? (
        <TabConversaciones />
      ) : tab === 'tickets' ? (
        <TabTickets />
      ) : tab === 'recordatorios' ? (
        <TabRecordatorios />
      ) : (
        <TabAgente />
      )}
    </div>
  );
}

// ===========================================================================
// Pestaña 4: Agente de Soporte (modelo, prompt y capacidades)
// ===========================================================================

function TabAgente() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['soporte-admin', 'agente'],
    queryFn: () => soporteAdminApi.agente(),
  });

  const [modelo, setModelo] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: (dto: { modelo?: string; prompt?: string }) =>
      soporteAdminApi.actualizarAgente(dto),
    onSuccess: () => {
      setAviso('✅ Guardado. Aplica de inmediato (el backend lee la configuración en cada turno).');
      void qc.invalidateQueries({ queryKey: ['soporte-admin', 'agente'] });
    },
    onError: (e) => setAviso(`❌ ${e instanceof Error ? e.message : 'No se pudo guardar.'}`),
  });

  if (isLoading) return <p className="text-sm text-gray-500">Cargando…</p>;
  if (isError || !data)
    return <p className="text-sm text-red-600">No se pudo cargar la configuración del agente.</p>;

  const modeloActual = modelo ?? data.modelo;
  const promptActual = prompt ?? data.prompt;
  const hayCambios = modeloActual !== data.modelo || promptActual !== data.prompt;

  return (
    <div className="space-y-6">
      {/* Modelo */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Modelo de IA</h2>
        <p className="mt-1 text-xs text-gray-500">
          Slug de OpenRouter (autor/modelo). ⚠️ Debe soportar <strong>herramientas</strong> (consulta
          de datos) y <strong>visión</strong> (captura de pantalla), o el agente pierde esas
          capacidades. Se guarda en la base de datos y aplica sin redesplegar.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={modeloActual}
            onChange={(e) => setModelo(e.target.value)}
            spellCheck={false}
            className="w-full max-w-md rounded-md border border-gray-300 px-3 py-1.5 font-mono text-sm outline-none focus:border-[#1f2a4d] focus:ring-1 focus:ring-[#1f2a4d]"
          />
          <span className="text-xs text-gray-400">default: {data.modeloDefault}</span>
        </div>
      </section>

      {/* Prompt */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Prompt base del agente</h2>
        <p className="mt-1 text-xs text-gray-500">
          Personalidad y reglas generales. Es la PRIMERA parte del prompt: el backend le añade en
          cada turno el método de diagnóstico, el perfil y permisos del usuario, el directorio, el
          glosario, los errores recientes del navegador y la documentación relevante de la KB.
        </p>
        <textarea
          value={promptActual}
          onChange={(e) => setPrompt(e.target.value)}
          rows={7}
          spellCheck={false}
          className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm leading-relaxed outline-none focus:border-[#1f2a4d] focus:ring-1 focus:ring-[#1f2a4d]"
        />
      </section>

      {/* Guardar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!hayCambios || guardar.isPending}
          onClick={() => {
            setAviso(null);
            guardar.mutate({
              ...(modeloActual !== data.modelo ? { modelo: modeloActual.trim() } : {}),
              ...(promptActual !== data.prompt ? { prompt: promptActual.trim() } : {}),
            });
            setModelo(null);
            setPrompt(null);
          }}
          className="rounded-md bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a3763] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
        {aviso && <span className="text-xs text-gray-600">{aviso}</span>}
      </div>

      {/* Herramientas */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">
          Herramientas del modelo ({data.herramientas.length})
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Las funciones que el modelo puede invocar, tal como se le declaran en cada turno (derivadas
          del código real, no de una lista aparte).
        </p>
        <ul className="mt-3 space-y-2">
          {data.herramientas.map((h) => (
            <li key={h.nombre} className="rounded-md border border-gray-100 bg-gray-50 p-3">
              <code className="text-xs font-semibold text-[#1f2a4d]">{h.nombre}</code>
              <p className="mt-1 text-xs leading-relaxed text-gray-600">{h.descripcion}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Capacidades */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">
          Habilidades del agente ({data.capacidades.length})
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Lo que el sistema hace por el agente alrededor del modelo (contexto que se le inyecta y
          acciones deterministas del backend).
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {data.capacidades.map((c) => (
            <li key={c.nombre} className="rounded-md border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-800">{c.nombre}</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-600">{c.descripcion}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function BotonTab({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
        activo
          ? 'border-[#1f2a4d] text-[#1f2a4d]'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

// ===========================================================================
// Pestaña 1: Conversaciones (auditoría)
// ===========================================================================

function TabConversaciones() {
  const [q, setQ] = useState('');
  const [incluirEliminadas, setIncluirEliminadas] = useState(false);
  const [sesionActiva, setSesionActiva] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['soporte-admin', 'sesiones', incluirEliminadas],
    queryFn: () => soporteAdminApi.sesiones(incluirEliminadas),
    staleTime: 20_000,
  });

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return data ?? [];
    return (data ?? []).filter(
      (s) =>
        s.usuario.toLowerCase().includes(t) ||
        (s.correo ?? '').toLowerCase().includes(t) ||
        (s.titulo ?? '').toLowerCase().includes(t),
    );
  }, [data, q]);

  const accessors = {
    usuario: (s: SesionAdmin) => s.usuario,
    titulo: (s: SesionAdmin) => s.titulo ?? '',
    mensajes: (s: SesionAdmin) => s.mensajes,
    ultima: (s: SesionAdmin) => s.ultimaActividad ?? '',
  };
  const { ordenados, sortKey, dir, toggle } = useSort(filtradas, accessors, {
    key: 'ultima',
    dir: 'desc',
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por usuario, correo o título…"
          className="w-72 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={incluirEliminadas}
            onChange={(e) => setIncluirEliminadas(e.target.checked)}
          />
          Incluir eliminadas
        </label>
        <button
          type="button"
          onClick={() => refetch()}
          className="ml-auto rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          {isFetching ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : isError ? (
        <p className="text-sm text-red-600">No se pudieron cargar las conversaciones.</p>
      ) : (
        <div className="overflow-auto rounded-lg border border-gray-200 max-h-[65vh]">
          <table className="min-w-full text-sm">
            <thead className={THEAD_STICKY}>
              <tr className={THEAD_TR}>
                <SortableTh campo="usuario" sortKey={sortKey} dir={dir} onSort={toggle}>
                  Usuario
                </SortableTh>
                <SortableTh campo="titulo" sortKey={sortKey} dir={dir} onSort={toggle}>
                  Tema
                </SortableTh>
                <SortableTh campo="mensajes" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                  Mensajes
                </SortableTh>
                <SortableTh campo="ultima" sortKey={sortKey} dir={dir} onSort={toggle}>
                  Última actividad
                </SortableTh>
                <th className="px-4 py-3 text-center">Escaló</th>
                <th className="px-4 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ordenados.map((s) => (
                <tr
                  key={s.uuid}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => setSesionActiva(s.uuid)}
                  title="Ver conversación completa"
                >
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-gray-900">{s.usuario}</span>
                    {s.correo && (
                      <span className="block text-xs text-gray-500">{s.correo}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{s.titulo ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                    {s.mensajes}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{fechaHora(s.ultimaActividad)}</td>
                  <td className="px-4 py-2.5 text-center">
                    {s.tieneEscalacion ? (
                      <span className="text-amber-600" title="Hubo sugerencia de ticket">🎫</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {s.activa ? (
                      <span className="text-green-600">●</span>
                    ) : (
                      <span className="text-gray-400" title="Eliminada por el usuario">●</span>
                    )}
                  </td>
                </tr>
              ))}
              {ordenados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                    No hay conversaciones.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {sesionActiva && (
        <ModalConversacion sessionId={sesionActiva} onClose={() => setSesionActiva(null)} />
      )}
    </section>
  );
}

function ModalConversacion({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['soporte-admin', 'conversacion', sessionId],
    queryFn: () => soporteAdminApi.conversacion(sessionId),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-200 p-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {data?.sesion.titulo ?? 'Conversación'}
            </h2>
            {data && (
              <p className="text-xs text-gray-500">
                {data.sesion.usuario}
                {data.sesion.correo ? ` · ${data.sesion.correo}` : ''} ·{' '}
                {fechaHora(data.sesion.fc)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-auto p-4">
          {isLoading ? (
            <p className="text-sm text-gray-500">Cargando conversación…</p>
          ) : isError ? (
            <p className="text-sm text-red-600">No se pudo cargar la conversación.</p>
          ) : data && data.mensajes.length > 0 ? (
            data.mensajes.map((m) => (
              <div key={m.uuid} className="space-y-2">
                {/* Pregunta del usuario */}
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#1f2a4d] px-3 py-2 text-sm text-white">
                    {m.pregunta}
                  </div>
                </div>
                {/* Respuesta del agente */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-gray-100 px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">
                    {m.respuesta}
                    {(m.escalable || m.modulos.length > 0 || m.ruta) && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5 border-t border-gray-200 pt-1.5 text-[11px] text-gray-500">
                        {m.escalable && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
                            sugirió ticket
                          </span>
                        )}
                        {m.ruta && (
                          <span className="rounded bg-gray-200 px-1.5 py-0.5">{m.ruta}</span>
                        )}
                        {m.modulos.map((mod) => (
                          <span key={mod} className="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-700">
                            {mod}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Captura de pantalla adjunta al turno (bucket privado, URL firmada) */}
                {m.capturaUrl && (
                  <a
                    href={m.capturaUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Ver captura completa"
                    className="mx-auto block w-[85%] overflow-hidden rounded-lg border border-gray-200"
                  >
                    <img
                      src={m.capturaUrl}
                      alt="Captura de pantalla del usuario"
                      className="max-h-40 w-full object-cover object-left-top"
                    />
                  </a>
                )}
                {/* Razonamiento del agente (auditoría): pasos del método + herramientas + SQL */}
                {(m.debugSql || (m.debugMeta?.traza && m.debugMeta.traza.length > 0)) && (
                  <details className="mx-auto w-[85%] rounded-lg border border-gray-200 bg-gray-50 text-[11px] text-gray-600">
                    <summary className="cursor-pointer px-2 py-1 font-medium text-gray-500">
                      🔎 Razonamiento del agente (pasos del método / herramientas / SQL)
                    </summary>
                    <div className="space-y-2 px-2 py-2">
                      {m.debugMeta?.traza && m.debugMeta.traza.length > 0 && (
                        <ol className="space-y-1">
                          {m.debugMeta.traza.map((p, i) =>
                            p.tipo === 'lectura_pantalla' ? (
                              <li key={i} className="rounded bg-sky-50 p-1.5 text-sky-800">
                                📸 <span className="font-semibold">Lectura de pantalla:</span>{' '}
                                {p.texto}
                              </li>
                            ) : p.tipo === 'tope' ? (
                              <li key={i} className="rounded bg-amber-50 p-1.5 text-amber-800">
                                ⛔ Límite de consultas alcanzado — respuesta forzada con lo
                                averiguado.
                              </li>
                            ) : p.tipo === 'razonamiento_final' ? (
                              <li key={i} className="whitespace-pre-wrap rounded bg-indigo-50 p-1.5 text-indigo-800">
                                🧭 <span className="font-semibold">Razonamiento final (no visible para el usuario):</span>{' '}
                                {p.texto}
                              </li>
                            ) : p.tipo === 'pensamiento' ? (
                              <li key={i} className="italic text-indigo-700">
                                {/^paso\s*\d/i.test(p.texto ?? '') ? (
                                  <>
                                    🧭{' '}
                                    <span className="font-semibold not-italic">
                                      {(p.texto ?? '').split(':')[0]}:
                                    </span>{' '}
                                    {(p.texto ?? '').split(':').slice(1).join(':').trim()}
                                  </>
                                ) : (
                                  <>💭 {p.texto}</>
                                )}
                              </li>
                            ) : (
                              <li key={i} className="pl-2">
                                ⚙️ <span className="font-mono text-gray-800">{p.tool}</span>
                                {p.tool === 'consultar_datos' && typeof p.args?.consulta === 'string' ? (
                                  <span className="text-gray-500"> </span>
                                ) : p.args && Object.keys(p.args).length > 0 ? (
                                  <span className="text-gray-500"> ({JSON.stringify(p.args)})</span>
                                ) : null}
                                {p.error ? (
                                  <span className="text-red-600"> — error: {p.error}</span>
                                ) : p.total_filas != null ? (
                                  <span className="text-green-700"> — {p.total_filas} fila(s)</span>
                                ) : null}
                              </li>
                            ),
                          )}
                        </ol>
                      )}
                      {m.debugSql && (
                        <pre className="overflow-auto rounded bg-gray-900 p-2 text-[10px] leading-snug text-gray-100">
                          {m.debugSql}
                        </pre>
                      )}
                    </div>
                  </details>
                )}
                <p className="text-center text-[11px] text-gray-400">{fechaHora(m.fc)}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">Esta conversación no tiene mensajes.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Pestaña 2: Tickets (atención)
// ===========================================================================

const ESTADOS: { valor: EstadoTicket | 'todos'; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'abierto', etiqueta: 'Abiertos' },
  { valor: 'en_proceso', etiqueta: 'En proceso' },
  { valor: 'cerrado', etiqueta: 'Cerrados' },
];

function EstadoTicketBadge({ estado }: { estado: EstadoTicket }) {
  const cls =
    estado === 'abierto'
      ? 'bg-red-100 text-red-700'
      : estado === 'en_proceso'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-green-100 text-green-700';
  const txt =
    estado === 'abierto' ? 'Abierto' : estado === 'en_proceso' ? 'En proceso' : 'Cerrado';
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{txt}</span>
  );
}

function TabTickets() {
  const [filtro, setFiltro] = useState<EstadoTicket | 'todos'>('todos');
  const [ticketActivo, setTicketActivo] = useState<TicketAdmin | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['soporte-admin', 'tickets', filtro],
    queryFn: () => soporteAdminApi.tickets(filtro === 'todos' ? undefined : filtro),
    staleTime: 15_000,
  });

  const accessors = {
    usuario: (t: TicketAdmin) => t.usuario,
    asunto: (t: TicketAdmin) => t.asunto,
    modulo: (t: TicketAdmin) => t.modulo ?? '',
    estado: (t: TicketAdmin) => t.estado,
    fc: (t: TicketAdmin) => t.fc,
  };
  const { ordenados, sortKey, dir, toggle } = useSort(data ?? [], accessors, {
    key: 'fc',
    dir: 'desc',
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {ESTADOS.map((e) => (
          <button
            key={e.valor}
            type="button"
            onClick={() => setFiltro(e.valor)}
            className={`rounded-full px-3 py-1 text-sm ${
              filtro === e.valor
                ? 'bg-[#1f2a4d] text-white'
                : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {e.etiqueta}
          </button>
        ))}
        <button
          type="button"
          onClick={() => refetch()}
          className="ml-auto rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          {isFetching ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : isError ? (
        <p className="text-sm text-red-600">No se pudieron cargar los tickets.</p>
      ) : (
        <div className="overflow-auto rounded-lg border border-gray-200 max-h-[65vh]">
          <table className="min-w-full text-sm">
            <thead className={THEAD_STICKY}>
              <tr className={THEAD_TR}>
                <SortableTh campo="usuario" sortKey={sortKey} dir={dir} onSort={toggle}>
                  Usuario
                </SortableTh>
                <SortableTh campo="asunto" sortKey={sortKey} dir={dir} onSort={toggle}>
                  Asunto
                </SortableTh>
                <SortableTh campo="modulo" sortKey={sortKey} dir={dir} onSort={toggle}>
                  Módulo
                </SortableTh>
                <SortableTh campo="estado" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                  Estado
                </SortableTh>
                <SortableTh campo="fc" sortKey={sortKey} dir={dir} onSort={toggle}>
                  Creado
                </SortableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ordenados.map((t) => (
                <tr
                  key={t.uuid}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => setTicketActivo(t)}
                  title="Ver y atender ticket"
                >
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-gray-900">{t.usuario}</span>
                    {t.correo && (
                      <span className="block text-xs text-gray-500">{t.correo}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{t.asunto}</td>
                  <td className="px-4 py-2.5 text-gray-700">{t.modulo ?? '—'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <EstadoTicketBadge estado={t.estado} />
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{fechaHora(t.fc)}</td>
                </tr>
              ))}
              {ordenados.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    No hay tickets con este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {ticketActivo && (
        <ModalTicket ticket={ticketActivo} onClose={() => setTicketActivo(null)} />
      )}
    </section>
  );
}

function ModalTicket({
  ticket,
  onClose,
}: {
  ticket: TicketAdmin;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [verConversacion, setVerConversacion] = useState(false);

  const atender = useMutation({
    mutationFn: (estado: EstadoTicket) => soporteAdminApi.atender(ticket.uuid, estado),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['soporte-admin', 'tickets'] });
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-200 p-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{ticket.asunto}</h2>
            <p className="text-xs text-gray-500">
              {ticket.usuario}
              {ticket.correo ? ` · ${ticket.correo}` : ''} · {fechaHora(ticket.fc)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-auto p-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-600">
              Módulo: {ticket.modulo ?? '—'}
            </span>
            {ticket.ruta && (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-600">
                Pantalla: {ticket.ruta}
              </span>
            )}
            <EstadoTicketBadge estado={ticket.estado} />
          </div>

          <div>
            <h3 className="mb-1 text-sm font-medium text-gray-700">Resumen del problema</h3>
            <p className="whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
              {ticket.resumen}
            </p>
          </div>

          {ticket.atendidoPorNombre && (
            <p className="text-xs text-gray-500">
              Última atención: {ticket.atendidoPorNombre} · {fechaHora(ticket.fum)}
            </p>
          )}

          {ticket.sessionId && (
            <button
              type="button"
              onClick={() => setVerConversacion(true)}
              className="text-sm font-medium text-[#1f2a4d] underline"
            >
              Ver conversación de origen
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 p-4">
          <span className="mr-1 text-sm text-gray-500">Cambiar estado:</span>
          {(['abierto', 'en_proceso', 'cerrado'] as EstadoTicket[]).map((e) => (
            <button
              key={e}
              type="button"
              disabled={atender.isPending || ticket.estado === e}
              onClick={() => atender.mutate(e)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              {e === 'abierto' ? 'Abierto' : e === 'en_proceso' ? 'En proceso' : 'Cerrado'}
            </button>
          ))}
          {atender.isError && (
            <span className="text-xs text-red-600">No se pudo actualizar.</span>
          )}
        </div>
      </div>

      {verConversacion && ticket.sessionId && (
        <ModalConversacion
          sessionId={ticket.sessionId}
          onClose={() => setVerConversacion(false)}
        />
      )}
    </div>
  );
}

// ===========================================================================
// Pestaña 3: Recordatorios de aprobación enviados (correos a aprobadores CxP)
// ===========================================================================

function EstadoRecordatorioBadge({ estado }: { estado: 'enviado' | 'fallido' }) {
  const enviado = estado === 'enviado';
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
        enviado ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      {enviado ? 'Enviado' : 'Falló'}
    </span>
  );
}

function TabRecordatorios() {
  const [q, setQ] = useState('');
  const [activo, setActivo] = useState<number | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['soporte-admin', 'recordatorios'],
    queryFn: () => soporteAdminApi.recordatorios(),
    staleTime: 20_000,
  });

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return data ?? [];
    return (data ?? []).filter(
      (r) =>
        r.email.toLowerCase().includes(t) ||
        (r.nombre ?? '').toLowerCase().includes(t),
    );
  }, [data, q]);

  const accessors = {
    destinatario: (r: RecordatorioEnviado) => r.nombre ?? r.email,
    pendientes: (r: RecordatorioEnviado) => r.numPendientes,
    estado: (r: RecordatorioEnviado) => r.estado,
    enviado: (r: RecordatorioEnviado) => r.enviadoEn,
  };
  const { ordenados, sortKey, dir, toggle } = useSort(filtradas, accessors, {
    key: 'enviado',
    dir: 'desc',
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por aprobador o correo…"
          className="w-72 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => refetch()}
          className="ml-auto rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          {isFetching ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : isError ? (
        <p className="text-sm text-red-600">No se pudieron cargar los recordatorios.</p>
      ) : (
        <div className="overflow-auto rounded-lg border border-gray-200 max-h-[65vh]">
          <table className="min-w-full text-sm">
            <thead className={THEAD_STICKY}>
              <tr className={THEAD_TR}>
                <SortableTh campo="destinatario" sortKey={sortKey} dir={dir} onSort={toggle}>
                  Aprobador
                </SortableTh>
                <SortableTh
                  campo="pendientes"
                  sortKey={sortKey}
                  dir={dir}
                  onSort={toggle}
                  align="right"
                >
                  Pendientes
                </SortableTh>
                <SortableTh campo="estado" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                  Estado
                </SortableTh>
                <SortableTh campo="enviado" sortKey={sortKey} dir={dir} onSort={toggle}>
                  Enviado
                </SortableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ordenados.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => setActivo(r.id)}
                  title="Ver detalle del correo enviado"
                >
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-gray-900">{r.nombre ?? '—'}</span>
                    <span className="block text-xs text-gray-500">{r.email}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                    {r.numPendientes}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <EstadoRecordatorioBadge estado={r.estado} />
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{fechaHora(r.enviadoEn)}</td>
                </tr>
              ))}
              {ordenados.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                    No hay recordatorios enviados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activo != null && (
        <ModalRecordatorio id={activo} onClose={() => setActivo(null)} />
      )}
    </section>
  );
}

function ModalRecordatorio({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['soporte-admin', 'recordatorio', id],
    queryFn: () => soporteAdminApi.recordatorio(id),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-200 p-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {data?.asunto ?? 'Recordatorio enviado'}
            </h2>
            {data && (
              <p className="text-xs text-gray-500">
                {data.nombre ?? data.email} · {data.email} · {fechaHora(data.enviadoEn)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-auto p-4">
          {isLoading ? (
            <p className="text-sm text-gray-500">Cargando…</p>
          ) : isError || !data ? (
            <p className="text-sm text-red-600">No se pudo cargar el recordatorio.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <EstadoRecordatorioBadge estado={data.estado} />
                <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-600">
                  {data.numPendientes} solicitud(es)
                </span>
              </div>
              {data.error && (
                <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  {data.error}
                </p>
              )}

              <div>
                <h3 className="mb-1 text-sm font-medium text-gray-700">
                  Solicitudes incluidas
                </h3>
                <div className="overflow-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead className={THEAD_STICKY}>
                      <tr className={THEAD_TR}>
                        <th className="px-3 py-2 text-left">Proveedor</th>
                        <th className="px-3 py-2 text-right">Monto</th>
                        <th className="px-3 py-2 text-left">Folio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.solicitudes.map((s) => (
                        <tr key={s.idCxp}>
                          <td className="px-3 py-2 text-gray-700">{s.proveedor}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                            {moneda(s.total, s.moneda)}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-gray-500">
                            {s.folio || '—'}
                          </td>
                        </tr>
                      ))}
                      {data.solicitudes.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                            Sin detalle de solicitudes.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="mb-1 text-sm font-medium text-gray-700">Correo enviado</h3>
                <iframe
                  title="Vista previa del correo"
                  srcDoc={data.html}
                  sandbox=""
                  className="h-80 w-full rounded-lg border border-gray-200 bg-white"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
