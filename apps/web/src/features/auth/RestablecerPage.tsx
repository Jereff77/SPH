import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from './auth.api';
import { ApiRequestError } from '@/lib/api';
import { Logo } from '@/components/Logo';
import { IconEye, IconEyeOff } from '@/components/icons';

/**
 * Página PÚBLICA de restablecimiento. Supabase (flujo implícito, igual que v1)
 * devuelve el token de recovery en el FRAGMENTO de la URL
 * (`#access_token=...&type=recovery`). Aquí lo leemos una sola vez, lo borramos
 * del historial del navegador, y lo reenviamos al backend junto con la nueva
 * contraseña. El frontend NUNCA habla con Supabase: solo pasa el token al backend.
 */

interface DatosHash {
  accessToken: string | null;
  esRecovery: boolean;
  error: string | null;
}

/** Lee y consume (borra del historial) el fragmento que dejó Supabase. */
function leerHash(): DatosHash {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) {
    return { accessToken: null, esRecovery: false, error: null };
  }
  const p = new URLSearchParams(hash);
  // Supabase puede devolver un error en el fragmento (p. ej. enlace expirado).
  const error = p.get('error_description') ?? p.get('error');
  const accessToken = p.get('access_token');
  const type = p.get('type');
  // Limpiamos el fragmento para que el token no quede en el historial ni se
  // reenvíe al recargar la página.
  window.history.replaceState(null, '', window.location.pathname);
  return {
    accessToken,
    esRecovery: type === 'recovery' || Boolean(accessToken),
    error: error ? error.replace(/\+/g, ' ') : null,
  };
}

export function RestablecerPage() {
  // Lectura única del fragmento al montar (lazy init: no se re-ejecuta en renders).
  const [datos] = useState<DatosHash>(leerHash);

  if (datos.error || !datos.accessToken || !datos.esRecovery) {
    return (
      <Mensaje
        titulo="Enlace no válido"
        texto={
          datos.error ??
          'El enlace de recuperación no es válido o ha expirado. Solicita uno nuevo.'
        }
        accion={
          <Link
            to="/recuperar"
            className="inline-block rounded-xl bg-[#1f2a4d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#172039]"
          >
            Solicitar un nuevo enlace
          </Link>
        }
      />
    );
  }

  return <Formulario accessToken={datos.accessToken} />;
}

function Formulario({ accessToken }: { accessToken: string }) {
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const m = useMutation({
    mutationFn: () => authApi.restablecer(accessToken, nueva),
    onSuccess: () => setListo(true),
    onError: (e) =>
      setError(
        e instanceof ApiRequestError
          ? e.message
          : 'No se pudo restablecer la contraseña.',
      ),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (nueva.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (nueva !== confirmar) {
      setError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }
    m.mutate();
  }

  if (listo) {
    return (
      <Mensaje
        titulo="¡Contraseña actualizada!"
        texto="Tu contraseña se restableció correctamente. Ya puedes iniciar sesión con tu nueva contraseña."
        accion={
          <Link
            to="/login"
            className="inline-block rounded-xl bg-[#1f2a4d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#172039]"
          >
            Ir a iniciar sesión
          </Link>
        }
      />
    );
  }

  const inputCls =
    'w-full rounded-xl border border-gray-300 px-4 py-3 pr-11 text-sm outline-none focus:border-[#3f5b87] focus:ring-2 focus:ring-[#3f5b87]/30';

  return (
    <main className="flex min-h-screen flex-col bg-white md:flex-row">
      <div className="flex items-center justify-center p-6 md:w-1/2 md:p-10">
        <Logo fondo="claro" />
      </div>

      <div className="flex flex-1 items-center justify-center p-6 md:p-10">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold text-[#3f5b87]">
              Nueva contraseña
            </h1>
            <p className="text-sm text-gray-500">
              Define la contraseña con la que ingresarás a partir de ahora.
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="relative">
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Nueva contraseña
            </label>
            <input
              type={ver ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => setVer((v) => !v)}
              aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-3 top-[2.1rem] text-gray-400 hover:text-gray-600"
            >
              {ver ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Confirmar nueva contraseña
            </label>
            <input
              type={ver ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-[#3f5b87] focus:ring-2 focus:ring-[#3f5b87]/30"
            />
          </div>

          <button
            type="submit"
            disabled={m.isPending || !nueva || !confirmar}
            className="w-full rounded-xl bg-[#1f2a4d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#172039] disabled:opacity-60"
          >
            {m.isPending ? 'Guardando…' : 'Restablecer contraseña'}
          </button>

          <p className="text-center text-sm text-gray-500">
            <Link to="/login" className="font-semibold text-[#3f5b87] hover:underline">
              Volver a iniciar sesión
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}

function Mensaje({
  titulo,
  texto,
  accion,
}: {
  titulo: string;
  texto: string;
  accion?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white p-6">
      <Logo fondo="claro" />
      <div className="w-full max-w-sm space-y-3 text-center">
        <h1 className="text-2xl font-semibold text-[#3f5b87]">{titulo}</h1>
        <p className="text-sm text-gray-500">{texto}</p>
        {accion ?? (
          <Link
            to="/login"
            className="inline-block text-sm font-semibold text-[#3f5b87] hover:underline"
          >
            Volver a iniciar sesión
          </Link>
        )}
      </div>
    </main>
  );
}
