import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSoporte } from './useSoporte';
import { capturarPantalla, type CapturaSoporte } from './screen-capture';
import type { MensajeSoporte, SesionSoporte } from './soporte.api';

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

const fechaSesion = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const MD = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-2 list-inside list-disc space-y-0.5">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-2 list-inside list-decimal space-y-0.5">{children}</ol>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-slate-900">{children}</strong>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-slate-200 px-1 py-0.5 font-mono text-xs text-slate-800">{children}</code>
  ),
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a href={href} className="text-blue-600 underline">
      {children}
    </a>
  ),
};

function Burbuja({ m }: { m: MensajeSoporte }) {
  const [ampliada, setAmpliada] = useState(false);
  if (m.tipo === 'user') {
    return (
      <div className="flex flex-row-reverse gap-2 self-end">
        <div className="max-w-[85%] rounded-b-xl rounded-tl-xl bg-blue-600 px-3 py-2 text-sm leading-relaxed text-white">
          {m.texto}
          {m.imagen && (
            <>
              <button
                type="button"
                onClick={() => setAmpliada(true)}
                title="Ver captura completa"
                className="mt-2 block overflow-hidden rounded-lg border border-white/30"
              >
                <img
                  src={m.imagen}
                  alt="Captura de pantalla enviada"
                  className="h-20 w-full object-cover object-left-top"
                />
              </button>
              {ampliada && (
                <div
                  className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
                  onClick={() => setAmpliada(false)}
                >
                  <img
                    src={m.imagen}
                    alt="Captura de pantalla enviada"
                    className="max-h-full max-w-full rounded-lg shadow-2xl"
                  />
                  <button
                    type="button"
                    onClick={() => setAmpliada(false)}
                    aria-label="Cerrar"
                    className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-sm font-medium text-slate-800 hover:bg-white"
                  >
                    ✕ Cerrar
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2 self-start">
      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-sm">
        🤖
      </div>
      <div className="max-w-[85%] rounded-b-xl rounded-tr-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-800">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>
          {m.texto}
        </ReactMarkdown>
        <div className="mt-1 text-[10px] text-slate-400">{hora(m.fc)}</div>
      </div>
    </div>
  );
}

/** Formulario inline para confirmar la escalación a ticket. */
function FormEscalar({
  asuntoSugerido,
  resumenSugerido,
  onCancelar,
  onConfirmar,
}: {
  asuntoSugerido: string;
  resumenSugerido: string;
  onCancelar: () => void;
  onConfirmar: (asunto: string, resumen: string) => void;
}) {
  const [asunto, setAsunto] = useState(asuntoSugerido);
  const [resumen, setResumen] = useState(resumenSugerido);
  const [enviando, setEnviando] = useState(false);
  return (
    <div className="m-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
      <p className="mb-2 font-semibold text-amber-900">Crear ticket de soporte</p>
      <label className="mb-1 block text-xs text-amber-900">Asunto</label>
      <input
        value={asunto}
        onChange={(e) => setAsunto(e.target.value)}
        maxLength={160}
        className="mb-2 w-full rounded border border-amber-300 bg-white px-2 py-1 text-sm outline-none focus:border-amber-500"
      />
      <label className="mb-1 block text-xs text-amber-900">Descripción del problema</label>
      <textarea
        value={resumen}
        onChange={(e) => setResumen(e.target.value)}
        rows={3}
        maxLength={4000}
        className="mb-2 w-full resize-none rounded border border-amber-300 bg-white px-2 py-1 text-sm outline-none focus:border-amber-500"
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancelar}
          className="rounded px-3 py-1 text-xs text-amber-900 hover:bg-amber-100"
        >
          Cancelar
        </button>
        <button
          disabled={enviando || asunto.trim().length < 3 || resumen.trim().length < 10}
          onClick={async () => {
            setEnviando(true);
            await onConfirmar(asunto, resumen);
            setEnviando(false);
          }}
          className="rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {enviando ? 'Enviando…' : 'Enviar ticket'}
        </button>
      </div>
    </div>
  );
}

/**
 * Agente de IA de Soporte: burbuja 💬 (disparador) + panel lateral FIJO a la
 * derecha que EMPUJA el contenido (el AppShell aplica `md:mr-96` cuando está
 * abierto y colapsa el sidebar; el estado abierto/cerrado vive allá). Conoce la
 * pantalla actual (`useLocation`) para dar ayuda contextual y puede escalar a
 * un ticket cuando no resuelve.
 */
export function SoporteWidget({
  abierto,
  onAbrir,
  onCerrar,
}: {
  abierto: boolean;
  onAbrir: () => void;
  onCerrar: () => void;
}) {
  const { pathname } = useLocation();
  const {
    mensajes,
    ocupado,
    cargando,
    puedeEscalar,
    enviar,
    proponerTicket,
    escalar,
    nuevaConversacion,
    listarSesiones,
    abrirSesion,
    renombrarSesion,
    eliminarSesion,
  } = useSoporte();
  const [texto, setTexto] = useState('');
  // Captura de pantalla adjunta manualmente (botón 📷), pendiente de enviar.
  const [captura, setCaptura] = useState<CapturaSoporte | null>(null);
  const [capturando, setCapturando] = useState(false);
  const [escalando, setEscalando] = useState(false);
  const [proponiendo, setProponiendo] = useState(false);
  const [propuesta, setPropuesta] = useState<{ asunto: string; resumen: string } | null>(null);
  // Panel de conversaciones anteriores.
  const [verHistorial, setVerHistorial] = useState(false);
  const [sesiones, setSesiones] = useState<SesionSoporte[]>([]);
  const [cargandoSesiones, setCargandoSesiones] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (abierto && !verHistorial) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, ocupado, abierto, escalando, verHistorial]);

  const abrirHistorial = async () => {
    setVerHistorial(true);
    setCargandoSesiones(true);
    try {
      setSesiones(await listarSesiones());
    } catch (e) {
      console.error('No se pudieron cargar las conversaciones:', e);
    } finally {
      setCargandoSesiones(false);
    }
  };

  const elegirSesion = async (id: string) => {
    await abrirSesion(id);
    setVerHistorial(false);
    setEscalando(false);
    setPropuesta(null);
  };

  const renombrar = async (s: SesionSoporte) => {
    const titulo = window.prompt('Nuevo nombre de la conversación:', s.titulo ?? '');
    if (titulo == null || !titulo.trim()) return;
    await renombrarSesion(s.uuid, titulo);
    setSesiones((prev) =>
      prev.map((x) => (x.uuid === s.uuid ? { ...x, titulo: titulo.trim() } : x)),
    );
  };

  const borrar = async (s: SesionSoporte) => {
    if (!window.confirm('¿Eliminar esta conversación?')) return;
    await eliminarSesion(s.uuid);
    setSesiones((prev) => prev.filter((x) => x.uuid !== s.uuid));
  };

  const mandar = () => {
    if ((texto.trim() || captura) && !ocupado) {
      enviar(texto.trim(), pathname, captura?.dataUrl);
      setTexto('');
      setCaptura(null);
    }
  };

  /** Captura la pantalla (botón 📷) y la deja adjunta para enviarla con el mensaje. */
  const adjuntarCaptura = async () => {
    if (ocupado || capturando || captura) return;
    setCapturando(true);
    try {
      setCaptura(await capturarPantalla());
    } catch (e) {
      console.error('No se pudo capturar la pantalla:', e);
    } finally {
      setCapturando(false);
    }
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      mandar();
    }
  };

  // Última pregunta del usuario (respaldo si la IA no logra redactar el ticket).
  const ultimaPregunta = [...mensajes].reverse().find((m) => m.tipo === 'user')?.texto ?? '';

  // Genera la propuesta de ticket (asunto + resumen) analizando la conversación.
  const abrirEscalacion = async () => {
    setProponiendo(true);
    const p = await proponerTicket(pathname);
    setPropuesta(
      p ?? {
        asunto: ultimaPregunta.slice(0, 80) || 'Solicitud de soporte',
        resumen: ultimaPregunta,
      },
    );
    setEscalando(true);
    setProponiendo(false);
  };

  return (
    <>
      {/* Botón flotante (disparador del panel) */}
      {!abierto && (
        <button
          onClick={onAbrir}
          aria-label="Abrir asistente de ayuda"
          className="fixed bottom-5 right-5 z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-[#1f2a4d] text-2xl text-white shadow-lg transition-transform hover:scale-105"
        >
          💬
        </button>
      )}

      {/* Panel lateral fijo derecho: empuja el contenido (no lo tapa). Siempre
          montado para animar la entrada/salida con translate. z-[70]: por ENCIMA
          de los modales (z-50/z-[60]) para poder escribirle al agente con un
          modal abierto (p. ej. adjuntar la captura de una ventana de config). */}
      <div
        className={`fixed inset-y-0 right-0 z-[70] flex w-full flex-col overflow-hidden border-l border-slate-200 bg-white shadow-xl transition-transform duration-200 md:w-96 ${
          abierto ? 'translate-x-0' : 'pointer-events-none translate-x-full'
        }`}
        aria-hidden={!abierto}
      >
          {/* Encabezado */}
          <div className="flex items-center justify-between bg-[#1f2a4d] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <div>
                <div className="text-sm font-semibold leading-tight">Asistente SPH</div>
                <div className="text-[11px] text-white/70">Ayuda para usar el sistema</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => (verHistorial ? setVerHistorial(false) : void abrirHistorial())}
                title={verHistorial ? 'Volver al chat' : 'Conversaciones anteriores'}
                className={`rounded p-1.5 text-white/80 hover:bg-white/10 ${verHistorial ? 'bg-white/15' : ''}`}
              >
                🕘
              </button>
              <button
                onClick={() => {
                  nuevaConversacion();
                  setVerHistorial(false);
                  setEscalando(false);
                  setPropuesta(null);
                }}
                title="Nueva conversación"
                className="rounded p-1.5 text-white/80 hover:bg-white/10"
              >
                ✚
              </button>
              <button
                onClick={onCerrar}
                title="Cerrar"
                className="rounded p-1.5 text-white/80 hover:bg-white/10"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Panel de conversaciones anteriores */}
          {verHistorial ? (
            <div className="flex flex-1 flex-col overflow-y-auto">
              <div className="border-b bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500">
                Conversaciones anteriores
              </div>
              {cargandoSesiones ? (
                <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
                  Cargando…
                </div>
              ) : sesiones.length === 0 ? (
                <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-400">
                  Aún no tienes conversaciones guardadas.
                </div>
              ) : (
                <ul className="divide-y">
                  {sesiones.map((s) => (
                    <li
                      key={s.uuid}
                      className="group flex items-center gap-2 px-3 py-2 hover:bg-slate-50"
                    >
                      <button
                        onClick={() => void elegirSesion(s.uuid)}
                        className="flex min-w-0 flex-1 flex-col text-left"
                      >
                        <span className="truncate text-sm text-slate-800">
                          {s.titulo?.trim() || 'Conversación'}
                        </span>
                        <span className="text-[10px] text-slate-400">{fechaSesion(s.fc)}</span>
                      </button>
                      <button
                        onClick={() => void renombrar(s)}
                        title="Renombrar"
                        className="rounded p-1 text-slate-400 opacity-0 hover:bg-slate-200 hover:text-slate-700 group-hover:opacity-100"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => void borrar(s)}
                        title="Eliminar"
                        className="rounded p-1 text-red-400 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                      >
                        🗑
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
          /* Mensajes */
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-4">
            {cargando ? (
              <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
                Cargando conversación…
              </div>
            ) : mensajes.length === 0 && !ocupado ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-slate-400">
                <span className="text-3xl">👋</span>
                <p className="text-sm">
                  Hola, soy tu asistente. Pregúntame <strong>cómo hacer algo</strong> en el sistema
                  o por qué no te aparece una opción.
                </p>
              </div>
            ) : (
              mensajes.map((m, i) => <Burbuja key={i} m={m} />)
            )}
            {ocupado && (
              <div className="flex gap-2 self-start">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-blue-100 bg-blue-50">
                  🤖
                </div>
                <div className="flex items-center gap-1 rounded-b-xl rounded-tr-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  {[0, 150, 300].map((d) => (
                    <span
                      key={d}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Botón / formulario de escalación */}
            {puedeEscalar && !escalando && (
              <button
                onClick={abrirEscalacion}
                disabled={proponiendo}
                className="self-start rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60"
              >
                {proponiendo ? '✍️ Redactando ticket…' : '🎫 Crear ticket de soporte'}
              </button>
            )}
            {escalando && propuesta && (
              <FormEscalar
                asuntoSugerido={propuesta.asunto}
                resumenSugerido={propuesta.resumen}
                onCancelar={() => {
                  setEscalando(false);
                  setPropuesta(null);
                }}
                onConfirmar={async (asunto, resumen) => {
                  await escalar(asunto, resumen, pathname);
                  setEscalando(false);
                  setPropuesta(null);
                }}
              />
            )}
            <div ref={bottomRef} />
          </div>
          )}

          {/* Input (oculto en el historial) */}
          {!verHistorial && (
          <div className="border-t bg-white px-3 pb-3 pt-2">
            {/* Captura adjunta pendiente de enviar */}
            {captura && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1.5">
                <img
                  src={captura.dataUrl}
                  alt="Captura de tu pantalla"
                  className="h-12 w-20 rounded border border-slate-200 object-cover object-left-top"
                />
                <span className="flex-1 text-xs text-slate-500">
                  📸 Captura de tu pantalla adjunta
                </span>
                <button
                  onClick={() => setCaptura(null)}
                  title="Quitar captura"
                  className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>
            )}
            <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-blue-400 focus-within:bg-white">
              <textarea
                rows={1}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={onKey}
                placeholder="Escribe tu pregunta…"
                disabled={ocupado}
                className="max-h-[100px] min-h-[20px] flex-1 resize-none border-none bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none disabled:opacity-50"
              />
              <button
                onClick={() => void adjuntarCaptura()}
                disabled={ocupado || capturando || !!captura}
                title="Adjuntar captura de mi pantalla"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-base text-[#1f2a4d] hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {capturando ? '⏳' : '📷'}
              </button>
              <button
                onClick={mandar}
                disabled={ocupado || (!texto.trim() && !captura)}
                title="Enviar"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                ➤
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-slate-400">
              El asistente puede equivocarse. Verifica lo importante.
            </p>
          </div>
          )}
        </div>
    </>
  );
}
