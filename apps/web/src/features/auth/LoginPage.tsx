import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from './useAuth';
import { ApiRequestError } from '@/lib/api';
import { Logo } from '@/components/Logo';
import { IconEye, IconEyeOff } from '@/components/icons';
import { STORAGE } from '@/lib/constants';

export function LoginPage() {
  const { estado, login } = useAuth();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Autocompletar el último usuario que inició sesión (nunca la contraseña).
  useEffect(() => {
    const ultimo = localStorage.getItem(STORAGE.ultimoUsuario);
    if (ultimo) setUsuario(ultimo);
  }, []);

  // Tras iniciar sesión, siempre al landing.
  if (estado === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const usuarioLimpio = usuario.trim();
      await login(usuarioLimpio, password);
      localStorage.setItem(STORAGE.ultimoUsuario, usuarioLimpio);
      navigate('/', { replace: true });
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : 'No se pudo iniciar sesión.';
      setError(msg);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-white md:flex-row">
      {/* Columna del logo (arriba en móvil, izquierda en escritorio) */}
      <div className="flex items-center justify-center p-6 md:w-1/2 md:p-10">
        <Logo fondo="claro" />
      </div>

      {/* Columna del formulario */}
      <div className="flex flex-1 items-center justify-center p-6 md:p-10">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold text-[#3f5b87]">
              Inicio sesión
            </h1>
            <p className="text-sm text-gray-500">
              Comencemos llenando el formulario a continuación.
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Usuario */}
          <div className="relative">
            <label
              htmlFor="usuario"
              className="absolute -top-2 left-3 bg-white px-1 text-xs font-medium text-gray-500"
            >
              Usuario o correo
            </label>
            <input
              id="usuario"
              type="text"
              autoComplete="username"
              autoFocus
              required
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="ej. jereff  o  jereff@aceleremos.com"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-[#3f5b87] focus:ring-2 focus:ring-[#3f5b87]/30"
            />
          </div>

          {/* Contraseña */}
          <div className="relative">
            <label
              htmlFor="password"
              className="absolute -top-2 left-3 bg-white px-1 text-xs font-medium text-gray-500"
            >
              Contraseña
            </label>
            <input
              id="password"
              type={verPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-11 text-sm outline-none focus:border-[#3f5b87] focus:ring-2 focus:ring-[#3f5b87]/30"
            />
            <button
              type="button"
              onClick={() => setVerPassword((v) => !v)}
              aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {verPassword ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-xl bg-[#1f2a4d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#172039] disabled:opacity-60"
          >
            {enviando ? 'Entrando…' : 'Iniciar Sesión'}
          </button>

          <p className="text-center text-sm text-gray-500">
            ¿Olvidaste tu contraseña?{' '}
            <Link
              to="/recuperar"
              className="font-semibold text-[#3f5b87] hover:underline"
            >
              Recupérala
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
