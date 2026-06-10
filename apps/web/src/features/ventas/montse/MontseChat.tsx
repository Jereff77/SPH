import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useMontse } from './useMontse';
import { ChartBlockIA } from './ChartBlockIA';
import type { MensajeIA } from './montse.api';

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

/** Convierte tablas markdown a CSV (para pegar en Excel); si no hay tabla, texto plano. */
function markdownToCSV(text: string): string {
  const lineas = text.split('\n').filter((l) => l.trim().startsWith('|'));
  if (lineas.length === 0) return text;
  const filas: string[] = [];
  for (const l of lineas) {
    if (/^\|[\s\-:|]+\|$/.test(l.trim())) continue;
    const celdas = l
      .split('|')
      .slice(1, -1)
      .map((c) => {
        const v = c.trim().replace(/\*\*?([^*]+)\*\*?/g, '$1').trim();
        return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      });
    filas.push(celdas.join(','));
  }
  return filas.join('\n');
}

const MD_COMPONENTS = {
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => <thead className="bg-slate-200">{children}</thead>,
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="whitespace-nowrap border border-slate-300 px-3 py-1.5 text-left font-semibold text-slate-700">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border border-slate-200 px-3 py-1.5 text-slate-700">{children}</td>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => <tr className="even:bg-slate-50">{children}</tr>,
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="mb-2 list-inside list-disc space-y-0.5">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="mb-2 list-inside list-decimal space-y-0.5">{children}</ol>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-slate-200 px-1 py-0.5 font-mono text-xs text-slate-800">{children}</code>
  ),
};

function MensajeAI({ m }: { m: MensajeIA }) {
  const [copiado, setCopiado] = useState(false);
  const copiarCSV = async () => {
    try {
      await navigator.clipboard.writeText(markdownToCSV(m.texto));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* noop */
    }
  };
  return (
    <div className="flex w-full max-w-[92%] gap-2 self-start">
      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-blue-500">
        🤖
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="overflow-x-auto rounded-b-xl rounded-tr-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-800">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
            {m.texto}
          </ReactMarkdown>
        </div>
        {m.grafico && <ChartBlockIA grafico={m.grafico} />}
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <span className="text-[10px] text-slate-400">{hora(m.fc)}</span>
          <button
            onClick={copiarCSV}
            title="Copiar como CSV (pegar en Excel)"
            className={`rounded border p-1.5 text-xs transition-colors ${copiado ? 'border-green-200 bg-green-50 text-green-600' : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600'}`}
          >
            {copiado ? '✓' : 'CSV'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MontseChat() {
  const {
    sesiones, sesionActual, mensajes, ocupado, sinTokens, cargando,
    cargarSesiones, nuevaSesion, seleccionarSesion, enviar, eliminarSesion,
  } = useMontse();
  const [texto, setTexto] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { cargarSesiones(); }, [cargarSesiones]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensajes, ocupado]);

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (texto.trim() && !ocupado && !sinTokens) {
        enviar(texto.trim());
        setTexto('');
      }
    }
  };

  return (
    <div className="flex h-[calc(100vh-15rem)] overflow-hidden rounded-xl border bg-white shadow-sm">
      {/* Sidebar de sesiones */}
      <div className="flex w-60 flex-shrink-0 flex-col border-r bg-gray-50">
        <div className="p-3">
          <button
            onClick={() => nuevaSesion()}
            disabled={sinTokens}
            className="w-full rounded-lg bg-[#1f2a4d] px-3 py-2 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50"
          >
            + Nueva conversación
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {cargando ? (
            <p className="px-2 py-4 text-center text-xs text-gray-400">Cargando…</p>
          ) : sesiones.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-gray-400">Sin conversaciones aún.</p>
          ) : (
            sesiones.map((s) => (
              <div
                key={s.uuid}
                className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-sm ${sesionActual === s.uuid ? 'bg-[#1f2a4d]/10 text-[#1f2a4d]' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <button onClick={() => seleccionarSesion(s.uuid)} className="flex-1 truncate text-left" title={s.titulo ?? 'Conversación'}>
                  {s.titulo ?? 'Conversación'}
                </button>
                <button
                  onClick={() => { if (window.confirm('¿Eliminar esta conversación?')) eliminarSesion(s.uuid); }}
                  title="Eliminar"
                  className="opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                >
                  🗑
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Área de chat */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 bg-blue-50">🤖</div>
          <div>
            <div className="text-sm font-semibold text-slate-800">Montse AI · Asistente SPH</div>
            <div className="max-w-xs truncate text-xs text-slate-400">
              {sesionActual ? sesiones.find((s) => s.uuid === sesionActual)?.titulo ?? 'Conversación' : 'Pregunta sobre tus datos del ERP'}
            </div>
          </div>
        </div>

        {/* Mensajes */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-5">
          {mensajes.length === 0 && !ocupado ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-slate-300">
              <span className="text-4xl">🤖</span>
              <h3 className="text-base font-medium text-slate-400">¿En qué te puedo ayudar?</h3>
              <p className="max-w-xs text-sm text-slate-300">Pregunta sobre parques, inversionistas, pagos o cualquier dato del sistema.</p>
            </div>
          ) : (
            mensajes.map((m, i) =>
              m.tipo === 'user' ? (
                <div key={i} className="flex max-w-[80%] flex-row-reverse gap-2 self-end">
                  <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">Tú</div>
                  <div className="flex min-w-0 flex-col">
                    <div className="break-words rounded-b-xl rounded-tl-xl bg-blue-600 px-3.5 py-2.5 text-sm leading-relaxed text-white">{m.texto}</div>
                    <span className="mt-1 text-right text-[10px] text-slate-400">{hora(m.fc)}</span>
                  </div>
                </div>
              ) : (
                <MensajeAI key={i} m={m} />
              ),
            )
          )}
          {ocupado && (
            <div className="flex gap-2 self-start">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-blue-100 bg-blue-50">🤖</div>
              <div className="flex items-center gap-1 rounded-b-xl rounded-tr-xl border border-slate-200 bg-slate-50 px-4 py-3">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {sinTokens ? (
          <div className="border-t bg-slate-50 px-4 py-3 text-center text-sm text-slate-500">
            El asistente no está disponible en este momento. Contacta a soporte para continuar.
          </div>
        ) : (
          <div className="border-t bg-white px-4 pb-4 pt-3">
            <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 focus-within:border-blue-400 focus-within:bg-white">
              <textarea
                rows={1}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={onKey}
                placeholder="Escribe tu pregunta…"
                disabled={ocupado}
                className="max-h-[120px] min-h-[22px] flex-1 resize-none border-none bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none disabled:opacity-50"
              />
              <button
                onClick={() => { if (texto.trim() && !ocupado) { enviar(texto.trim()); setTexto(''); } }}
                disabled={ocupado || !texto.trim()}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                title="Enviar"
              >
                ➤
              </button>
            </div>
            <p className="mt-2 text-center text-[10.5px] text-slate-400">
              ⚠️ El asistente puede cometer errores. Verifica información importante con tu asesor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
