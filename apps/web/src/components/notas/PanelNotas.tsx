import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notasApi, type EventoHistorial, type Nota, type RefNotas, type TipoEventoHistorial } from './notas.api';

const TZ = 'America/Mexico_City';
const MAX_TEXTO = 2000;
const LS_COLAPSADO = 'notas-panel-colapsado';

const diaMx = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso));
const horaMx = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(
    new Date(iso),
  );
const fechaMx = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(iso),
  );

/** «Hoy» / «Ayer» / dd/mm/aaaa (horario de México). */
function etiquetaDia(iso: string): string {
  const d = diaMx(iso);
  const hoy = diaMx(new Date().toISOString());
  const ayer = diaMx(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  return d === hoy ? 'Hoy' : d === ayer ? 'Ayer' : fechaMx(iso);
}

/** Por defecto el panel arranca COLAPSADO; solo se abre si la persona lo abrió antes ('0'). */
function leerColapsado(): boolean {
  try {
    return window.localStorage.getItem(LS_COLAPSADO) !== '0';
  } catch {
    return true;
  }
}
function guardarColapsado(v: boolean): void {
  try {
    window.localStorage.setItem(LS_COLAPSADO, v ? '1' : '0');
  } catch {
    /* sin almacenamiento: el panel sigue funcionando */
  }
}

const Svg = ({ children, size = 16 }: { children: React.ReactNode; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);
const IconChat = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Svg>
);
const IconDobleDer = () => (
  <Svg size={14}>
    <path d="m6 17 5-5-5-5M13 17l5-5-5-5" />
  </Svg>
);
const IconDobleIzq = () => (
  <Svg size={14}>
    <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />
  </Svg>
);
const IconBasura = () => (
  <Svg size={14}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
  </Svg>
);
const IconEnviar = () => (
  <Svg size={15}>
    <path d="m22 2-7 20-4-9-9-4zM22 2 11 13" />
  </Svg>
);
const IconChev = ({ abierto }: { abierto: boolean }) => (
  <Svg size={14}>
    <path d={abierto ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6'} />
  </Svg>
);
const IconChispa = () => (
  <Svg size={11}>
    <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2zM19 3v4M21 5h-4" />
  </Svg>
);

const IconHist = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5M12 7v5l4 2" />
  </Svg>
);
const IconCandado = () => (
  <Svg size={12}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Svg>
);

/** Icono y colores de cada tipo de evento del historial. */
const ESTILO_EVENTO: Record<TipoEventoHistorial, { color: string; fondo: string; icono: React.ReactNode }> = {
  plan_creado: {
    color: '#1f2a4d', fondo: '#e8edf8',
    icono: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M12 18v-6M9 15h6" /></>,
  },
  contrato: {
    color: '#1f2a4d', fondo: '#e8edf8',
    icono: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="m9 15 2 2 4-4" /></>,
  },
  cancelacion: {
    color: '#dc2626', fondo: '#fee2e2',
    icono: <><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6M9 9l6 6" /></>,
  },
  activacion: {
    color: '#15803d', fondo: '#dcfce7',
    icono: <><path d="M12 2v10" /><path d="M18.4 6.6a9 9 0 1 1-12.77.04" /></>,
  },
  liberacion: {
    color: '#b45309', fondo: '#fef3c7',
    icono: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></>,
  },
  inpc: {
    color: '#1f2a4d', fondo: '#e8edf8',
    icono: <><path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></>,
  },
  pago_aplicado: {
    color: '#15803d', fondo: '#dcfce7',
    icono: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></>,
  },
  pago_desaplicado: {
    color: '#b45309', fondo: '#fef3c7',
    icono: <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></>,
  },
  cambio_manual: {
    color: '#1f2a4d', fondo: '#e8edf8',
    icono: <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />,
  },
};

/** Renglón del Historial: icono, título (con marca MontseAI si fue su aviso), detalle, hora y quién. */
function FilaEvento({ evento }: { evento: EventoHistorial }) {
  const est = ESTILO_EVENTO[evento.tipo];
  const cambios = evento.cambios ?? [];
  const [abierto, setAbierto] = useState(false);
  const desplegable = cambios.length > 0;
  const titulo = (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className="text-xs font-bold text-gray-800">
        {evento.titulo}
        {desplegable && evento.autor ? <span className="font-normal text-gray-600"> · por {evento.autor}</span> : null}
      </span>
      {evento.origen === 'montse' && (
        <span className="inline-flex items-center gap-0.5 rounded-lg border border-[#c9d6ee] bg-[#eef3fb] px-1.5 py-px text-[9px] font-bold text-[#1f2a4d]">
          <IconChispa />
          MontseAI
        </span>
      )}
    </span>
  );
  return (
    <div className="flex gap-2.5">
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ background: est.fondo, color: est.color }}
      >
        <Svg size={14}>{est.icono}</Svg>
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        {desplegable ? (
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            {titulo}
            <span className="shrink-0 text-gray-500">
              <IconChev abierto={abierto} />
            </span>
          </button>
        ) : (
          titulo
        )}
        {evento.detalle && (
          <p className="whitespace-pre-wrap break-words text-[11px] leading-snug text-gray-600">{evento.detalle}</p>
        )}
        {abierto &&
          cambios.map((c, i) => (
            <div key={i} className="space-y-0.5 border-t border-[#c9d6ee] pt-1">
              {(c.partida != null || c.concepto) && (
                <div className="text-[10px] font-semibold text-gray-500">
                  {c.partida != null ? `#${c.partida}` : ''}
                  {c.partida != null && c.concepto ? ' · ' : ''}
                  {c.concepto ?? ''}
                </div>
              )}
              <div className="text-[11px] font-semibold text-[#1f2a4d]">{c.descripcion}</div>
            </div>
          ))}
        <div className="text-[11px] text-gray-500">
          {horaMx(evento.fecha)}
          {!desplegable && evento.autor ? ` · por ${evento.autor}` : ''}
        </div>
      </div>
    </div>
  );
}

function NotaUsuario({ nota, onEliminar, eliminando }: { nota: Nota; onEliminar: () => void; eliminando: boolean }) {
  return (
    <div
      className={`space-y-1 rounded-lg border p-2.5 ${
        nota.esMia ? 'border-[#c9d6ee] bg-[#e8edf8]' : 'border-gray-200 bg-gray-50'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-bold text-gray-800">
            {nota.esMia ? `Tú${nota.autor ? ` · ${nota.autor}` : ''}` : (nota.autor ?? 'Usuario')}
          </span>
          <span className="shrink-0 text-[11px] text-gray-500">{horaMx(nota.fc)}</span>
        </div>
        {nota.eliminable && (
          <button
            type="button"
            onClick={onEliminar}
            disabled={eliminando}
            title="Eliminar (solo el día en que la subiste)" aria-label="Eliminar nota"
            className="shrink-0 text-red-600 hover:text-red-700 disabled:opacity-40"
          >
            <IconBasura />
          </button>
        )}
      </div>
      <p className="whitespace-pre-wrap break-words text-xs leading-snug text-gray-800">{nota.texto}</p>
    </div>
  );
}

/**
 * Chat de notas de una entidad (colapsable). Reutilizable: solo recibe la
 * ubicación (`modulo`, `pantalla`, `entidadTipo`, `entidadId`). Los avisos de
 * MontseAI los inserta el servidor al ocurrir un cambio; aquí solo se muestran.
 * Ver / escribir exige el permiso del módulo (lo valida el backend).
 */
export function PanelNotas({
  refNotas,
  titulo = 'Notas',
  historial,
}: {
  refNotas: RefNotas;
  titulo?: string;
  /** Si se da, el panel gana la pestaña «Historial» (solo lectura; todo lo automático). */
  historial?: {
    queryKey: readonly unknown[];
    queryFn: () => Promise<EventoHistorial[]>;
    /** Texto del pie de solo lectura (p. ej. desde cuándo hay registros). */
    pie?: string;
  };
}) {
  const queryClient = useQueryClient();
  const [colapsado, setColapsado] = useState(leerColapsado);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState<'notas' | 'historial'>('notas');
  const finRef = useRef<HTMLDivElement>(null);

  const clave = ['notas', refNotas.modulo, refNotas.pantalla, refNotas.entidadTipo, refNotas.entidadId];
  const { data: todas = [], isLoading, isError } = useQuery({
    queryKey: clave,
    queryFn: () => notasApi.listar(refNotas),
    // Las notas de otras personas llegan por sondeo: cada 60 s y al volver a la ventana, pero solo mientras
    // el panel está abierto en la pestaña Notas (de inmediato tras editar el plan: `invalidateQueries(['notas'])`).
    refetchInterval: !colapsado && pestana === 'notas' ? 60_000 : false,
    refetchOnWindowFocus: true,
  });
  // «Notas» = solo lo que escriben las personas; lo automático (MontseAI) vive en «Historial».
  const notas = useMemo(() => todas.filter((n) => n.tipo === 'usuario'), [todas]);

  const { data: eventos = [], isLoading: cargandoHist, isError: errorHist } = useQuery({
    queryKey: historial?.queryKey ?? ['notas', 'historial', 'sin-historial'],
    queryFn: historial?.queryFn ?? (() => Promise.resolve([] as EventoHistorial[])),
    enabled: !!historial,
    // La primera carga alimenta el contador; el sondeo solo corre con el Historial a la vista.
    refetchInterval: !colapsado && pestana === 'historial' ? 60_000 : false,
    refetchOnWindowFocus: true,
  });

  const crear = useMutation({
    mutationFn: (t: string) => notasApi.crear(refNotas, t),
    onSuccess: () => {
      setTexto('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: clave });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo guardar la nota.'),
  });
  const eliminar = useMutation({
    mutationFn: (id: string) => notasApi.eliminar(id),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: clave });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo eliminar la nota.'),
  });

  // Al abrir o llegar mensajes nuevos, baja al último.
  useEffect(() => {
    if (!colapsado && pestana === 'notas') finRef.current?.scrollIntoView({ block: 'end' });
  }, [notas.length, colapsado, pestana]);

  const grupos = useMemo(() => {
    const out: Array<{ dia: string; items: Nota[] }> = [];
    for (const n of notas) {
      const dia = etiquetaDia(n.fc);
      const ult = out[out.length - 1];
      if (ult && ult.dia === dia) ult.items.push(n);
      else out.push({ dia, items: [n] });
    }
    return out;
  }, [notas]);

  const gruposHist = useMemo(() => {
    const out: Array<{ dia: string; items: EventoHistorial[] }> = [];
    for (const e of eventos) {
      const dia = etiquetaDia(e.fecha);
      const ult = out[out.length - 1];
      if (ult && ult.dia === dia) ult.items.push(e);
      else out.push({ dia, items: [e] });
    }
    return out;
  }, [eventos]);

  function alternar() {
    setColapsado((v) => {
      guardarColapsado(!v);
      return !v;
    });
  }

  function enviar() {
    const t = texto.trim();
    if (!t || crear.isPending) return;
    crear.mutate(t);
  }

  if (colapsado) {
    return (
      <aside className="flex w-12 shrink-0 flex-col items-center gap-3 rounded-xl border bg-white py-3" aria-label={titulo}>
        <button
          type="button"
          onClick={alternar}
          title="Mostrar notas" aria-label="Mostrar notas"
          className="flex h-7 w-7 items-center justify-center rounded-md border text-gray-500 hover:bg-gray-50"
        >
          <IconDobleIzq />
        </button>
        <span className="text-[#1f2a4d]">
          <IconChat size={20} />
        </span>
        {notas.length > 0 && (
          <span className="rounded-full bg-[#1f2a4d] px-2 py-0.5 text-[11px] font-bold text-white">{notas.length}</span>
        )}
        <span className="text-[11px] font-bold tracking-[0.2em] text-gray-500 [writing-mode:vertical-rl]">
          {titulo.toUpperCase()}
        </span>
      </aside>
    );
  }

  // El contenedor es `relative` y el panel `absolute inset-0`: así el panel mide
  // exactamente lo que mida el elemento hermano (la tabla) y su lista de mensajes
  // hace scroll interno en vez de estirar la fila.
  return (
    <div className="relative min-h-[420px] w-[360px] shrink-0">
    <aside className="absolute inset-0 flex flex-col overflow-hidden rounded-xl border bg-white" aria-label={titulo}>
      <div className={`flex items-center justify-between border-b ${historial ? 'pr-2.5' : 'px-3.5 py-3'}`}>
        {historial ? (
          <div className="flex" role="tablist">
            {(
              [
                ['notas', 'Notas', notas.length, <IconChat key="n" size={14} />],
                ['historial', 'Historial', eventos.length, <IconHist key="h" size={14} />],
              ] as const
            ).map(([id, etiqueta, n, icono]) => {
              const activa = pestana === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={activa}
                  onClick={() => setPestana(id)}
                  className={`flex items-center gap-1.5 border-b-2 px-3.5 py-3 text-[13px] ${
                    activa ? 'border-[#1f2a4d] font-bold text-gray-800' : 'border-transparent font-medium text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <span className={activa ? 'text-[#1f2a4d]' : ''}>{icono}</span>
                  {etiqueta}
                  <span
                    className={`rounded-full px-1.5 py-px text-[11px] font-bold ${
                      activa ? 'bg-[#1f2a4d] text-white' : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {n}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[#1f2a4d]">
            <IconChat />
            <span className="text-sm font-bold text-gray-800">{titulo}</span>
            {notas.length > 0 && (
              <span className="rounded-full bg-[#1f2a4d] px-2 py-0.5 text-[11px] font-bold text-white">{notas.length}</span>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={alternar}
          title="Ocultar notas" aria-label="Ocultar notas"
          className="flex h-7 w-7 items-center justify-center rounded-md border text-gray-500 hover:bg-gray-50"
        >
          <IconDobleDer />
        </button>
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3.5">
        {pestana === 'historial' && historial ? (
          cargandoHist ? (
            <p className="py-6 text-center text-xs text-gray-400">Cargando…</p>
          ) : errorHist ? (
            <p className="py-6 text-center text-xs text-red-600">No se pudo cargar el historial.</p>
          ) : gruposHist.length === 0 ? (
            <p className="py-6 text-center text-xs text-gray-400">Aún no hay eventos registrados en este plan.</p>
          ) : (
            gruposHist.map((g) => (
              <div key={g.dia} className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-gray-500">
                  <span className="h-px w-14 bg-gray-200" />
                  {g.dia}
                  <span className="h-px w-14 bg-gray-200" />
                </div>
                {g.items.map((e) => (
                  <FilaEvento key={e.id} evento={e} />
                ))}
              </div>
            ))
          )
        ) : isLoading ? (
          <p className="py-6 text-center text-xs text-gray-400">Cargando…</p>
        ) : isError ? (
          <p className="py-6 text-center text-xs text-red-600">No se pudieron cargar las notas.</p>
        ) : grupos.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-400">
            Aún no hay notas. Escribe la primera
            {historial ? '; los avisos automáticos de MontseAI están en la pestaña Historial.' : '.'}
          </p>
        ) : (
          grupos.map((g) => (
            <div key={g.dia} className="space-y-2.5">
              <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-gray-500">
                <span className="h-px w-14 bg-gray-200" />
                {g.dia}
                <span className="h-px w-14 bg-gray-200" />
              </div>
              {g.items.map((n) => (
                <NotaUsuario
                  key={n.id}
                  nota={n}
                  eliminando={eliminar.isPending}
                  onEliminar={() => {
                    if (window.confirm('¿Eliminar esta nota? No se puede deshacer.')) eliminar.mutate(n.id);
                  }}
                />
              ))}
            </div>
          ))
        )}
        <div ref={finRef} />
      </div>

      {pestana === 'historial' && historial ? (
        <div className="flex items-center gap-1.5 border-t bg-gray-50 px-3.5 py-2.5 text-[11px] text-gray-500">
          <IconCandado />
          {historial.pie ?? 'Solo lectura'}
        </div>
      ) : (
      <div className="border-t p-3">
        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value.slice(0, MAX_TEXTO))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            rows={1}
            placeholder="Escribe una nota…"
            className="max-h-28 min-h-9 flex-1 resize-none rounded-md border px-2.5 py-2 text-sm outline-none focus:border-[#1f2a4d]"
          />
          <button
            type="button"
            onClick={enviar}
            disabled={!texto.trim() || crear.isPending}
            title="Enviar (Enter)" aria-label="Enviar nota"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#1f2a4d] text-white hover:bg-[#2a3868] disabled:opacity-40"
          >
            <IconEnviar />
          </button>
        </div>
      </div>
      )}
    </aside>
    </div>
  );
}
