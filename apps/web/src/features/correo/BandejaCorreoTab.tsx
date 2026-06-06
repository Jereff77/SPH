import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  correoApi,
  type Conversacion,
  type MensajeCorreo,
} from './correo.api';
import { ApiRequestError } from '@/lib/api';

const fechaHora = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
const esUrl = (u: string | null): u is string => !!u && /^https?:\/\//.test(u);

export function BandejaCorreoTab({ idCuenta }: { idCuenta: string }) {
  const queryClient = useQueryClient();
  const [convSel, setConvSel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: conversaciones = [], isLoading } = useQuery({
    queryKey: ['correo-bandeja', idCuenta],
    queryFn: () => correoApi.bandeja(idCuenta),
  });

  const sincronizar = useMutation({
    mutationFn: () => correoApi.sincronizar(idCuenta),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['correo-bandeja', idCuenta] });
      if (convSel)
        void queryClient.invalidateQueries({ queryKey: ['correo-hilo', idCuenta, convSel] });
    },
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo sincronizar.'),
  });

  return (
    <div className="flex h-[calc(100vh-3.5rem-9rem)] gap-3">
      {/* Lista de conversaciones */}
      <aside className="flex w-80 shrink-0 flex-col rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold text-gray-700">Bandeja</span>
          <button
            onClick={() => sincronizar.mutate()}
            disabled={sincronizar.isPending}
            className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
          >
            {sincronizar.isPending ? 'Sincronizando…' : '↻ Sincronizar'}
          </button>
        </div>
        {error && <div className="px-3 py-2 text-xs text-red-600">{error}</div>}
        <div className="flex-1 divide-y overflow-auto">
          {isLoading && <p className="px-3 py-4 text-sm text-gray-400">Cargando…</p>}
          {!isLoading && conversaciones.length === 0 && (
            <p className="px-3 py-4 text-xs text-gray-400">
              No hay correos. Pulsa "Sincronizar" para traerlos.
            </p>
          )}
          {conversaciones.map((c) => (
            <ConversacionItem
              key={c.conversationId}
              c={c}
              activo={c.conversationId === convSel}
              onClick={() => setConvSel(c.conversationId)}
            />
          ))}
        </div>
      </aside>

      {/* Detalle del hilo */}
      <section className="flex min-w-0 flex-1 flex-col rounded-xl border bg-white">
        {convSel ? (
          <Hilo idCuenta={idCuenta} conversationId={convSel} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
            Selecciona un correo para verlo.
          </div>
        )}
      </section>
    </div>
  );
}

function ConversacionItem({
  c,
  activo,
  onClick,
}: {
  c: Conversacion;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full px-3 py-2.5 text-left hover:bg-gray-50 ${activo ? 'bg-[#3f5b87]/10' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`truncate text-sm ${c.noLeidos > 0 ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
          {c.ultimoFrom ?? '—'}
        </span>
        <span className="shrink-0 text-[10px] text-gray-400">{fechaHora(c.ultimaFecha)}</span>
      </div>
      <div className="truncate text-xs text-gray-500">{c.subject ?? '(sin asunto)'}</div>
      <div className="mt-0.5 flex items-center gap-1.5">
        {c.noLeidos > 0 && (
          <span className="rounded-full bg-[#1f2a4d] px-1.5 text-[10px] font-bold text-white">{c.noLeidos}</span>
        )}
        {c.tieneAdjuntos && <span className="text-[10px] text-gray-400">📎</span>}
        <span className="text-[10px] text-gray-400">{c.total} mensaje(s)</span>
      </div>
    </button>
  );
}

function Hilo({ idCuenta, conversationId }: { idCuenta: string; conversationId: string }) {
  const queryClient = useQueryClient();
  const [respuesta, setRespuesta] = useState('');
  const [archivos, setArchivos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: mensajes = [], isLoading } = useQuery({
    queryKey: ['correo-hilo', idCuenta, conversationId],
    queryFn: () => correoApi.hilo(idCuenta, conversationId),
  });

  // Se responde al último mensaje recibido (o al último del hilo).
  const idResponder = useMemo(() => {
    const recibidos = mensajes.filter((m) => m.tipo === 'received');
    const base = recibidos.length ? recibidos[recibidos.length - 1] : mensajes[mensajes.length - 1];
    return base?.id;
  }, [mensajes]);

  const enviar = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('body', respuesta);
      archivos.forEach((a) => fd.append('adjuntos', a));
      return correoApi.responder(idResponder!, fd);
    },
    onSuccess: () => {
      setError(null);
      setRespuesta('');
      setArchivos([]);
      void queryClient.invalidateQueries({ queryKey: ['correo-hilo', idCuenta, conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['correo-bandeja', idCuenta] });
    },
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo enviar.'),
  });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-2.5">
        <h2 className="truncate font-semibold text-gray-800">
          {mensajes[0]?.subject ?? '(sin asunto)'}
        </h2>
      </div>
      <div className="flex-1 space-y-3 overflow-auto p-4">
        {isLoading && <p className="text-sm text-gray-400">Cargando…</p>}
        {mensajes.map((m) => (
          <MensajeBloque key={m.id} m={m} />
        ))}
      </div>

      {/* Responder */}
      <div className="border-t p-3">
        {error && <div className="mb-2 rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-700">{error}</div>}
        <textarea
          value={respuesta}
          onChange={(e) => setRespuesta(e.target.value)}
          rows={3}
          placeholder="Escribe tu respuesta…"
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
            disabled={enviar.isPending || !respuesta.trim() || !idResponder}
            className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039] disabled:opacity-50"
          >
            {enviar.isPending ? 'Enviando…' : 'Responder'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MensajeBloque({ m }: { m: MensajeCorreo }) {
  const esEnviado = m.tipo === 'sent';
  return (
    <div className={`rounded-lg border p-3 ${esEnviado ? 'border-[#3f5b87]/30 bg-[#3f5b87]/5' : 'bg-white'}`}>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-gray-700">
          {esEnviado ? 'Tú' : (m.fromEmail ?? '—')}
        </span>
        <span className="text-gray-400">{fechaHora(m.fecha)}</span>
      </div>
      <div className="whitespace-pre-wrap break-words text-sm text-gray-700">
        {m.bodyText || '(sin contenido de texto)'}
      </div>
      {m.adjuntos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {m.adjuntos.map((a) =>
            esUrl(a.url) ? (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700 hover:bg-amber-100"
              >
                📎 {a.filename ?? 'adjunto'}
              </a>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
