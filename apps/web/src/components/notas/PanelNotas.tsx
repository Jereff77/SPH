import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notasApi, type Nota, type RefNotas } from './notas.api';

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

/** Mensaje de MontseAI: aviso automático; los de «cambio manual» se despliegan con su detalle. */
function AvisoMontse({ nota }: { nota: Nota }) {
  const cambios = nota.evento === 'cambio_manual' ? (nota.detalle?.cambios ?? []) : [];
  const [abierto, setAbierto] = useState(false);
  const desplegable = cambios.length > 0;
  return (
    <div className="space-y-1.5 rounded-lg border border-[#c9d6ee] bg-[#eef3fb] p-2.5">
      <div className="flex items-center gap-1.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1f2a4d] text-[#8cc63f]">
          <IconChispa />
        </span>
        <span className="text-xs font-bold text-[#1f2a4d]">MontseAI</span>
        <span className="text-[11px] text-gray-500">{horaMx(nota.fa)}</span>
      </div>
      {desplegable ? (
        <>
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            className="flex w-full items-center justify-between gap-2 text-left text-xs text-gray-800"
          >
            <span className={abierto ? 'font-semibold' : ''}>
              {nota.texto}
              {nota.autor ? ` · por ${nota.autor}` : ''}
            </span>
            <span className="shrink-0 text-gray-500">
              <IconChev abierto={abierto} />
            </span>
          </button>
          {abierto &&
            cambios.map((c, i) => (
              <div key={i} className="space-y-0.5 border-t border-[#c9d6ee] pt-1.5">
                {(c.partida != null || c.concepto) && (
                  <div className="text-[11px] font-semibold text-gray-500">
                    {c.partida != null ? `#${c.partida}` : ''}
                    {c.partida != null && c.concepto ? ' · ' : ''}
                    {c.concepto ?? ''}
                  </div>
                )}
                <div className="text-xs font-semibold text-[#1f2a4d]">{c.descripcion}</div>
              </div>
            ))}
        </>
      ) : (
        <p className="whitespace-pre-wrap break-words text-xs leading-snug text-gray-800">
          {nota.texto}
          {nota.autor ? <span className="text-gray-500"> — por {nota.autor}</span> : null}
        </p>
      )}
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
export function PanelNotas({ refNotas, titulo = 'Notas' }: { refNotas: RefNotas; titulo?: string }) {
  const queryClient = useQueryClient();
  const [colapsado, setColapsado] = useState(leerColapsado);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  const clave = ['notas', refNotas.modulo, refNotas.pantalla, refNotas.entidadTipo, refNotas.entidadId];
  const { data: notas = [], isLoading, isError } = useQuery({
    queryKey: clave,
    queryFn: () => notasApi.listar(refNotas),
    // Los avisos de MontseAI nacen en el servidor: se refresca al volver a la ventana y cada 60 s
    // (y de inmediato tras editar el plan, ver `invalidateQueries(['notas'])`).
    refetchInterval: 60_000,
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
    if (!colapsado) finRef.current?.scrollIntoView({ block: 'end' });
  }, [notas.length, colapsado]);

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
      <div className="flex items-center justify-between border-b px-3.5 py-3">
        <div className="flex items-center gap-2 text-[#1f2a4d]">
          <IconChat />
          <span className="text-sm font-bold text-gray-800">{titulo}</span>
          {notas.length > 0 && (
            <span className="rounded-full bg-[#1f2a4d] px-2 py-0.5 text-[11px] font-bold text-white">{notas.length}</span>
          )}
        </div>
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
        {isLoading ? (
          <p className="py-6 text-center text-xs text-gray-400">Cargando…</p>
        ) : isError ? (
          <p className="py-6 text-center text-xs text-red-600">No se pudieron cargar las notas.</p>
        ) : grupos.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-400">
            Aún no hay notas. Escribe la primera; aquí también verás los avisos de MontseAI sobre este plan.
          </p>
        ) : (
          grupos.map((g) => (
            <div key={g.dia} className="space-y-2.5">
              <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-gray-500">
                <span className="h-px w-14 bg-gray-200" />
                {g.dia}
                <span className="h-px w-14 bg-gray-200" />
              </div>
              {g.items.map((n) =>
                n.tipo === 'sistema' ? (
                  <AvisoMontse key={n.id} nota={n} />
                ) : (
                  <NotaUsuario
                    key={n.id}
                    nota={n}
                    eliminando={eliminar.isPending}
                    onEliminar={() => {
                      if (window.confirm('¿Eliminar esta nota? No se puede deshacer.')) eliminar.mutate(n.id);
                    }}
                  />
                ),
              )}
            </div>
          ))
        )}
        <div ref={finRef} />
      </div>

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
    </aside>
    </div>
  );
}
