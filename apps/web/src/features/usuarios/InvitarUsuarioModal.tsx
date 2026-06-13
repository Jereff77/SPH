import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { invitacionesApi, type ResultadoInvitar } from './invitaciones.api';
import { ApiRequestError } from '@/lib/api';

interface Props {
  onClose: () => void;
  /** Se invoca tras invitar con éxito (para refrescar la lista). */
  onInvitado: () => void;
}

/**
 * Modal para invitar a un usuario por correo. El backend valida el dominio: si no
 * está autorizado, agrega el correo a los autorizados automáticamente.
 */
export function InvitarUsuarioModal({ onClose, onInvitado }: Props) {
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoInvitar | null>(null);

  const m = useMutation({
    mutationFn: () =>
      invitacionesApi.invitar({
        email: email.trim().toLowerCase(),
        nombre: nombre.trim(),
        apellidos: apellidos.trim(),
      }),
    onSuccess: (r) => {
      setResultado(r);
      onInvitado();
    },
    onError: (e) =>
      setError(
        e instanceof ApiRequestError ? e.message : 'No se pudo enviar la invitación.',
      ),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    m.mutate();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">Invitar usuario</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {resultado ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
              <p className="font-semibold">
                Invitación creada para {resultado.email}.
              </p>
              <p className="mt-1">
                {resultado.enviado
                  ? 'Se envió el correo con el enlace de registro.'
                  : '⚠️ La invitación se creó, pero no se pudo enviar el correo (revisa la configuración SMTP). Puedes reenviarla desde la lista.'}
              </p>
              {resultado.agregadoACorreos && (
                <p className="mt-1 text-green-700">
                  El dominio no estaba autorizado: el correo se agregó
                  automáticamente a los correos autorizados.
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-[#1f2a4d] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#172039]"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Correo
              </label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="persona@empresa.com"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-[#3f5b87] focus:ring-2 focus:ring-[#3f5b87]/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Nombre
                </label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-[#3f5b87] focus:ring-2 focus:ring-[#3f5b87]/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Apellidos
                </label>
                <input
                  type="text"
                  required
                  value={apellidos}
                  onChange={(e) => setApellidos(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-[#3f5b87] focus:ring-2 focus:ring-[#3f5b87]/30"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={m.isPending}
                className="flex-1 rounded-xl bg-[#1f2a4d] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#172039] disabled:opacity-60"
              >
                {m.isPending ? 'Enviando…' : 'Enviar invitación'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
