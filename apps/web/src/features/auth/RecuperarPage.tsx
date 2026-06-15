import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from './auth.api';
import { Logo } from '@/components/Logo';

/**
 * Recuperación de contraseña (público). El usuario ingresa su usuario o correo;
 * el backend dispara el correo de recuperación de Supabase (mismo mecanismo que
 * v1) con un enlace de retorno a /restablecer. La respuesta es SIEMPRE genérica
 * (no revela si la cuenta existe), por lo que tras enviar mostramos el mismo
 * mensaje de confirmación pase lo que pase.
 */
export function RecuperarPage() {
  const [usuario, setUsuario] = useState('');
  const [enviado, setEnviado] = useState(false);

  const m = useMutation({
    mutationFn: () => authApi.recuperar(usuario.trim()),
    onSuccess: () => setEnviado(true),
    // Por seguridad (anti-enumeración) el backend responde 200 aunque el usuario
    // no exista; si llegara a fallar por otra causa, mostramos igualmente el aviso
    // genérico para no filtrar información.
    onError: () => setEnviado(true),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!usuario.trim()) return;
    m.mutate();
  }

  if (enviado) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white p-6">
        <Logo fondo="claro" />
        <div className="w-full max-w-sm space-y-3 text-center">
          <h1 className="text-2xl font-semibold text-[#3f5b87]">Revisa tu correo</h1>
          <p className="text-sm text-gray-500">
            Si existe una cuenta asociada, te enviamos un enlace para restablecer tu
            contraseña. El enlace caduca pronto, úsalo cuanto antes. Revisa también la
            carpeta de spam.
          </p>
          <Link
            to="/login"
            className="inline-block text-sm font-semibold text-[#3f5b87] hover:underline"
          >
            Volver a iniciar sesión
          </Link>
        </div>
      </main>
    );
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
              ¿Olvidaste tu contraseña?
            </h1>
            <p className="text-sm text-gray-500">
              Ingresa tu usuario o correo y te enviaremos un enlace para recuperarla.
            </p>
          </div>

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

          <button
            type="submit"
            disabled={m.isPending || !usuario.trim()}
            className="w-full rounded-xl bg-[#1f2a4d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#172039] disabled:opacity-60"
          >
            {m.isPending ? 'Enviando…' : 'Enviar enlace de recuperación'}
          </button>

          <p className="text-center text-sm text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="font-semibold text-[#3f5b87] hover:underline">
              Inicia sesión
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
